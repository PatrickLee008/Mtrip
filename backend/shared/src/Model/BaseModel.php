<?php

declare(strict_types=1);

namespace Mtrip\Shared\Model;

use Hyperf\Database\Model\Builder;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Mtrip\Shared\Context\AdminContext;

/**
 * 业务模型基类(文档 9.1 数据隔离规范 / 9.7 软删除规范 / 9.8 时间规范)
 * - 软删除 deleted_at
 * - 站点隔离:模型 $siteIsolated = true 时,非超管查询自动过滤 site_id
 * - 时间统一 DATETIME(数据库存 UTC,由连接时区配置保证)
 */
abstract class BaseModel extends Model
{
    use SoftDeletes;

    /** 是否启用站点数据隔离(业务表默认开启,系统全局表可关闭) */
    protected bool $siteIsolated = true;

    public const CREATED_AT = 'created_at';

    public const UPDATED_AT = 'updated_at';

    protected ?string $dateFormat = 'Y-m-d H:i:s';

    /**
     * 带站点隔离的查询构造器:非超管强制 site_id = 自身站点
     * 超管可传入 $querySiteId 过滤指定站点(null/0 = 全部)
     */
    public function newSiteQuery(?int $querySiteId = null): Builder
    {
        $query = $this->newQuery();
        if (! $this->siteIsolated) {
            return $query;
        }
        $siteId = AdminContext::scopeSiteId($querySiteId);
        if ($siteId !== null && $siteId > 0) {
            $query->where($this->getTable() . '.site_id', $siteId);
        }
        return $query;
    }

    /**
     * 金额字段统一 decimal(12,2) 四舍五入(文档 9.9 金额计算规范)
     */
    public static function money(float|string $amount): string
    {
        return number_format(round((float) $amount, 2), 2, '.', '');
    }
}
