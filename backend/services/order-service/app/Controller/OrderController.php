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

        $orderNo = OrderNoGenerator::orderNo($siteId);
        $orderId = Db::transaction(function () use (
            $siteId, $userId, $goods, $sku, $orderType, $goodsId, $skuId,
            $quantity, $dates, $useDate, $endDate, $orderNo, $contactName, $contactPhone
        ) {
            [$totalAmount, $changes] = $this->stockService->lock(
                $siteId, $goodsId, $orderType, $skuId, $sku, $dates, $quantity
            );
            $unitPrice = round($totalAmount / max(1, count($dates)) / $quantity, 2);
            $orderId = (int) Db::table('order_main')->insertGetId([
                'order_no' => $orderNo,
                'site_id' => $siteId,
                'user_id' => $userId,
                'order_type' => $orderType,
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
                'pay_amount' => $totalAmount,
                'order_status' => 0,
                'use_date' => $useDate,
                'end_date' => $endDate,
                'contact_name' => mb_substr($contactName, 0, 50),
                'contact_phone' => CryptoHelper::encrypt($contactPhone, $this->aesKey()),
                'remark' => mb_substr($this->strInput('remark'), 0, 500),
            ]);
            $this->stockService->logChanges($orderId, $changes);
            return $orderId;
        });

        return Result::success([
            'orderId' => $orderId,
            'orderNo' => $orderNo,
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

    /** 申请退款:已支付未使用订单,进入商户审核流(退款审核归管理端) */
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
            $images = $this->input('images');
            Db::table('order_refund')->insert([
                'refund_no' => $refundNo,
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'user_id' => (int) $order['user_id'],
                'merchant_id' => (int) $order['merchant_id'],
                'refund_type' => 1,
                'apply_amount' => (float) $order['pay_amount'],
                'reason' => mb_substr($reason, 0, 500),
                'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null,
                'status' => 0,
            ]);
            Db::table('order_main')->where('id', $orderId)->update([
                'order_status' => 5,
                'refund_status' => 1,
            ]);
        });
        return Result::success(['refundNo' => $refundNo], '退款申请已提交,等待商户审核');
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
