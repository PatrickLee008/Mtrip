<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Service\FraudService;
use App\Service\NotifyService;
use App\Service\OrderStockService;
use App\Service\PricingService;
use App\Service\ReferralService;
use App\Service\SettlementService;
use App\Service\WalletService;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
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
    protected WalletService $walletService;

    #[Inject]
    protected NotifyService $notifyService;

    #[Inject]
    protected FraudService $fraudService;

    #[Inject]
    protected SettlementService $settlementService;

    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected ReferralService $referralService;

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
        $guests = $this->pricingService->normalizeGuests($this->input('travelers'), $quantity);
        $remark = mb_substr($this->strInput('remark'), 0, 500);

        $orderNo = OrderNoGenerator::orderNo($siteId);
        $priced = Db::transaction(function () use (
            $siteId, $userId, $goods, $sku, $orderType, $goodsId, $skuId,
            $quantity, $dates, $useDate, $endDate, $orderNo, $contactName, $contactPhone,
            $isCitizen, $couponId, $guests, $remark
        ) {
            MerchantAccessGuard::lockBookable([$goods], $siteId);
            MerchantAccessGuard::lockGoods([$goods], $siteId);
            $sku = (array) Db::table($orderType === 1 ? 'hotel_room_type' : 'ticket_type')
                ->where('id', $skuId)->where('goods_id', $goodsId)->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
            if ($sku === []) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型/票种已停售');
            }
            [$totalAmount, $changes] = $this->stockService->lock(
                $siteId, $goodsId, $orderType, $skuId, $sku, $dates, $quantity, $isCitizen
            );
            // 长住优惠:仅酒店,按住宿夜数命中最高梯度,对原总价打折
            $longstay = $orderType === 1 ? $this->pricingService->longstayDiscount($siteId, count($dates), $totalAmount) : 0.0;
            // 优惠券(可选):校验归属/状态/有效期/适用范围/门槛,计算抵扣(不在此消耗,支付时消耗)
            [$couponRefId, $couponDiscount] = $couponId > 0
                ? $this->pricingService->resolveCoupon($siteId, $userId, $couponId, $orderType, $goodsId, round($totalAmount - $longstay, 2))
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
                'guests' => $guests !== [] ? CryptoHelper::encrypt(json_encode($guests, JSON_UNESCAPED_UNICODE), $this->aesKey()) : null,
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

        $snapshot = Db::table('order_main')->where('id', $orderId)->where('site_id', $this->requireSiteId())
            ->where('user_id', UserContext::userId())->whereNull('deleted_at')->first();
        if (! $snapshot) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $snapshot = (array) $snapshot;
        $result = Db::transaction(function () use ($orderId, $payMethod, $snapshot) {
            MerchantAccessGuard::lockBookable([$snapshot], (int) $snapshot['site_id']);
            $order = $this->lockOwnOrder($orderId);
            foreach (['merchant_id', 'site_id', 'order_type', 'supplier_id'] as $field) {
                if ((int) $order[$field] !== (int) $snapshot[$field]) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单归属已变更');
                }
            }
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
            // 推荐返利:被推荐人首个已支付酒店订单达成 → 奖励入推荐人钱包(PRD 模块14)
            if ((int) $order['order_type'] === 1) {
                $this->referralService->grantOnFirstBooking((int) $order['site_id'], (int) $order['user_id'], $orderId);
            }
            // 结算分录:按优惠券出资方生成按订单分账(PRD 模块8),回填订单佣金/商户实收
            $this->settlementService->recordBooking($order);
            return [
                'verifyCode' => $verifyCode,
                'siteId' => (int) $order['site_id'],
                'userId' => (int) $order['user_id'],
                'goodsName' => (string) $order['goods_name'],
                'orderNo' => (string) $order['order_no'],
            ];
        });

        // 预订确认站内通知(事件后置,失败不影响支付结果)
        try {
            $this->notifyService->pushOrder(
                $result['siteId'], $result['userId'], 'booking_confirmed',
                '预订已确认',
                "您的预订「{$result['goodsName']}」(订单 {$result['orderNo']})已确认,可在「我的预订」查看凭证。",
                $orderId,
            );
        } catch (\Throwable) {
        }

        return Result::success(['verifyCode' => $result['verifyCode']], '支付成功');
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
        $order['guests'] = $this->decryptGuests((string) ($order['guests'] ?? ''));
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

        $snap = Db::transaction(function () use ($orderId, $reason, $refundNo) {
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
            return [
                'siteId' => (int) $order['site_id'],
                'userId' => (int) $order['user_id'],
                'goodsName' => (string) $order['goods_name'],
                'orderNo' => (string) $order['order_no'],
                'refundAmount' => $q['refundAmount'],
            ];
        });

        // 预订取消/退款站内通知(事件后置,失败不影响退款申请)
        try {
            $this->notifyService->pushOrder(
                $snap['siteId'], $snap['userId'], 'booking_cancelled',
                '退款申请已提交',
                "您的预订「{$snap['goodsName']}」(订单 {$snap['orderNo']})退款申请已提交,预计退回 mTrip 钱包 {$snap['refundAmount']},审核通过后到账。",
                $orderId,
            );
        } catch (\Throwable) {
        }
        // 风控:取消/退款行为评估(阈值化,后置容错,不影响退款申请)
        try {
            $this->fraudService->evaluateCancellation($snap['siteId'], $snap['userId']);
        } catch (\Throwable) {
        }

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

    /**
     * 推荐返利发放(须在事务内调用):被推荐人首个已支付酒店订单达成时,
     * 按站点配置的奖励额给推荐人+新人钱包入账,并把绑定记录置已发放(reward_status=0→1 保证仅首单发放)。
     */
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

    /** 解密住客名单并对手机号/邮箱脱敏(整块 AES 存储) */
    private function decryptGuests(string $ciphertext): array
    {
        if ($ciphertext === '') {
            return [];
        }
        try {
            $json = CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return [];
        }
        $arr = json_decode($json, true);
        if (! is_array($arr)) {
            return [];
        }
        return array_map(static function ($g) {
            $g = (array) $g;
            return [
                'firstName' => (string) ($g['firstName'] ?? ''),
                'lastName' => (string) ($g['lastName'] ?? ''),
                'phone' => MaskHelper::mobile((string) ($g['phone'] ?? '')),
                'email' => MaskHelper::email((string) ($g['email'] ?? '')),
            ];
        }, $arr);
    }
}
