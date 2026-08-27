<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 商户端订单与核销:数据范围强制 MerchantContext 商户集合
 * 集团→可访问的绑定商户订单；商户→本商户订单；门店在订单归属模型补齐前不开放。
 */
class OrderController extends AbstractAdminController
{
    /** 订单列表 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_main')->whereNull('deleted_at');
        $this->applyMerchantScope($query);
        if (($orderNo = $this->strInput('orderNo')) !== '') {
            $query->where('order_no', $orderNo);
        }
        if (($type = $this->intInput('orderType')) > 0) {
            $query->where('order_type', $type);
        }
        $status = $this->input('orderStatus');
        if ($status !== null && $status !== '') {
            $query->where('order_status', (int) $status);
        }
        if (($name = $this->strInput('contactName')) !== '') {
            $query->where('contact_name', 'like', "%{$name}%");
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        if (($useDate = $this->strInput('useDate')) !== '') {
            $query->where('use_date', $useDate);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 订单详情(含核销日志) */
    public function detail(): array
    {
        $order = $this->findScoped($this->requireId());
        $order['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $order['contact_phone']));
        unset($order['deleted_at']);
        $verifyLogs = Db::table('order_verify_log')
            ->where('order_id', $order['id'])->orderByDesc('id')->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::success(['order' => $order, 'verifyLogs' => $verifyLogs]);
    }

    /** 手工核销:按订单ID或核销码;仅已支付订单 1→2 */
    #[Permission('mch:order:verify')]
    public function verify(): array
    {
        $order = $this->resolveOrder();
        if ((int) $order['order_status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已支付订单可核销');
        }
        if ($order['use_date'] !== null && (string) $order['use_date'] > date('Y-m-d')) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "订单使用日期为 {$order['use_date']},尚未到期");
        }
        Db::transaction(static function () use ($order) {
            Db::table('order_main')->where('id', $order['id'])->update(['order_status' => 2]);
            Db::table('order_verify_log')->insert([
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'verify_code' => (string) $order['verify_code'],
                'merchant_id' => (int) $order['merchant_id'],
                'device_id' => 0,
                'operator_id' => MerchantContext::adminId(),
                'operator_name' => MerchantContext::adminName(),
                'verify_type' => 3,
                'status' => 1,
            ]);
        });
        return Result::success(['orderId' => (int) $order['id']], '核销成功');
    }

    /** 商户数据范围:按可见商户集合过滤 */
    private function applyMerchantScope($query): void
    {
        $merchantIds = MerchantContext::scopeMerchantIds();
        // 订单尚无门店归属字段，不能把商户全集授权给门店账号。
        $query->where('site_id', MerchantContext::siteId());
        $query->whereIn('merchant_id', MerchantContext::scopeStoreId() !== null ? [] : $merchantIds);
    }

    private function findScoped(int $id): array
    {
        $order = Db::table('order_main')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $order = (array) $order;
        $this->assertMerchantScope((int) $order['merchant_id']);
        return $order;
    }

    private function resolveOrder(): array
    {
        $orderId = $this->intInput('id');
        $verifyCode = $this->strInput('verifyCode');
        if ($orderId <= 0 && $verifyCode === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请提供订单ID或核销码');
        }
        $query = Db::table('order_main')->whereNull('deleted_at');
        $orderId > 0 ? $query->where('id', $orderId) : $query->where('verify_code', $verifyCode);
        $order = $query->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $order = (array) $order;
        $this->assertMerchantScope((int) $order['merchant_id']);
        return $order;
    }

    private function assertMerchantScope(int $merchantId): void
    {
        if (MerchantContext::scopeStoreId() !== null || ! in_array($merchantId, MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }
}
