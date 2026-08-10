<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\Result;

/**
 * 平台特性开关(Super Admin Portal 模块 11 · Feature Toggles)
 * 路由前缀 /api/v1/admin/config/features/*(config → system_service)
 */
class FeatureController extends AbstractController
{
    #[Permission('config:feature:list')]
    public function index(): array
    {
        $query = Db::table('sys_feature_flag');
        $this->applySiteScope($query);
        $list = $query->orderBy('sort')->orderBy('id')->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::success($list);
    }

    /** 切换/保存开关:按 id 更新 enabled(可带 label/description) */
    #[Permission('config:feature:save')]
    public function save(): array
    {
        $id = $this->requireId();
        Db::table('sys_feature_flag')->where('id', $id)->update([
            'enabled' => $this->intInput('enabled') === 1 ? 1 : 0,
        ]);
        return Result::success(null, '已保存');
    }
}
