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
 * 管理端促销中心活动(PRD 模块6.1):列表 / 详情 / 保存 / 上下架 / 删除
 */
class CampaignController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('marketing_campaign')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($title = $this->strInput('title')) !== '') {
            $query->where('title', 'like', "%{$title}%");
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderBy('sort')->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                $row['coupon_ids'] = $row['coupon_ids'] ? json_decode((string) $row['coupon_ids'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('marketing:campaign:save')]
    public function save(): array
    {
        $couponIds = $this->input('couponIds');
        $data = [
            'title' => mb_substr($this->requireStr('title'), 0, 200),
            'subtitle' => mb_substr($this->strInput('subtitle'), 0, 255),
            'banner' => $this->strInput('banner'),
            'landing_url' => $this->strInput('landingUrl'),
            'coupon_ids' => is_array($couponIds) ? json_encode(array_map('intval', $couponIds)) : null,
            'start_time' => ($s = $this->strInput('startTime')) !== '' ? $s : null,
            'end_time' => ($e = $this->strInput('endTime')) !== '' ? $e : null,
            'sort' => $this->intInput('sort'),
            'status' => in_array($this->intInput('status', 0), [0, 1, 2], true) ? $this->intInput('status', 0) : 0,
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            $this->scoped($id);
            Db::table('marketing_campaign')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['site_id'] = AdminContext::siteId();
        $newId = (int) Db::table('marketing_campaign')->insertGetId($data);
        return Result::success(['id' => $newId], '已保存');
    }

    /** 上下架:status 1上架 2下架 */
    #[Permission('marketing:campaign:save')]
    public function toggleStatus(): array
    {
        $row = $this->scoped($this->requireId());
        $status = $this->intInput('status');
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '状态只能为1上架/2下架');
        }
        Db::table('marketing_campaign')->where('id', $row['id'])->update(['status' => $status]);
        return Result::success(null, '已更新');
    }

    #[Permission('marketing:campaign:delete')]
    public function remove(): array
    {
        $row = $this->scoped($this->requireId());
        Db::table('marketing_campaign')->where('id', $row['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    private function scoped(int $id): array
    {
        $row = Db::table('marketing_campaign')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '活动不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }
}
