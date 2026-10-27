<?php

declare(strict_types=1);

namespace App\Service\Payment;

use App\Constants\BookingConst;
use App\Service\Booking\BookingEventService;
use App\Service\OrderPayService;
use App\Service\OrderStockService;
use App\Service\PricingService;
use App\Service\WalletService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\PaymentCenterClient;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Payment\SettleRules;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\RedisLock;
use Mtrip\Shared\Support\UserNotify;
use Psr\Log\LoggerInterface;

/**
 * 退款落账(方案 22 阶段 5 / §9.1 遗留 4、5):
 *
 * - 后台退款到账确认(钱包 / 人工原路)、KBZ 原路退款完成、超限改退钱包共用 completeRow(),不复制;
 * - KBZ 原路退款(pay_method=5 订单的原路退回、商户退款、迟到支付自动退款)不直接调支付中心,先**排队**
 *   (order_refund.channel_submit_status=1,pay_no 记原支付单):
 *     · 迟到支付全额退款、独立单支付(bizType=order)→ 立即提交;
 *     · 行程支付(bizType=trip,一笔钱对应多条预订)→ 等合并窗口(默认 5 分钟,env KBZ_REFUND_MERGE_SECONDS),
 *       crontab `kbz-refund-batch` 按 pay_no 把到期的排队行**合并为一次** createRefund(金额求和、新 refundNo,
 *       各行写同一 refund_trade_no,置 2 已提交)——KBZ 每笔支付最多退 3 次;
 *     · 提交前向支付中心取该支付已用次数(成功 + 处理中),已达上限 → 整批改退 mTrip 钱包(置 3,余额流水 + finance_flow)。
 * - 同一 refund_trade_no 且 status=2 的若干行为一个「退款组」,refunded / refund_failed 业务通知按 refundNo 收敛整组;
 * - 失败(含缺证书、支付中心拒绝)不改终态:退款单保持 2 退款中 + audit_remark 记原因 + 时间线失败事件,
 *   后台「确认到账」即重试(每次重试先查旧单仍在处理 / 已成功则不重发,否则重新判配额后换新 refundNo);
 * - 迟到支付退款单 late_pay=1:完成时**不动订单状态**(该笔钱从未计入订单),只记退款支出流水;不计入订单已退金额,
 *   也不阻塞该订单的商户 / 住客退款。
 * - 住客通知:原路 refund_completed_original / 超限转钱包 refund_completed_wallet_fallback /
 *   迟到 payment_late_refunded、payment_late_refund_failed(均经 UserNotify::order)。
 */
class RefundSettleService
{
    public const DEFAULT_NOTIFY_URL = 'http://order-service:9504/internal/v1/order/payment-notify';

    /** 与迟到支付落账共用的 payNo 维度锁,避免并发换号导致同一笔钱重复退款 */
    private const LOCK_PREFIX = 'mtrip:order:late-refund:';

    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected WalletService $walletService;

    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected OrderPayService $orderPay;

    #[Inject]
    protected RedisLock $lock;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    protected ?PaymentCenterClient $center = null;

    /** 业务通知地址:env ORDER_NOTIFY_URL 可覆盖 */
    public static function notifyUrl(): string
    {
        $url = self::env('ORDER_NOTIFY_URL');
        return $url !== '' ? $url : self::DEFAULT_NOTIFY_URL;
    }

    /** 行程支付退款合并窗口(秒):env KBZ_REFUND_MERGE_SECONDS 可覆盖,缺省 300,范围 0–3600 */
    public static function mergeWindowSeconds(): int
    {
        $value = self::env('KBZ_REFUND_MERGE_SECONDS');
        if ($value === '' || preg_match('/^\d{1,5}$/D', $value) !== 1) {
            return SettleRules::REFUND_MERGE_WINDOW_SECONDS;
        }
        return min((int) $value, 3600);
    }

    /** 退款单号(与既有退款单同一生成口径):R + yyyyMMddHHmmss + 6 位随机,21 位,满足 KBZ refund_request_no ≤32 */
    public static function newRefundNo(): string
    {
        return 'R' . date('YmdHis') . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public function center(): PaymentCenterClient
    {
        return $this->center ??= new PaymentCenterClient();
    }

    /** 是否走 KBZ 原路退款:迟到支付退款单,或 KBZ 支付订单的原路退回(refund_channel=2) */
    public static function isKbzRefund(array $refund, array $order): bool
    {
        return SettleRules::isChannelRefund(
            (int) ($refund['late_pay'] ?? 0) === 1,
            (int) ($refund['refund_channel'] ?? 1),
            (int) ($order['pay_method'] ?? 0),
        );
    }

    /** 订单是否 KBZ 支付(退款应原路退回) */
    public static function isKbzOrder(array $order): bool
    {
        return (int) ($order['pay_method'] ?? 0) === BookingConst::PAY_METHOD_KBZ_MMQR;
    }

    /**
     * 排队字段:调用方在自己的事务里随审批 / 建单一起写入,事务提交后再调 afterQueued()
     */
    public static function queueFields(array $order): array
    {
        return [
            'pay_no' => (string) ($order['pay_trade_no'] ?? ''),
            'channel_submit_status' => SettleRules::SUBMIT_QUEUED,
            'channel_queued_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * 已排队的 KBZ 退款单:独立单支付立即提交;行程支付等合并窗口(crontab kbz-refund-batch)
     *
     * 立即提交失败只记录不抛出(quiet),退款单保持退款中,后台「确认到账」可重试。
     *
     * @return array{status: string, refundNo: string, message: string} status: queued|processing|succeeded|failed|wallet
     */
    public function afterQueued(array $refund, array $order, int $operatorId): array
    {
        $tripPayment = (int) ($order['trip_id'] ?? 0) > 0;
        if (! SettleRules::submitImmediately((int) ($refund['late_pay'] ?? 0) === 1, $tripPayment)) {
            $minutes = (int) ceil(self::mergeWindowSeconds() / 60);
            return ['status' => 'queued', 'refundNo' => '',
                'message' => "已加入 KBZPay 原路退款队列,同一笔行程支付的退款将在约 {$minutes} 分钟后合并提交"];
        }
        return $this->submit($refund, $operatorId, true);
    }

    // ------------------------------------------------------------------ 迟到支付自动退款

    /**
     * 迟到支付 / 无法入账 → 原路全额退款(幂等可重入;始终立即提交,同样占用 KBZ 退款次数)
     *
     * 已有本 payNo 的迟到退款单:已完成 → 直接返回;$retry=true 时按 submit() 规则重试(进行中不重发)。
     * 否则在订单行锁内建退款单(每预订一条,金额按应付拆分、末条吸收差额)并记一笔迟到收入流水,再提交支付中心。
     *
     * @param array $p 通知字段 payNo / amount / currency
     * @param list<array> $orders 业务单下的预订(可为空:业务单不存在时只调支付中心退款)
     * @return array{status: string, refundNo: string}
     */
    public function startLateRefund(array $p, array $orders, string $reasonCode, bool $retry): array
    {
        $payNo = (string) $p['payNo'];
        return $this->lock->run(self::LOCK_PREFIX . $payNo, 60,
            fn () => $this->doStartLateRefund($p, $orders, $reasonCode, $retry), '迟到支付退款处理中');
    }

    private function doStartLateRefund(array $p, array $orders, string $reasonCode, bool $retry): array
    {
        $payNo = (string) $p['payNo'];
        $amountCents = (int) PaymentRules::toCents((string) ($p['amount'] ?? '0'));
        $text = self::lateReasonText($reasonCode);

        if ($orders === []) {
            // 业务单不存在(理论上不会发生):无单可挂,直接按 payNo 退款并告警,以支付中心 pay_refund 为准
            $refundNo = self::newRefundNo();
            try {
                $res = $this->center()->createRefund(['payNo' => $payNo, 'refundNo' => $refundNo,
                    'amount' => PaymentRules::fromCents($amountCents), 'reason' => 'Late payment auto refund (' . $reasonCode . ')',
                    'notifyUrl' => self::notifyUrl()]);
                $this->logger()->error('late_refund_orphan 业务单不存在,已按支付单原路退款', ['payNo' => $payNo, 'refundNo' => $refundNo, 'status' => $res['status'] ?? '']);
                return ['status' => (string) ($res['status'] ?? 'processing'), 'refundNo' => $refundNo];
            } catch (BusinessException $e) {
                $this->logger()->error('late_refund_orphan_failed 业务单不存在且退款失败,需人工处理', ['payNo' => $payNo, 'code' => $e->getCode(), 'message' => $e->getMessage()]);
                return ['status' => 'failed', 'refundNo' => $refundNo];
            }
        }

        $existing = $this->lateRows($payNo);
        if ($existing !== []) {
            foreach ($existing as $row) {
                if ((int) $row['status'] === 3) {
                    return ['status' => 'succeeded', 'refundNo' => (string) $row['refund_trade_no']];
                }
            }
            if (! $retry) {
                return ['status' => 'processing', 'refundNo' => (string) $existing[0]['refund_trade_no']];
            }
            // 已持有同一 payNo 锁,直接走无锁版本
            $r = $this->doSubmit((int) $existing[0]['id'], $payNo, 0, true);
            return ['status' => $r['status'], 'refundNo' => $r['refundNo']];
        }

        $created = Db::transaction(function () use ($orders, $payNo, $amountCents, $text) {
            $ids = array_map(static fn ($o) => (int) $o['id'], $orders);
            sort($ids);
            $locked = Db::table('order_main')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()
                ->map(static fn ($r) => (array) $r)->all();
            if ($this->lateRows($payNo) !== []) {
                return []; // 并发已建
            }
            $parts = SettleRules::splitCents($amountCents, array_map(
                static fn ($o) => (int) PaymentRules::toCents(number_format((float) $o['pay_amount'], 2, '.', '')), $locked));
            $now = date('Y-m-d H:i:s');
            foreach ($locked as $i => $o) {
                $amount = PaymentRules::fromCents($parts[$i]);
                Db::table('order_refund')->insert([
                    'refund_no' => self::newRefundNo(),
                    'site_id' => (int) $o['site_id'],
                    'order_id' => (int) $o['id'],
                    'order_no' => (string) $o['order_no'],
                    'user_id' => (int) $o['user_id'],
                    'merchant_id' => (int) $o['merchant_id'],
                    'property_id' => (int) $o['property_id'],
                    'room_type_id' => (int) $o['room_type_id'],
                    'refund_type' => 1,
                    'apply_amount' => $amount,
                    'refund_amount' => $amount,
                    'deduct_amount' => 0,
                    'refund_channel' => 2,
                    'reason' => mb_substr($text, 0, 500),
                    'status' => 2,
                    'platform_audit_time' => $now,
                    'refund_trade_no' => '',
                    'pay_no' => $payNo,
                    'late_pay' => 1,
                    'channel_submit_status' => SettleRules::SUBMIT_QUEUED,
                    'channel_queued_at' => $now,
                ]);
                // 钱确实到了平台:先记一笔收入,退款完成再记支出,对账两清
                if ($parts[$i] > 0) {
                    $this->orderPay->recordIncome($o, (float) $amount, BookingConst::PAY_METHOD_KBZ_MMQR, $payNo,
                        "订单 {$o['order_no']} KBZPay 迟到支付(将原路退回)");
                }
            }
            return $locked;
        });
        if ($created === []) {
            return ['status' => 'processing', 'refundNo' => ''];
        }

        // 迟到退款始终立即提交(同样先判配额;支付中心不可用则保持排队,由 kbz-refund-batch 补提交)
        $result = $this->dispatchRows($this->lateRows($payNo), $payNo, 0, true);
        $eventType = $result['status'] === 'failed' ? 'payment_late_refund_failed' : 'payment_late_refunded';
        foreach ($created as $o) {
            try {
                $this->events->log($o, $eventType, BookingConst::OPERATOR_SYSTEM, 0, '', $result['status'] === 'failed' ? 2 : 1, [
                    'payNo' => $payNo,
                    'refundNo' => $result['refundNo'],
                    'amount' => PaymentRules::fromCents($amountCents),
                    'currency' => (string) ($p['currency'] ?? ''),
                    'reason' => $reasonCode,
                    'refundStatus' => $result['status'],
                    'message' => $result['message'],
                ], 'refund');
            } catch (\Throwable) {
            }
        }
        // 失败通知由 failGroup 发(payment_late_refund_failed);转钱包由 walletFallback 发;其余告知已发起原路退款
        if (in_array($result['status'], ['queued', 'processing', 'succeeded'], true)) {
            $this->notifyUser($created[0], 'payment_late_refunded', PaymentRules::fromCents($amountCents));
        }
        $this->logger()->warning('late_refund_started', ['payNo' => $payNo, 'refundNo' => $result['refundNo'], 'reason' => $reasonCode,
            'status' => $result['status'], 'message' => $result['message']]);
        return ['status' => $result['status'], 'refundNo' => $result['refundNo']];
    }

    // ------------------------------------------------------------------ 后台 / 重试:提交 KBZ 原路退款

    /**
     * 提交(或重试)一张 KBZ 退款单所在的退款组;返回 {status: queued|processing|succeeded|failed|wallet, refundNo, message}
     *
     * - 已提交(channel_submit_status=2):旧 refundNo 仍在处理 → 不重发;已成功 → 直接收敛;失败 / 查无此单 → 重判配额后换新 refundNo 重发;
     * - 排队中:连同该支付单其余排队行一起立即合并提交(后台「确认到账」= 不等合并窗口)。
     * $quiet=true(自动 / 审批后立即提交)时失败只记录不抛出;后台「确认到账」(false)把失败原因抛给操作人。
     */
    public function submit(array $refund, int $operatorId, bool $quiet = false): array
    {
        $refund = (array) Db::table('order_refund')->where('id', (int) $refund['id'])->first();
        $payNo = (string) ($refund['pay_no'] ?? '');
        if ($payNo === '') {
            $payNo = (string) Db::table('order_main')->where('id', (int) $refund['order_id'])->value('pay_trade_no');
        }
        if (! PaymentRules::isValidPayNo($payNo)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单缺少 KBZPay 支付单号,无法原路退款');
        }
        return $this->lock->run(self::LOCK_PREFIX . $payNo, 60,
            fn () => $this->doSubmit((int) $refund['id'], $payNo, $operatorId, $quiet), '该支付单正在处理退款,请稍候');
    }

    private function doSubmit(int $refundId, string $payNo, int $operatorId, bool $quiet): array
    {
        $refund = (array) Db::table('order_refund')->where('id', $refundId)->first();
        if ((int) ($refund['status'] ?? -1) !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅退款中的退款单可提交原路退款');
        }
        $current = (string) $refund['refund_trade_no'];
        if ($current !== '' && (int) $refund['channel_submit_status'] !== SettleRules::SUBMIT_QUEUED) {
            try {
                $q = $this->center()->queryRefund($current);
                if (($q['status'] ?? '') === 'processing') {
                    return ['status' => 'processing', 'refundNo' => $current, 'message' => 'KBZPay 退款处理中,请等待结果'];
                }
                if (($q['status'] ?? '') === 'succeeded') {
                    $this->completeGroup($current, (string) ($q['channelRefundNo'] ?? ''), BookingConst::OPERATOR_PLATFORM, $operatorId);
                    return ['status' => 'succeeded', 'refundNo' => $current, 'message' => 'KBZPay 退款已成功'];
                }
            } catch (BusinessException $e) {
                if ($e->getCode() !== ErrorCode::NOT_FOUND) {
                    throw $e; // 支付中心不可用:不换号重发,避免旧单其实已受理造成重复退款
                }
            }
            $rows = $this->groupRows($current);
        } else {
            // 排队中:连同该支付单其余排队行合并提交
            $rows = $this->queuedRows($payNo);
            if (! in_array($refundId, array_map(static fn ($r) => (int) $r['id'], $rows), true)) {
                $rows[] = $refund;
            }
        }
        return $this->dispatchRows($rows, $payNo, $operatorId, $quiet);
    }

    // ------------------------------------------------------------------ crontab:合并提交

    /**
     * kbz-refund-batch(每分钟,singleton + onOneServer):排队行按 pay_no 聚合,到期批次一次提交
     */
    public function processQueue(): void
    {
        $rows = Db::table('order_refund')->where('channel_submit_status', SettleRules::SUBMIT_QUEUED)
            ->where('status', 2)->whereNull('deleted_at')->orderBy('id')->limit(500)
            ->get(['id', 'pay_no', 'late_pay', 'channel_queued_at'])
            ->map(static fn ($r) => [
                'id' => (int) $r->id,
                'payNo' => (string) $r->pay_no,
                'latePay' => (int) $r->late_pay === 1,
                'queuedAt' => $r->channel_queued_at !== null && ($ts = strtotime((string) $r->channel_queued_at)) !== false ? $ts : null,
            ])->all();
        if ($rows === []) {
            return;
        }
        foreach (SettleRules::dueRefundBatches($rows, time(), self::mergeWindowSeconds()) as $payNo => $ids) {
            try {
                $r = $this->lock->run(self::LOCK_PREFIX . $payNo, 60,
                    fn () => $this->dispatchRows($this->queuedRows((string) $payNo), (string) $payNo, 0, true), 'busy');
                $this->logger()->info('kbz_refund_batch', ['payNo' => $payNo, 'rows' => count($ids), 'status' => $r['status'], 'refundNo' => $r['refundNo']]);
            } catch (\Throwable $e) {
                $this->logger()->warning('kbz_refund_batch_skipped 下轮重试', ['payNo' => $payNo, 'exception' => $e::class, 'message' => $e->getMessage()]);
            }
        }
    }

    /**
     * 提交一批同一 pay_no 的退款行(须持有 payNo 锁):配额判定 → 超限改退钱包 / 合并为一次渠道退款
     *
     * @param list<array> $rows
     * @return array{status: string, refundNo: string, message: string}
     */
    private function dispatchRows(array $rows, string $payNo, int $operatorId, bool $quiet): array
    {
        $rows = array_values(array_filter($rows, static fn ($r) => (int) $r['status'] === 2));
        if ($rows === []) {
            return ['status' => 'processing', 'refundNo' => '', 'message' => '无待提交的退款单'];
        }
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        $amountCents = 0;
        $late = true;
        foreach ($rows as $r) {
            $amountCents += (int) PaymentRules::toCents(number_format((float) $r['refund_amount'], 2, '.', ''));
            $late = $late && (int) ($r['late_pay'] ?? 0) === 1;
        }

        // 1) 配额:该支付已用渠道退款次数(成功 + 处理中)
        $used = 0;
        try {
            $used = $this->center()->refundQuota($payNo)['refundCount'];
        } catch (BusinessException $e) {
            if ($e->getCode() !== ErrorCode::NOT_FOUND) {
                // 支付中心不可用:不提交、不改状态;排队行由 kbz-refund-batch 下轮重试
                $this->logger()->warning('kbz_refund_quota_unavailable', ['payNo' => $payNo, 'code' => $e->getCode(), 'message' => $e->getMessage()]);
                if (! $quiet) {
                    throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR, 'KBZPay 退款配额查询失败,请稍后重试:' . $e->getMessage());
                }
                $queued = array_filter($rows, static fn ($r) => (int) $r['channel_submit_status'] === SettleRules::SUBMIT_QUEUED);
                return count($queued) === count($rows)
                    ? ['status' => 'queued', 'refundNo' => '', 'message' => '支付中心暂不可用,退款已排队,稍后自动提交']
                    : ['status' => 'failed', 'refundNo' => (string) $rows[0]['refund_trade_no'], 'message' => '支付中心暂不可用,请稍后在「确认到账」重试'];
            }
            // 查无支付单:照常提交,由支付中心拒绝并走失败收敛(转人工),不在队列里空转
        }
        if (SettleRules::refundRoute($used) === SettleRules::ROUTE_WALLET) {
            return $this->walletFallback($rows, $payNo, $operatorId, $used);
        }

        // 2) 合并为一次渠道退款
        $newNo = self::newRefundNo();
        Db::table('order_refund')->whereIn('id', $ids)->where('status', 2)->update([
            'refund_trade_no' => $newNo,
            'pay_no' => $payNo,
            'channel_submit_status' => SettleRules::SUBMIT_SENT,
            'audit_remark' => '',
        ]);
        $result = $this->callCenter($payNo, $newNo, $amountCents, $late ? 'Late payment auto refund' : 'Booking refund');
        if ($result['ok']) {
            // 失败事件由 failGroup 统一记录
            foreach ($rows as $r) {
                $o = (array) Db::table('order_main')->where('id', (int) $r['order_id'])->first();
                try {
                    $this->events->log($o, 'refund_submitted',
                        $operatorId > 0 ? BookingConst::OPERATOR_PLATFORM : BookingConst::OPERATOR_SYSTEM, $operatorId, '', 1, [
                            'payNo' => $payNo, 'refundNo' => $newNo, 'amount' => PaymentRules::fromCents($amountCents),
                            'mergedRows' => count($rows), 'usedRefundTimes' => $used,
                            'refundStatus' => $result['status'], 'late' => $late,
                        ], 'refund');
                } catch (\Throwable) {
                }
            }
        }
        $this->applyCenterResult($newNo, $result, $operatorId);
        if (! $result['ok'] && ! $quiet) {
            throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR, 'KBZPay 原路退款发起失败:' . $result['error']);
        }
        $merged = count($rows) > 1 ? '(已合并 ' . count($rows) . ' 笔退款)' : '';
        return ['status' => $result['status'], 'refundNo' => $newNo, 'message' => match ($result['status']) {
            'succeeded' => 'KBZPay 原路退款已成功' . $merged,
            'processing' => '已提交 KBZPay 原路退款,处理中' . $merged,
            default => 'KBZPay 原路退款失败:' . $result['error'],
        }];
    }

    /**
     * 渠道退款次数已达上限:整批改退 mTrip 钱包(同一事务逐行完成,置 3 已转钱包、refund_channel=1)
     *
     * @param list<array> $rows
     */
    private function walletFallback(array $rows, string $payNo, int $operatorId, int $used): array
    {
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        $operatorType = $operatorId > 0 ? BookingConst::OPERATOR_PLATFORM : BookingConst::OPERATOR_SYSTEM;
        $suffix = '(KBZPay 该笔支付退款次数已达上限 ' . PaymentRules::MAX_REFUND_TIMES . ' 次,改退 mTrip 钱包)';
        $done = Db::transaction(function () use ($ids, $operatorType, $operatorId, $suffix) {
            $locked = Db::table('order_refund')->whereIn('id', $ids)->where('status', 2)->whereNull('deleted_at')
                ->orderBy('id')->lockForUpdate()->get()->map(static fn ($r) => (array) $r)->all();
            $done = [];
            foreach ($locked as $row) {
                $done[] = (int) $row['late_pay'] === 1
                    ? $this->completeLateRow($row, '', '', $operatorType, $operatorId, true)
                    : $this->completeRow($row, '', true, BookingConst::PAY_METHOD_KBZ_MMQR, $operatorType, $operatorId, $suffix);
                Db::table('order_refund')->where('id', (int) $row['id'])->update([
                    'channel_submit_status' => SettleRules::SUBMIT_WALLET,
                    'refund_channel' => 1,
                    'audit_remark' => 'KBZPay 该笔支付退款次数已达上限,已改退 mTrip 钱包',
                ]);
            }
            return $done;
        });
        foreach ($done as $d) {
            $this->notifyUser($d['order'], 'refund_completed_wallet_fallback', $d['refundAmount']);
        }
        $this->logger()->warning('kbz_refund_wallet_fallback 渠道退款次数已达上限,改退钱包', ['payNo' => $payNo, 'rows' => count($done), 'used' => $used]);
        return ['status' => 'wallet', 'refundNo' => '', 'message' => 'KBZPay 该笔支付退款次数已达上限,已改退 mTrip 钱包'];
    }

    // ------------------------------------------------------------------ 业务通知:refunded / refund_failed

    /** @return array{action: string} */
    public function onRefundNotify(array $body): array
    {
        $refundNo = trim((string) ($body['refundNo'] ?? ''));
        if (! PaymentRules::isValidRefundNo($refundNo)) {
            return ['action' => 'ignored'];
        }
        if ($this->groupRows($refundNo) === []) {
            return ['action' => 'ignored']; // 已收敛(同步结果先到)或旧 refundNo(已换号重试)
        }
        if (($body['event'] ?? '') === 'refunded') {
            $this->completeGroup($refundNo, (string) ($body['channelTradeNo'] ?? ''), BookingConst::OPERATOR_SYSTEM, 0);
            return ['action' => 'refunded'];
        }
        $this->failGroup($refundNo, (string) ($body['refundFailReason'] ?? ''));
        return ['action' => 'refund_failed'];
    }

    // ------------------------------------------------------------------ 收敛

    /** 退款组成功:逐行完成(同一事务,行锁 + 状态复检幂等),提交后通知住客(原路退回) */
    public function completeGroup(string $refundNo, string $channelRefundNo, int $operatorType, int $operatorId): void
    {
        $done = Db::transaction(function () use ($refundNo, $channelRefundNo, $operatorType, $operatorId) {
            $rows = Db::table('order_refund')->where('refund_trade_no', $refundNo)->where('status', 2)
                ->whereNull('deleted_at')->orderBy('id')->lockForUpdate()->get()->map(static fn ($r) => (array) $r)->all();
            $done = [];
            foreach ($rows as $row) {
                if ((int) $row['late_pay'] === 1) {
                    $done[] = $this->completeLateRow($row, $refundNo, $channelRefundNo, $operatorType, $operatorId, false);
                } else {
                    $done[] = $this->completeRow($row, $refundNo, false, BookingConst::PAY_METHOD_KBZ_MMQR, $operatorType, $operatorId,
                        '(KBZPay 原路退回' . ($channelRefundNo !== '' ? ',渠道单号 ' . $channelRefundNo : '') . ')');
                }
            }
            return $done;
        });
        foreach ($done as $d) {
            $this->notifyUser($d['order'], 'refund_completed_original', $d['refundAmount']);
        }
    }

    /** 退款组失败:保持 2 退款中,记原因与失败事件,等待后台重试;迟到退款通知住客「转人工」 */
    public function failGroup(string $refundNo, string $reason): void
    {
        $rows = $this->groupRows($refundNo);
        if ($rows === []) {
            return;
        }
        $reason = $reason !== '' ? $reason : 'unknown';
        Db::table('order_refund')->where('refund_trade_no', $refundNo)->where('status', 2)
            ->update(['audit_remark' => mb_substr('KBZPay 退款失败:' . $reason . '(可在「确认到账」重试)', 0, 500)]);
        $lateOrder = null;
        $lateCents = 0;
        foreach ($rows as $r) {
            $late = (int) $r['late_pay'] === 1;
            $o = (array) Db::table('order_main')->where('id', (int) $r['order_id'])->first();
            if ($late) {
                $lateOrder ??= $o;
                $lateCents += (int) PaymentRules::toCents(number_format((float) $r['refund_amount'], 2, '.', ''));
            }
            try {
                $this->events->log($o, $late ? 'payment_late_refund_failed' : 'refund_failed', BookingConst::OPERATOR_SYSTEM, 0, '', 2, [
                    'refundNo' => $refundNo, 'reason' => mb_substr($reason, 0, 200),
                ], 'refund');
            } catch (\Throwable) {
            }
        }
        if ($lateOrder !== null && $lateOrder !== []) {
            $this->notifyUser($lateOrder, 'payment_late_refund_failed', PaymentRules::fromCents($lateCents));
        }
        $this->logger()->error('kbz_refund_failed 原路退款失败,退款单保持退款中待人工重试', ['refundNo' => $refundNo, 'reason' => $reason]);
    }

    /**
     * 退款到账:退款单 → 3 已退款;订单退款状态 / 库存回补 / 返券 / 钱包入账 / 支出流水 / 时间线
     * (后台人工确认、KBZ 原路退款完成、超限改退钱包共用;须在事务内调用)
     *
     * - 部分退款:订单处于 5 退款中(住客申请)→ 回 1 已支付;其余状态不动(商户对已入住单的部分退款);
     * - 全额退款:订单 6 已退款;库存仅对未消耗的预订回补(已入住 / 已退房 / No-show 视为已消耗)。
     *
     * @return array{order: array, refundAmount: float, fullRefund: bool, late: bool}
     */
    public function completeRow(array $refund, string $tradeNo, bool $toWallet, int $payChannel, int $operatorType, int $operatorId, string $remarkSuffix = ''): array
    {
        $order = (array) Db::table('order_main')->where('id', (int) $refund['order_id'])->lockForUpdate()->first();
        if ($order === []) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '关联订单不存在');
        }
        $refundAmount = (float) $refund['refund_amount'];
        $refundedBefore = (float) Db::table('order_refund')->where('order_id', (int) $order['id'])->where('status', 3)
            ->where('late_pay', 0)->whereNull('deleted_at')->sum('refund_amount');
        $fullRefund = $refundedBefore + $refundAmount >= (float) $order['pay_amount'] - 0.001;
        $affected = Db::table('order_refund')->where('id', (int) $refund['id'])->where('status', 2)->update([
            'status' => 3,
            'refund_trade_no' => $tradeNo,
            'refund_time' => date('Y-m-d H:i:s'),
        ]);
        if ($affected !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '退款单状态已变更,请刷新');
        }
        $orderStatus = (int) $order['order_status'];
        Db::table('order_main')->where('id', $order['id'])->update([
            'order_status' => $fullRefund ? 6 : ($orderStatus === 5 ? 1 : $orderStatus),
            'refund_status' => $fullRefund ? 3 : 2,
            // M4:支付状态双写(部分退款/已退款)
            'payment_status' => $fullRefund ? BookingConst::PAY_REFUNDED : BookingConst::PAY_PARTIAL_REFUNDED,
            'version' => Db::raw('version + 1'),
        ]);
        if ($fullRefund) {
            // 全额退款回补库存(change_type=4);已入住 / 已退房 / No-show 视为已消耗不回补;部分退款订单仍有效不回补
            if (! in_array((int) ($order['booking_status'] ?? 0),
                [BookingConst::STATUS_CHECKED_IN, BookingConst::STATUS_CHECKED_OUT, BookingConst::STATUS_NO_SHOW], true)) {
                $this->stockService->refundRestore($order);
            }
            // 订单已关闭:返还优惠券(部分退款订单仍有效,券继续占用)
            $this->pricingService->releaseCoupon($order);
        }
        // 退款入 mTrip 钱包:行锁用户余额 + 前后快照写流水(change_type=3 退款)
        if ($toWallet && $refundAmount > 0) {
            $this->walletService->credit(
                (int) $refund['site_id'],
                (int) $order['user_id'],
                $refundAmount,
                3,
                (int) $refund['order_id'],
                $operatorId,
                "退款单 {$refund['refund_no']} 退入钱包",
            );
        }
        $this->recordRefundFlow($refund, $order, $refundAmount, $toWallet ? 0 : $payChannel, $tradeNo, $operatorId,
            "退款单 {$refund['refund_no']} 到账确认(" . ($toWallet ? '入mTrip钱包' : '原路退回') . ')' . $remarkSuffix);
        $this->events->log($order, 'refund_completed', $operatorType, $operatorId, '', 1, [
            'refundNo' => (string) $refund['refund_no'],
            'refundAmount' => $refundAmount,
            'fullRefund' => $fullRefund,
            'tradeNo' => $tradeNo,
            'toWallet' => $toWallet,
        ], 'refund');
        return ['order' => $order, 'refundAmount' => $refundAmount, 'fullRefund' => $fullRefund, 'late' => false];
    }

    /** 迟到支付退款完成:只收敛退款单 + 支出流水 + 时间线(超限时改入钱包),不动订单状态 / 库存 / 券 */
    private function completeLateRow(array $refund, string $refundNo, string $channelRefundNo, int $operatorType, int $operatorId, bool $toWallet): array
    {
        $order = (array) Db::table('order_main')->where('id', (int) $refund['order_id'])->first();
        $refundAmount = (float) $refund['refund_amount'];
        $affected = Db::table('order_refund')->where('id', (int) $refund['id'])->where('status', 2)->update([
            'status' => 3,
            'refund_time' => date('Y-m-d H:i:s'),
        ]);
        if ($affected !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '退款单状态已变更,请刷新');
        }
        if ($toWallet && $refundAmount > 0) {
            $this->walletService->credit(
                (int) $refund['site_id'],
                (int) ($order['user_id'] ?? $refund['user_id']),
                $refundAmount,
                3,
                (int) $refund['order_id'],
                $operatorId,
                "迟到支付退款单 {$refund['refund_no']} 退入钱包",
            );
        }
        $this->recordRefundFlow($refund, $order, $refundAmount, $toWallet ? 0 : BookingConst::PAY_METHOD_KBZ_MMQR, $refundNo, $operatorId,
            "退款单 {$refund['refund_no']} KBZPay 迟到支付" . ($toWallet
                ? '退入 mTrip 钱包(渠道退款次数已达上限)'
                : '原路退回' . ($channelRefundNo !== '' ? '(渠道单号 ' . $channelRefundNo . ')' : '')));
        $this->events->log($order, 'refund_completed', $operatorType, $operatorId, '', 1, [
            'refundNo' => (string) $refund['refund_no'],
            'channelRefundNo' => $channelRefundNo,
            'refundAmount' => $refundAmount,
            'latePayNo' => (string) $refund['pay_no'],
            'toWallet' => $toWallet,
        ], 'refund');
        return ['order' => $order, 'refundAmount' => $refundAmount, 'fullRefund' => true, 'late' => true];
    }

    private function recordRefundFlow(array $refund, array $order, float $amount, int $payChannel, string $tradeNo, int $operatorId, string $remark): void
    {
        Db::table('finance_flow')->insert([
            'flow_no' => OrderNoGenerator::flowNo(),
            'site_id' => (int) $refund['site_id'],
            'flow_type' => 2,
            'biz_type' => 2,
            'amount' => $amount,
            'order_id' => (int) $refund['order_id'],
            'merchant_id' => (int) $refund['merchant_id'],
            'property_id' => (int) ($refund['property_id'] ?? 0),
            'room_type_id' => (int) ($refund['room_type_id'] ?? 0),
            'user_id' => (int) ($order['user_id'] ?? $refund['user_id']),
            'pay_channel' => $payChannel,
            'trade_no' => $tradeNo,
            'flow_status' => 1,
            'remark' => mb_substr($remark, 0, 500),
            'operator_id' => $operatorId,
        ]);
    }

    // ------------------------------------------------------------------ 内部

    /**
     * 调支付中心退款;业务错误(缺证书 / 超次数 / 金额超限)与不可用都归为失败,不抛出
     *
     * @return array{ok: bool, status: string, channelRefundNo: string, error: string}
     */
    private function callCenter(string $payNo, string $refundNo, int $amountCents, string $reason): array
    {
        try {
            $res = $this->center()->createRefund([
                'payNo' => $payNo,
                'refundNo' => $refundNo,
                'amount' => PaymentRules::fromCents($amountCents),
                'reason' => $reason,
                'notifyUrl' => self::notifyUrl(),
            ]);
        } catch (BusinessException $e) {
            return ['ok' => false, 'status' => 'failed', 'channelRefundNo' => '', 'error' => mb_substr($e->getMessage(), 0, 200)];
        }
        $status = (string) ($res['status'] ?? 'processing');
        return [
            'ok' => $status !== 'failed',
            'status' => $status,
            'channelRefundNo' => (string) ($res['channelRefundNo'] ?? ''),
            'error' => $status === 'failed' ? mb_substr((string) ($res['failReason'] ?? 'refund failed'), 0, 200) : '',
        ];
    }

    /** 支付中心同步结果收敛:succeeded → 完成;failed → 失败;processing → 等通知 */
    private function applyCenterResult(string $refundNo, array $result, int $operatorId = 0): void
    {
        if ($result['status'] === 'succeeded') {
            $this->completeGroup($refundNo, $result['channelRefundNo'],
                $operatorId > 0 ? BookingConst::OPERATOR_PLATFORM : BookingConst::OPERATOR_SYSTEM, $operatorId);
        } elseif ($result['status'] === 'failed') {
            $this->failGroup($refundNo, $result['error']);
        }
    }

    /** @return list<array> 同一 refund_trade_no 且仍在退款中的行 */
    private function groupRows(string $refundNo): array
    {
        return Db::table('order_refund')->where('refund_trade_no', $refundNo)->where('status', 2)
            ->whereNull('deleted_at')->orderBy('id')->get()->map(static fn ($r) => (array) $r)->all();
    }

    /** @return list<array> 本 payNo 排队待提交的行 */
    private function queuedRows(string $payNo): array
    {
        return Db::table('order_refund')->where('pay_no', $payNo)->where('channel_submit_status', SettleRules::SUBMIT_QUEUED)
            ->where('status', 2)->whereNull('deleted_at')->orderBy('id')->get()->map(static fn ($r) => (array) $r)->all();
    }

    /** 本 payNo 是否已发起过迟到支付退款(任意状态) */
    public function hasLateRefund(string $payNo): bool
    {
        return $this->lateRows($payNo) !== [];
    }

    /** @return list<array> 本 payNo 的迟到支付退款单(任意状态) */
    private function lateRows(string $payNo): array
    {
        return Db::table('order_refund')->where('pay_no', $payNo)->where('late_pay', 1)
            ->whereNull('deleted_at')->orderBy('id')->get()->map(static fn ($r) => (array) $r)->all();
    }

    private static function lateReasonText(string $reasonCode): string
    {
        return match (true) {
            str_starts_with($reasonCode, 'cancelled') => 'KBZPay 支付到账时订单已取消,自动原路全额退款',
            str_starts_with($reasonCode, 'amount_mismatch') => 'KBZPay 到账金额与订单应付不一致,自动原路全额退款',
            str_starts_with($reasonCode, 'recover_failed') => 'KBZPay 支付超时后到账且无法恢复(库存 / 优惠券不可用),自动原路全额退款',
            str_starts_with($reasonCode, 'confirm_failed') => 'KBZPay 到账但订单无法确认,自动原路全额退款',
            default => 'KBZPay 支付到账时订单不可入账,自动原路全额退款',
        } . '(' . mb_substr($reasonCode, 0, 120) . ')';
    }

    /** 住客站内通知(UserNotify 事件表;后置容错,失败不影响落账) */
    public function notifyUser(array $order, string $event, float|string $amount): void
    {
        if ($order === [] || (int) ($order['user_id'] ?? 0) <= 0) {
            return;
        }
        try {
            UserNotify::order($order, $event, ['amount' => $amount]);
        } catch (\Throwable) {
        }
    }

    private static function env(string $key): string
    {
        $value = function_exists('Hyperf\Support\env') ? \Hyperf\Support\env($key, '') : getenv($key);
        return is_string($value) ? trim($value) : '';
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-settle');
    }
}
