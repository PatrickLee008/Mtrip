<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端房量价格日历:复用 goods_daily_stock,补充 CTA/CTD/最晚最短住等商户端字段。
 */
class AvailabilityController extends AbstractAdminController
{
    private const MAX_RANGE_DAYS = 366;

    /** 酒店/房型树选项 */
    public function options(): array
    {
        return Result::success($this->roomTree());
    }

    /** 日历视图:返回酒店 → 房型 → 日期单元格 */
    public function calendar(): array
    {
        [$startDate, $endDate] = $this->dateRange(false, 14);
        $tree = $this->roomTree();
        $skuIds = [];
        foreach ($tree as $hotel) {
            foreach ($hotel['rooms'] as $room) {
                $skuIds[] = (int) $room['id'];
            }
        }
        $stocks = [];
        if ($skuIds !== []) {
            foreach (Db::table('goods_daily_stock')
                ->where('sku_type', 1)
                ->whereIn('sku_id', $skuIds)
                ->whereBetween('stock_date', [$startDate, $endDate])
                ->whereNull('deleted_at')
                ->get() as $stockRow) {
                $stocks[$stockRow->sku_id . '_' . $stockRow->stock_date] = (array) $stockRow;
            }
        }

        $dates = [];
        for ($ts = strtotime($startDate); $ts <= strtotime($endDate); $ts += 86400) {
            $dates[] = date('Y-m-d', $ts);
        }

        foreach ($tree as &$hotel) {
            foreach ($hotel['rooms'] as &$room) {
                $room['days'] = array_map(function (string $date) use ($room, $stocks) {
                    $key = $room['id'] . '_' . $date;
                    $row = $stocks[$key] ?? null;
                    return $row !== null
                        ? $this->formatStockRow($row, $room)
                        : $this->fallbackDay($date, $room);
                }, $dates);
            }
            unset($room);
        }
        unset($hotel);

        $summary = $this->summary($tree);
        return Result::success([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'dates' => $dates,
            'hotels' => $tree,
            'summary' => $summary,
        ]);
    }

    /** 单日保存 */
    #[Permission('mch:availability:edit')]
    public function saveDay(): array
    {
        [$goods, $room] = $this->resolveRoom();
        $date = $this->requireDate('stockDate');
        if ($date < date('Y-m-d')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '不能修改过去日期');
        }
        $payload = $this->collectStockFields($room);
        $this->upsertStock($goods, $room, $date, $payload, '商户单日更新');
        return Result::success(null, '房量价格已保存');
    }

    /** 批量更新:日期区间 + 多房型 + 可选星期过滤 */
    #[Permission('mch:availability:bulk-update')]
    public function batchSet(): array
    {
        [$startDate, $endDate] = $this->dateRange(true, self::MAX_RANGE_DAYS);
        $roomIds = $this->input('roomIds');
        $roomIds = is_array($roomIds) ? array_values(array_unique(array_map('intval', $roomIds))) : [];
        $rooms = $this->scopedRooms($roomIds);
        if ($rooms === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择房型');
        }
        $weekdays = $this->input('weekdays');
        $weekdays = is_array($weekdays) ? array_values(array_unique(array_map('intval', $weekdays))) : null;
        $payload = $this->collectStockFields(null, true);
        if ($payload === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '至少填写一个要批量更新的字段');
        }

        $affected = (int) Db::transaction(function () use ($rooms, $startDate, $endDate, $weekdays, $payload) {
            $count = 0;
            for ($ts = strtotime($startDate); $ts <= strtotime($endDate); $ts += 86400) {
                if ($weekdays !== null && ! in_array((int) date('w', $ts), $weekdays, true)) {
                    continue;
                }
                $date = date('Y-m-d', $ts);
                foreach ($rooms as $room) {
                    $goods = ['id' => (int) $room['goods_id'], 'site_id' => (int) $room['site_id']];
                    $this->upsertStock($goods, $room, $date, $payload, '商户批量更新', false);
                    ++$count;
                }
            }
            return $count;
        });

        return Result::success(['affectedCells' => $affected], "已更新 {$affected} 个日期单元");
    }

    /** 单房型/单日变更记录 */
    public function logs(): array
    {
        [, $room] = $this->resolveRoom();
        $date = $this->requireDate('stockDate');
        $rows = Db::table('goods_stock_log')
            ->where('sku_type', 1)
            ->where('sku_id', $room['id'])
            ->where('stock_date', $date)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::success($rows);
    }

    /** 同步按钮占位:真实 PMS/CM 接入前只返回当前服务端时间 */
    #[Permission('mch:availability:sync')]
    public function syncNow(): array
    {
        return Result::success([
            'pms' => 'connected',
            'channelManager' => 'disconnected',
            'lastSyncAt' => date('Y-m-d H:i:s'),
        ], '同步任务已触发');
    }

    private function roomTree(): array
    {
        $goodsId = $this->intInput('goodsId');
        $roomId = $this->intInput('roomId');

        $query = Db::table('hotel_room_type as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->where('g.goods_type', 1)
            ->where('g.status', '<>', 5)
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at');
        $this->applyMerchantScope($query, 'g.merchant_id');
        if ($goodsId > 0) {
            $query->where('r.goods_id', $goodsId);
        }
        if ($roomId > 0) {
            $query->where('r.id', $roomId);
        }

        $rows = $query->orderBy('g.id')->orderBy('r.sort')->orderBy('r.id')
            ->get([
                'r.id', 'r.site_id', 'r.goods_id', 'r.room_name', 'r.bed_type', 'r.base_price', 'r.weekend_price', 'r.base_stock', 'r.status',
                'g.goods_name', 'g.merchant_id', 'g.cover_image', 'g.address',
            ])->map(static fn ($row) => (array) $row)->all();

        $hotels = [];
        foreach ($rows as $row) {
            $hotelId = (int) $row['goods_id'];
            if (! isset($hotels[$hotelId])) {
                $hotels[$hotelId] = [
                    'id' => $hotelId,
                    'name' => (string) $row['goods_name'],
                    'merchant_id' => (int) $row['merchant_id'],
                    'cover_image' => (string) $row['cover_image'],
                    'address' => (string) $row['address'],
                    'rooms' => [],
                ];
            }
            $hotels[$hotelId]['rooms'][] = [
                'id' => (int) $row['id'],
                'site_id' => (int) $row['site_id'],
                'goods_id' => $hotelId,
                'name' => (string) $row['room_name'],
                'bed_type' => (string) $row['bed_type'],
                'base_price' => (float) $row['base_price'],
                'weekend_price' => (float) $row['weekend_price'],
                'base_stock' => (int) $row['base_stock'],
                'status' => (int) $row['status'],
            ];
        }
        return array_values($hotels);
    }

    private function scopedRooms(array $roomIds): array
    {
        $query = Db::table('hotel_room_type as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->where('g.goods_type', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at')
            ->where('r.status', 1);
        $this->applyMerchantScope($query, 'g.merchant_id');
        if ($roomIds !== []) {
            $query->whereIn('r.id', $roomIds);
        }
        return $query->get(['r.*', 'g.merchant_id'])->map(static fn ($row) => (array) $row)->all();
    }

    private function resolveRoom(): array
    {
        $goodsId = $this->requireId('goodsId');
        $skuId = $this->requireId('skuId');
        $row = Db::table('hotel_room_type as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->where('r.id', $skuId)
            ->where('r.goods_id', $goodsId)
            ->where('g.goods_type', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at')
            ->get(['r.*', 'g.merchant_id'])
            ->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
        }
        $room = (array) $row;
        if (! in_array((int) $room['merchant_id'], MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return [['id' => $goodsId, 'site_id' => (int) $room['site_id']], $room];
    }

    private function collectStockFields(?array $room, bool $partial = false): array
    {
        $fields = [];
        if ($this->input('price') !== null || ! $partial) {
            $price = $this->input('price') !== null ? round($this->floatInput('price'), 2) : (float) ($room['base_price'] ?? 0);
            if ($price < 0) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 price 不能为负');
            }
            $fields['price'] = $price;
        }
        if ($this->input('stockTotal') !== null || ! $partial) {
            $stock = $this->input('stockTotal') !== null ? $this->intInput('stockTotal') : (int) ($room['base_stock'] ?? 0);
            if ($stock < 0) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 stockTotal 不能为负');
            }
            $fields['stock_total'] = $stock;
        }
        $map = [
            'isClosed' => 'is_closed',
            'closedToArrival' => 'closed_to_arrival',
            'closedToDeparture' => 'closed_to_departure',
        ];
        foreach ($map as $param => $column) {
            if ($this->input($param) !== null || ! $partial) {
                $fields[$column] = $this->intInput($param) === 1 ? 1 : 0;
            }
        }
        if ($this->input('minStay') !== null || ! $partial) {
            $fields['min_stay'] = max(1, $this->intInput('minStay', 1));
        }
        if ($this->input('maxStay') !== null || ! $partial) {
            $fields['max_stay'] = max(1, $this->intInput('maxStay', 30));
        }
        if ($this->input('source') !== null) {
            $fields['source'] = mb_substr($this->strInput('source', 'manual'), 0, 30);
        }
        if ($this->input('note') !== null) {
            $fields['note'] = mb_substr($this->strInput('note'), 0, 255);
        }
        return $fields;
    }

    private function upsertStock(array $goods, array $room, string $date, array $payload, string $remark, bool $transaction = true): void
    {
        $work = function () use ($goods, $room, $date, $payload, $remark) {
            $row = Db::table('goods_daily_stock')
                ->where('sku_type', 1)
                ->where('sku_id', $room['id'])
                ->where('stock_date', $date)
                ->lockForUpdate()
                ->first();
            $data = $payload;
            $newTotal = array_key_exists('stock_total', $data) ? (int) $data['stock_total'] : ($row !== null ? (int) $row->stock_total : (int) $room['base_stock']);
            $occupied = $row !== null ? (int) $row->stock_sold + (int) $row->stock_locked : 0;
            if ($newTotal < $occupied) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "{$date} 已售+锁定 {$occupied},总库存不可低于该值");
            }
            if ($row !== null) {
                $oldTotal = (int) $row->stock_total;
                $data['deleted_at'] = null;
                Db::table('goods_daily_stock')->where('id', $row->id)->update($data);
                if (array_key_exists('stock_total', $payload) && $newTotal !== $oldTotal) {
                    $this->writeLog($goods, (int) $room['id'], $date, $newTotal - $oldTotal, $remark);
                }
                return;
            }
            $insert = array_merge([
                'site_id' => (int) $goods['site_id'],
                'goods_id' => (int) $goods['id'],
                'sku_type' => 1,
                'sku_id' => (int) $room['id'],
                'stock_date' => $date,
                'price' => (float) $room['base_price'],
                'stock_total' => (int) $room['base_stock'],
                'source' => 'manual',
            ], $data);
            Db::table('goods_daily_stock')->insert($insert);
            if (array_key_exists('stock_total', $payload)) {
                $this->writeLog($goods, (int) $room['id'], $date, (int) $insert['stock_total'], $remark);
            }
        };

        if ($transaction) {
            Db::transaction($work);
            return;
        }
        $work();
    }

    private function formatStockRow(array $row, array $room): array
    {
        $total = (int) $row['stock_total'];
        $sold = (int) $row['stock_sold'];
        $locked = (int) $row['stock_locked'];
        return [
            'date' => (string) $row['stock_date'],
            'price' => (float) $row['price'],
            'stockTotal' => $total,
            'stockSold' => $sold,
            'stockLocked' => $locked,
            'stockLeft' => (int) ((int) $row['is_closed'] === 1 ? 0 : max(0, $total - $sold - $locked)),
            'isClosed' => (int) $row['is_closed'],
            'minStay' => (int) $row['min_stay'],
            'maxStay' => (int) $row['max_stay'],
            'closedToArrival' => (int) $row['closed_to_arrival'],
            'closedToDeparture' => (int) $row['closed_to_departure'],
            'source' => (string) $row['source'],
            'note' => (string) $row['note'],
            'hasRecord' => 1,
        ];
    }

    private function fallbackDay(string $date, array $room): array
    {
        $isWeekend = in_array((int) date('w', strtotime($date)), [5, 6], true);
        $price = $isWeekend && (float) $room['weekend_price'] > 0 ? (float) $room['weekend_price'] : (float) $room['base_price'];
        return [
            'date' => $date,
            'price' => $price,
            'stockTotal' => (int) $room['base_stock'],
            'stockSold' => 0,
            'stockLocked' => 0,
            'stockLeft' => (int) $room['base_stock'],
            'isClosed' => (int) $room['status'] === 1 ? 0 : 1,
            'minStay' => 1,
            'maxStay' => 30,
            'closedToArrival' => 0,
            'closedToDeparture' => 0,
            'source' => 'base',
            'note' => '',
            'hasRecord' => 0,
        ];
    }

    private function summary(array $tree): array
    {
        $rooms = 0;
        $soldOut = 0;
        $low = 0;
        foreach ($tree as $hotel) {
            foreach ($hotel['rooms'] as $room) {
                ++$rooms;
                foreach ($room['days'] ?? [] as $day) {
                    if ((int) $day['isClosed'] === 1 || (int) $day['stockLeft'] === 0) {
                        ++$soldOut;
                    } elseif ((int) $day['stockLeft'] <= 2) {
                        ++$low;
                    }
                }
            }
        }
        return [
            'hotelCount' => count($tree),
            'roomCount' => $rooms,
            'lowInventoryCells' => $low,
            'closedCells' => $soldOut,
            'pms' => 'connected',
            'channelManager' => 'disconnected',
            'lastSyncAt' => date('Y-m-d H:i:s'),
        ];
    }

    private function dateRange(bool $forbidPast, int $defaultDays): array
    {
        $startDate = $this->strInput('startDate') !== '' ? $this->requireDate('startDate') : date('Y-m-d');
        $endDate = $this->strInput('endDate') !== '' ? $this->requireDate('endDate') : date('Y-m-d', strtotime('+' . ($defaultDays - 1) . ' days', strtotime($startDate)));
        if ($startDate > $endDate) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'startDate 不能晚于 endDate');
        }
        $days = (int) ((strtotime($endDate) - strtotime($startDate)) / 86400) + 1;
        if ($days > self::MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '日期区间不能超过 ' . self::MAX_RANGE_DAYS . ' 天');
        }
        if ($forbidPast && $startDate < date('Y-m-d')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '不能批量更新过去日期');
        }
        return [$startDate, $endDate];
    }

    private function applyMerchantScope(Builder $query, string $column): void
    {
        $merchantIds = MerchantContext::scopeMerchantIds();
        $query->whereIn($column, $merchantIds === [] ? [0] : $merchantIds);
    }

    private function writeLog(array $goods, int $roomId, string $date, int $changeQty, string $remark): void
    {
        if ($changeQty === 0) {
            return;
        }
        Db::table('goods_stock_log')->insert([
            'site_id' => (int) $goods['site_id'],
            'goods_id' => (int) $goods['id'],
            'sku_type' => 1,
            'sku_id' => $roomId,
            'stock_date' => $date,
            'change_type' => 5,
            'change_qty' => $changeQty,
            'operator_id' => MerchantContext::adminId(),
            'remark' => mb_substr($remark, 0, 255),
        ]);
    }
}

