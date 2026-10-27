<?php

declare(strict_types=1);

namespace App\Service;

use App\Payment\KbzMmqrChannel;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Pay\KbzPay\KbzAccountConfig;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Support\RedisLock;
use Psr\Log\LoggerInterface;

/**
 * 退款(方案 22 §1「退款」/ §4.3 pay_refund)
 *
 * - refundNo 即 KBZ refund_request_no(字母数字下划线 ≤32),唯一幂等;
 * - 前置:原流水已支付(paid / late)、累计(成功+处理中)不超原额、成功+处理中次数 < 3;
 * - 先落 processing 行再调 KBZ(mTLS,证书从账户解密后交给 KbzAccountConfig,仅内存/0600 临时文件);
 * - KBZ 明确失败 → failed;网络超时 / 响应验签失败等「结果未知」→ 保持 processing,由 refund-sync 查单收敛;
 * - 终态写 outbox(refunded / refund_failed)。
 *
 * 退款状态查询协议依据:官方 SDK QueryOrderRequest 支持 refund_request_no,故用 queryorder(v3)+ refund_request_no,
 * 从响应顶层 refund_status 或 refund_info 数组中按 refund_request_no 匹配(字段名为推断,联调校准)。
 */
class RefundService
{
    /** 创建时 KBZ 结果未知(网络 / 验签 / 协议),refund-sync 查不到时允许以同一 refund_request_no 重发一次 */
    public const REASON_UNCONFIRMED = 'UNCONFIRMED_SEND';
    public const REASON_RESENT = 'RESENT';

    /** 处理中超过该时长仍查不到的退款不再自动处理,只告警(秒) */
    private const GIVE_UP_AFTER = 86400;

    #[Inject]
    protected PayAccountResolver $resolver;

    #[Inject]
    protected BizNotifyService $notifier;

    #[Inject]
    protected RedisLock $lock;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    // ------------------------------------------------------------------ 发起

    public function create(array $in): array
    {
        $payNo = trim((string) ($in['payNo'] ?? ''));
        $refundNo = trim((string) ($in['refundNo'] ?? ''));
        if (! PaymentRules::isValidPayNo($payNo)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 payNo 不合法');
        }
        if (! PaymentRules::isValidRefundNo($refundNo)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 refundNo 仅允许字母数字下划线且不超过 32 位');
        }
        $amountCents = PaymentRules::toCents($in['amount'] ?? null);
        if ($amountCents === null || $amountCents <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 amount 须为大于 0 且不超过 2 位小数的金额');
        }
        $reason = mb_substr(trim((string) ($in['reason'] ?? '')), 0, 255);
        if ($reason === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 reason 不能为空');
        }
        $notifyUrl = trim((string) ($in['notifyUrl'] ?? ''));
        if ($notifyUrl !== '' && (strlen($notifyUrl) > 255 || filter_var($notifyUrl, FILTER_VALIDATE_URL) === false
            || ! in_array(strtolower((string) parse_url($notifyUrl, PHP_URL_SCHEME)), ['http', 'https'], true))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 notifyUrl 不合法');
        }

        if (($existing = $this->findIdempotent($refundNo, $payNo, $amountCents)) !== null) {
            return $existing;
        }
        return $this->lock->run(
            'mtrip:pay:refund:' . $payNo,
            60,
            fn () => $this->doCreate($payNo, $refundNo, $amountCents, $reason, $notifyUrl),
            '该支付单正在处理退款,请稍候'
        );
    }

    private function doCreate(string $payNo, string $refundNo, int $amountCents, string $reason, string $notifyUrl): array
    {
        if (($existing = $this->findIdempotent($refundNo, $payNo, $amountCents)) !== null) {
            return $existing;
        }
        $tx = Db::table('pay_transaction')->where('pay_no', $payNo)->first();
        if ($tx === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '支付单不存在');
        }
        $tx = (array) $tx;
        if ((string) $tx['channel_code'] !== KbzMmqrChannel::CODE) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '暂不支持该渠道退款');
        }
        $config = $this->resolver->configForTransaction($tx, true);
        if (! $config->hasRefundCert()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '收款账户未配置退款证书(或解密失败),无法退款');
        }

        $refundId = Db::transaction(function () use ($tx, $payNo, $refundNo, $amountCents, $reason, $notifyUrl) {
            $locked = (array) Db::table('pay_transaction')->where('id', $tx['id'])->lockForUpdate()->first();
            if (! in_array((int) $locked['status'], [PaymentRules::PAY_PAID, PaymentRules::PAY_LATE], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '原支付未成功,不能退款');
            }
            $active = Db::table('pay_refund')->where('pay_no', $payNo)
                ->whereIn('status', [PaymentRules::REFUND_PROCESSING, PaymentRules::REFUND_SUCCEEDED])
                ->get(['amount']);
            $activeCents = 0;
            foreach ($active as $r) {
                $activeCents += (int) PaymentRules::toCents((string) $r->amount);
            }
            $error = PaymentRules::checkRefund((int) PaymentRules::toCents((string) $locked['amount']), $activeCents, count($active), $amountCents);
            if ($error !== null) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, $error);
            }
            return (int) Db::table('pay_refund')->insertGetId([
                'refund_no' => $refundNo,
                'pay_no' => $payNo,
                'site_id' => (int) $locked['site_id'],
                'amount' => PaymentRules::fromCents($amountCents),
                'currency' => (string) $locked['currency'],
                'reason' => $reason,
                'status' => PaymentRules::REFUND_PROCESSING,
                'biz_notify_url' => $notifyUrl,
                'biz_notify_status' => PaymentRules::NOTIFY_NONE,
            ]);
        });

        $this->sendToChannel($refundId, $tx, $config);
        return $this->present((array) Db::table('pay_refund')->where('id', $refundId)->first());
    }

    /**
     * 调 KBZ 退款并按结果收敛;$config 必须含证书
     */
    private function sendToChannel(int $refundId, array $tx, KbzAccountConfig $config): void
    {
        $refund = (array) Db::table('pay_refund')->where('id', $refundId)->first();
        try {
            $result = (new KbzMmqrChannel($config))->createRefund([
                'refundNo' => (string) $refund['refund_no'],
                'orderNo' => (string) $tx['pay_no'],
                'amount' => PaymentRules::fromCents((int) PaymentRules::toCents((string) $refund['amount'])),
                'reason' => (string) $refund['reason'],
            ]);
        } catch (KbzPayException $e) {
            if ($this->isUnknownOutcome($e)) {
                Db::table('pay_refund')->where('id', $refundId)->where('status', PaymentRules::REFUND_PROCESSING)
                    ->where('fail_reason', '')->update(['fail_reason' => self::REASON_UNCONFIRMED]);
                $this->logger()->warning('refund_send_unconfirmed', ['refundNo' => $refund['refund_no'], 'kind' => $e->kind(), 'code' => $e->kbzCode()]);
                return;
            }
            $this->finalize($refundId, PaymentRules::REFUND_FAILED, '', $e->kind() . ':' . $e->kbzCode() . ' ' . $e->kbzMsg(), null);
            $this->logger()->warning('refund_failed', ['refundNo' => $refund['refund_no'], 'kind' => $e->kind(), 'code' => $e->kbzCode()]);
            return;
        } catch (\InvalidArgumentException $e) {
            $this->finalize($refundId, PaymentRules::REFUND_FAILED, '', 'param:' . $e->getMessage(), null);
            return;
        } catch (\Throwable $e) {
            // 结果未知(可能已发出):保持 processing,交给 refund-sync
            Db::table('pay_refund')->where('id', $refundId)->where('status', PaymentRules::REFUND_PROCESSING)
                ->where('fail_reason', '')->update(['fail_reason' => self::REASON_UNCONFIRMED]);
            $this->logger()->error('refund_send_exception', ['refundNo' => $refund['refund_no'], 'exception' => $e::class]);
            return;
        }

        $raw = json_encode(['source' => 'refund', 'refund_status' => $result['refundStatus'],
            'channel_refund_no' => $result['channelRefundNo']], JSON_UNESCAPED_SLASHES) ?: null;
        if ($result['localStatus'] === PaymentRules::REFUND_PROCESSING) {
            Db::table('pay_refund')->where('id', $refundId)->where('status', PaymentRules::REFUND_PROCESSING)->update([
                'channel_refund_no' => $result['channelRefundNo'],
                'fail_reason' => '',
                'notify_raw' => $raw,
            ]);
            return;
        }
        $failReason = $result['localStatus'] === PaymentRules::REFUND_FAILED ? 'KBZ:' . $result['refundStatus'] : '';
        $this->finalize($refundId, (int) $result['localStatus'], $result['channelRefundNo'], $failReason, $raw);
    }

    /** 网络 / 协议 / 响应验签失败(KBZ 未返回错误码)= KBZ 是否受理未知 */
    private function isUnknownOutcome(KbzPayException $e): bool
    {
        return $e->kind() === KbzPayException::KIND_NETWORK
            || $e->kind() === KbzPayException::KIND_PROTOCOL
            || ($e->kind() === KbzPayException::KIND_SIGN && $e->kbzCode() === '');
    }

    /** 进入终态(仅从 processing),写 outbox 并即时推送 */
    private function finalize(int $refundId, int $status, string $channelRefundNo, string $failReason, ?string $raw): void
    {
        $row = (array) Db::table('pay_refund')->where('id', $refundId)->first();
        $update = [
            'status' => $status,
            'fail_reason' => mb_substr($failReason, 0, 255),
            'biz_notify_status' => (string) $row['biz_notify_url'] !== '' ? PaymentRules::NOTIFY_PENDING : PaymentRules::NOTIFY_NONE,
            'biz_notify_tries' => 0,
            'biz_notify_next_at' => gmdate('Y-m-d H:i:s'),
        ];
        if ($channelRefundNo !== '') {
            $update['channel_refund_no'] = $channelRefundNo;
        }
        if ($status === PaymentRules::REFUND_SUCCEEDED) {
            $update['refunded_at'] = gmdate('Y-m-d H:i:s');
        }
        if ($raw !== null) {
            $update['notify_raw'] = $raw;
        }
        $changed = Db::table('pay_refund')->where('id', $refundId)->where('status', PaymentRules::REFUND_PROCESSING)->update($update);
        if ($changed === 1) {
            $this->logger()->info('refund_finalized', ['refundNo' => $row['refund_no'], 'status' => PaymentRules::refundStatusName($status)]);
            if ((string) $row['biz_notify_url'] !== '') {
                $this->notifier->pushAsync(BizNotifyService::TABLE_REFUND, $refundId);
            }
        }
    }

    // ------------------------------------------------------------------ 查询

    public function query(array $in): array
    {
        $refundNo = trim((string) ($in['refundNo'] ?? ''));
        if ($refundNo === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 refundNo 不能为空');
        }
        $row = Db::table('pay_refund')->where('refund_no', $refundNo)->first();
        if ($row === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '退款单不存在');
        }
        return $this->present((array) $row);
    }

    // ------------------------------------------------------------------ Crontab refund-sync

    /**
     * 处理中退款查单收敛(创建超过 1 分钟)
     *
     * 查不到该退款单:创建时结果未知(UNCONFIRMED_SEND)且超过 2 分钟 → 以同一 refund_request_no 重发一次(RESENT);
     * 其余情况保持 processing;超过 24 小时仍未收敛只 error 告警,等人工。
     */
    public function syncProcessing(int $limit = 50): void
    {
        $rows = Db::table('pay_refund')
            ->where('status', PaymentRules::REFUND_PROCESSING)
            ->where('created_at', '<', gmdate('Y-m-d H:i:s', time() - 60))
            ->orderBy('id')->limit($limit)->get();
        foreach ($rows as $row) {
            try {
                $this->syncOne((array) $row);
            } catch (\Throwable $e) {
                $this->logger()->error('refund_sync_exception', ['refundNo' => $row->refund_no, 'exception' => $e::class]);
            }
        }
    }

    private function syncOne(array $refund): void
    {
        $tx = Db::table('pay_transaction')->where('pay_no', (string) $refund['pay_no'])->first();
        if ($tx === null) {
            return;
        }
        $tx = (array) $tx;
        $age = time() - (int) PaymentRules::parseUtc((string) $refund['created_at']);
        try {
            $found = (new KbzMmqrChannel($this->resolver->configForTransaction($tx)))
                ->queryRefund((string) $tx['pay_no'], (string) $refund['refund_no']);
        } catch (KbzPayException $e) {
            $this->logger()->warning('refund_query_failed', ['refundNo' => $refund['refund_no'], 'kind' => $e->kind(), 'code' => $e->kbzCode()]);
            return;
        } catch (BusinessException $e) {
            $this->logger()->error('refund_query_config_error', ['refundNo' => $refund['refund_no'], 'message' => $e->getMessage()]);
            return;
        }

        if ($found['found'] && $found['localStatus'] !== null && $found['localStatus'] !== PaymentRules::REFUND_PROCESSING) {
            $raw = json_encode(['source' => 'queryorder', 'refund_status' => $found['refundStatus'],
                'channel_refund_no' => $found['channelRefundNo']], JSON_UNESCAPED_SLASHES) ?: null;
            $failReason = $found['localStatus'] === PaymentRules::REFUND_FAILED ? 'KBZ:' . $found['refundStatus'] : '';
            $this->finalize((int) $refund['id'], $found['localStatus'], $found['channelRefundNo'], $failReason, $raw);
            return;
        }
        if ($found['found']) {
            return; // REFUNDING
        }
        if ($age > self::GIVE_UP_AFTER) {
            $this->logger()->error('refund_unresolved 退款超过 24 小时未能在 KBZ 查到,需人工核对', ['refundNo' => $refund['refund_no']]);
            return;
        }
        if ((string) $refund['fail_reason'] === self::REASON_UNCONFIRMED && $age > 120) {
            $claimed = Db::table('pay_refund')->where('id', $refund['id'])->where('status', PaymentRules::REFUND_PROCESSING)
                ->where('fail_reason', self::REASON_UNCONFIRMED)->update(['fail_reason' => self::REASON_RESENT]);
            if ($claimed !== 1) {
                return;
            }
            try {
                $config = $this->resolver->configForTransaction($tx, true);
            } catch (BusinessException $e) {
                $this->logger()->error('refund_resend_config_error', ['refundNo' => $refund['refund_no'], 'message' => $e->getMessage()]);
                return;
            }
            $this->logger()->warning('refund_resend', ['refundNo' => $refund['refund_no']]);
            $this->sendToChannel((int) $refund['id'], $tx, $config);
        }
    }

    // ------------------------------------------------------------------ 内部

    private function findIdempotent(string $refundNo, string $payNo, int $amountCents): ?array
    {
        $row = Db::table('pay_refund')->where('refund_no', $refundNo)->first();
        if ($row === null) {
            return null;
        }
        if ((string) $row->pay_no !== $payNo || PaymentRules::toCents((string) $row->amount) !== $amountCents) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'refundNo 已存在且原支付单或金额不一致');
        }
        return $this->present((array) $row);
    }

    private function present(array $row): array
    {
        return [
            'refundNo' => (string) $row['refund_no'],
            'payNo' => (string) $row['pay_no'],
            'amount' => (string) PaymentRules::normalizeAmount((string) $row['amount']),
            'currency' => (string) $row['currency'],
            'status' => PaymentRules::refundStatusName((int) $row['status']),
            'channelRefundNo' => (string) $row['channel_refund_no'],
            'refundedAt' => $row['refunded_at'] === null ? null : (string) $row['refunded_at'],
            'failReason' => (int) $row['status'] === PaymentRules::REFUND_FAILED ? (string) $row['fail_reason'] : '',
        ];
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-refund');
    }
}
