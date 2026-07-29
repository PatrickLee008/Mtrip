<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 价格库存日历管理:日历查询 / 区间批量设置 / 单日手动调整 / 流水 / 低库存预警 / 总览
 * 手动变动一律写 goods_stock_log(change_type=5),扣减下限=已售+锁定
 */
class AdminStockController extends AbstractAdminController
{
    private const MAX_RANGE_DAYS = 366;

    /** 价格库存日历:按 SKU 查日期区间,无记录日期回落基础价/基础库存 */
    public function calendar(): array
    {
        [$goods, $skuType, $sku] = $this->resolveSku();
        [$startDate, $endDate] = $this->dateRange();

        $rows = Db::table('goods_daily_stock')
            ->where('sku_type', $skuType)->where('sku_id', $sku['id'])
            ->whereBetween('stock_date', [$startDate, $endDate])
            ->whereNull('deleted_at')
            ->get()->keyBy('stock_date');

        $days = [];
        for ($ts = strtotime($startDate); $ts <= strtotime($endDate); $ts += 86400) {
            $date = date('Y-m-d', $ts);
            $row = $rows->get($date);
            $days[] = $row !== null ? [
                'date' => $date,
                'price' => (float) $row->price,
                'stockTotal' => (int) $row->stock_total,
                'stockSold' => (int) $row->stock_sold,
                'stockLocked' => (int) $row->stock_locked,
                'stockLeft' => (int) $row->stock_total - (int) $row->stock_sold - (int) $row->stock_locked,
                'isClosed' => (int) $row->is_closed,
                'hasRecord' => 1,
            ] : [
                'date' => $date,
                'price' => (float) $sku['base_price'],
                'stockTotal' => (int) $sku['base_stock'],
                'stockSold' => 0,
                'stockLocked' => 0,
                'stockLeft' => (int) $sku['base_stock'],
                'isClosed' => 0,
                'hasRecord' => 0,
            ];
        }
        return Result::success([
            'goodsId' => (int) $goods['id'],
            'skuType' => $skuType,
            'skuId' => (int) $sku['id'],
            'basePrice' => (float) $sku['base_price'],
            'baseStock' => (int) $sku['base_stock'],
            'days' => $days,
        ]);
    }

    /** 区间批量设置:price / stockTotal / isClosed 至少一项;可按 weekdays(0-6)过滤 */
    #[Permission('goods:stock:edit')]
    public function batchSet(): array
    {
        [$goods, $skuType, $sku] = $this->resolveSku();
        [$startDate, $endDate] = $this->dateRange(true);

        $price = $this->input('price') !== null ? round($this->floatInput('price'), 2) : null;
        if ($price !== null && $price < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 price 不能为负');
        }
        $stockTotal = $this->input('stockTotal') !== null ? $this->intInput('stockTotal') : null;
        if ($stockTotal !== null && $stockTotal < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 stockTotal 不能为负');
        }
        $isClosed = $this->input('isClosed') !== null ? ($this->intInput('isClosed') === 1 ? 1 : 0) : null;
        if ($price === null && $stockTotal === null && $isClosed === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'price/stockTotal/isClosed 至少设置一项');
        }
        $weekdays = $this->input('weekdays');
        $weekdays = is_array($weekdays) ? array_map('intval', $weekdays) : null;

        $affected = (int) Db::transaction(function () use ($goods, $skuType, $sku, $startDate, $endDate, $price, $stockTotal, $isClosed, $weekdays) {
            $exists = Db::table('goods_daily_stock')
                ->where('sku_type', $skuType)->where('sku_id', $sku['id'])
                ->whereBetween('stock_date', [$startDate, $endDate])
                ->whereNull('deleted_at')
                ->get()->keyBy('stock_date');
            $count = 0;
            for ($ts = strtotime($startDate); $ts <= strtotime($endDate); $ts += 86400) {
                $date = date('Y-m-d', $ts);
                if ($weekdays !== null && ! in_array((int) date('w', $ts), $weekdays, true)) {
                    continue;
                }
                $row = $exists->get($date);
                if ($row !== null) {
                    $update = [];
                    if ($price !== null) {
                        $update['price'] = $price;
                    }
                    if ($isClosed !== null) {
                        $update['is_closed'] = $isClosed;
                    }
                    if ($stockTotal !== null) {
                        $occupied = (int) $row->stock_sold + (int) $row->stock_locked;
                        if ($stockTotal < $occupied) {
                            throw new BusinessException(ErrorCode::DATA_CONFLICT, "{$date} 已售+锁定 {$occupied},总库存不可低于该值");
                        }
                        $update['stock_total'] = $stockTotal;
                        $this->writeLog($goods, $skuType, (int) $sku['id'], $date, $stockTotal - (int) $row->stock_total, '批量设置库存');
                    }
                    Db::table('goods_daily_stock')->where('id', $row->id)->update($update);
                } else {
                    $total = $stockTotal ?? (int) $sku['base_stock'];
                    Db::table('goods_daily_stock')->insert([
                        'site_id' => (int) $goods['site_id'],
                        'goods_id' => (int) $goods['id'],
                        'sku_type' => $skuType,
                        'sku_id' => (int) $sku['id'],
                        'stock_date' => $date,
                        'price' => $price ?? (float) $sku['base_price'],
                        'stock_total' => $total,
                        'is_closed' => $isClosed ?? 0,
                    ]);
                    if ($stockTotal !== null) {
                        $this->writeLog($goods, $skuType, (int) $sku['id'], $date, $total, '批量设置库存(新建)');
                    }
                }
                ++$count;
            }
            return $count;
        });
        return Result::success(['affectedDays' => $affected], "已批量设置 {$affected} 天");
    }

    /** 单日手动调整库存:changeQty 正增负减,下限=已售+锁定 */
    #[Permission(['goods:stock:edit', 'goods:stock:close'])]
    public function adjust(): array
    {
        [$goods, $skuType, $sku] = $this->resolveSku();
        $date = $this->requireDate('stockDate');
        $changeQty = $this->intInput('changeQty');
        if ($changeQty === 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 changeQty 不能为 0');
        }
        $remark = $this->strInput('remark');

        $left = (int) Db::transaction(function () use ($goods, $skuType, $sku, $date, $changeQty, $remark) {
            $row = Db::table('goods_daily_stock')
                ->where('sku_type', $skuType)->where('sku_id', $sku['id'])
                ->where('stock_date', $date)->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if ($row !== null) {
                $newTotal = (int) $row->stock_total + $changeQty;
                $occupied = (int) $row->stock_sold + (int) $row->stock_locked;
                if ($newTotal < $occupied) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, "已售+锁定 {$occupied},总库存不可低于该值");
                }
                Db::table('goods_daily_stock')->where('id', $row->id)->update(['stock_total' => $newTotal]);
                $left = $newTotal - $occupied;
            } else {
                $newTotal = (int) $sku['base_stock'] + $changeQty;
                if ($newTotal < 0) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '调整后库存不能为负');
                }
                Db::table('goods_daily_stock')->insert([
                    'site_id' => (int) $goods['site_id'],
                    'goods_id' => (int) $goods['id'],
                    'sku_type' => $skuType,
                    'sku_id' => (int) $sku['id'],
                    'stock_date' => $date,
                    'price' => (float) $sku['base_price'],
                    'stock_total' => $newTotal,
                ]);
                $left = $newTotal;
            }
            $this->writeLog($goods, $skuType, (int) $sku['id'], $date, $changeQty, $remark !== '' ? $remark : '手动调整');
            return $left;
        });
        return Result::success(['stockLeft' => $left], '库存已调整');
    }

    /** 库存变动流水:筛选 商品/SKU/变动类型/日期区间 */
    public function logs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('goods_stock_log');
        $this->applySiteScope($query);
        if (($goodsId = $this->intInput('goodsId')) > 0) {
            $query->where('goods_id', $goodsId);
        }
        if (($skuType = $this->intInput('skuType')) > 0) {
            $query->where('sku_type', $skuType);
        }
        if (($skuId = $this->intInput('skuId')) > 0) {
            $query->where('sku_id', $skuId);
        }
        if (($changeType = $this->intInput('changeType')) > 0) {
            $query->where('change_type', $changeType);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('stock_date', '>=', $start);
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('stock_date', '<=', $end);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 低库存预警:未来 daysAhead 天内剩余库存 ≤ threshold 的日历行(默认 30 天 / 阈值 5) */
    public function lowWarning(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $daysAhead = min(90, max(1, $this->intInput('daysAhead', 30)));
        $threshold = max(0, $this->intInput('threshold', 5));
        $startDate = date('Y-m-d');
        $endDate = date('Y-m-d', strtotime("+{$daysAhead} days"));

        $query = Db::table('goods_daily_stock')
            ->whereBetween('stock_date', [$startDate, $endDate])
            ->where('is_closed', 0)->whereNull('deleted_at')
            ->whereRaw('stock_total - stock_sold - stock_locked <= ?', [$threshold]);
        $this->applySiteScope($query);
        if (($goodsId = $this->intInput('goodsId')) > 0) {
            $query->where('goods_id', $goodsId);
        }
        $total = (clone $query)->count();
        $rows = $query->orderBy('stock_date')->orderBy('goods_id')
            ->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['stock_left'] = (int) $row['stock_total'] - (int) $row['stock_sold'] - (int) $row['stock_locked'];
                unset($row['deleted_at']);
                return $row;
            })->all();

        $goodsNames = $this->goodsNames(array_column($rows, 'goods_id'));
        $list = array_map(static function (array $row) use ($goodsNames) {
            $row['goods_name'] = (string) ($goodsNames[$row['goods_id']] ?? '');
            return $row;
        }, $rows);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 库存总览:按上架商品分页,聚合未来 daysAhead 天 总库存/已售/锁定/剩余 */
    public function overview(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $daysAhead = min(90, max(1, $this->intInput('daysAhead', 30)));
        $startDate = date('Y-m-d');
        $endDate = date('Y-m-d', strtotime("+{$daysAhead} days"));

        $goodsQuery = Db::table('goods_info')
            ->whereIn('status', [3, 4])->whereNull('deleted_at');
        $this->applySiteScope($goodsQuery);
        if (($name = $this->strInput('goodsName')) !== '') {
            $goodsQuery->where('goods_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('goodsType')) > 0) {
            $goodsQuery->where('goods_type', $type);
        }
        $total = (clone $goodsQuery)->count();
        $goodsRows = $goodsQuery->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'goods_type', 'goods_name', 'status'])
            ->map(static fn ($row) => (array) $row)->all();

        $goodsIds = array_column($goodsRows, 'id');
        $sums = $goodsIds === [] ? [] : Db::table('goods_daily_stock')
            ->whereIn('goods_id', $goodsIds)
            ->whereBetween('stock_date', [$startDate, $endDate])
            ->whereNull('deleted_at')
            ->groupBy('goods_id')
            ->selectRaw('goods_id, SUM(stock_total) AS total, SUM(stock_sold) AS sold, SUM(stock_locked) AS locked')
            ->get()->keyBy('goods_id');
        $list = array_map(static function (array $row) use ($sums) {
            $sum = $sums[$row['id']] ?? null;
            $row['stock_total'] = $sum !== null ? (int) $sum->total : 0;
            $row['stock_sold'] = $sum !== null ? (int) $sum->sold : 0;
            $row['stock_locked'] = $sum !== null ? (int) $sum->locked : 0;
            $row['stock_left'] = $row['stock_total'] - $row['stock_sold'] - $row['stock_locked'];
            return $row;
        }, $goodsRows);
        return Result::page($list, $total, $page, $pageSize);
    }

    // ---------- 私有 ----------

    /** 解析并校验 goodsId+skuType+skuId,返回 [商品, skuType, SKU行] */
    private function resolveSku(): array
    {
        $goods = Db::table('goods_info')
            ->where('id', $this->requireId('goodsId'))->whereNull('deleted_at')->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在');
        }
        $goods = (array) $goods;
        $this->assertSiteScope((int) $goods['site_id']);

        $skuType = $this->intInput('skuType', (int) $goods['goods_type']);
        if (! in_array($skuType, [1, 2], true) || $skuType !== (int) $goods['goods_type']) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 skuType 与商品类型不符');
        }
        $skuTable = $skuType === 1 ? 'hotel_room_type' : 'ticket_type';
        $sku = Db::table($skuTable)
            ->where('id', $this->requireId('skuId'))->where('goods_id', $goods['id'])
            ->whereNull('deleted_at')->first();
        if (! $sku) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'SKU 不存在或不属于该商品');
        }
        return [$goods, $skuType, (array) $sku];
    }

    /** 解析日期区间;$forbidPast=true 时起始日不得早于今天 */
    private function dateRange(bool $forbidPast = false): array
    {
        $startDate = $this->requireDate('startDate');
        $endDate = $this->requireDate('endDate');
        if ($startDate > $endDate) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'startDate 不能晚于 endDate');
        }
        $days = (int) ((strtotime($endDate) - strtotime($startDate)) / 86400) + 1;
        if ($days > self::MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '日期区间不能超过 ' . self::MAX_RANGE_DAYS . ' 天');
        }
        if ($forbidPast && $startDate < date('Y-m-d')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '批量设置不能包含过去日期');
        }
        return [$startDate, $endDate];
    }

    /** 写库存变动流水(change_type=5 手动调整) */
    private function writeLog(array $goods, int $skuType, int $skuId, string $date, int $changeQty, string $remark): void
    {
        if ($changeQty === 0) {
            return;
        }
        Db::table('goods_stock_log')->insert([
            'site_id' => (int) $goods['site_id'],
            'goods_id' => (int) $goods['id'],
            'sku_type' => $skuType,
            'sku_id' => $skuId,
            'stock_date' => $date,
            'change_type' => 5,
            'change_qty' => $changeQty,
            'operator_id' => AdminContext::adminId(),
            'remark' => mb_substr($remark, 0, 255),
        ]);
    }

    /** 批量取商品名 */
    private function goodsNames(array $ids): array
    {
        $ids = array_values(array_filter(array_unique($ids)));
        if ($ids === []) {
            return [];
        }
        return Db::table('goods_info')->whereIn('id', $ids)->pluck('goods_name', 'id')->all();
    }
}
