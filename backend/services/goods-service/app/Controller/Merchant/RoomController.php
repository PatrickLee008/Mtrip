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
 * 商户端客房/房型管理:围绕酒店商品(goods_type=1)维护 hotel_room_type。
 * 数据范围只按 MerchantContext::scopeMerchantIds() 裁剪,门店账号暂无 goods_info.store_id 可用。
 */
class RoomController extends AbstractAdminController
{
    /** 酒店下拉选项:仅返回当前商户范围内的酒店商品 */
    public function hotelOptions(): array
    {
        $query = Db::table('goods_info')
            ->where('goods_type', 1)
            ->where('status', '<>', 5)
            ->whereNull('deleted_at');
        $this->applyMerchantScope($query, 'goods_info.merchant_id');

        $rows = $query->orderByDesc('sort_weight')->orderByDesc('id')
            ->get(['id', 'merchant_id', 'goods_name', 'cover_image', 'address', 'status'])
            ->map(static fn ($row) => (array) $row)->all();
        $merchantNames = $this->pluckNames('merchant_info', array_column($rows, 'merchant_id'), 'merchant_name');

        return Result::success(array_map(static function (array $row) use ($merchantNames) {
            return [
                'id' => (int) $row['id'],
                'merchant_id' => (int) $row['merchant_id'],
                'merchant_name' => (string) ($merchantNames[$row['merchant_id']] ?? ''),
                'goods_name' => (string) $row['goods_name'],
                'cover_image' => (string) $row['cover_image'],
                'address' => (string) $row['address'],
                'status' => (int) $row['status'],
            ];
        }, $rows));
    }

    /** 房型分页列表:支持酒店/状态/关键词筛选 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('hotel_room_type as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->where('g.goods_type', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at')
            ->where('g.status', '<>', 5);
        $this->applyMerchantScope($query, 'g.merchant_id');

        if (($goodsId = $this->intInput('goodsId')) > 0) {
            $query->where('r.goods_id', $goodsId);
        }
        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function (Builder $q) use ($keyword) {
                $q->where('r.room_name', 'like', "%{$keyword}%")
                    ->orWhere('r.room_code', 'like', "%{$keyword}%")
                    ->orWhere('g.goods_name', 'like', "%{$keyword}%");
            });
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('r.status', (int) $status);
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('r.updated_at')->orderBy('r.sort')->orderByDesc('r.id')
            ->forPage($page, $pageSize)
            ->get([
                'r.*', 'g.goods_name', 'g.merchant_id', 'g.cover_image as hotel_cover', 'g.address as hotel_address',
            ])->map(fn ($row) => $this->formatRoom((array) $row))->all();

        $rows = $this->appendAvailability($rows);
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 房型详情 */
    public function detail(): array
    {
        return Result::success($this->formatRoom($this->findScopedRoom($this->requireId())));
    }

    /** 新增/编辑房型:保存草稿或提交审核由 publishStatus 表示 */
    #[Permission(['mch:rooms:add', 'mch:rooms:edit'])]
    public function save(): array
    {
        $id = $this->intInput('id');
        $requiredPerm = $id > 0 ? 'mch:rooms:edit' : 'mch:rooms:add';
        if (! MerchantContext::hasPermission($requiredPerm)) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        $goods = $id > 0
            ? $this->findScopedHotel((int) $this->findScopedRoom($id)['goods_id'])
            : $this->findScopedHotel($this->requireId('goodsId'));

        $data = $this->collectRoomFields($id <= 0);
        $data['goods_id'] = (int) $goods['id'];
        $data['site_id'] = (int) $goods['site_id'];

        if ($id > 0) {
            Db::table('hotel_room_type')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '房型已更新');
        }

        $newId = (int) Db::table('hotel_room_type')->insertGetId($data);
        return Result::success(['id' => $newId], '房型已创建');
    }

    /** 上下架/停售切换 */
    #[Permission('mch:rooms:status')]
    public function toggleStatus(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        $next = (int) $room['status'] === 1 ? 2 : 1;
        Db::table('hotel_room_type')->where('id', $room['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '房型已启用' : '房型已停用');
    }

    /** 删除房型:存在进行中订单时禁止 */
    #[Permission('mch:rooms:delete')]
    public function delete(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        $pending = Db::table('order_main')
            ->where('order_type', 1)
            ->where('sku_id', $room['id'])
            ->whereIn('order_status', [0, 1, 5])
            ->whereNull('deleted_at')
            ->count();
        if ($pending > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$pending} 笔进行中订单,禁止删除");
        }
        Db::table('hotel_room_type')->where('id', $room['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '房型已删除');
    }

    private function collectRoomFields(bool $creating): array
    {
        $data = [
            'room_name' => $creating ? $this->requireStr('roomName') : $this->strInput('roomName'),
            'room_code' => mb_substr($this->strInput('roomCode'), 0, 50),
            'description' => mb_substr($this->strInput('description'), 0, 1000),
            'bed_type' => mb_substr($this->strInput('bedType'), 0, 50),
            'bed_count' => max(1, $this->intInput('bedCount', 1)),
            'area' => mb_substr($this->strInput('area'), 0, 20),
            'max_adults' => max(1, $this->intInput('maxAdults', 2)),
            'max_children' => max(0, $this->intInput('maxChildren')),
            'max_guests' => max(1, $this->intInput('maxGuests', 2)),
            'floor_name' => mb_substr($this->strInput('floorName'), 0, 50),
            'room_view' => mb_substr($this->strInput('roomView'), 0, 80),
            'smoking' => $this->intInput('smoking') === 1 ? 1 : 0,
            'breakfast' => in_array($this->intInput('breakfast'), [0, 1, 2], true) ? $this->intInput('breakfast') : 0,
            'meal_plan' => mb_substr($this->strInput('mealPlan'), 0, 80),
            'cancellation_policy' => mb_substr($this->strInput('cancellationPolicy'), 0, 255),
            'checkin_notes' => mb_substr($this->strInput('checkinNotes'), 0, 500),
            'base_price' => $this->validPrice('basePrice'),
            'weekend_price' => $this->input('weekendPrice') !== null ? $this->validPrice('weekendPrice') : 0,
            'extra_bed_price' => $this->input('extraBedPrice') !== null ? $this->validPrice('extraBedPrice') : 0,
            'base_stock' => max(0, $this->intInput('baseStock')),
            'launch_stock' => max(0, $this->intInput('launchStock')),
            'video_url' => mb_substr($this->strInput('videoUrl'), 0, 255),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
            'publish_status' => in_array($this->intInput('publishStatus'), [0, 1, 2, 3], true) ? $this->intInput('publishStatus') : 0,
            'sort' => $this->intInput('sort'),
        ];
        if (! $creating && $data['room_name'] === '') {
            unset($data['room_name']);
        }
        foreach (['images', 'facilities'] as $key) {
            $value = $this->input($key);
            if (is_array($value)) {
                $data[$key] = json_encode(array_values($value), JSON_UNESCAPED_UNICODE);
            }
        }
        if ((int) $data['publish_status'] === 1 && $this->input('submittedAt') === null) {
            $data['submitted_at'] = date('Y-m-d H:i:s');
        }
        return $data;
    }

    private function findScopedRoom(int $id): array
    {
        $row = Db::table('hotel_room_type as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->where('r.id', $id)
            ->where('g.goods_type', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at')
            ->get(['r.*', 'g.goods_name', 'g.merchant_id', 'g.cover_image as hotel_cover', 'g.address as hotel_address'])
            ->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
        }
        $room = (array) $row;
        if (! in_array((int) $room['merchant_id'], MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $room;
    }

    private function findScopedHotel(int $goodsId): array
    {
        $goods = Db::table('goods_info')
            ->where('id', $goodsId)
            ->where('goods_type', 1)
            ->whereNull('deleted_at')
            ->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '酒店商品不存在');
        }
        $goods = (array) $goods;
        if (! in_array((int) $goods['merchant_id'], MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $goods;
    }

    private function applyMerchantScope(Builder $query, string $column): void
    {
        $merchantIds = MerchantContext::scopeMerchantIds();
        $query->whereIn($column, $merchantIds === [] ? [0] : $merchantIds);
    }

    private function formatRoom(array $row): array
    {
        foreach (['images', 'facilities'] as $key) {
            $row[$key] = $this->jsonDecode($row[$key] ?? null);
        }
        unset($row['deleted_at']);
        return $row;
    }

    private function appendAvailability(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $today = date('Y-m-d');
        $skuIds = array_map(static fn (array $row) => (int) $row['id'], $rows);
        $stock = Db::table('goods_daily_stock')
            ->where('sku_type', 1)
            ->whereIn('sku_id', $skuIds)
            ->where('stock_date', $today)
            ->whereNull('deleted_at')
            ->get(['sku_id', 'stock_total', 'stock_sold', 'stock_locked', 'is_closed'])
            ->keyBy('sku_id');

        return array_map(static function (array $row) use ($stock) {
            $day = $stock[(int) $row['id']] ?? null;
            $total = $day !== null ? (int) $day->stock_total : (int) $row['base_stock'];
            $sold = $day !== null ? (int) $day->stock_sold : 0;
            $locked = $day !== null ? (int) $day->stock_locked : 0;
            $row['today_stock_total'] = $total;
            $row['today_stock_left'] = (int) ($day !== null && (int) $day->is_closed === 1 ? 0 : max(0, $total - $sold - $locked));
            return $row;
        }, $rows);
    }

    private function pluckNames(string $table, array $ids, string $nameColumn): array
    {
        $ids = array_values(array_filter(array_unique($ids)));
        return $ids === [] ? [] : Db::table($table)->whereIn('id', $ids)->pluck($nameColumn, 'id')->all();
    }

    private function validPrice(string $key): float
    {
        $price = $this->floatInput($key, 0.0);
        if ($price < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为负");
        }
        return round($price, 2);
    }
}
