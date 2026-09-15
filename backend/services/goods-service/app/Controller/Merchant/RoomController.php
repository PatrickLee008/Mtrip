<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use App\Service\RoomReviewService;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
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

        return Result::success(array_map(static function (array $row) use ($merchantNames) {
            return [
                'id' => (int) $row['id'],
                'merchant_id' => (int) $row['merchant_id'],
                'merchant_name' => (string) ($merchantNames[$row['merchant_id']] ?? ''),
                'property_name' => (string) $row['store_name'],
                'cover_image' => (string) (((array) json_decode((string) ($row['images'] ?? ''), true))[0] ?? ''),
                'address' => (string) $row['address'],
                'status' => (int) $row['operating_status'],
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
        $rows = $query->orderByDesc('r.updated_at')->orderBy('r.sort')->orderByDesc('r.id')
            ->forPage($page, $pageSize)
            ->get([
                'r.*', 'p.store_name as property_name', 'p.merchant_id', 'p.images as property_images', 'p.address as property_address',
            ])->map(fn ($row) => $this->formatRoom((array) $row))->all();

        $rows = $this->appendAvailability($rows);
        $rows = $this->appendReviewState($rows);
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 房型详情 */
    public function detail(): array
    {
        $room = $this->formatRoom($this->findScopedRoom($this->requireId()));
        $revisions = Db::table('hotel_room_type_revision')->where('room_id', $room['id'])
            ->orderByDesc('version')->get()->map(function ($row) {
                $item = (array) $row;
                $item['payload'] = (new RoomReviewService())->decode((string) $item['payload_json']);
                foreach (['images', 'facilities'] as $field) {
                    if (isset($item['payload'][$field]) && is_string($item['payload'][$field])) {
                        $item['payload'][$field] = $this->jsonDecode($item['payload'][$field]);
                    }
                }
                unset($item['payload_json']);
                return $item;
            })->all();
        $latest = $revisions[0] ?? null;
        return Result::success([
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
        $name = (string) ($file->getClientFilename() ?? '');
        $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        $size = (int) $file->getSize();
        if ($kind === 'image') {
            if (! in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true) || $size > 10 * 1024 * 1024) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '图片仅支持 JPG/PNG/WEBP,单张不超过10MB');
            }
            $dimensions = @getimagesize((string) $file->getRealPath());
            if (! $dimensions || (int) $dimensions[0] < 800 || (int) $dimensions[1] < 600) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '图片分辨率不能低于800×600');
            }
        } elseif (! in_array($ext, ['mp4', 'mov'], true) || $size > 500 * 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '视频仅支持 MP4/MOV,大小不超过500MB');
        }
        $dir = '/opt/www/uploads/rooms/' . date('Ym');
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        }
        $filename = date('His') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
        $path = $dir . '/' . $filename;
        $file->moveTo($path);
        @chmod($path, 0644);
        return Result::success(['url' => '/uploads/rooms/' . date('Ym') . '/' . $filename, 'name' => $name, 'kind' => $kind], '上传成功');
    }

    /** 上下架/停售切换 */
    #[Permission('mch:rooms:status')]
    public function toggleStatus(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        MerchantContext::assertPropertyAccess((int) $room['property_id'], true);
        $next = (int) $room['status'] === 1 ? 2 : 1;
        Db::table('hotel_room_type')->where('id', $room['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '房型已启用' : '房型已停用');
    }

    /** 删除房型:存在进行中订单时禁止 */
    #[Permission('mch:rooms:delete')]
    public function delete(): array
    {
        $room = $this->findScopedRoom($this->requireId());
        MerchantContext::assertPropertyAccess((int) $room['property_id'], true);
        $pending = Db::table('order_main')
            ->where('order_type', 1)
            ->where('sku_id', $room['id'])
            ->whereIn('order_status', [0, 1, 5])
            ->whereNull('deleted_at')
            ->count();
        if ($pending > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$pending} 笔进行中订单,禁止删除");
        }
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
            'currency' => mb_substr(strtoupper($this->strInput('currency', 'THB')), 0, 3),
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
