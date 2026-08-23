<?php

declare(strict_types=1);

namespace App\Controller;

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
    /** 通知分类(原型抽屉下拉) */
    private const CATEGORIES = ['booking', 'promotion', 'rewards', 'wallet', 'refund', 'account', 'security', 'support', 'system'];

    /** 下发渠道(原型卡片多选) */
    private const CHANNELS = ['push', 'inapp', 'email', 'sms'];

    /** 深链类型(原型 Deep Link / Destination) */
    private const DEEP_LINK_TYPES = ['booking_detail', 'wallet', 'promotion', 'coupon', 'user_profile', 'external_url', 'none'];

    /** 发送通知:写记录 + 审计 */
    #[Permission('merchant:list:notify')]
    public function send(): array
    {
        $merchant = $this->findMerchant($this->requireId('merchantId'));
        $category = $this->strInput('category', 'system');
        if (! in_array($category, self::CATEGORIES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '通知分类不合法');
        }
        $title = $this->requireStr('title');
        $message = $this->requireStr('message');
        $deepLinkType = $this->strInput('deepLinkType', 'none');
        if (! in_array($deepLinkType, self::DEEP_LINK_TYPES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '深链类型不合法');
        }
        $channels = array_values(array_intersect(self::CHANNELS, (array) $this->input('channels', [])));
        if ($channels === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少选择一个下发渠道');
        }
        $sendType = $this->intInput('sendType', 1);
        $sendAt = $this->strInput('sendAt');
        if ($sendType === 2 && ($sendAt === '' || strtotime($sendAt) === false)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '定时发送需选择有效时间');
        }

        Db::table('merchant_notify')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'category' => $category,
            'title' => mb_substr($title, 0, 200),
            'message' => mb_substr($message, 0, 1000),
            'deep_link_type' => $deepLinkType,
            'deep_link_value' => mb_substr($this->strInput('deepLinkValue'), 0, 500),
            'channels' => implode(',', $channels),
            'send_type' => $sendType,
            'send_at' => $sendType === 2 ? $sendAt : date('Y-m-d H:i:s'),
            'status' => 1,
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
        ]);

        $this->pushActivity($merchant, '发送商户通知:' . $category . ':' . $title);
        return Result::success(null, '通知已发送');
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
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 通知模板(Use Template 自动填充;site_id=0 平台通用 + 当前站点模板) */
    #[Permission('merchant:list:notify')]
    public function templates(): array
    {
        $query = Db::table('notify_template')->where('status', 1);
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
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

    /** 写商户活动日志 */
    private function pushActivity(array $merchant, string $desc, int $status = 1): void
    {
        Db::table('merchant_activity_log')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'activity_type' => 'notification',
            'description' => mb_substr($desc, 0, 255),
            'performed_by' => AdminContext::adminName() ?: 'Admin',
            'performed_by_id' => AdminContext::adminId(),
            'ip_address' => $this->clientIp(),
            'status' => $status,
        ]);
    }
}
