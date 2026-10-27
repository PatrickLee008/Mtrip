<?php

declare(strict_types=1);

namespace App\Service\Payment;

use App\Constants\BookingConst;
use App\Service\PricingService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\PaymentCenterClient;
use Mtrip\Shared\Payment\PaymentRules;
use Psr\Log\LoggerInterface;

/**
 * KBZPay MMQR 收银(方案 22 §4.1 / §8,C 端入口在 order-service,渠道对接全部经 payment-service)
 *
 * - 出码:锁单校验(待支付、未过期、券仍可用、币种 MMK)→ 订单记 pay_method=5(**不改支付状态**)→
 *   事务外调支付中心 createPayment(同一业务单未过期的码由支付中心幂等复用;码过期而订单仍在窗口内则出新码)
 *   → 订单 pay_trade_no 记最新 payNo(仅待支付时)。
 * - 时间:订单表 DATETIME 由 PHP date() 写入(容器 UTC);对外与支付中心一律 'Y-m-d H:i:s' UTC,
 *   转换统一 gmdate(strtotime(...)),PHP 时区非 UTC 时也正确。
 * - 状态轮询 / 可用支付方式见 status() / methods()。
 */
class MmqrCheckoutService
{
    public const CHANNEL = 'kbz_mmqr';

    public const CURRENCY = 'MMK';

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected PaymentSettleService $settle;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    protected ?PaymentCenterClient $center = null;

    public function center(): PaymentCenterClient
    {
        return $this->center ??= new PaymentCenterClient();
    }

    // ------------------------------------------------------------------ 出码

    /** 独立单出码;$snapshot 为已校验归属(本人、本站点、非 Trip)的订单行 */
    public function createForOrder(array $snapshot): array
    {
        $orderId = (int) $snapshot['id'];
        $currency = $this->orderCurrency($snapshot);
        $this->assertCurrency($currency);
        $order = Db::transaction(function () use ($orderId, $snapshot) {
            $order = Db::table('order_main')->where('id', $orderId)->where('user_id', (int) $snapshot['user_id'])
                ->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $order) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
            }
            $order = (array) $order;
            $this->assertPayable([$order]);
            // 券已被别的订单用掉就不出码(否则付了款也只能退)
            $this->pricingService->lockCouponForPay((int) $order['coupon_id']);
            Db::table('order_main')->where('id', $orderId)->update(['pay_method' => BookingConst::PAY_METHOD_KBZ_MMQR]);
            return $order;
        });

        $res = $this->center()->createPayment([
            'siteId' => (int) $order['site_id'],
            'bizType' => BookingConst::PAY_BIZ_ORDER,
            'bizNo' => (string) $order['order_no'],
            'userId' => (int) $order['user_id'],
            'amount' => $this->amountOf((float) $order['pay_amount']),
            'currency' => self::CURRENCY,
            'channel' => self::CHANNEL,
            'subject' => 'mTrip Booking ' . $order['order_no'],
            'expireAt' => self::toUtc((string) $order['payment_expires_at']),
            'notifyUrl' => RefundSettleService::notifyUrl(),
        ]);
        $payNo = (string) ($res['payNo'] ?? '');
        Db::table('order_main')->where('id', $orderId)->where('order_status', 0)
            ->where('booking_status', BookingConst::STATUS_PENDING_PAYMENT)
            ->update(['pay_trade_no' => $payNo]);
        $this->logger()->info('mmqr_created', ['payNo' => $payNo, 'bizType' => 'order', 'bizNo' => $order['order_no']]);
        return $this->present($res, (string) $order['payment_expires_at']);
    }

    /** Trip 整单出码:金额为 Trip 应付总额,bizNo = trip_no;订单过期取各预订最早的 payment_expires_at */
    public function createForTrip(array $tripSnapshot, array $snapshots): array
    {
        $tripId = (int) $tripSnapshot['id'];
        if ($snapshots === []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip预订已变更');
        }
        foreach ($snapshots as $s) {
            $this->assertCurrency($this->orderCurrency($s));
        }
        [$trip, $bookings] = Db::transaction(function () use ($tripId, $tripSnapshot, $snapshots) {
            $trip = Db::table('order_trip')->where('id', $tripId)->where('user_id', (int) $tripSnapshot['user_id'])
                ->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $trip) {
                throw new BusinessException(ErrorCode::NOT_FOUND, 'Trip 不存在');
            }
            $trip = (array) $trip;
            if ((int) $trip['pay_status'] !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip 不是待支付状态');
            }
            $bookings = Db::table('order_main')->where('trip_id', $tripId)->whereNull('deleted_at')->orderBy('id')
                ->lockForUpdate()->get()->map(static fn ($r) => (array) $r)->all();
            if ($bookings === [] || count($bookings) !== count($snapshots) || count($bookings) !== (int) $trip['booking_count']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip预订已变更');
            }
            $this->assertPayable($bookings);
            $this->pricingService->lockCouponForPay((int) $trip['coupon_id']);
            Db::table('order_trip')->where('id', $tripId)->update(['pay_method' => BookingConst::PAY_METHOD_KBZ_MMQR]);
            Db::table('order_main')->where('trip_id', $tripId)->where('order_status', 0)
                ->update(['pay_method' => BookingConst::PAY_METHOD_KBZ_MMQR]);
            return [$trip, $bookings];
        });

        $expiresAt = min(array_map(static fn ($b) => (string) $b['payment_expires_at'], $bookings));
        $res = $this->center()->createPayment([
            'siteId' => (int) $trip['site_id'],
            'bizType' => BookingConst::PAY_BIZ_TRIP,
            'bizNo' => (string) $trip['trip_no'],
            'userId' => (int) $trip['user_id'],
            'amount' => $this->amountOf((float) $trip['pay_amount']),
            'currency' => self::CURRENCY,
            'channel' => self::CHANNEL,
            'subject' => 'mTrip Trip ' . $trip['trip_no'],
            'expireAt' => self::toUtc($expiresAt),
            'notifyUrl' => RefundSettleService::notifyUrl(),
        ]);
        $payNo = (string) ($res['payNo'] ?? '');
        Db::table('order_trip')->where('id', $tripId)->where('pay_status', 0)->update(['pay_trade_no' => $payNo]);
        Db::table('order_main')->where('trip_id', $tripId)->where('order_status', 0)
            ->where('booking_status', BookingConst::STATUS_PENDING_PAYMENT)->update(['pay_trade_no' => $payNo]);
        $this->logger()->info('mmqr_created', ['payNo' => $payNo, 'bizType' => 'trip', 'bizNo' => $trip['trip_no']]);
        return $this->present($res, $expiresAt);
    }

    // ------------------------------------------------------------------ 状态轮询

    /**
     * @return array{payNo:string, status:string, bizType:string, orderId:?int, tripId:?int, paidAt:?string,
     *               expireAt:?string, orderExpireAt:?string, bookingStatus:int}
     */
    public function status(string $payNo, bool $refresh, int $userId): array
    {
        if (! PaymentRules::isValidPayNo($payNo)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 payNo 不合法');
        }
        $q = $this->center()->queryPayment(['payNo' => $payNo, 'refresh' => $refresh ? 1 : 0]);
        $bizType = (string) ($q['bizType'] ?? '');
        $bizNo = (string) ($q['bizNo'] ?? '');
        [$trip, $orders] = $this->settle->loadTarget($bizType, $bizNo, false);
        $ownerId = $trip !== null ? (int) $trip['user_id'] : (int) ($orders[0]['user_id'] ?? 0);
        if ($orders === [] || $ownerId !== $userId) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '支付单不存在'); // 不泄露他人单据是否存在
        }
        $status = (string) ($q['status'] ?? 'pending');
        if (in_array($status, ['paid', 'late'], true) && ! $this->settledBy($orders, $payNo)) {
            // 支付中心已成功但本服务尚未收到通知:同步落账一次(幂等;迟到退款不在轮询里重试)
            try {
                $this->settle->onPaid($q + ['payNo' => $payNo], false);
            } catch (\Throwable $e) {
                $this->logger()->warning('mmqr_status_settle_failed 交由业务通知重推', ['payNo' => $payNo, 'exception' => $e::class, 'message' => $e->getMessage()]);
            }
            [$trip, $orders] = $this->settle->loadTarget($bizType, $bizNo, false);
        }
        $orderExpire = min(array_map(static fn ($o) => (string) $o['payment_expires_at'], $orders));
        return [
            'payNo' => $payNo,
            'status' => $status,
            'bizType' => $bizType,
            'orderId' => $trip === null ? (int) $orders[0]['id'] : null,
            'tripId' => $trip !== null ? (int) $trip['id'] : null,
            'paidAt' => isset($q['paidAt']) && $q['paidAt'] !== '' ? (string) $q['paidAt'] : null,
            'expireAt' => isset($q['expireAt']) && $q['expireAt'] !== '' ? (string) $q['expireAt'] : null,
            'orderExpireAt' => $orderExpire !== '' ? self::toUtc($orderExpire) : null,
            'bookingStatus' => (int) $orders[0]['booking_status'],
        ];
    }

    // ------------------------------------------------------------------ 可用支付方式

    /**
     * @return list<array{payMethod:int, code:string, name:string, currencies:list<string>, enabled:bool}>
     *         currencies 为空数组表示不限币种
     */
    public function methods(int $siteId, string $currency): array
    {
        $currency = strtoupper(trim($currency));
        if ($currency === '') {
            $currency = strtoupper(trim((string) Db::connection('system')->table('sys_site')->where('id', $siteId)
                ->whereNull('deleted_at')->value('currency')));
        }
        $kbzCurrencies = [self::CURRENCY];
        $kbzEnabled = false;
        try {
            foreach ($this->center()->availableChannels($siteId) as $ch) {
                if (($ch['channel'] ?? '') === self::CHANNEL) {
                    $kbzCurrencies = array_values(array_map('strval', (array) ($ch['currencies'] ?? [])));
                    $kbzEnabled = in_array($currency, $kbzCurrencies, true);
                }
            }
        } catch (\Throwable $e) {
            $this->logger()->warning('mmqr_methods_center_unavailable', ['siteId' => $siteId, 'exception' => $e::class]);
        }
        return [
            ['payMethod' => 3, 'code' => 'wallet', 'name' => 'mTrip Wallet', 'currencies' => [], 'enabled' => true],
            ['payMethod' => BookingConst::PAY_METHOD_KBZ_MMQR, 'code' => self::CHANNEL, 'name' => 'KBZPay MMQR', 'currencies' => $kbzCurrencies, 'enabled' => $kbzEnabled],
            ['payMethod' => 1, 'code' => 'stripe', 'name' => 'Stripe', 'currencies' => [], 'enabled' => false],
            ['payMethod' => 2, 'code' => 'paypal', 'name' => 'PayPal', 'currencies' => [], 'enabled' => false],
        ];
    }

    // ------------------------------------------------------------------ 工具

    /**
     * 订单计价币种(order_main / order_trip 无 currency 列,下单不快照币种,只能现查)
     *
     * 依据(2026-10-27 核实):
     * - 订单 site_id 必等于物业 / 商品所属站点(OrderController::hotelTarget / resolveCreateTarget 按 site_id 取物业,
     *   MerchantAccessGuard 同站点校验),价格即该站点下录入的金额;
     * - 房型价格的币种由 goods-service RoomContentService::normalize 在保存时**强制写成物业所属站点币种**
     *   (传入不一致直接拒绝,存量不一致要求先核对金额)——房型币种是价格录入时的快照,是最直接的计价币种;
     * - hotel_room_type.currency 列 NOT NULL DEFAULT 'THB':从未经新流程保存的存量房型可能是默认值而非真实币种,
     *   因此房型币种与站点币种**不一致时视为无法确定(返回空串)**,宁可不出码也不按错误币种收款;
     * - 门票 / 无房型:goods_info / ticket_type 无币种列,取站点 sys_site.currency。
     */
    public function orderCurrency(array $order): string
    {
        $site = strtoupper(trim((string) Db::connection('system')->table('sys_site')
            ->where('id', (int) $order['site_id'])->whereNull('deleted_at')->value('currency')));
        if ((int) $order['order_type'] !== 1 || (int) ($order['room_type_id'] ?? 0) <= 0) {
            return $site;
        }
        $room = strtoupper(trim((string) Db::table('hotel_room_type')->where('id', (int) $order['room_type_id'])->value('currency')));
        if (preg_match('/^[A-Z]{3}$/D', $room) !== 1) {
            return $site;
        }
        if ($site !== '' && $room !== $site) {
            $this->logger()->warning('order_currency_conflict 房型币种与站点币种不一致,不判定订单币种', [
                'orderId' => (int) ($order['id'] ?? 0), 'roomTypeId' => (int) $order['room_type_id'], 'room' => $room, 'site' => $site,
            ]);
            return '';
        }
        return $room;
    }

    /** 订单表时间(PHP 默认时区写入)→ UTC 'Y-m-d H:i:s' */
    public static function toUtc(string $value): string
    {
        $ts = strtotime($value);
        return $ts === false ? '' : gmdate('Y-m-d H:i:s', $ts);
    }

    private function assertCurrency(string $currency): void
    {
        if ($currency === '') {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单计价币种无法确定(房型币种与站点不一致),请联系商户核对价格');
        }
        if ($currency !== self::CURRENCY) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'KBZPay 扫码支付仅支持 MMK 订单');
        }
    }

    /** 全部预订须待支付且未过期 */
    private function assertPayable(array $orders): void
    {
        foreach ($orders as $o) {
            if ((int) $o['order_status'] !== 0 || (int) $o['booking_status'] !== BookingConst::STATUS_PENDING_PAYMENT) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单不是待支付状态');
            }
            $expires = $o['payment_expires_at'] !== null ? strtotime((string) $o['payment_expires_at']) : false;
            if ($expires === false || $expires <= time()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单已超过支付时限');
            }
        }
    }

    private function amountOf(float $amount): string
    {
        $normalized = PaymentRules::normalizeAmount(number_format($amount, 2, '.', ''));
        if ($normalized === null || PaymentRules::toCents($normalized) <= 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单应付金额为 0,无需扫码支付');
        }
        return $normalized;
    }

    /** 本 payNo 是否已在本服务落账(全部预订已支付且交易号一致) */
    private function settledBy(array $orders, string $payNo): bool
    {
        foreach ($orders as $o) {
            if ((int) $o['payment_status'] === BookingConst::PAY_PENDING || (string) $o['pay_trade_no'] !== $payNo
                || (int) $o['pay_method'] !== BookingConst::PAY_METHOD_KBZ_MMQR) {
                return false;
            }
        }
        return true;
    }

    /** 出参(契约):时间均为 UTC 'Y-m-d H:i:s' */
    private function present(array $res, string $orderExpiresAt): array
    {
        return [
            'payMethod' => BookingConst::PAY_METHOD_KBZ_MMQR,
            'payNo' => (string) ($res['payNo'] ?? ''),
            'qrCode' => (string) ($res['qrCode'] ?? ''),
            'amount' => (string) ($res['amount'] ?? ''),
            'currency' => (string) ($res['currency'] ?? self::CURRENCY),
            'expireAt' => isset($res['expireAt']) && $res['expireAt'] !== '' ? (string) $res['expireAt'] : null,
            'orderExpireAt' => self::toUtc($orderExpiresAt),
        ];
    }
}
