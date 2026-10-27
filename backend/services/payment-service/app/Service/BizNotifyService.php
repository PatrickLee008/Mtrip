<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\PaymentRules;
use Psr\Log\LoggerInterface;

/**
 * 业务通知 outbox(方案 22 §4.1 / §4.3):pay_transaction / pay_refund 的 biz_notify_* 列
 *
 * - 事件:支付 `paid`;退款 `refunded` / `refund_failed`;
 * - POST JSON 到业务方 notifyUrl,头 `X-Internal-Token`(env MTRIP_INTERNAL_TOKEN),对方返回 JSON code=0 视为确认;
 * - 失败退避 1,2,5,10,30,60,120… 分钟(PaymentRules::notifyBackoffMinutes),共 10 次后置 3 并 error 告警;
 * - 并发:先用条件更新把 biz_notify_next_at 推后 2 分钟作为租约,抢到才推送(crontab 与即时推送不会重复发)。
 *
 * 日志只记表、id、单号、HTTP 状态与对方 code,不记 token 与对方响应体。
 */
class BizNotifyService
{
    public const TABLE_PAY = 'pay_transaction';
    public const TABLE_REFUND = 'pay_refund';

    private const LEASE_SECONDS = 120;
    private const CONNECT_TIMEOUT = 3;
    private const TOTAL_TIMEOUT = 5;

    #[Inject]
    protected ConfigInterface $config;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    /** Crontab pay-biz-notify:推送到期 outbox(两张表各取一批) */
    public function processDue(int $limit = 100): void
    {
        foreach ([self::TABLE_PAY, self::TABLE_REFUND] as $table) {
            $ids = Db::table($table)
                ->where('biz_notify_status', PaymentRules::NOTIFY_PENDING)
                ->where(static function ($q) {
                    $q->whereNull('biz_notify_next_at')->orWhere('biz_notify_next_at', '<=', gmdate('Y-m-d H:i:s'));
                })
                ->orderBy('id')->limit($limit)->pluck('id')->all();
            foreach ($ids as $id) {
                try {
                    $this->push($table, (int) $id);
                } catch (\Throwable $e) {
                    $this->logger()->error('biz_notify_exception', ['table' => $table, 'id' => (int) $id, 'exception' => $e::class]);
                }
            }
        }
    }

    /** 状态变更后立即推一次:协程内异步(不拖慢 KBZ 回调应答),否则同步 */
    public function pushAsync(string $table, int $id): void
    {
        $job = function () use ($table, $id): void {
            try {
                $this->push($table, $id);
            } catch (\Throwable $e) {
                $this->logger()->error('biz_notify_exception', ['table' => $table, 'id' => $id, 'exception' => $e::class]);
            }
        };
        if (Coroutine::inCoroutine()) {
            Coroutine::create($job);
            return;
        }
        $job();
    }

    /**
     * 重推:把 outbox 重置为待通知(次数清零)并立即推一次
     *
     * @return array{notified: bool, bizNotifyStatus: int}
     */
    public function renotify(string $payNo, string $refundNo): array
    {
        if ($refundNo !== '') {
            $table = self::TABLE_REFUND;
            $row = Db::table($table)->where('refund_no', $refundNo)->first();
            if ($row === null) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '退款单不存在');
            }
            $eligible = in_array((int) $row->status, [PaymentRules::REFUND_SUCCEEDED, PaymentRules::REFUND_FAILED], true);
            $hint = '退款尚在处理中,终态后才会通知业务方';
        } elseif ($payNo !== '') {
            $table = self::TABLE_PAY;
            $row = Db::table($table)->where('pay_no', $payNo)->first();
            if ($row === null) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '支付单不存在');
            }
            $eligible = in_array((int) $row->status, [PaymentRules::PAY_PAID, PaymentRules::PAY_LATE], true);
            $hint = '支付单未成功,无需通知业务方';
        } else {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 payNo 或 refundNo 不能为空');
        }
        if (! $eligible) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, $hint);
        }
        if ((string) $row->biz_notify_url === '') {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该单未登记业务通知地址');
        }
        $id = (int) $row->id;
        Db::table($table)->where('id', $id)->update([
            'biz_notify_status' => PaymentRules::NOTIFY_PENDING,
            'biz_notify_tries' => 0,
            'biz_notify_next_at' => gmdate('Y-m-d H:i:s'),
        ]);
        $notified = $this->push($table, $id);
        $status = (int) Db::table($table)->where('id', $id)->value('biz_notify_status');
        return ['notified' => $notified, 'bizNotifyStatus' => $status];
    }

    /**
     * 抢租约 → 组装事件 → 推送 → 回写 outbox 状态;返回是否被业务方确认
     */
    public function push(string $table, int $id): bool
    {
        if (! in_array($table, [self::TABLE_PAY, self::TABLE_REFUND], true)) {
            return false;
        }
        $now = time();
        $claimed = Db::table($table)
            ->where('id', $id)
            ->where('biz_notify_status', PaymentRules::NOTIFY_PENDING)
            ->where(static function ($q) use ($now) {
                $q->whereNull('biz_notify_next_at')->orWhere('biz_notify_next_at', '<=', gmdate('Y-m-d H:i:s', $now));
            })
            ->update(['biz_notify_next_at' => gmdate('Y-m-d H:i:s', $now + self::LEASE_SECONDS)]);
        if ($claimed !== 1) {
            return false;
        }
        $row = (array) Db::table($table)->where('id', $id)->first();
        $payload = $this->buildPayload($table, $row);
        if ($payload === null) {
            // 非可通知状态(数据被人工改动等):撤销 outbox,避免反复空转
            Db::table($table)->where('id', $id)->update(['biz_notify_status' => PaymentRules::NOTIFY_NONE, 'biz_notify_next_at' => null]);
            return false;
        }

        [$ok, $httpStatus, $bizCode] = $this->post((string) $row['biz_notify_url'], $payload);
        $tries = (int) $row['biz_notify_tries'] + 1;
        $context = ['table' => $table, 'id' => $id, 'event' => $payload['event'], 'payNo' => $payload['payNo'],
            'refundNo' => $payload['refundNo'] ?? '', 'tries' => $tries, 'http' => $httpStatus, 'bizCode' => $bizCode];

        if ($ok) {
            Db::table($table)->where('id', $id)->update([
                'biz_notify_status' => PaymentRules::NOTIFY_CONFIRMED,
                'biz_notify_tries' => $tries,
                'biz_notify_next_at' => null,
            ]);
            $this->logger()->info('biz_notify_confirmed', $context);
            return true;
        }

        $delay = PaymentRules::notifyBackoffMinutes($tries);
        if ($delay === null) {
            Db::table($table)->where('id', $id)->update([
                'biz_notify_status' => PaymentRules::NOTIFY_EXHAUSTED,
                'biz_notify_tries' => $tries,
                'biz_notify_next_at' => null,
            ]);
            $this->logger()->error('biz_notify_exhausted 业务通知重试耗尽,需人工处理(可调 /internal/v1/payment/renotify)', $context);
            return false;
        }
        Db::table($table)->where('id', $id)->update([
            'biz_notify_tries' => $tries,
            'biz_notify_next_at' => gmdate('Y-m-d H:i:s', time() + $delay * 60),
        ]);
        $this->logger()->warning('biz_notify_failed', $context + ['retryInMinutes' => $delay]);
        return false;
    }

    /** 组装通知 body;不可通知返回 null */
    private function buildPayload(string $table, array $row): ?array
    {
        if ($table === self::TABLE_PAY) {
            if (! in_array((int) $row['status'], [PaymentRules::PAY_PAID, PaymentRules::PAY_LATE], true)) {
                return null;
            }
            return ['event' => 'paid'] + $this->payFields($row);
        }

        $event = match ((int) $row['status']) {
            PaymentRules::REFUND_SUCCEEDED => 'refunded',
            PaymentRules::REFUND_FAILED => 'refund_failed',
            default => null,
        };
        if ($event === null) {
            return null;
        }
        $tx = Db::table(self::TABLE_PAY)->where('pay_no', (string) $row['pay_no'])->first();
        if ($tx === null) {
            return null;
        }
        return ['event' => $event] + $this->payFields((array) $tx) + [
            'refundNo' => (string) $row['refund_no'],
            'refundAmount' => (string) PaymentRules::normalizeAmount((string) $row['amount']),
            'refundStatus' => PaymentRules::refundStatusName((int) $row['status']),
            'refundReason' => (string) $row['reason'],
            'refundedAt' => $row['refunded_at'] === null ? null : (string) $row['refunded_at'],
            'refundFailReason' => (int) $row['status'] === PaymentRules::REFUND_FAILED ? (string) $row['fail_reason'] : '',
        ];
    }

    private function payFields(array $tx): array
    {
        return [
            'payNo' => (string) $tx['pay_no'],
            'bizType' => (string) $tx['biz_type'],
            'bizNo' => (string) $tx['biz_no'],
            'siteId' => (int) $tx['site_id'],
            'userId' => (int) $tx['user_id'],
            'amount' => (string) PaymentRules::normalizeAmount((string) $tx['amount']),
            'currency' => (string) $tx['currency'],
            'channel' => (string) $tx['channel_code'],
            'channelTradeNo' => (string) $tx['channel_trade_no'],
            'paidAt' => $tx['paid_at'] === null ? null : (string) $tx['paid_at'],
            'lateAfterClose' => (int) ($tx['late_paid'] ?? 0) === 1,
        ];
    }

    /**
     * POST JSON 并判定确认:HTTP 2xx 且响应 JSON code === 0
     *
     * @return array{0: bool, 1: int, 2: string} [确认, HTTP 状态, 对方 code]
     */
    protected function post(string $url, array $payload): array
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (! in_array($scheme, ['http', 'https'], true)) {
            return [false, 0, 'bad_url'];
        }
        $token = (string) $this->config->get('mtrip.internal_token', '');
        if ($token === '') {
            $this->logger()->warning('biz_notify_token_missing MTRIP_INTERNAL_TOKEN 未配置,业务方将拒绝通知');
        }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $ch = curl_init($url);
        if ($ch === false || $json === false) {
            return [false, 0, 'init'];
        }
        try {
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'X-Internal-Token: ' . $token],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
                CURLOPT_TIMEOUT => self::TOTAL_TIMEOUT,
                CURLOPT_FOLLOWLOCATION => false,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        } finally {
            curl_close($ch);
            unset($token);
        }
        if ($body === false || $errno !== 0) {
            return [false, $http, 'curl_' . $errno];
        }
        $resp = json_decode((string) $body, true);
        $code = is_array($resp) && array_key_exists('code', $resp) && is_scalar($resp['code']) ? (string) $resp['code'] : '';
        return [$http >= 200 && $http < 300 && $code === '0', $http, $code];
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-notify');
    }
}
