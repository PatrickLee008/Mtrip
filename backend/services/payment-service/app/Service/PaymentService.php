<?php

declare(strict_types=1);

namespace App\Service;

use App\Payment\KbzMmqrChannel;
use Hyperf\Database\Exception\QueryException;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Support\RedisLock;
use Psr\Log\LoggerInterface;

/**
 * 支付流水(方案 22 §4.2 / §6.1):下单出码、查询、与渠道状态收敛、落账(回调与查单共用)
 *
 * 流水 mtrip_business.pay_transaction,业务服务风格 Db::table 直查,不建 Model;时间统一 UTC。
 */
class PaymentService
{
    public const BIZ_TYPES = ['order', 'trip'];

    /** 同业务单金额变化 / 临近过期被新流水替代时的本地关闭原因(KBZ 侧码仍可能有效,reconcile 继续跟踪) */
    public const REASON_SUPERSEDED = 'SUPERSEDED';
    /** 被替代流水已在 KBZ 侧确认终态,不再跟踪 */
    public const REASON_SUPERSEDED_FINAL = 'SUPERSEDED_FINAL';

    /** 复用已有码的最小剩余有效期(秒):太短的码直接换新,避免用户扫到即过期 */
    private const REUSE_MIN_REMAIN = 60;

    /** pending 超过 expire_at 多久仍未付则关单(秒) */
    public const STALE_CLOSE_AFTER = 300;

    #[Inject]
    protected PayAccountResolver $resolver;

    #[Inject]
    protected BizNotifyService $notifier;

    #[Inject]
    protected RedisLock $lock;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    // ------------------------------------------------------------------ 下单

    /**
     * @return array{payNo: string, qrCode: string, amount: string, currency: string, expireAt: ?string, status: string}
     */
    public function create(array $in): array
    {
        $siteId = max(0, (int) ($in['siteId'] ?? 0));
        $bizType = trim((string) ($in['bizType'] ?? ''));
        if (! in_array($bizType, self::BIZ_TYPES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 bizType 仅支持 order / trip');
        }
        $bizNo = trim((string) ($in['bizNo'] ?? ''));
        if ($bizNo === '' || preg_match('/^[A-Za-z0-9_\-]{1,64}$/D', $bizNo) !== 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 bizNo 不合法');
        }
        $userId = max(0, (int) ($in['userId'] ?? 0));
        $amountCents = PaymentRules::toCents($in['amount'] ?? null);
        if ($amountCents === null || $amountCents <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 amount 须为大于 0 且不超过 2 位小数的金额');
        }
        $currency = strtoupper(trim((string) ($in['currency'] ?? '')));
        if ($currency === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 currency 不能为空');
        }
        $channel = trim((string) ($in['channel'] ?? '')) ?: KbzMmqrChannel::CODE;
        $subject = mb_substr(trim((string) ($in['subject'] ?? '')), 0, 255);
        $bizExpireAt = PaymentRules::parseUtc((string) ($in['expireAt'] ?? ''));
        if ($bizExpireAt === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 expireAt 须为 UTC 时间 Y-m-d H:i:s');
        }
        $notifyUrl = trim((string) ($in['notifyUrl'] ?? ''));
        if ($notifyUrl !== '' && (strlen($notifyUrl) > 255 || filter_var($notifyUrl, FILTER_VALIDATE_URL) === false
            || ! in_array(strtolower((string) parse_url($notifyUrl, PHP_URL_SCHEME)), ['http', 'https'], true))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 notifyUrl 不合法');
        }
        $callbackInfo = (string) ($in['callbackInfo'] ?? '');

        $input = compact('siteId', 'bizType', 'bizNo', 'userId', 'amountCents', 'currency', 'channel', 'subject',
            'bizExpireAt', 'notifyUrl', 'callbackInfo');
        return $this->lock->run(
            'mtrip:pay:create:' . $bizType . ':' . $bizNo,
            30,
            fn () => $this->doCreate($input),
            '该业务单正在发起支付,请稍候'
        );
    }

    private function doCreate(array $in): array
    {
        $now = time();
        // timeout_express = min(业务剩余分钟 - 1, 120),保证 KBZ 码先于业务订单过期(§6.1)
        $minutes = PaymentRules::timeoutMinutes($in['bizExpireAt'], $now);
        if ($minutes < 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '订单即将过期,请重新下单');
        }
        $paid = Db::table('pay_transaction')
            ->where('biz_type', $in['bizType'])->where('biz_no', $in['bizNo'])
            ->whereIn('status', [PaymentRules::PAY_PAID, PaymentRules::PAY_LATE])
            ->exists();
        if ($paid) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该业务单已支付,请勿重复支付');
        }

        // 幂等:未过期且金额币种渠道一致的 pending 流水直接返回;其余仍有效的 pending 本地关闭后新建
        $pendings = Db::table('pay_transaction')
            ->where('biz_type', $in['bizType'])->where('biz_no', $in['bizNo'])
            ->where('status', PaymentRules::PAY_PENDING)
            ->orderByDesc('id')->get();
        foreach ($pendings as $row) {
            $row = (array) $row;
            $expireAt = PaymentRules::parseUtc((string) $row['expire_at']);
            $alive = $expireAt !== null && $expireAt > $now;
            $same = PaymentRules::toCents((string) $row['amount']) === $in['amountCents']
                && (string) $row['currency'] === $in['currency']
                && (string) $row['channel_code'] === $in['channel']
                && (string) $row['qr_code'] !== '';
            if ($alive && $same && $expireAt - $now >= self::REUSE_MIN_REMAIN) {
                return $this->presentCreate($row);
            }
            if ($alive) {
                $closed = Db::table('pay_transaction')->where('id', $row['id'])->where('status', PaymentRules::PAY_PENDING)
                    ->update(['status' => PaymentRules::PAY_CLOSED, 'fail_reason' => self::REASON_SUPERSEDED]);
                if ($closed === 1) {
                    $this->logger()->info('pay_superseded', ['payNo' => $row['pay_no'], 'bizType' => $in['bizType'], 'bizNo' => $in['bizNo']]);
                }
            }
            // 已过期的 pending 交给 pay-reconcile 查单后关闭
        }

        $route = $this->resolver->resolveForCreate($in['siteId'], $in['channel'], $in['currency'], $in['amountCents']);
        $expireAt = PaymentRules::formatUtc($now + $minutes * 60);

        $row = [
            'site_id' => $in['siteId'],
            'user_id' => $in['userId'],
            'biz_type' => $in['bizType'],
            'biz_no' => $in['bizNo'],
            'channel_code' => $in['channel'],
            'account_id' => (int) $route['account']['id'],
            'binding_id' => (int) $route['binding']['id'],
            'amount' => PaymentRules::fromCents($in['amountCents']),
            'currency' => $in['currency'],
            'subject' => $in['subject'],
            'expire_at' => $expireAt,
            'status' => PaymentRules::PAY_PENDING,
            'biz_notify_url' => $in['notifyUrl'],
            'biz_notify_status' => PaymentRules::NOTIFY_NONE,
        ];
        [$id, $payNo] = $this->insertWithPayNo($row, $now);

        try {
            $result = (new KbzMmqrChannel($route['config']))->createPayment([
                'orderNo' => $payNo,
                'amount' => PaymentRules::fromCents($in['amountCents']),
                'currency' => $in['currency'],
                'subject' => mb_substr($in['subject'], 0, 64),
                'timeoutMinutes' => $minutes,
                'notifyUrl' => $route['notifyUrl'],
                'callbackInfo' => $in['callbackInfo'],
            ]);
        } catch (KbzPayException $e) {
            $this->markCreateFailed($id, $e->kind() . ':' . $e->kbzCode() . ' ' . $e->kbzMsg());
            $this->logger()->warning('pay_precreate_failed', ['payNo' => $payNo, 'kind' => $e->kind(), 'code' => $e->kbzCode()]);
            throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR,
                'KBZPay 下单失败' . ($e->kbzCode() !== '' ? '(' . $e->kbzCode() . ')' : '') . ',请稍后重试');
        } catch (\InvalidArgumentException $e) {
            $this->markCreateFailed($id, 'param:' . $e->getMessage());
            throw new BusinessException(ErrorCode::PARAM_ERROR, $e->getMessage());
        } catch (\Throwable $e) {
            $this->markCreateFailed($id, 'exception:' . $e::class);
            $this->logger()->error('pay_precreate_exception', ['payNo' => $payNo, 'exception' => $e::class]);
            throw new BusinessException(ErrorCode::SERVER_ERROR, '支付下单异常,请稍后重试');
        }

        Db::table('pay_transaction')->where('id', $id)->update([
            'prepay_id' => mb_substr($result['prepayId'], 0, 128),
            'qr_code' => mb_substr($result['qrCode'], 0, 1024),
        ]);
        $this->logger()->info('pay_created', ['payNo' => $payNo, 'bizType' => $in['bizType'], 'bizNo' => $in['bizNo'],
            'accountId' => $row['account_id'], 'bindingId' => $row['binding_id'], 'timeoutMinutes' => $minutes]);
        return $this->presentCreate((array) Db::table('pay_transaction')->where('id', $id)->first());
    }

    /** @return array{0: int, 1: string} */
    private function insertWithPayNo(array $row, int $now): array
    {
        for ($i = 0; $i < 3; ++$i) {
            $payNo = PaymentRules::generatePayNo($now);
            try {
                $id = (int) Db::table('pay_transaction')->insertGetId($row + ['pay_no' => $payNo]);
                return [$id, $payNo];
            } catch (QueryException $e) {
                if (! str_contains($e->getMessage(), 'Duplicate') || $i === 2) {
                    throw $e;
                }
            }
        }
        throw new BusinessException(ErrorCode::SERVER_ERROR, '支付单号生成失败');
    }

    private function markCreateFailed(int $id, string $reason): void
    {
        Db::table('pay_transaction')->where('id', $id)->where('status', PaymentRules::PAY_PENDING)
            ->update(['status' => PaymentRules::PAY_FAILED, 'fail_reason' => mb_substr($reason, 0, 255)]);
    }

    // ------------------------------------------------------------------ 查询

    public function query(array $in): array
    {
        $payNo = trim((string) ($in['payNo'] ?? ''));
        $query = Db::table('pay_transaction');
        if ($payNo !== '') {
            $query->where('pay_no', $payNo);
        } else {
            $bizType = trim((string) ($in['bizType'] ?? ''));
            $bizNo = trim((string) ($in['bizNo'] ?? ''));
            if ($bizType === '' || $bizNo === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 payNo 或 bizType + bizNo 不能为空');
            }
            $query->where('biz_type', $bizType)->where('biz_no', $bizNo)->orderByDesc('id');
        }
        $row = $query->first();
        if ($row === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '支付单不存在');
        }
        $row = (array) $row;
        if ((int) ($in['refresh'] ?? 0) === 1 && (int) $row['status'] === PaymentRules::PAY_PENDING) {
            $this->syncWithChannel($row, false);
            $row = (array) Db::table('pay_transaction')->where('id', $row['id'])->first();
        }
        return $this->presentQuery($row);
    }

    // ------------------------------------------------------------------ 渠道收敛(查单)

    /**
     * 查 KBZ 并收敛本地状态(refresh 查询与 pay-reconcile 共用)
     *
     * @param bool $closeIfStale 对账模式:WAIT_PAY/PAYING/查无此单且 expire_at 已过 5 分钟 → 关单
     * @return string 结果标记(日志用):skip / paid / closed / failed / pending / mismatch
     */
    public function syncWithChannel(array $tx, bool $closeIfStale): string
    {
        $superseded = (int) $tx['status'] === PaymentRules::PAY_CLOSED && (string) $tx['fail_reason'] === self::REASON_SUPERSEDED;
        if ((int) $tx['status'] !== PaymentRules::PAY_PENDING && ! $superseded) {
            return 'skip';
        }
        $expireAt = PaymentRules::parseUtc((string) $tx['expire_at']);
        $stale = $expireAt === null || $expireAt + self::STALE_CLOSE_AFTER < time();

        try {
            $result = (new KbzMmqrChannel($this->resolver->configForTransaction($tx)))->queryPayment((string) $tx['pay_no']);
        } catch (KbzPayException $e) {
            if ($e->kind() === KbzPayException::KIND_BUSINESS && KbzPayException::isOrderNotFound($e->kbzCode())) {
                if ($closeIfStale && $stale) {
                    return $this->closeFromChannel($tx, PaymentRules::PAY_CLOSED, 'KBZ_ORDER_NOT_FOUND', $superseded);
                }
                return 'pending';
            }
            // 网络 / 协议 / 签名:跳过,下轮再试
            $this->logger()->warning('pay_query_failed', ['payNo' => $tx['pay_no'], 'kind' => $e->kind(), 'code' => $e->kbzCode()]);
            return 'skip';
        } catch (BusinessException $e) {
            $this->logger()->error('pay_query_config_error', ['payNo' => $tx['pay_no'], 'message' => $e->getMessage()]);
            return 'skip';
        }

        $local = $result['localStatus'];
        if ($local === PaymentRules::PAY_PAID) {
            if (($result['amount'] !== '' && ! PaymentRules::amountEquals($result['amount'], (string) $tx['amount']))
                || ($result['currency'] !== '' && $result['currency'] !== (string) $tx['currency'])) {
                $this->markAmountMismatch($tx, $result['amount'], $result['currency'], 'query');
                return 'mismatch';
            }
            $raw = json_encode(['source' => 'queryorder', 'trade_status' => $result['tradeStatus'],
                'mm_order_id' => $result['channelTradeNo'], 'total_amount' => $result['amount'],
                'trans_currency' => $result['currency']], JSON_UNESCAPED_SLASHES);
            $this->settlePaid((int) $tx['id'], $result['channelTradeNo'], $raw === false ? null : $raw, 'query');
            return 'paid';
        }
        if ($local === PaymentRules::PAY_FAILED || $local === PaymentRules::PAY_CLOSED) {
            return $this->closeFromChannel($tx, $local, $result['tradeStatus'], $superseded);
        }
        if ($local === PaymentRules::PAY_PENDING && $closeIfStale && $stale) {
            // 本轮查单即「过期 5 分钟后的再查一次」,仍未付则本地关闭(KBZ 码已先于 expire_at 过期)
            return $this->closeFromChannel($tx, PaymentRules::PAY_CLOSED, 'EXPIRED_UNPAID:' . $result['tradeStatus'], $superseded);
        }
        if ($local === null) {
            $this->logger()->warning('pay_query_unknown_status', ['payNo' => $tx['pay_no'], 'tradeStatus' => $result['tradeStatus']]);
        }
        return 'pending';
    }

    private function closeFromChannel(array $tx, int $status, string $reason, bool $superseded): string
    {
        if ($superseded) {
            // 被替代流水保持 closed,仅标记已终结,不再跟踪
            Db::table('pay_transaction')->where('id', $tx['id'])->where('status', PaymentRules::PAY_CLOSED)
                ->where('fail_reason', self::REASON_SUPERSEDED)
                ->update(['fail_reason' => self::REASON_SUPERSEDED_FINAL]);
            return 'closed';
        }
        Db::table('pay_transaction')->where('id', $tx['id'])->where('status', PaymentRules::PAY_PENDING)
            ->update(['status' => $status, 'fail_reason' => mb_substr($reason, 0, 255)]);
        return $status === PaymentRules::PAY_FAILED ? 'failed' : 'closed';
    }

    // ------------------------------------------------------------------ 落账(回调与查单共用)

    /**
     * 置支付成功并写 outbox(幂等)
     *
     * 行锁 + 状态复检:仅 pending / closed / failed 可变 paid;已 paid/late 视为重复,直接返回。
     * 本地已关闭或失败后才确认:仍置 paid,late_paid=1(fail_reason 保留原关闭原因),通知带 lateAfterClose=true,
     * 恢复订单还是退款由业务方(阶段 5 order-service)决定。
     *
     * @return bool 本次是否发生状态变更
     */
    public function settlePaid(int $txId, string $channelTradeNo, ?string $notifyRaw, string $source): bool
    {
        $outcome = Db::transaction(function () use ($txId, $channelTradeNo, $notifyRaw) {
            $row = Db::table('pay_transaction')->where('id', $txId)->lockForUpdate()->first();
            if ($row === null) {
                return null;
            }
            $row = (array) $row;
            $status = (int) $row['status'];
            if (in_array($status, [PaymentRules::PAY_PAID, PaymentRules::PAY_LATE], true)) {
                if ($notifyRaw !== null && (string) ($row['notify_raw'] ?? '') === '') {
                    Db::table('pay_transaction')->where('id', $txId)->update(['notify_raw' => $notifyRaw]);
                }
                return ['changed' => false, 'late' => false, 'row' => $row];
            }
            if (! in_array($status, [PaymentRules::PAY_PENDING, PaymentRules::PAY_CLOSED, PaymentRules::PAY_FAILED], true)) {
                return ['changed' => false, 'late' => false, 'row' => $row];
            }
            $late = $status !== PaymentRules::PAY_PENDING;
            $update = [
                'status' => PaymentRules::PAY_PAID,
                'paid_at' => gmdate('Y-m-d H:i:s'),
                'channel_trade_no' => $channelTradeNo !== '' ? mb_substr($channelTradeNo, 0, 64) : (string) $row['channel_trade_no'],
                'late_paid' => $late ? 1 : 0,
                'fail_reason' => $late ? (string) $row['fail_reason'] : '',
                'biz_notify_status' => (string) $row['biz_notify_url'] !== '' ? PaymentRules::NOTIFY_PENDING : PaymentRules::NOTIFY_NONE,
                'biz_notify_tries' => 0,
                'biz_notify_next_at' => gmdate('Y-m-d H:i:s'),
            ];
            if ($notifyRaw !== null) {
                $update['notify_raw'] = $notifyRaw;
            }
            Db::table('pay_transaction')->where('id', $txId)->update($update);
            return ['changed' => true, 'late' => $late, 'row' => $row];
        });

        if ($outcome === null || ! $outcome['changed']) {
            return false;
        }
        $context = ['payNo' => $outcome['row']['pay_no'], 'bizType' => $outcome['row']['biz_type'],
            'bizNo' => $outcome['row']['biz_no'], 'source' => $source];
        if ($outcome['late']) {
            $this->logger()->error('pay_paid_after_close 流水本地已关闭后确认支付,需业务方恢复或退款',
                $context + ['previousStatus' => (int) $outcome['row']['status'], 'previousReason' => $outcome['row']['fail_reason']]);
        } else {
            $this->logger()->info('pay_paid', $context);
        }
        if ((string) $outcome['row']['biz_notify_url'] !== '') {
            $this->notifier->pushAsync(BizNotifyService::TABLE_PAY, $txId);
        }
        return true;
    }

    /** 渠道确认成功但金额/币种与流水不符:不置 paid,记 fail_reason 并告警(人工核查) */
    public function markAmountMismatch(array $tx, string $amount, string $currency, string $source): void
    {
        $reason = mb_substr(sprintf('AMOUNT_MISMATCH:%s %s via %s', $amount, $currency, $source), 0, 255);
        Db::table('pay_transaction')->where('id', $tx['id'])
            ->whereIn('status', [PaymentRules::PAY_PENDING, PaymentRules::PAY_CLOSED])
            ->update(['fail_reason' => $reason]);
        $this->logger()->error('pay_amount_mismatch 渠道金额/币种与流水不一致,未入账', [
            'payNo' => $tx['pay_no'], 'expected' => (string) $tx['amount'] . ' ' . (string) $tx['currency'],
            'actual' => $amount . ' ' . $currency, 'source' => $source,
        ]);
    }

    // ------------------------------------------------------------------ 出参

    private function presentCreate(array $row): array
    {
        return [
            'payNo' => (string) $row['pay_no'],
            'qrCode' => (string) $row['qr_code'],
            'amount' => (string) PaymentRules::normalizeAmount((string) $row['amount']),
            'currency' => (string) $row['currency'],
            'expireAt' => $row['expire_at'] === null ? null : (string) $row['expire_at'],
            'status' => PaymentRules::payStatusName((int) $row['status']),
        ];
    }

    private function presentQuery(array $row): array
    {
        // 退款配额:成功 + 处理中(与 RefundService 发起前 checkRefund 同口径),供业务方判定合并提交 / 超限退钱包
        $refunds = Db::table('pay_refund')->where('pay_no', (string) $row['pay_no'])
            ->whereIn('status', [PaymentRules::REFUND_PROCESSING, PaymentRules::REFUND_SUCCEEDED])
            ->get(['amount']);
        $refundedCents = 0;
        foreach ($refunds as $r) {
            $refundedCents += (int) PaymentRules::toCents((string) $r->amount);
        }
        return [
            'payNo' => (string) $row['pay_no'],
            'bizType' => (string) $row['biz_type'],
            'bizNo' => (string) $row['biz_no'],
            'status' => PaymentRules::payStatusName((int) $row['status']),
            'amount' => (string) PaymentRules::normalizeAmount((string) $row['amount']),
            'currency' => (string) $row['currency'],
            'channelTradeNo' => (string) $row['channel_trade_no'],
            'paidAt' => $row['paid_at'] === null ? null : (string) $row['paid_at'],
            'expireAt' => $row['expire_at'] === null ? null : (string) $row['expire_at'],
            'qrCode' => (int) $row['status'] === PaymentRules::PAY_PENDING ? (string) $row['qr_code'] : '',
            'lateAfterClose' => (int) ($row['late_paid'] ?? 0) === 1,
            'refundCount' => count($refunds),
            'refundedAmount' => PaymentRules::fromCents($refundedCents),
            'maxRefundTimes' => PaymentRules::MAX_REFUND_TIMES,
        ];
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment');
    }
}
