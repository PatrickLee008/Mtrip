<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use App\Service\RoomReviewService;
use App\Service\RoomContentService;
use App\Service\RoomMediaService;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\RoomDefaults;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端客房/房型管理:房型直接归属酒店物业 merchant_store.id。
 */
class RoomController extends AbstractAdminController
{
    /**
     * 列表「未来窗口」天数:今天之后 N 天内最低可售。
     * 库存按日期落 goods_daily_stock,只订明天/后天的订单不会改动今天的数字,
     * 所以列表必须额外给出未来窗口,否则商户在客房管理里完全看不出这类订单(见 docs/plans/20)。
     */
    private const UPCOMING_DAYS = 7;

    /** 酒店下拉选项:仅返回当前账号可管理且 KYC 已通过的物业 */
    public function hotelOptions(): array
    {
        $query = Db::table('merchant_store')
            ->where('business_type', 'hotel')
            ->where('kyc_status', 1)
            ->whereNull('deleted_at');
        $this->applyPropertyScope($query, 'merchant_store.');

        $rows = $query->orderByDesc('id')
            ->get(['id', 'merchant_id', 'store_name', 'images', 'address', 'operating_status'])
            ->map(static fn ($row) => (array) $row)->all();
        $merchantNames = $this->pluckNames('merchant_info', array_column($rows, 'merchant_id'), 'merchant_name');

        $currency = RoomContentService::siteCurrency(MerchantContext::siteId());
        return Result::success(array_map(static function (array $row) use ($merchantNames, $currency) {
            return [
                'id' => (int) $row['id'],
                'merchant_id' => (int) $row['merchant_id'],
                'merchant_name' => (string) ($merchantNames[$row['merchant_id']] ?? ''),
                'property_name' => (string) $row['store_name'],
                'cover_image' => (string) (((array) json_decode((string) ($row['images'] ?? ''), true))[0] ?? ''),
                'address' => (string) $row['address'],
                'status' => (int) $row['operating_status'],
                'currency' => $currency,
            ];
        }, $rows));
    }

    /** 房型分页列表:支持酒店/状态/关键词筛选 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('hotel_room_type as r')
            ->join('merchant_store as p', 'p.id', '=', 'r.property_id')
            ->where('p.business_type', 'hotel')
            ->whereNull('r.deleted_at')
            ->whereNull('p.deleted_at');
        $this->applyPropertyScope($query, 'p.');

        if (($propertyId = $this->intInput('propertyId')) > 0) {
            $query->where('r.property_id', $propertyId);
        }
        $metrics = (clone $query)->orderBy('r.sort')->orderBy('r.id')->get(['r.id', 'r.room_name', 'r.base_stock', 'r.property_id'])->map(static fn ($r) => (array) $r)->all();
        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function (Builder $q) use ($keyword) {
                $q->where('r.room_name', 'like', "%{$keyword}%")
                    ->orWhere('r.room_code', 'like', "%{$keyword}%")
                    ->orWhere('p.store_name', 'like', "%{$keyword}%");
            });
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('r.status', (int) $status);
        }
        $reviewStatus = $this->input('reviewStatus');
        if ($reviewStatus !== null && $reviewStatus !== '') {
            $query->whereRaw('COALESCE((SELECT v.status FROM hotel_room_type_revision v WHERE v.room_id=r.id ORDER BY v.id DESC LIMIT 1), IF(r.publish_status=2,2,0)) = ?', [(int) $reviewStatus]);
        }

        $total = (clone $query)->count();
        $sorts = ['updated' => ['r.updated_at', 'desc'], 'name' => ['r.room_name', 'asc'], 'priceAsc' => ['r.base_price', 'asc'], 'priceDesc' => ['r.base_price', 'desc'], 'quantity' => ['r.base_stock', 'desc']];
        [$column, $direction] = $sorts[$this->strInput('sort', 'updated')] ?? $sorts['updated'];
        $rows = $query->orderBy($column, $direction)->orderBy('r.id')
            ->forPage($page, $pageSize)
            ->get([
                'r.*', 'p.store_name as property_name', 'p.merchant_id', 'p.images as property_images', 'p.address as property_address',
            ])->map(fn ($row) => $this->formatRoom((array) $row))->all();

        $rows = $this->appendAvailability($rows);
        $rows = $this->appendReviewState($rows);
        return Result::success(['list' => $rows, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize,
            'metrics' => ['totalRooms' => array_sum(array_column($metrics, 'base_stock')), 'roomTypes' => $metrics]]);
    }

    /** 房型详情 */
    public function detail(): array
    {
        $room = $this->formatRoom($this->findScopedRoom($this->requireId()));
        $revisions = Db::table('hotel_room_type_revision')->where('room_id', $room['id'])
            ->orderByDesc('version')->get()->map(function ($row) {
                $item = (array) $row;
                $item['payload'] = (new RoomReviewService())->decode((string) $item['payload_json']);
                foreach (RoomContentService::JSON_FIELDS as $field) {
                    if (isset($item['payload'][$field]) && is_string($item['payload'][$field])) {
                        $item['payload'][$field] = $this->jsonDecode($item['payload'][$field]);
                    }
                }
                unset($item['payload_json']);
                return $item;
            })->all();
        $latest = $revisions[0] ?? null;
        $rule = Db::table('goods_refund_rule')->where('site_id', $room['site_id'])->where('property_id', $room['property_id'])->whereNull('deleted_at')
            ->where(function ($q) use ($room) { $q->where('sku_type', 0)->orWhere(function ($q) use ($room) { $q->where('sku_type', 1)->where('sku_id', $room['id']); }); })
            ->orderByDesc('sku_type')->orderByDesc('id')->first();
        return Result::success([
            'currentRefundPolicy' => $rule ? ['ruleType' => (int) $rule->rule_type, 'rules' => json_decode($rule->rules ?? '[]', true), 'remark' => $rule->remark] : ['ruleType' => 1, 'rules' => [], 'remark' => ''],
            'room' => $room,
            'editable' => $latest && in_array((int) $latest['status'], [0, 3], true) ? $latest['payload'] : $room,
            'latestRevision' => $latest,
            'history' => $revisions,
        ]);
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
        $property = $id > 0
            ? $this->findScopedProperty((int) $this->findScopedRoom($id)['property_id'])
            : $this->findScopedProperty($this->requireId('propertyId'));
        MerchantContext::assertPropertyAccess((int) $property['id'], true);

        $data = $this->collectRoomFields($id <= 0);
        $data['property_id'] = (int) $property['id'];
        $data['site_id'] = (int) $property['site_id'];

        $submit = (int) $data['publish_status'] === 1;
        unset($data['publish_status'], $data['submitted_at']);
        $result = (new RoomReviewService())->save($property, $id, $data, $submit);
        return Result::success($result, $submit ? '房型已提交审核' : '房型草稿已保存');
    }

    /** 复制房型为新草稿。 */
    #[Permission('mch:rooms:add')]
    public function copy(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        $property = $this->findScopedProperty((int) $room['property_id']);
        MerchantContext::assertPropertyAccess((int) $property['id'], true);
        return Result::success((new RoomReviewService())->copy($property, $room), '房型已复制为草稿');
    }

    /** 撤回待审核版本。 */
    #[Permission('mch:rooms:edit')]
    public function withdraw(): array
    {
        (new RoomReviewService())->withdraw($this->requireId('revisionId'));
        return Result::success(null, '已撤回审核');
    }

    /** 房型媒体上传:图片最多10MB且不低于800x600;视频最多500MB。 */
    #[Permission(['mch:rooms:add', 'mch:rooms:edit'])]
    public function uploadMedia(): array
    {
        /** @var UploadedFile|null $file */
        $file = $this->request->file('file');
        if (! $file || ! $file->isValid()) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '未接收到有效文件');
        }
        $kind = $this->strInput('kind', 'image');
        $property = $this->findScopedProperty($this->requireId('propertyId'));
        MerchantContext::assertPropertyAccess((int) $property['id'], true);
        $roomId = $this->intInput('roomId');
        $permission = $roomId > 0 ? 'mch:rooms:edit' : 'mch:rooms:add';
        if (! MerchantContext::hasPermission($permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
        if ($roomId > 0 && (int) $this->findScopedRoom($roomId)['property_id'] !== (int) $property['id']) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return Result::success((new RoomMediaService())->upload($file, $kind, $property), '上传成功');
    }

    /** 上下架/停售切换 */
    #[Permission('mch:rooms:status')]
    public function toggleStatus(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        MerchantContext::assertPropertyAccess((int) $room['property_id'], true);
        $next = Db::transaction(function () use ($room) {
            $current = Db::table('hotel_room_type')->where('id', $room['id'])->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $current || (int) $current->approved_version === 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型批准后才能启停销售');
            $next = (int) $current->status === 1 ? 2 : 1;
            Db::table('hotel_room_type')->where('id', $room['id'])->update(['status' => $next, 'status_version' => (int) $current->status_version + 1]);
            return $next;
        });
        return Result::success(['status' => $next], $next === 1 ? '房型已启用' : '房型已停用');
    }

    /** 删除房型:存在进行中订单时禁止 */
    #[Permission('mch:rooms:delete')]
    public function delete(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        MerchantContext::assertPropertyAccess((int) $room['property_id'], true);
        $property = $this->findScopedProperty((int) $room['property_id']);
        $result = (new RoomReviewService())->remove($property, $room);
        return Result::success($result, $result['reviewRequired'] ? '下线申请已提交审核' : '房型草稿已删除');
    }

    private function collectRoomFields(bool $creating): array
    {
        $data = [
            'room_name' => $creating ? $this->requireStr('roomName') : $this->strInput('roomName'),
            'room_code' => mb_substr($this->strInput('roomCode'), 0, 50),
            'description' => mb_substr($this->strInput('description'), 0, 1000),
            'bed_type' => mb_substr($this->strInput('bedType'), 0, 50),
            'bed_count' => $this->input('bedCount', 1),
            'area' => mb_substr($this->strInput('area'), 0, 20),
            'max_adults' => $this->input('maxAdults', 2),
            'max_children' => $this->input('maxChildren', 0),
            'max_guests' => $this->input('maxGuests', 2),
            'floor_name' => mb_substr($this->strInput('floorName'), 0, 50),
            'room_view' => mb_substr($this->strInput('roomView'), 0, 80),
            'smoking' => $this->intInput('smoking') === 1 ? 1 : 0,
            'breakfast' => in_array($this->intInput('breakfast'), [0, 1, 2], true) ? $this->intInput('breakfast') : 0,
            'meal_plan' => mb_substr($this->strInput('mealPlan'), 0, 80),
            'cancellation_policy' => mb_substr($this->strInput('cancellationPolicy'), 0, 255),
            'currency' => strtoupper($this->strInput('currency')),
            'checkin_notes' => mb_substr($this->strInput('checkinNotes'), 0, 500),
            'base_price' => $this->validPrice('basePrice'),
            'weekend_price' => $this->input('weekendPrice') !== null ? $this->validPrice('weekendPrice') : 0,
            'extra_bed_price' => $this->input('extraBedPrice') !== null ? $this->validPrice('extraBedPrice') : 0,
            'base_stock' => $this->input('baseStock', 0),
            'launch_stock' => $this->input('launchStock', 0),
            'video_url' => mb_substr($this->strInput('videoUrl'), 0, 255),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
            'publish_status' => in_array($this->intInput('publishStatus'), [0, 1, 2, 3], true) ? $this->intInput('publishStatus') : 0,
            'sort' => $this->intInput('sort'),
        ];
        if (! $creating && $data['room_name'] === '') {
            unset($data['room_name']);
        }
        foreach (RoomContentService::JSON_FIELDS as $key) {
            $value = $this->input($key);
            if (is_array($value)) {
                $data[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
            }
        }
        foreach (['imageGallery' => 'image_gallery', 'vrTour' => 'vr_tour', 'floorPlan' => 'floor_plan', 'refundPolicy' => 'refund_policy'] as $input => $field) {
            if ($this->input($input) !== null) $data[$field] = $this->input($input);
        }
        $data['area_unit'] = $this->strInput('areaUnit', 'sqm');
        if ((int) $data['publish_status'] === 1 && $this->input('submittedAt') === null) {
            $data['submitted_at'] = date('Y-m-d H:i:s');
        }
        return $data;
    }

    private function appendReviewState(array $rows): array
    {
        if ($rows === []) return [];
        $roomIds = array_map(static fn (array $row) => (int) $row['id'], $rows);
        $latestIds = Db::table('hotel_room_type_revision')->whereIn('room_id', $roomIds)
            ->selectRaw('MAX(id) as id')->groupBy('room_id')->pluck('id')->all();
        $latest = $latestIds === [] ? collect() : Db::table('hotel_room_type_revision')->whereIn('id', $latestIds)->get()->keyBy('room_id');
        return array_map(static function (array $row) use ($latest) {
            $revision = $latest[(int) $row['id']] ?? null;
            $row['review_status'] = $revision ? (int) $revision->status : ((int) ($row['publish_status'] ?? 0) === 2 ? 2 : 0);
            $row['revision_id'] = $revision ? (int) $revision->id : 0;
            $row['revision_version'] = $revision ? (int) $revision->version : (int) ($row['approved_version'] ?? 0);
            $row['revision_action'] = $revision ? (string) $revision->action : '';
            $row['reject_reason'] = $revision ? (string) $revision->reject_reason : '';
            return $row;
        }, $rows);
    }

    private function findScopedRoom(int $id): array
    {
        $row = Db::table('hotel_room_type as r')
            ->join('merchant_store as p', 'p.id', '=', 'r.property_id')
            ->where('r.id', $id)
            ->where('p.business_type', 'hotel')
            ->whereNull('r.deleted_at')
            ->whereNull('p.deleted_at')
            ->get(['r.*', 'p.store_name as property_name', 'p.merchant_id', 'p.images as property_images', 'p.address as property_address'])
            ->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
        }
        $room = (array) $row;
        MerchantContext::assertPropertyAccess((int) $room['property_id']);
        return $room;
    }

    private function findScopedProperty(int $propertyId): array
    {
        $property = Db::table('merchant_store')
            ->where('id', $propertyId)
            ->where('site_id', MerchantContext::siteId())
            ->where('business_type', 'hotel')
            ->where('kyc_status', 1)
            ->whereNull('deleted_at')
            ->first();
        if (! $property) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '酒店物业不存在或 KYC 未通过');
        }
        $property = (array) $property;
        MerchantContext::assertPropertyAccess((int) $property['id']);
        return $property;
    }

    private function applyPropertyScope(Builder $query, string $prefix): void
    {
        $query->where($prefix . 'site_id', MerchantContext::siteId());
        $query->whereIn($prefix . 'id', MerchantContext::scopePropertyIds());
    }

    private function formatRoom(array $row): array
    {
        foreach (RoomContentService::JSON_FIELDS as $key) {
            $row[$key] = $this->jsonDecode($row[$key] ?? null);
        }
        unset($row['deleted_at']);
        return $row;
    }

    /**
     * 列表附加「今日可售」与「未来 7 天(明天起)最低可售」。
     *
     * 无日库存记录的日期一律按房型默认可售配额兜底(与 C 端日历同口径);
     * 未来窗口里商户主动关房的日期不计入最低值(全部关房则记 0)。
     */
    private function appendAvailability(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $today = date('Y-m-d');
        $windowEnd = date('Y-m-d', strtotime("{$today} +" . self::UPCOMING_DAYS . ' days'));
        $skuIds = array_map(static fn (array $row) => (int) $row['id'], $rows);
        $days = [];
        foreach (Db::table('goods_daily_stock')
            ->where('sku_type', 1)
            ->whereIn('sku_id', $skuIds)
            ->whereBetween('stock_date', [$today, $windowEnd])
            ->whereNull('deleted_at')
            ->get(['sku_id', 'stock_date', 'stock_total', 'stock_sold', 'stock_locked', 'is_closed']) as $stockRow) {
            $days[(int) $stockRow->sku_id][(string) $stockRow->stock_date] = (array) $stockRow;
        }

        return array_map(static function (array $row) use ($days, $today) {
            $skuId = (int) $row['id'];
            $day = $days[$skuId][$today] ?? null;
            $row['today_stock_total'] = $day !== null ? (int) $day['stock_total'] : RoomDefaults::stock($row);
            $row['today_stock_left'] = self::stockLeft($row, $day);

            $lowest = null;
            $occupied = 0;
            for ($offset = 1; $offset <= self::UPCOMING_DAYS; ++$offset) {
                $date = date('Y-m-d', strtotime("{$today} +{$offset} days"));
                $windowDay = $days[$skuId][$date] ?? null;
                if ($windowDay !== null) {
                    $occupied += (int) $windowDay['stock_sold'] + (int) $windowDay['stock_locked'];
                    if ((int) $windowDay['is_closed'] === 1) {
                        continue;
                    }
                }
                $left = self::stockLeft($row, $windowDay);
                if ($lowest === null || $left < $lowest['left']) {
                    $lowest = ['date' => $date, 'left' => $left];
                }
            }
            $row['upcoming_days'] = self::UPCOMING_DAYS;
            $row['upcoming_stock_left'] = $lowest !== null ? $lowest['left'] : 0;
            $row['upcoming_stock_date'] = $lowest !== null ? $lowest['date'] : '';
            // 窗口内已售+锁定合计(间夜):非今日订单的"看得见"信号,前端据此高亮
            $row['upcoming_sold'] = $occupied;
            return $row;
        }, $rows);
    }

    /** 单日剩余可售:无记录按默认配额,关房为 0 */
    private static function stockLeft(array $room, ?array $day): int
    {
        if ($day === null) {
            return RoomDefaults::stock($room);
        }
        if ((int) $day['is_closed'] === 1) {
            return 0;
        }
        return max(0, (int) $day['stock_total'] - (int) $day['stock_sold'] - (int) $day['stock_locked']);
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
