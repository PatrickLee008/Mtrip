<?php

declare(strict_types=1);

namespace App\Service;

use App\Constants\BookingConst;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\UserNotify;

/**
 * 支付成功后的统一落账(余额 / mock / KBZPay MMQR 共用,方案 22 阶段 5)
 *
 * 原先写在 OrderController::pay / TripController::pay 事务内的「置已支付 → 资金流水 → 库存锁定转已售 →
 * 销量 → 核销券 → 结算分录」抽到这里,KBZ 业务通知落账(PaymentSettleService)复用同一套,不复制。
 * 调用方负责:事务、Trip / 订单行锁、扣款前 lockCouponForPay、钱包扣款;本类只做状态与账务。
 */
class OrderPayService
{
    #[Inject]
    protected PaymentResultHandler $payHandler;

    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected SettlementService $settlementService;

    /**
     * 独立单支付成功(须在已持有订单行锁的事务内调用)
     *
     * @param array $order 已行锁的订单行
     * @param object|null $couponRec lockCouponForPay 的返回
     * @param bool $afterExpiry true = 超时取消后到账恢复(markPaidAfterExpiry),调用方须已重新锁定库存
     * @return string 核销码
     */
    public function settleOrder(array $order, int $payMethod, string $tradeNo, ?object $couponRec, bool $afterExpiry = false): string
    {
        $orderId = (int) $order['id'];
        $verifyCode = OrderNoGenerator::verifyCode();
        // 支付状态变更统一走 PaymentResultHandler(幂等+迟到支付拦截+时间线)
        $verifyCode = $afterExpiry
            ? $this->payHandler->markPaidAfterExpiry($order, $payMethod, $tradeNo, $verifyCode)
            : $this->payHandler->markPaid($order, $payMethod, $tradeNo, $verifyCode);
        // 资金流水:余额 / KBZ 是平台真实收到的钱,记 finance_flow(mock 渠道无真实资金,不记)
        if (self::isRealMoney($payMethod)) {
            $this->recordIncome($order, round((float) $order['pay_amount'], 2), $payMethod, $tradeNo,
                "订单 {$order['order_no']} " . self::methodText($payMethod));
        }
        $this->stockService->deduct($order);
        if ((int) $order['order_type'] === 2) {
            Db::table('goods_info')->where('id', (int) $order['goods_id'])
                ->increment('sales_count', (int) $order['quantity']);
        }
        // 支付成功核销优惠券(已在扣款前锁定并确认可用)
        $this->pricingService->consumeCoupon($couponRec, $orderId);
        // 推荐返利不在支付时发放:改为入住核销时由 BookingLifecycleService::checkIn 发放(PRD 模块14)
        // 结算分录:按优惠券出资方生成按订单分账(PRD 模块8),回填订单佣金/商户实收
        $this->settlementService->recordBooking($order);
        return $verifyCode;
    }

    /**
     * Trip 整单支付成功(须在已持有 Trip + 全部预订行锁的事务内调用):确认其下所有预订,券消耗一次
     *
     * @param list<array> $bookings 已行锁的预订行
     * @param string|null $bookingTradeNo 各预订记录的交易号;null 时沿用原 mock 口径(每单 MOCK+流水号)
     * @return list<array{orderNo:string, verifyCode:string}>
     */
    public function settleTrip(array $trip, array $bookings, int $payMethod, string $tripTradeNo, ?object $couponRec, bool $afterExpiry = false, ?string $bookingTradeNo = null): array
    {
        Db::table('order_trip')->where('id', (int) $trip['id'])->update([
            'pay_status' => 1,
            'pay_method' => $payMethod,
            'pay_trade_no' => $tripTradeNo,
            'pay_time' => date('Y-m-d H:i:s'),
        ]);
        $codes = [];
        foreach ($bookings as $b) {
            $tradeNo = $bookingTradeNo ?? 'MOCK' . OrderNoGenerator::flowNo();
            $verifyCode = OrderNoGenerator::verifyCode();
            // 支付状态变更统一走 PaymentResultHandler(幂等+时间线)
            $verifyCode = $afterExpiry
                ? $this->payHandler->markPaidAfterExpiry($b, $payMethod, $tradeNo, $verifyCode)
                : $this->payHandler->markPaid($b, $payMethod, $tradeNo, $verifyCode);
            // KBZ 为真实收款:按预订各记一条收入流水(余额 Trip 维持原口径不记)
            if ($payMethod === BookingConst::PAY_METHOD_KBZ_MMQR) {
                $this->recordIncome($b, round((float) $b['pay_amount'], 2), $payMethod, $tradeNo,
                    "行程 {$trip['trip_no']} 预订 {$b['order_no']} " . self::methodText($payMethod));
            }
            $this->stockService->deduct($b);
            $this->settlementService->recordBooking($b);
            $codes[] = ['orderNo' => (string) $b['order_no'], 'verifyCode' => $verifyCode];
        }
        // 整单券核销一次(已在扣款前锁定并确认可用)
        $this->pricingService->consumeCoupon($couponRec, (int) $trip['id']);
        return $codes;
    }

    /** 事务提交后的确认通知:住客「预订已确认」逐单 + 商户逐单(后置容错) */
    public function notifyConfirmed(array $orders): void
    {
        foreach ($orders as $o) {
            try {
                UserNotify::order($o, 'booking_confirmed');
            } catch (\Throwable) {
            }
        }
        foreach ($orders as $o) {
            $this->payHandler->notifyMerchantConfirmed($o);
        }
    }

    /** 订单支付收入流水(flow_type 1 收入 / biz_type 1 订单支付) */
    public function recordIncome(array $order, float $amount, int $payMethod, string $tradeNo, string $remark): void
    {
        Db::table('finance_flow')->insert([
            'flow_no' => OrderNoGenerator::flowNo(),
            'site_id' => (int) $order['site_id'],
            'flow_type' => 1,
            'biz_type' => 1,
            'amount' => $amount,
            'order_id' => (int) $order['id'],
            'merchant_id' => (int) $order['merchant_id'],
            'supplier_id' => (int) $order['supplier_id'],
            'user_id' => (int) $order['user_id'],
            'pay_channel' => $payMethod,
            'trade_no' => $tradeNo,
            'flow_status' => 1,
            'remark' => mb_substr($remark, 0, 255),
            'operator_id' => 0,
        ]);
    }

    public static function isRealMoney(int $payMethod): bool
    {
        return $payMethod === 3 || $payMethod === BookingConst::PAY_METHOD_KBZ_MMQR;
    }

    private static function methodText(int $payMethod): string
    {
        return $payMethod === BookingConst::PAY_METHOD_KBZ_MMQR ? 'KBZPay 扫码支付' : '钱包支付';
    }
}
