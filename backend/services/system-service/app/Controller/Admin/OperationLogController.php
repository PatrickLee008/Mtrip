<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块4 系统操作日志:分页查询 / 详情(只读,禁止删改,导出由前端基于列表数据完成)
 */
class OperationLogController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('sys_operation_log');
        if (! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        } elseif (($siteId = $this->intInput('siteId')) > 0) {
            $query->where('site_id', $siteId);
        }
        if (($adminName = $this->strInput('adminName')) !== '') {
            $query->where('admin_name', 'like', "%{$adminName}%");
        }
        if (($module = $this->strInput('module')) !== '') {
            $query->where('module', $module);
        }
        if (($action = $this->strInput('action')) !== '') {
            $query->where('action', $action);
        }
        if (($start = $this->strInput('startTime')) !== '') {
            $query->where('created_at', '>=', $start);
        }
        if (($end = $this->strInput('endTime')) !== '') {
            $query->where('created_at', '<=', $end);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'admin_id', 'admin_name', 'site_id', 'module', 'action',
                'request_url', 'request_method', 'client_ip', 'status_code', 'created_at'])
            ->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $row = Db::table('sys_operation_log')->find($this->requireId());
        if ($row === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '日志不存在');
        }
        if (! AdminContext::isSuper() && (int) $row->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return Result::success($row);
    }
}
