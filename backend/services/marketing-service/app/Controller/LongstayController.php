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
 * 管理端长住折扣梯度(PRD 模块2.1):列表 / 保存 / 删除
 */
class LongstayController extends AbstractController
{
    /** 梯度列表(按最低夜数升序) */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('marketing_longstay_tier')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $total = (clone $query)->count();
        $list = $query->orderBy('min_nights')->orderBy('id')->forPage($page, $pageSize)
            ->get()->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 新增/编辑梯度:minNights/discountRate/status */
    #[Permission('marketing:longstay:save')]
    public function save(): array
    {
        $minNights = $this->intInput('minNights');
        $discountRate = round($this->floatInput('discountRate'), 2);
        if ($minNights < 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '最低夜数须≥1');
        }
        if ($discountRate <= 0 || $discountRate >= 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '折扣率须为0-100之间');
        }
        $status = $this->intInput('status', 1) === 2 ? 2 : 1;
        $data = ['min_nights' => $minNights, 'discount_rate' => $discountRate, 'status' => $status];

        $id = $this->intInput('id');
        if ($id > 0) {
            $row = Db::table('marketing_longstay_tier')->where('id', $id)->whereNull('deleted_at')->first();
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '梯度不存在');
            }
            $this->assertSiteScope((int) ((array) $row)['site_id']);
            Db::table('marketing_longstay_tier')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['site_id'] = AdminContext::siteId();
        $newId = (int) Db::table('marketing_longstay_tier')->insertGetId($data);
        return Result::success(['id' => $newId], '已保存');
    }

    /** 删除梯度(软删) */
    #[Permission('marketing:longstay:delete')]
    public function delete(): array
    {
        $id = $this->requireId();
        $row = Db::table('marketing_longstay_tier')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '梯度不存在');
        }
        $this->assertSiteScope((int) ((array) $row)['site_id']);
        Db::table('marketing_longstay_tier')->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }
}
