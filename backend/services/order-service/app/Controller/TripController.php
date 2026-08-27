<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\NotifyService;
use App\Service\OrderStockService;
use App\Service\PricingService;
use App\Service\ReferralService;
use App\Service\SettlementService;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\Result;

/**
 * C端多酒店 Trip(PRD 模块 1.1):一次结账多家酒店 → 单笔支付 → 支付后各预订独立。
 * 券按各预订净额占比分摊(alloc_coupon_discount);各预订后续走既有独立生命周期(取消/退款/结算)。
 * 本期仅支持酒店(order_type=1);预订失败补偿为结构化占位(mock 支付下不触发)。
 */
class TripController extends AbstractController
{
    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected SettlementService $settlementService;

    #[Inject]
    protected ReferralService $referralService;

    #[Inject]
    protected NotifyService $notifyService;

    #[Inject]
    protected ConfigInterface $config;

    /** 创建 Trip:items 多个酒店预订 + 可选整单券,券按净额占比分摊 */
    public function create(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $items = $this->input('items');
        if (! is_array($items) || count($items) < 1 || count($items) > 10) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Trip 须包含 1-10 个酒店预订');
        }
        $couponId = $this->intInput('couponId', 0);

        // 先做无副作用的校验与取数(商品/房型/日期),事务内再锁库存计价
        $prepared = [];
        foreach ($items as $idx => $item) {
            $prepared[] = $this->prepareItem($siteId, (array) $item, $idx);
        }

        $tripNo = OrderNoGenerator::orderNo($siteId);
        $result = Db::transaction(function () use ($siteId, $userId, $prepared, $couponId, $tripNo) {
            $goods = array_column($prepared, 'goods');
            MerchantAccessGuard::lockBookable($goods, $siteId);
            MerchantAccessGuard::lockGoods($goods, $siteId);
            // 商品行已按ID排序锁定；同商品的库存请求串行，不改变用户预订顺序及券分摊顺序。
            foreach ($prepared as &$item) {
                $item['sku'] = (array) Db::table('hotel_room_type')->where('id', $item['skuId'])
                    ->where('goods_id', $item['goodsId'])->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
                if ($item['sku'] === []) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型已停售');
                }
            }
            unset($item);
            // 1) 逐项锁库存 + 计长住,得到各项净额
            $legs = [];
            $tripTotal = 0.0;
            foreach ($prepared as $p) {
                [$original, $changes] = $this->stockService->lock(
                    $siteId, $p['goodsId'], 1, $p['skuId'], $p['sku'], $p['dates'], $p['quantity'], $p['isCitizen']
                );
                $longstay = $this->pricingService->longstayDiscount($siteId, count($p['dates']), $original);
                $net = round($original - $longstay, 2);
                $tripTotal = round($tripTotal + $net, 2);
                $legs[] = $p + ['original' => $original, 'longstay' => $longstay, 'net' => $net, 'changes' => $changes];
            }

            // 2) 整单券校验(按整单净额)与占比分摊
            $couponRefId = 0;
            $couponDiscount = 0.0;
            if ($couponId > 0) {
                [$couponRefId, $couponDiscount] = $this->pricingService->resolveCoupon(
                    $siteId, $userId, $couponId, 1, 0, $tripTotal
                );
            }
            $allocs = $this->allocate($couponDiscount, array_column($legs, 'net'), $tripTotal);

            // 3) 建 Trip 主单
            $tripId = (int) Db::table('order_trip')->insertGetId([
                'trip_no' => $tripNo,
                'site_id' => $siteId,
                'user_id' => $userId,
                'total_amount' => $tripTotal,
                'coupon_id' => $couponRefId,
                'coupon_discount' => $couponDiscount,
                'pay_amount' => max(0.0, round($tripTotal - $couponDiscount, 2)),
                'booking_count' => count($legs),
                'pay_status' => 0,
            ]);

            // 4) 建各预订(order_main,trip_id 关联,券分摊落 alloc_coupon_discount)
            $bookings = [];
            foreach ($legs as $i => $leg) {
                $alloc = $allocs[$i];
                $payAmount = max(0.0, round($leg['net'] - $alloc, 2));
                $orderNo = OrderNoGenerator::orderNo($siteId);
                $unitPrice = round($leg['original'] / max(1, count($leg['dates'])) / $leg['quantity'], 2);
                $orderId = (int) Db::table('order_main')->insertGetId([
                    'order_no' => $orderNo,
                    'site_id' => $siteId,
                    'user_id' => $userId,
                    'trip_id' => $tripId,
                    'order_type' => 1,
                    'is_citizen' => $leg['isCitizen'] ? 1 : 0,
                    'merchant_id' => (int) $leg['goods']['merchant_id'],
                    'supplier_id' => (int) $leg['goods']['supplier_id'],
                    'goods_id' => $leg['goodsId'],
                    'goods_name' => (string) $leg['goods']['goods_name'],
                    'goods_image' => (string) $leg['goods']['cover_image'],
                    'sku_id' => $leg['skuId'],
                    'sku_name' => (string) ($leg['sku']['room_name'] ?? ''),
                    'quantity' => $leg['quantity'],
                    'unit_price' => $unitPrice,
                    'original_price' => (float) $leg['sku']['base_price'],
                    'total_amount' => $leg['original'],
                    'discount_amount' => round($leg['longstay'] + $alloc, 2),
                    'longstay_discount' => $leg['longstay'],
                    'coupon_id' => $couponRefId,
                    'coupon_discount' => $alloc,
                    'alloc_coupon_discount' => $alloc,
                    'pay_amount' => $payAmount,
                    'order_status' => 0,
                    'use_date' => $leg['useDate'],
                    'end_date' => $leg['endDate'],
                    'contact_name' => mb_substr($leg['contactName'], 0, 50),
                    'contact_phone' => CryptoHelper::encrypt($leg['contactPhone'], $this->aesKey()),
                    'guests' => $leg['guests'] !== [] ? CryptoHelper::encrypt(json_encode($leg['guests'], JSON_UNESCAPED_UNICODE), $this->aesKey()) : null,
                    'remark' => $leg['remark'],
                ]);
                $this->stockService->logChanges($orderId, $leg['changes']);
                $bookings[] = ['orderId' => $orderId, 'orderNo' => $orderNo, 'goodsName' => $leg['goods']['goods_name'], 'payAmount' => $payAmount];
            }

            return [
                'tripId' => $tripId,
                'tripNo' => $tripNo,
                'totalAmount' => $tripTotal,
                'couponDiscount' => $couponDiscount,
                'payAmount' => max(0.0, round($tripTotal - $couponDiscount, 2)),
                'bookings' => $bookings,
            ];
        });

        return Result::success($result, 'Trip 已创建,请在15分钟内完成支付');
    }

    /** 支付整个 Trip(单笔支付):确认其下所有预订,券消耗一次 */
    public function pay(): array
    {
        $tripId = $this->requireId('tripId');
        $payMethod = $this->intInput('payMethod', 1);
        if (! in_array($payMethod, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '支付方式不正确');
        }

        $siteId = $this->requireSiteId();
        $tripSnapshot = Db::table('order_trip')->where('id', $tripId)->where('site_id', $siteId)
            ->where('user_id', UserContext::userId())->whereNull('deleted_at')->first();
        if (! $tripSnapshot) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'Trip不存在');
        }
        $snapshots = Db::table('order_main')->where('trip_id', $tripId)->where('site_id', $siteId)
            ->where('user_id', UserContext::userId())->whereNull('deleted_at')->orderBy('id')->get()
            ->map(static fn ($row) => (array) $row)->all();
        $snap = Db::transaction(function () use ($tripId, $payMethod, $siteId, $snapshots) {
            MerchantAccessGuard::lockBookable($snapshots, $siteId);
            $trip = Db::table('order_trip')->where('id', $tripId)->where('site_id', $siteId)
                ->where('user_id', UserContext::userId())->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if (! $trip) {
                throw new BusinessException(ErrorCode::NOT_FOUND, 'Trip 不存在');
            }
            $trip = (array) $trip;
            if ((int) $trip['pay_status'] !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip 不是待支付状态');
            }
            $bookings = Db::table('order_main')->where('trip_id', $tripId)->whereNull('deleted_at')->orderBy('id')->lockForUpdate()->get();
            if ($bookings->count() === 0 || $bookings->count() !== count($snapshots) || $bookings->count() !== (int) $trip['booking_count']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip预订已变更');
            }
            foreach ($bookings as $index => $booking) {
                foreach (['id', 'merchant_id', 'site_id', 'user_id', 'order_type', 'supplier_id'] as $field) {
                    if ((int) $booking->{$field} !== (int) $snapshots[$index][$field]) {
                        throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip预订归属已变更');
                    }
                }
                if ((int) $booking->order_status !== 0) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip包含非待支付预订');
                }
            }
            Db::table('order_trip')->where('id', $tripId)->update([
                'pay_status' => 1,
                'pay_method' => $payMethod,
                'pay_trade_no' => 'MOCK' . OrderNoGenerator::flowNo(),
                'pay_time' => date('Y-m-d H:i:s'),
            ]);


            $codes = [];
            $firstBookingId = 0;
            foreach ($bookings as $b) {
                $b = (array) $b;
                if ($firstBookingId === 0) {
                    $firstBookingId = (int) $b['id'];
                }
                $verifyCode = OrderNoGenerator::verifyCode();
                Db::table('order_main')->where('id', $b['id'])->update([
                    'order_status' => 1,
                    'pay_method' => $payMethod,
                    'pay_trade_no' => 'MOCK' . OrderNoGenerator::flowNo(),
                    'pay_time' => date('Y-m-d H:i:s'),
                    'verify_code' => $verifyCode,
                ]);
                $this->stockService->deduct($b);
                Db::table('goods_info')->where('id', (int) $b['goods_id'])->increment('sales_count', (int) $b['quantity']);
                $this->settlementService->recordBooking($b);
                $codes[] = ['orderNo' => $b['order_no'], 'verifyCode' => $verifyCode];
            }

            // 整单券消耗一次
            if ((int) $trip['coupon_id'] > 0) {
                $rec = Db::table('marketing_coupon_receive')->where('id', (int) $trip['coupon_id'])
                    ->where('status', 0)->lockForUpdate()->first(['id', 'coupon_id']);
                if ($rec) {
                    Db::table('marketing_coupon_receive')->where('id', $rec->id)->update([
                        'status' => 1, 'order_id' => $tripId, 'used_time' => date('Y-m-d H:i:s'),
                    ]);
                    Db::table('marketing_coupon')->where('id', $rec->coupon_id)->increment('used_count');
                }
            }
            // 推荐返利:Trip 内均为酒店订单,首单达成即发放(仅首单,幂等)
            if ($firstBookingId > 0) {
                $this->referralService->grantOnFirstBooking((int) $trip['site_id'], (int) $trip['user_id'], $firstBookingId);
            }
            return ['siteId' => (int) $trip['site_id'], 'userId' => (int) $trip['user_id'], 'tripNo' => (string) $trip['trip_no'], 'codes' => $codes];
        });

        // 预订确认通知(整单一次,后置容错)
        try {
            $this->notifyService->pushOrder(
                $snap['siteId'], $snap['userId'], 'booking_confirmed',
                'Trip 预订已确认',
                "您的行程 {$snap['tripNo']} 下 " . count($snap['codes']) . ' 个酒店预订已全部确认,可在「我的预订」查看各凭证。',
                $this->requireId('tripId'),
            );
        } catch (\Throwable) {
        }

        return Result::success(['codes' => $snap['codes']], '支付成功,行程内各预订已确认');
    }

    /** Trip 详情:主单 + 各预订(按入住日排序,展示各自状态) */
    public function detail(): array
    {
        $tripId = $this->requireId('tripId');
        $trip = Db::table('order_trip')->where('id', $tripId)
            ->where('user_id', UserContext::userId())->whereNull('deleted_at')->first();
        if (! $trip) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'Trip 不存在');
        }
        $trip = (array) $trip;
        unset($trip['deleted_at']);
        $bookings = Db::table('order_main')->where('trip_id', $tripId)->whereNull('deleted_at')
            ->orderBy('use_date')->orderBy('id')
            ->get(['id', 'order_no', 'goods_name', 'goods_image', 'sku_name', 'quantity',
                'pay_amount', 'alloc_coupon_discount', 'order_status', 'refund_status', 'use_date', 'end_date'])
            ->map(static fn ($row) => (array) $row)->all();
        $trip['bookings'] = $bookings;
        return Result::success($trip);
    }

    /** 我的 Trip 分页 */
    public function list(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_trip')->where('user_id', UserContext::userId())->whereNull('deleted_at');
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'trip_no', 'total_amount', 'coupon_discount', 'pay_amount', 'booking_count', 'pay_status', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 校验并取数单个行程项(无副作用) */
    private function prepareItem(int $siteId, array $item, int $idx): array
    {
        $goodsId = (int) ($item['goodsId'] ?? 0);
        $skuId = (int) ($item['skuId'] ?? 0);
        $quantity = (int) ($item['quantity'] ?? 1);
        if ($goodsId <= 0 || $skuId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "第" . ($idx + 1) . "项缺少 goodsId/skuId");
        }
        if ($quantity < 1 || $quantity > 10) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "第" . ($idx + 1) . "项数量须为1-10");
        }
        $useDate = trim((string) ($item['useDate'] ?? ''));
        $endDate = trim((string) ($item['endDate'] ?? ''));
        $contactName = trim((string) ($item['contactName'] ?? ''));
        $contactPhone = trim((string) ($item['contactPhone'] ?? ''));
        if ($useDate === '' || $endDate === '' || $contactName === '' || $contactPhone === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "第" . ($idx + 1) . "项缺少入离店日期或联系人");
        }

        $goods = Db::table('goods_info')->where('id', $goodsId)->where('site_id', $siteId)
            ->where('status', 3)->whereNull('deleted_at')->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, "第" . ($idx + 1) . "项酒店不存在或已下架");
        }
        $goods = (array) $goods;
        if ((int) $goods['goods_type'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Trip 仅支持酒店预订');
        }
        $sku = Db::table('hotel_room_type')->where('id', $skuId)->where('goods_id', $goodsId)
            ->where('status', 1)->whereNull('deleted_at')->first();
        if (! $sku) {
            throw new BusinessException(ErrorCode::NOT_FOUND, "第" . ($idx + 1) . "项房型不存在或已停售");
        }
        $sku = (array) $sku;
        $dates = $this->stockService->datesOf(1, $useDate, $endDate);
        if (strtotime($dates[0]) < strtotime(date('Y-m-d'))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "第" . ($idx + 1) . "项入住日期不能早于今天");
        }

        return [
            'goodsId' => $goodsId, 'skuId' => $skuId, 'quantity' => $quantity,
            'useDate' => $useDate, 'endDate' => $endDate, 'dates' => $dates,
            'isCitizen' => (int) ($item['isCitizen'] ?? 0) === 1,
            'contactName' => $contactName, 'contactPhone' => $contactPhone,
            'guests' => $this->pricingService->normalizeGuests($item['travelers'] ?? null, $quantity),
            'remark' => mb_substr(trim((string) ($item['remark'] ?? '')), 0, 500),
            'goods' => $goods, 'sku' => $sku,
        ];
    }

    /** 券按各项净额占比分摊,末项吸收四舍五入余数,保证合计=券额 */
    private function allocate(float $discount, array $nets, float $total): array
    {
        $n = count($nets);
        $allocs = [];
        if ($discount <= 0 || $total <= 0) {
            return array_fill(0, $n, 0.0);
        }
        $acc = 0.0;
        foreach ($nets as $i => $net) {
            if ($i < $n - 1) {
                $a = round($discount * $net / $total, 2);
                $acc = round($acc + $a, 2);
            } else {
                $a = round($discount - $acc, 2);
            }
            $allocs[$i] = max(0.0, $a);
        }
        return $allocs;
    }

    private function aesKey(): string
    {
        return (string) $this->config->get('mtrip.aes_key', '');
    }
}
