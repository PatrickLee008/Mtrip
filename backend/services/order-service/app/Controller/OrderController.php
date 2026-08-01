<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\OrderStockService;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\Result;

/**
 * C端订单接口:下单/支付(本期mock)/列表/详情/取消/退款申请/核销码
 * 正式 Stripe/PayPal 收单归 payment-service(模块06)
 */
class OrderController extends AbstractController
{
    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected ConfigInterface $config;

    /** 创建订单:锁定价格日历库存,15分钟未支付由定时任务过期 */
    public function create(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $goodsId = $this->requireId('goodsId');
        $skuId = $this->requireId('skuId');
        $quantity = $this->intInput('quantity', 1);
        if ($quantity < 1 || $quantity > 10) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '购买数量须为1-10');
        }
        $useDate = $this->requireStr('useDate');
        $contactName = $this->requireStr('contactName');
        $contactPhone = $this->requireStr('contactPhone');

        $goods = Db::table('goods_info')
            ->where('id', $goodsId)->where('site_id', $siteId)
            ->where('status', 3)->whereNull('deleted_at')
            ->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在或已下架');
        }
        $goods = (array) $goods;
        $orderType = (int) $goods['goods_type'];
        $endDate = $orderType === 1 ? $this->requireStr('endDate') : null;

        $skuTable = $orderType === 1 ? 'hotel_room_type' : 'ticket_type';
        $sku = Db::table($skuTable)
            ->where('id', $skuId)->where('goods_id', $goodsId)
            ->where('status', 1)->whereNull('deleted_at')
            ->first();
        if (! $sku) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '房型/票种不存在或已停售');
        }
        $sku = (array) $sku;
        if ($orderType === 2 && (int) $sku['book_limit'] > 0 && $quantity > (int) $sku['book_limit']) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "该票种单人限购{$sku['book_limit']}张");
        }

        $dates = $this->stockService->datesOf($orderType, $useDate, $endDate);
        if (strtotime($dates[0]) < strtotime(date('Y-m-d'))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '使用日期不能早于今天');
        }

        $isCitizen = $this->intInput('isCitizen', 0) === 1;
        $couponId = $this->intInput('couponId', 0);
        $guests = $this->normalizeGuests($this->input('travelers'), $quantity);
        $remark = mb_substr($this->strInput('remark'), 0, 500);

        $orderNo = OrderNoGenerator::orderNo($siteId);
        $priced = Db::transaction(function () use (
            $siteId, $userId, $goods, $sku, $orderType, $goodsId, $skuId,
            $quantity, $dates, $useDate, $endDate, $orderNo, $contactName, $contactPhone,
            $isCitizen, $couponId, $guests, $remark
        ) {
            [$totalAmount, $changes] = $this->stockService->lock(
                $siteId, $goodsId, $orderType, $skuId, $sku, $dates, $quantity, $isCitizen
            );
            // 长住优惠:仅酒店,按住宿夜数命中最高梯度,对原总价打折
            $longstay = $orderType === 1 ? $this->longstayDiscount($siteId, count($dates), $totalAmount) : 0.0;
            // 优惠券(可选):校验归属/状态/有效期/适用范围/门槛,计算抵扣(不在此消耗,支付时消耗)
            [$couponRefId, $couponDiscount] = $couponId > 0
                ? $this->resolveCoupon($siteId, $userId, $couponId, $orderType, $goodsId, round($totalAmount - $longstay, 2))
                : [0, 0.0];
            $payAmount = max(0.0, round($totalAmount - $longstay - $couponDiscount, 2));
            $unitPrice = round($totalAmount / max(1, count($dates)) / $quantity, 2);
            $orderId = (int) Db::table('order_main')->insertGetId([
                'order_no' => $orderNo,
                'site_id' => $siteId,
                'user_id' => $userId,
                'order_type' => $orderType,
                'is_citizen' => $isCitizen ? 1 : 0,
                'merchant_id' => (int) $goods['merchant_id'],
                'supplier_id' => (int) $goods['supplier_id'],
                'goods_id' => $goodsId,
                'goods_name' => (string) $goods['goods_name'],
                'goods_image' => (string) $goods['cover_image'],
                'sku_id' => $skuId,
                'sku_name' => (string) ($sku['room_name'] ?? $sku['ticket_name'] ?? ''),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'original_price' => (float) $sku['base_price'],
                'total_amount' => $totalAmount,
                'discount_amount' => round($longstay + $couponDiscount, 2),
                'longstay_discount' => $longstay,
                'coupon_id' => $couponRefId,
                'coupon_discount' => $couponDiscount,
                'alloc_coupon_discount' => $couponDiscount,
                'pay_amount' => $payAmount,
                'order_status' => 0,
                'use_date' => $useDate,
                'end_date' => $endDate,
                'contact_name' => mb_substr($contactName, 0, 50),
                'contact_phone' => CryptoHelper::encrypt($contactPhone, $this->aesKey()),
                'guests' => $guests !== [] ? json_encode($guests, JSON_UNESCAPED_UNICODE) : null,
                'remark' => $remark,
            ]);
            $this->stockService->logChanges($orderId, $changes);
            return [
                'orderId' => $orderId,
                'original' => $totalAmount,
                'longstay' => $longstay,
                'coupon' => $couponDiscount,
                'payAmount' => $payAmount,
            ];
        });

        return Result::success([
            'orderId' => $priced['orderId'],
            'orderNo' => $orderNo,
            'priceDetail' => [
                'original' => $priced['original'],
                'longstayDiscount' => $priced['longstay'],
                'couponDiscount' => $priced['coupon'],
                'payAmount' => $priced['payAmount'],
            ],
        ], '下单成功,请在15分钟内完成支付');
    }

    /** 支付(本期mock):payMethod 1Stripe 2PayPal,直接置为已支付并生成核销码 */
    public function pay(): array
    {
        $orderId = $this->requireId('orderId');
        $payMethod = $this->intInput('payMethod', 1);
        if (! in_array($payMethod, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '支付方式不正确');
        }

        $result = Db::transaction(function () use ($orderId, $payMethod) {
            $order = $this->lockOwnOrder($orderId);
            if ((int) $order['order_status'] !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单不是待支付状态');
            }
            $verifyCode = OrderNoGenerator::verifyCode();
            Db::table('order_main')->where('id', $orderId)->update([
                'order_status' => 1,
                'pay_method' => $payMethod,
                'pay_trade_no' => 'MOCK' . OrderNoGenerator::flowNo(),
                'pay_time' => date('Y-m-d H:i:s'),
                'verify_code' => $verifyCode,
            ]);
            $this->stockService->deduct($order);
            Db::table('goods_info')->where('id', (int) $order['goods_id'])
                ->increment('sales_count', (int) $order['quantity']);
            // 支付成功消耗优惠券:领券记录置已用 + 模板已用数+1(仅当仍未使用)
            if ((int) $order['coupon_id'] > 0) {
                $rec = Db::table('marketing_coupon_receive')
                    ->where('id', (int) $order['coupon_id'])
                    ->where('status', 0)
                    ->lockForUpdate()
                    ->first(['id', 'coupon_id']);
                if ($rec) {
                    Db::table('marketing_coupon_receive')->where('id', $rec->id)->update([
                        'status' => 1,
                        'order_id' => $orderId,
                        'used_time' => date('Y-m-d H:i:s'),
                    ]);
                    Db::table('marketing_coupon')->where('id', $rec->coupon_id)->increment('used_count');
                }
            }
            return ['verifyCode' => $verifyCode];
        });

        return Result::success($result, '支付成功');
    }

    /** 我的订单分页:status 可选过滤 */
    public function list(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_main')
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->orderByDesc('id');
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('order_status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)
            ->get(['id', 'order_no', 'order_type', 'goods_id', 'goods_name', 'goods_image',
                'sku_name', 'quantity', 'pay_amount', 'order_status', 'refund_status',
                'use_date', 'end_date', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 订单详情:联系人手机号脱敏,已支付订单含核销码 */
    public function detail(): array
    {
        $order = $this->ownOrder($this->requireId('orderId'));
        $order['contact_phone'] = MaskHelper::mobile($this->decryptPhone((string) $order['contact_phone']));
        if (! in_array((int) $order['order_status'], [1, 2], true)) {
            $order['verify_code'] = '';
        }
        unset($order['platform_commission'], $order['merchant_receivable'], $order['supplier_cost'], $order['deleted_at']);
        return Result::success($order);
    }

    /** 取消待支付订单:释放锁定库存 */
    public function cancel(): array
    {
        $orderId = $this->requireId('orderId');
        Db::transaction(function () use ($orderId) {
            $order = $this->lockOwnOrder($orderId);
            if ((int) $order['order_status'] !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待支付订单可直接取消');
            }
            Db::table('order_main')->where('id', $orderId)->update([
                'order_status' => 4,
                'cancel_reason' => mb_substr($this->strInput('reason', '用户主动取消'), 0, 500),
                'cancel_time' => date('Y-m-d H:i:s'),
            ]);
            $this->stockService->release($order);
        });
        return Result::success(null, '订单已取消');
    }

    /**
     * 退款预览(取消页透明展示):按退改规则算可退,再扣平台便民费(仅用户主动取消收)。
     * PRD 模块 11:结账不收平台费,取消时才从可退额扣;取消页展示 取消费/退款额。
     */
    public function refundQuote(): array
    {
        $order = $this->ownOrder($this->requireId('orderId'));
        if ((int) $order['order_status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已支付且未使用的订单可预览退款');
        }
        $q = $this->computeRefund($order);
        return Result::success([
            'payAmount' => $q['payAmount'],
            'refundable' => $q['refundable'],
            'cancellationFee' => round($q['payAmount'] - $q['refundable'], 2),
            'platformFee' => $q['platformFee'],
            'refundAmount' => $q['refundAmount'],
            'refundChannel' => 1,
            'refundChannelText' => 'mTrip 钱包',
        ]);
    }

    /** 申请退款:已支付未使用订单,按退改规则+平台费核算净退款额,进入商户审核流 */
    public function applyRefund(): array
    {
        $orderId = $this->requireId('orderId');
        $reason = $this->requireStr('reason');
        $refundNo = 'R' . date('YmdHis') . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Db::transaction(function () use ($orderId, $reason, $refundNo) {
            $order = $this->lockOwnOrder($orderId);
            if ((int) $order['order_status'] !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已支付且未使用的订单可申请退款');
            }
            $q = $this->computeRefund($order);
            if ($q['refundAmount'] <= 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '按退改规则该订单不可退款');
            }
            $images = $this->input('images');
            Db::table('order_refund')->insert([
                'refund_no' => $refundNo,
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'user_id' => (int) $order['user_id'],
                'merchant_id' => (int) $order['merchant_id'],
                'refund_type' => $q['refundAmount'] >= (float) $order['pay_amount'] ? 1 : 2,
                'apply_amount' => $q['refundAmount'],
                'refund_channel' => 1,
                'reason' => mb_substr($reason, 0, 500),
                'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null,
                'status' => 0,
            ]);
            // 记录本单平台便民费(用于对账);退款目的地为 mTrip 钱包(refund_channel=1)
            Db::table('order_main')->where('id', $orderId)->update([
                'order_status' => 5,
                'refund_status' => 1,
                'platform_fee' => $q['platformFee'],
            ]);
        });
        return Result::success(['refundNo' => $refundNo], '退款申请已提交,等待商户审核');
    }

    /**
     * 退款核算:refundable=按退改规则可退额;platformFee=可退额×站点便民费率(仅用户主动取消);
     * refundAmount=refundable−platformFee。
     * @return array{payAmount:float,refundable:float,platformFee:float,refundAmount:float}
     */
    private function computeRefund(array $order): array
    {
        $pay = (float) $order['pay_amount'];
        $rule = Db::table('goods_refund_rule')
            ->where('goods_id', (int) $order['goods_id'])
            ->whereNull('deleted_at')
            ->where(static function ($q) use ($order) {
                $q->where(static function ($q2) use ($order) {
                    $q2->where('sku_type', (int) $order['order_type'])->where('sku_id', (int) $order['sku_id']);
                })->orWhere('sku_type', 0);
            })
            ->orderByDesc('sku_type') // SKU 级(1/2)优先于商品级(0)
            ->first();

        $refundable = $pay; // 无规则视为免费取消(全额可退)
        if ($rule) {
            $rule = (array) $rule;
            $type = (int) $rule['rule_type'];
            if ($type === 3) {
                $refundable = 0.0;              // 不可退
            } elseif ($type === 2) {
                $refundable = $this->stepRefundable($pay, $rule, $order); // 阶梯
            }
            // type=1 免费取消 → 全额
        }
        $rate = $this->platformFeeRate((int) $order['site_id']);
        $platformFee = round($refundable * $rate, 2);
        $refundAmount = max(0.0, round($refundable - $platformFee, 2));
        return [
            'payAmount' => round($pay, 2),
            'refundable' => round($refundable, 2),
            'platformFee' => $platformFee,
            'refundAmount' => $refundAmount,
        ];
    }

    /** 阶梯退款:rules=[{hours_before,refund_rate}],按距入住剩余小时命中可满足的最优档 */
    private function stepRefundable(float $pay, array $rule, array $order): float
    {
        $rules = is_string($rule['rules']) ? (json_decode((string) $rule['rules'], true) ?: []) : (array) ($rule['rules'] ?? []);
        if ($rules === []) {
            return $pay;
        }
        $checkin = strtotime((string) $order['use_date'] . ' 14:00:00');
        $hoursUntil = $checkin !== false ? ($checkin - time()) / 3600 : 0;
        usort($rules, static fn ($a, $b) => (float) ($b['hours_before'] ?? 0) <=> (float) ($a['hours_before'] ?? 0));
        foreach ($rules as $tier) {
            if ($hoursUntil >= (float) ($tier['hours_before'] ?? 0)) {
                return round($pay * (float) ($tier['refund_rate'] ?? 0) / 100, 2);
            }
        }
        return 0.0; // 离入住太近,无满足档
    }

    /** 站点平台便民费率:sys_site_config.platform_fee_rate(百分比,如 5=5%),未配=0 */
    private function platformFeeRate(int $siteId): float
    {
        $value = Db::connection('system')->table('sys_site_config')
            ->where('site_id', $siteId)
            ->where('config_key', 'platform_fee_rate')
            ->whereNull('deleted_at')
            ->value('config_value');
        $rate = $value !== null ? (float) $value : 0.0;
        return $rate > 0 ? $rate / 100 : 0.0;
    }

    /** 核销码(二维码展示):仅已支付/已核销订单 */
    public function verifyCode(): array
    {
        $order = $this->ownOrder($this->requireId('orderId'));
        if (! in_array((int) $order['order_status'], [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单当前状态无核销码');
        }
        return Result::success([
            'orderNo' => $order['order_no'],
            'verifyCode' => $order['verify_code'],
            'orderStatus' => (int) $order['order_status'],
            'goodsName' => $order['goods_name'],
            'skuName' => $order['sku_name'],
            'quantity' => (int) $order['quantity'],
            'useDate' => $order['use_date'],
        ]);
    }

    /** 取本人订单,不存在抛404 */
    private function ownOrder(int $orderId): array
    {
        $order = Db::table('order_main')
            ->where('id', $orderId)
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        return (array) $order;
    }

    /** 事务内行锁取本人订单 */
    private function lockOwnOrder(int $orderId): array
    {
        $order = Db::table('order_main')
            ->where('id', $orderId)
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        return (array) $order;
    }

    /** 长住优惠额:命中站点内 min_nights<=夜数 的最高梯度,按原总价乘折扣率 */
    private function longstayDiscount(int $siteId, int $nights, float $total): float
    {
        $tier = Db::table('marketing_longstay_tier')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->where('min_nights', '<=', $nights)
            ->whereNull('deleted_at')
            ->orderByDesc('min_nights')
            ->first(['discount_rate']);
        if (! $tier) {
            return 0.0;
        }
        return round($total * (float) $tier->discount_rate / 100, 2);
    }

    /**
     * 校验优惠券并计算抵扣(须在事务内调用,行锁领券记录防并发)。
     * 券在此不消耗,支付成功时才置已用。
     * @return array{0:int,1:float} [领券记录ID, 抵扣金额]
     */
    private function resolveCoupon(int $siteId, int $userId, int $receiveId, int $orderType, int $goodsId, float $base): array
    {
        $rec = Db::table('marketing_coupon_receive')
            ->where('id', $receiveId)
            ->where('user_id', $userId)
            ->where('site_id', $siteId)
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();
        if (! $rec) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
        }
        $rec = (array) $rec;
        if ((int) $rec['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券已使用或已失效');
        }
        $now = date('Y-m-d H:i:s');
        if (($rec['valid_start'] && $now < $rec['valid_start']) || ($rec['valid_end'] && $now > $rec['valid_end'])) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券不在有效期');
        }
        $coupon = Db::table('marketing_coupon')->where('id', $rec['coupon_id'])->whereNull('deleted_at')->first();
        if (! $coupon) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券模板不存在');
        }
        $coupon = (array) $coupon;
        // 适用范围:0全部 1酒店 2门票 3指定商品
        $scope = (int) $coupon['goods_scope'];
        if ($scope === 1 && $orderType !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券仅限酒店订单');
        }
        if ($scope === 2 && $orderType !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券仅限门票订单');
        }
        if ($scope === 3) {
            $ids = is_string($coupon['goods_ids']) ? (json_decode($coupon['goods_ids'], true) ?: []) : (array) ($coupon['goods_ids'] ?? []);
            if (! in_array($goodsId, array_map('intval', $ids), true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券不适用于本商品');
            }
        }
        // 门槛
        $min = (float) $coupon['min_amount'];
        if ($min > 0 && $base < $min) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '未满使用门槛');
        }
        // 抵扣:1满减/3无门槛=直减金额;2折扣券=discount_value 为折扣率(8.50=8.5折,用户付85%),max_discount 封顶
        $type = (int) $coupon['coupon_type'];
        $val = (float) $coupon['discount_value'];
        $maxD = (float) $coupon['max_discount'];
        if ($type === 2) {
            $discount = round($base * (1 - $val / 10), 2);
            if ($maxD > 0 && $discount > $maxD) {
                $discount = $maxD;
            }
        } else {
            $discount = $val;
        }
        $discount = max(0.0, min($discount, $base));
        return [$receiveId, round($discount, 2)];
    }

    /** 住客名单归一化:最多 qty 条,每条取 firstName/lastName/phone/email 并限长 */
    private function normalizeGuests(mixed $input, int $qty): array
    {
        if (! is_array($input)) {
            return [];
        }
        $out = [];
        foreach (array_slice(array_values($input), 0, max(1, $qty)) as $g) {
            if (! is_array($g)) {
                continue;
            }
            $out[] = [
                'firstName' => mb_substr(trim((string) ($g['firstName'] ?? '')), 0, 50),
                'lastName' => mb_substr(trim((string) ($g['lastName'] ?? '')), 0, 50),
                'phone' => mb_substr(trim((string) ($g['phone'] ?? '')), 0, 30),
                'email' => mb_substr(trim((string) ($g['email'] ?? '')), 0, 100),
            ];
        }
        return $out;
    }

    private function aesKey(): string
    {
        return (string) $this->config->get('mtrip.aes_key', '');
    }

    private function decryptPhone(string $ciphertext): string
    {
        if ($ciphertext === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return '';
        }
    }
}
