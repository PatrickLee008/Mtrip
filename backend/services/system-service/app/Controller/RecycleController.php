<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\RecycleRegistry;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 回收站:集中管理两库(mtrip_system / mtrip_business)已软删数据。
 *
 * 统一约束:
 * - 所有查询/操作只针对 whereNotNull('deleted_at') 的行,绝不触碰在用数据;
 * - 表名只能来自 RecycleRegistry 白名单,杜绝任意表注入;
 * - scope=site 且非超管强制 where site_id = 当前站点;scope=global 且非超管直接拒绝。
 */
class RecycleController extends AbstractController
{
    /**
     * 当前管理员可见的表清单 [{key,label,labelEn,group,scope,count}]。
     * count 为各表在可见范围内的软删行数,驱动前端选择器与数量角标。
     */
    public function tables(): array
    {
        $isSuper = AdminContext::isSuper();
        $siteId = AdminContext::siteId();
        $rows = [];
        foreach (RecycleRegistry::all() as $item) {
            if ($item['scope'] === 'global' && ! $isSuper) {
                continue; // 全局表仅超管可见
            }
            $query = Db::connection($item['conn'])->table($item['table'])->whereNotNull('deleted_at');
            if ($item['scope'] === 'site' && ! $isSuper) {
                $query->where('site_id', $siteId);
            }
            $rows[] = [
                'key' => $item['key'],
                'label' => $item['label'],
                'labelEn' => $item['labelEn'],
                'group' => $item['group'],
                'scope' => $item['scope'],
                'count' => (int) $query->count(),
            ];
        }
        return Result::success($rows);
    }

    /**
     * 某表软删数据分页:仅返回 id + 名称字段 + (site_id) + deleted_at + created_at,敏感列不返回。
     */
    public function index(): array
    {
        $item = $this->resolveItem();
        [$page, $pageSize] = $this->pageParams();
        $query = $this->scopedQuery($item);

        $keyword = $this->strInput('keyword');
        if ($keyword !== '' && $item['search'] !== []) {
            $query->where(static function (Builder $q) use ($item, $keyword) {
                foreach ($item['search'] as $col) {
                    $q->orWhere($col, 'like', "%{$keyword}%");
                }
            });
        }

        $total = (clone $query)->count();
        $columns = array_merge(['id'], $item['title'], ['deleted_at', 'created_at']);
        if ($item['scope'] === 'site') {
            $columns[] = 'site_id';
        }
        $columns = array_values(array_unique($columns));
        $list = (clone $query)->orderByDesc('deleted_at')->forPage($page, $pageSize)->get($columns)
            ->map(static fn ($row) => (array) $row)->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    /** 恢复:置 deleted_at=null。唯一键冲突转 DATA_CONFLICT 友好提示。 */
    #[Permission('sys:recycle:restore')]
    public function restore(): array
    {
        $item = $this->resolveItem();
        $id = $this->requireId();
        try {
            $affected = $this->scopedRowQuery($item, $id)->update(['deleted_at' => null]);
        } catch (\Throwable $e) {
            // 唯一键冲突:同名数据可能已被重新创建,需先彻底删除占用项
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '恢复失败:唯一标识已被占用(可能已重新创建同名数据),请先彻底删除占用项');
            }
            throw $e;
        }
        if ($affected === 0) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '数据不存在或已恢复');
        }
        return Result::success(null, '恢复成功');
    }

    /** 彻底删除单条:物理 delete,限 deleted_at IS NOT NULL 且在可见范围内。 */
    #[Permission('sys:recycle:purge')]
    public function purge(): array
    {
        $item = $this->resolveItem();
        $id = $this->requireId();
        $affected = $this->scopedRowQuery($item, $id)->delete();
        if ($affected === 0) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '数据不存在');
        }
        return Result::success(null, '已彻底删除');
    }

    /** 一键清空:物理删除该表可见范围内全部软删行,需 confirm=1。返回删除条数。 */
    #[Permission('sys:recycle:empty')]
    public function empty(): array
    {
        $item = $this->resolveItem();
        if ($this->intInput('confirm') !== 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请确认清空操作(confirm=1)');
        }
        $affected = $this->scopedQuery($item)->delete();
        return Result::success(['deleted' => (int) $affected], "已清空 {$affected} 条数据");
    }

    /**
     * 从入参 key 解析注册表项(白名单校验)。
     *
     * @return array<string, mixed>
     */
    private function resolveItem(): array
    {
        $item = RecycleRegistry::get($this->requireStr('key'));
        if ($item === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '未知的回收站数据类型');
        }
        return $item;
    }

    /**
     * 构建带软删过滤 + 站点范围约束的查询。
     *
     * @param array<string, mixed> $item
     */
    private function scopedQuery(array $item): Builder
    {
        if ($item['scope'] === 'global' && ! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        $query = Db::connection($item['conn'])->table($item['table'])->whereNotNull('deleted_at');
        if ($item['scope'] === 'site' && ! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        }
        return $query;
    }

    /**
     * 单行操作查询:在 scopedQuery 基础上限定 id。
     *
     * @param array<string, mixed> $item
     */
    private function scopedRowQuery(array $item, int $id): Builder
    {
        return $this->scopedQuery($item)->where('id', $id);
    }
}
