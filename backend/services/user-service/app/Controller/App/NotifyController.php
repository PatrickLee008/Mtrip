<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

/**
 * C端站内通知(Notification Center):列表 / 标记已读 / 未读数
 * 通知由 order-service 在预订事件时写入 notify_record(同库 mtrip_business)
 */
class NotifyController extends AbstractController
{
    /** 通知列表:onlyUnread=1 仅看未读;bizType=1 订单 / 3 系统(App 两个页签各自分页) */
    public function list(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('notify_record')->where('user_id', UserContext::userId());
        if ($this->intInput('onlyUnread') === 1) {
            $query->where('is_read', 0);
        }
        if (($bizType = $this->intInput('bizType')) > 0) {
            // 订单页签只看订单类;系统页签收「非订单」的全部(系统 + 营销)
            $bizType === 1 ? $query->where('biz_type', 1) : $query->where('biz_type', '<>', 1);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'event_key', 'params', 'title', 'content', 'biz_type', 'biz_id', 'is_read', 'created_at'])
            ->map(static function ($row): array {
                $row = (array) $row;
                // 事件变量:App 按当前语言渲染文案;旧数据为 null,App 回落到 title/content
                $params = is_string($row['params']) ? json_decode($row['params'], true) : null;
                $row['params'] = is_array($params) ? $params : null;
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 未读数(角标) */
    public function unreadCount(): array
    {
        $count = Db::table('notify_record')
            ->where('user_id', UserContext::userId())->where('is_read', 0)->count();
        return Result::success(['unread' => $count]);
    }

    /** 标记已读:传 id 标记单条;不传则全部标记已读 */
    public function read(): array
    {
        $query = Db::table('notify_record')
            ->where('user_id', UserContext::userId())->where('is_read', 0);
        if (($id = $this->intInput('id')) > 0) {
            $query->where('id', $id);
        }
        $query->update(['is_read' => 1, 'read_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已标记已读');
    }
}
