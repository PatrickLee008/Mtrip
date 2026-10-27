<?php

declare(strict_types=1);

namespace App\Service;

use App\Payment\KbzMmqrChannel;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;
use Mtrip\Shared\Payment\PaymentRules;
use Psr\Log\LoggerInterface;

/**
 * KBZPay MMQR 异步通知处理(方案 22 §1「通知」/ §5.2 第 4 条)
 *
 * 1. 非信任地取 Request.merch_order_id → 按 pay_no 找流水(找不到 → fail);
 * 2. 按流水快照账户的 AppKey 验签(失败 → fail,KBZ 会重推,对账 crontab 兜底);
 * 3. 只处理 PAY_SUCCESS;金额 / 币种与流水比对,不符 → 不入账、记 fail_reason、error 告警、回 success 止住重推;
 * 4. PaymentService::settlePaid 行锁幂等落账并写 outbox。
 *
 * 日志不记签名、AppKey 与原始报文。
 */
class PayCallbackService
{
    public const ACK_SUCCESS = 'success';
    public const ACK_FAIL = 'fail';

    /** notify_raw 列为 TEXT(64KB),超长截断 */
    private const RAW_MAX_BYTES = 60000;

    #[Inject]
    protected PayAccountResolver $resolver;

    #[Inject]
    protected PaymentService $payments;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    /** @return string 回给 KBZ 的纯文本:success / fail */
    public function handleKbzMmqr(string $raw): string
    {
        $json = json_decode($raw, true);
        $request = is_array($json) && is_array($json['Request'] ?? null) ? $json['Request'] : null;
        $payNo = $request !== null && is_scalar($request['merch_order_id'] ?? null) ? (string) $request['merch_order_id'] : '';
        if (! PaymentRules::isValidPayNo($payNo)) {
            $this->logger()->warning('kbz_notify_rejected', ['reason' => 'bad_merch_order_id', 'bodyLength' => strlen($raw)]);
            return self::ACK_FAIL;
        }

        $tx = Db::table('pay_transaction')->where('pay_no', $payNo)->first();
        if ($tx === null || (string) $tx->channel_code !== KbzMmqrChannel::CODE) {
            $this->logger()->warning('kbz_notify_rejected', ['reason' => 'transaction_not_found', 'payNo' => $payNo]);
            return self::ACK_FAIL;
        }
        $tx = (array) $tx;

        try {
            $channel = new KbzMmqrChannel($this->resolver->configForTransaction($tx));
        } catch (BusinessException $e) {
            // 账户配置损坏:不应答 success,让 KBZ 重推;修复配置后由重推或对账补单
            $this->logger()->error('kbz_notify_config_error', ['payNo' => $payNo, 'message' => $e->getMessage()]);
            return self::ACK_FAIL;
        }

        try {
            $notify = $channel->verifyCallback($raw, []);
        } catch (KbzPayException $e) {
            $this->logger()->warning('kbz_notify_rejected', ['reason' => 'verify_' . $e->kind(), 'payNo' => $payNo]);
            return self::ACK_FAIL;
        }
        if ($notify['orderNo'] !== $payNo) {
            $this->logger()->warning('kbz_notify_rejected', ['reason' => 'order_id_changed', 'payNo' => $payNo]);
            return self::ACK_FAIL;
        }

        $local = PaymentRules::mapTradeStatus($notify['tradeStatus']);
        if ($local !== PaymentRules::PAY_PAID) {
            // 非成功通知只记录;终态由 pay-reconcile 查单收敛,避免单凭通知关单
            $this->logger()->info('kbz_notify_non_success', ['payNo' => $payNo, 'tradeStatus' => $notify['tradeStatus']]);
            return self::ACK_SUCCESS;
        }

        if (! PaymentRules::amountEquals($notify['amount'], (string) $tx['amount'])
            || $notify['currency'] !== strtoupper((string) $tx['currency'])) {
            $this->payments->markAmountMismatch($tx, $notify['amount'], $notify['currency'], 'notify');
            return self::ACK_SUCCESS;
        }

        $raw = strlen($raw) > self::RAW_MAX_BYTES ? substr($raw, 0, self::RAW_MAX_BYTES) : $raw;
        $this->payments->settlePaid((int) $tx['id'], $notify['channelTradeNo'], $raw, 'notify');
        return self::ACK_SUCCESS;
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-callback');
    }
}
