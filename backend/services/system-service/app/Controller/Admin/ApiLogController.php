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
 * 模块14 接口调用日志:分页 / 详情(入参出参写入时已脱敏)/ 统计(只读,永久留存)
 */
class ApiLogController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->scopedQuery();
        if (($clientId = $this->strInput('clientId')) !== '') {
            $query->where('client_id', $clientId);
        }
        if (($apiPath = $this->strInput('apiPath')) !== '') {
            $query->where('api_path', 'like', "%{$apiPath}%");
        }
        if (($responseCode = $this->intInput('responseCode')) > 0) {
            $query->where('response_code', $responseCode);
        }
        if (($start = $this->strInput('startTime')) !== '') {
            $query->where('created_at', '>=', $start);
        }
        if (($end = $this->strInput('endTime')) !== '') {
            $query->where('created_at', '<=', $end);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'client_id', 'client_name', 'client_type', 'api_path',
                'request_method', 'response_code', 'cost_ms', 'client_ip', 'created_at'])
            ->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $row = Db::table('sys_api_access_log')->find($this->requireId());
        if ($row === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '日志不存在');
        }
        if (! AdminContext::isSuper() && (int) $row->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return Result::success($row);
    }

    /** 调用统计:近N天(默认7)每日调用量、失败量、平均耗时 */
    public function stats(): array
    {
        $days = min(30, max(1, $this->intInput('days', 7)));
        $since = date('Y-m-d 00:00:00', strtotime('-' . ($days - 1) . ' days'));
        $query = $this->scopedQuery()->where('created_at', '>=', $since);

        $summary = (clone $query)->selectRaw(
            'count(*) as total,'
            . 'sum(case when response_code >= 400 then 1 else 0 end) as fail_count,'
            . 'ifnull(avg(cost_ms), 0) as avg_cost_ms'
        )->first();
        $daily = (clone $query)->selectRaw(
            "date_format(created_at, '%Y-%m-%d') as day,"
            . 'count(*) as cnt,'
            . 'sum(case when response_code >= 400 then 1 else 0 end) as fail_cnt,'
            . 'ifnull(avg(cost_ms), 0) as avg_cost_ms'
        )->groupBy('day')->orderBy('day')->get()->toArray();
        $topApis = (clone $query)->selectRaw('api_path, count(*) as cnt')
            ->groupBy('api_path')->orderByDesc('cnt')->limit(10)->get()->toArray();

        return Result::success([
            'total' => (int) ($summary->total ?? 0),
            'failCount' => (int) ($summary->fail_count ?? 0),
            'avgCostMs' => round((float) ($summary->avg_cost_ms ?? 0), 1),
            'daily' => $daily,
            'topApis' => $topApis,
        ]);
    }

    private function scopedQuery(): \Hyperf\Database\Query\Builder
    {
        $query = Db::table('sys_api_access_log');
        if (! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        } elseif (($siteId = $this->intInput('siteId')) > 0) {
            $query->where('site_id', $siteId);
        }
        return $query;
    }
}
