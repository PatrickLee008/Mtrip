<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户通知中心(Super Admin Portal 模块 03,整改 B1)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.6(Send Notification 抽屉)
 * 记录写 merchant_notify(与 C 端 notify_record 分表);发送动作写 merchant_activity_log(notification 类型)
 */
class NotificationController extends AbstractController
{


    /** Only configured transports may be requested; delivery and audit share a transaction. */
    #[Permission('merchant:list:notify')]
    public function send(): array
    {
        return Result::success((new \App\Service\MerchantNotificationService())->send($this->requireId('merchantId'), $this->request->all()));
    }

    #[Permission('merchant:list:notify')]
    public function channels(): array
    {
        return Result::success(\App\Service\MerchantNotificationService::CHANNELS);
    }

    /** 通知记录列表(站点/商户筛选) */
    #[Permission('merchant:list:notify')]
    public function list(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_notify');
        $this->applySiteScope($query);
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $ids = array_column($list, 'id');
        $deliveries = $ids === [] ? [] : Db::table('merchant_notify_delivery')->whereIn('notify_id', $ids)->get()->groupBy('notify_id')->all();
        foreach ($list as &$row) {
            $row['deliveries'] = isset($deliveries[$row['id']]) ? $deliveries[$row['id']]->all() : [];
            unset($row['payload_hash']);
        }
        unset($row);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 通知模板(Use Template 自动填充;site_id=0 平台通用 + 当前站点模板) */
    #[Permission('merchant:list:notify')]
    public function templates(): array
    {
        $query = Db::table('notify_template')->where('status', 1);
        $merchant = $this->intInput('merchantId') > 0 ? $this->findMerchant($this->intInput('merchantId')) : null;
        $siteId = $merchant ? (int) $merchant['site_id'] : AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $query->where(function ($q) use ($siteId) {
                $q->where('site_id', 0)->orWhere('site_id', $siteId);
            });
        } else {
            $query->where('site_id', 0);
        }
        $list = $query->orderBy('id')->get()->map(static fn ($r) => (array) $r)->all();
        return Result::success($list);
    }

    /** 取商户并校验站点数据权限 */
    private function findMerchant(int $id): array
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        $merchant = (array) $merchant;
        $this->assertSiteScope((int) $merchant['site_id']);
        return $merchant;
    }


}
