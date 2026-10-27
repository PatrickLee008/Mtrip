<?php

declare(strict_types=1);

namespace App\Service\Payment;

use App\Constants\BookingConst;
use App\Service\OrderPayService;
use App\Service\OrderStockService;
use App\Service\PaymentResultHandler;
use App\Service\PricingService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Payment\SettleRules;
use Mtrip\Shared\Support\RedisLock;
use Mtrip\Shared\Support\UserNotify;
use Psr\Log\LoggerInterface;

/**
 * 支付中心业务通知落账(方案 22 §6.3,order-service 侧)
 *
 * onPaid 三分支(判定见 SettleRules::decidePaid,对支付中心一律回 code=0):
 *   1. 待支付 → 正常确认:商户锁 → Trip/订单行锁 → 复判 → 锁券 → OrderPayService 统一落账(同一事务)
 *   2. 系统超时取消 → 恢复:同上锁序,逐单 relock 库存 + 复核券 → markPaidAfterExpiry → 统一落账(同一事务)
 *      → 商户「预订已恢复」+ 住客 payment_late_recovered(迟到支付后已恢复确认)
 *   3. 恢复 / 确认失败(库存、券、商户不可订、并发变化)、用户 / 商户取消、金额不符、其他终态
 *      → RefundSettleService::startLateRefund 原路全额退款(独立事务建退款单,事务外调支付中心)
 * 数据库异常等非业务错误照常抛出 → 通知接口回非 0,支付中心退避重推。
 */
class PaymentSettleService
{
    #[Inject]
    protected OrderPayService $orderPay;

    #[Inject]
    protected PaymentResultHandler $payHandler;

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected RefundSettleService $refunds;

    #[Inject]
    protected RedisLock $lock;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    /** 业务通知入口(event = paid / refunded / refund_failed);未知事件忽略并确认 */
    public function handleNotify(array $body): array
    {
        return match ((string) ($body['event'] ?? '')) {
            'paid' => $this->onPaid($body, true),
            'refunded', 'refund_failed' => $this->refunds->onRefundNotify($body),
            default => ['action' => 'ignored'],
        };
    }

    /**
     * 支付成功落账(幂等)
     *
     * @param array $p payNo / bizType / bizNo / amount / currency(通知 body 或支付中心查单结果)
     * @param bool $retryRefund 已有迟到退款单且上次失败时是否重试(业务通知 / 重推 = true;轮询 / 超时任务 = false)
     * @return array{action: string, reason: string}
     */
    public function onPaid(array $p, bool $retryRefund = true): array
    {
        $payNo = trim((string) ($p['payNo'] ?? ''));
        $bizType = (string) ($p['bizType'] ?? '');
        $bizNo = trim((string) ($p['bizNo'] ?? ''));
        if (! PaymentRules::isValidPayNo($payNo) || ! in_array($bizType, [BookingConst::PAY_BIZ_ORDER, BookingConst::PAY_BIZ_TRIP], true) || $bizNo === '') {
            $this->logger()->error('pay_notify_invalid 业务通知字段不完整,忽略', ['payNo' => $payNo, 'bizType' => $bizType, 'bizNo' => $bizNo]);
            return ['action' => 'ignored', 'reason' => 'invalid'];
        }
        // 同一 payNo 的通知 / 轮询 / 超时查单串行处理(抢不到锁抛 42902:通知回非 0 由支付中心稍后重推)
        return $this->lock->run('mtrip:order:pay-settle:' . $payNo, 60,
            fn () => $this->doOnPaid($p, $payNo, $bizType, $bizNo, $retryRefund), '支付结果处理中');
    }

    private function doOnPaid(array $p, string $payNo, string $bizType, string $bizNo, bool $retryRefund): array
    {
        $context = ['payNo' => $payNo, 'bizType' => $bizType, 'bizNo' => $bizNo];

        // 1) 无锁预判:已处理直接返回;要退款的不必拿商户锁
        [$trip, $orders] = $this->loadTarget($bizType, $bizNo, false);
        $decision = $this->decide($p, $trip, $orders);
        if ($decision['action'] === SettleRules::ACTION_ALREADY) {
            return $decision;
        }
        // 本笔已判过退款(如超时任务查单时金额不符 → 退款后订单又被超时取消):不得再走恢复,保持退款结论
        if ($this->refunds->hasLateRefund($payNo)) {
            $decision = ['action' => SettleRules::ACTION_REFUND, 'reason' => 'refund_started'];
        }

        // 2) 确认 / 恢复:锁内复判后执行,业务异常(库存 / 券 / 商户 / 并发)转退款
        if (in_array($decision['action'], [SettleRules::ACTION_CONFIRM, SettleRules::ACTION_RECOVER], true)) {
            $attempted = $decision['action'];
            try {
                $done = Db::transaction(function () use ($p, $bizType, $bizNo, $orders, $payNo) {
                    $siteId = (int) $orders[0]['site_id'];
                    MerchantAccessGuard::lockBookable($orders, $siteId);
                    $hotels = array_values(array_filter($orders, static fn ($o) => (int) $o['order_type'] === 1));
                    if ($hotels !== []) {
                        MerchantAccessGuard::lockProperties($hotels, $siteId);
                    }
                    [$trip, $locked] = $this->loadTarget($bizType, $bizNo, true);
                    $d = $this->decide($p, $trip, $locked);
                    if (! in_array($d['action'], [SettleRules::ACTION_CONFIRM, SettleRules::ACTION_RECOVER], true)) {
                        return ['decision' => $d, 'orders' => $locked];
                    }
                    $recover = $d['action'] === SettleRules::ACTION_RECOVER;
                    if ($recover) {
                        foreach ($locked as $o) {
                            $this->stockService->relock($o);
                        }
                    }
                    $couponRec = $this->pricingService->lockCouponForPay((int) ($trip['coupon_id'] ?? $locked[0]['coupon_id']));
                    if ($trip !== null) {
                        $this->orderPay->settleTrip($trip, $locked, BookingConst::PAY_METHOD_KBZ_MMQR, $payNo, $couponRec, $recover, $payNo);
                    } else {
                        $this->orderPay->settleOrder($locked[0], BookingConst::PAY_METHOD_KBZ_MMQR, $payNo, $couponRec, $recover);
                    }
                    return ['decision' => $d, 'orders' => $locked];
                });
            } catch (BusinessException $e) {
                $this->logger()->warning('pay_settle_' . $attempted . '_failed 转原路退款', $context + ['code' => $e->getCode(), 'message' => $e->getMessage()]);
                [$trip, $orders] = $this->loadTarget($bizType, $bizNo, false);
                $reason = ($attempted === SettleRules::ACTION_RECOVER ? 'recover_failed: ' : 'confirm_failed: ') . $e->getMessage();
                $this->refunds->startLateRefund($p, $orders, $reason, $retryRefund);
                return ['action' => SettleRules::ACTION_REFUND, 'reason' => $reason];
            }

            $decision = $done['decision'];
            if ($decision['action'] === SettleRules::ACTION_CONFIRM) {
                $this->orderPay->notifyConfirmed($done['orders']);
                $this->logger()->info('pay_settled', $context);
                return $decision;
            }
            if ($decision['action'] === SettleRules::ACTION_RECOVER) {
                foreach ($done['orders'] as $o) {
                    $this->payHandler->notifyMerchantRecovered($o);
                    try {
                        UserNotify::order($o, 'payment_late_recovered', ['amount' => number_format((float) $o['pay_amount'], 2, '.', '')]);
                    } catch (\Throwable) {
                    }
                }
                $this->logger()->warning('pay_late_recovered 超时取消后到账,已恢复预订', $context);
                return $decision;
            }
            if ($decision['action'] === SettleRules::ACTION_ALREADY) {
                return $decision;
            }
            $orders = $done['orders'];
        }

        // 3) 退款
        $this->refunds->startLateRefund($p, $orders, $decision['reason'], $retryRefund);
        $this->logger()->warning('pay_late_refund 到账但无法入账,已发起原路全额退款', $context + ['reason' => $decision['reason']]);
        return $decision;
    }

    /**
     * 取业务单:order → 独立订单;trip → Trip 主单 + 全部预订(加锁顺序 order_trip → order_main,与支付 / 取消一致)
     *
     * @return array{0: ?array, 1: list<array>}
     */
    public function loadTarget(string $bizType, string $bizNo, bool $lock): array
    {
        if ($bizType === BookingConst::PAY_BIZ_TRIP) {
            $q = Db::table('order_trip')->where('trip_no', $bizNo)->whereNull('deleted_at');
            $trip = $lock ? $q->lockForUpdate()->first() : $q->first();
            if (! $trip) {
                return [null, []];
            }
            $trip = (array) $trip;
            $oq = Db::table('order_main')->where('trip_id', (int) $trip['id'])->whereNull('deleted_at')->orderBy('id');
            $orders = ($lock ? $oq->lockForUpdate() : $oq)->get()->map(static fn ($r) => (array) $r)->all();
            return [$trip, $orders];
        }
        $q = Db::table('order_main')->where('order_no', $bizNo)->whereNull('deleted_at');
        $order = $lock ? $q->lockForUpdate()->first() : $q->first();
        if (! $order || (int) ($order->trip_id ?? 0) > 0) {
            return [null, []];
        }
        return [null, [(array) $order]];
    }

    /** 组装状态 → SettleRules::decidePaid */
    private function decide(array $p, ?array $trip, array $orders): array
    {
        $states = [];
        foreach ($orders as $o) {
            $states[] = [
                'orderStatus' => (int) $o['order_status'],
                'bookingStatus' => (int) $o['booking_status'],
                'paymentStatus' => (int) $o['payment_status'],
                'payMethod' => (int) $o['pay_method'],
                'payTradeNo' => (string) $o['pay_trade_no'],
                'expiryCancelled' => $this->payHandler->isExpiryCancelled($o),
            ];
        }
        $expected = $trip !== null ? (float) $trip['pay_amount'] : (float) ($orders[0]['pay_amount'] ?? 0);
        $amountMatches = $orders !== []
            && PaymentRules::amountEquals((string) ($p['amount'] ?? ''), number_format($expected, 2, '.', ''))
            && strtoupper((string) ($p['currency'] ?? '')) === MmqrCheckoutService::CURRENCY;
        return SettleRules::decidePaid($states, (string) $p['payNo'], $amountMatches, $trip !== null ? (int) $trip['pay_status'] : null);
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-settle');
    }
}
