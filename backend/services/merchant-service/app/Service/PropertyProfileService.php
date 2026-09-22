<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Psr\Http\Message\UploadedFileInterface;

use function Hyperf\Config\config;

/** Property content drafts and the approved live projection. */
class PropertyProfileService
{
    private const FIELDS = [
        'store_name', 'contact_phone', 'contact_phone2', 'contact_email', 'address', 'country_code',
        'city_key', 'longitude', 'latitude', 'description', 'star_level', 'facilities', 'images',
        'amenities', 'image_gallery', 'website', 'checkin_time', 'checkout_time',
        'long_stay', 'hotel_policies', 'nearby_attractions',
    ];

    /** 逗号分隔的 JSON 列清单:读时统一解码,写时统一编码 */
    private const JSON_FIELDS = [
        'images', 'facilities', 'amenities', 'image_gallery',
        'long_stay', 'hotel_policies', 'nearby_attractions',
    ];

    private const LONG_STAY_LIMITS = ['promotions' => 10, 'benefits' => 12];
    private const POLICY_LIMITS = ['children' => 10, 'rules' => 12];
    private const POLICY_TEXT_LIMIT = 500;
    private const NEARBY_LIMIT = 20;
    private const NEARBY_STOP_LIMIT = 8;

    public function detail(int $propertyId): array
    {
        $property = $this->merchantProperty($propertyId);
        $latest = Db::table('merchant_property_content_revision')->where('property_id', $propertyId)
            ->orderByDesc('version')->first();
        $live = $this->formatProperty($property);
        $rooms = Db::table('hotel_room_type')->where('property_id', $propertyId)
            ->where('site_id', $property['site_id'])->where('status', 1)->where('publish_status', 2)
            ->where('approved_version', '>', 0)->whereNull('deleted_at')->get(['room_name', 'base_stock', 'currency']);
        $roomTypes = [];
        $totalRooms = 0;
        $currency = '';
        foreach ($rooms as $room) {
            $roomTypes[] = (string) $room->room_name;
            $totalRooms += max(0, (int) $room->base_stock);
            if ($currency === '') $currency = strtoupper(trim((string) ($room->currency ?? '')));
        }
        // 在售房型都没填币种时,回退到该物业任意一条房型的币种(金额输入框右侧的币种胶囊要用)
        if ($currency === '') {
            $currency = strtoupper(trim((string) (Db::table('hotel_room_type')->where('property_id', $propertyId)
                ->where('site_id', $property['site_id'])->whereNull('deleted_at')
                ->where('currency', '<>', '')->value('currency') ?? '')));
        }
        $live['live_room_count'] = count($rooms);
        $reviewQuery = Db::table('goods_review')->where('property_id', $propertyId)
            ->where('site_id', $property['site_id'])->where('status', 1)->whereNull('deleted_at');
        $reviewCount = (clone $reviewQuery)->count();
        $rating = $reviewCount > 0 ? round((float) $reviewQuery->avg('rating'), 1) : 0.0;
        $editable = $latest && in_array((int) $latest->status, [0, 3], true)
            ? $this->decode((string) $latest->payload_json) : array_intersect_key($property, array_flip(self::FIELDS));
        return [
            'property' => $live,
            'editable' => $this->formatPayload($editable),
            'latestRevision' => $latest ? $this->formatRevision((array) $latest) : null,
            'metrics' => ['roomTypes' => array_values(array_unique($roomTypes)), 'totalRooms' => $totalRooms,
                'guestRating' => $rating, 'guestReviewCount' => $reviewCount, 'currency' => $currency],
        ];
    }

    public function uploadImage(int $propertyId, ?UploadedFileInterface $file): array
    {
        $property = $this->merchantProperty($propertyId);
        MerchantContext::assertPropertyAccess($propertyId, true);
        if ((int) $property['kyc_status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业 KYC 通过后才能上传酒店图片');
        }
        $pending = Db::table('merchant_property_content_revision')->where('property_id', $propertyId)
            ->where('status', 1)->exists();
        if ($pending) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业资料正在审核中');
        }
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || ! $file->getSize() || $file->getSize() > 10 * 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择不超过 10MB 的图片');
        }
        $path = (string) $file->getStream()->getMetadata('uri');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        $dimensions = @getimagesize($path);
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '图片仅支持 JPG/PNG/WEBP');
        }
        if (! $dimensions || (int) $dimensions[0] < 800 || (int) $dimensions[1] < 600) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '图片分辨率不能低于800×600');
        }
        $month = date('Ym');
        $root = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
        $dir = $root . '/properties/' . $propertyId . '/' . $month;
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        }
        $filename = bin2hex(random_bytes(20)) . '.' . $ext;
        $target = $dir . '/' . $filename;
        $file->moveTo($target);
        if (! is_file($target)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '图片保存失败');
        }
        chmod($target, 0644);
        return ['url' => '/uploads/properties/' . $property['id'] . '/' . $month . '/' . $filename,
            'name' => mb_substr(basename((string) $file->getClientFilename()), 0, 100)];
    }

    public function save(array $input, bool $submit): array
    {
        $propertyId = max(0, (int) ($input['propertyId'] ?? 0));
        return Db::transaction(function () use ($propertyId, $input, $submit): array {
            $property = $this->merchantProperty($propertyId, true);
            MerchantContext::assertPropertyAccess($propertyId, true);
            if ((int) $property['kyc_status'] !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业 KYC 通过后才能维护酒店资料');
            }
            $latest = Db::table('merchant_property_content_revision')->where('property_id', $propertyId)
                ->orderByDesc('version')->lockForUpdate()->first();
            if ($latest && (int) $latest->status === 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业资料正在审核中');
            }
            $base = $latest && in_array((int) $latest->status, [0, 3], true)
                ? $this->decode((string) $latest->payload_json) : array_intersect_key($property, array_flip(self::FIELDS));
            $payload = $this->collect($input, $base);
            if ($payload['store_name'] === '' || $payload['address'] === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '物业名称和地址不能为空');
            }
            if ($submit && ($payload['country_code'] === '' || $payload['city_key'] === '')) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '提交审核前必须填写国家和城市');
            }
            $now = date('Y-m-d H:i:s');
            $status = $submit ? 1 : 0;
            if ($latest && (int) $latest->status === 0) {
                $version = (int) $latest->version;
                $revisionId = (int) $latest->id;
                Db::table('merchant_property_content_revision')->where('id', $revisionId)->update([
                    'payload_json' => $this->encode($payload), 'status' => $status,
                    'submitted_by' => $submit ? MerchantContext::adminId() : 0,
                    'submitted_at' => $submit ? $now : null, 'reject_reason' => '',
                    'reviewed_by' => 0, 'reviewed_at' => null, 'review_remark' => '',
                ]);
            } else {
                $version = max((int) $property['content_version'], (int) ($latest->version ?? 0)) + 1;
                $revisionId = (int) Db::table('merchant_property_content_revision')->insertGetId([
                    'site_id' => $property['site_id'], 'merchant_id' => $property['merchant_id'],
                    'property_id' => $propertyId, 'version' => $version, 'status' => $status,
                    'payload_json' => $this->encode($payload),
                    'submitted_by' => $submit ? MerchantContext::adminId() : 0,
                    'submitted_at' => $submit ? $now : null,
                ]);
            }
            $update = ['content_version' => $version, 'content_reject_reason' => ''];
            if ((int) $property['content_approved_version'] === 0) {
                $update += $payload;
                $update['content_status'] = $status;
            }
            if ($submit) {
                $update['content_submitted_at'] = $now;
            }
            Db::table('merchant_store')->where('id', $propertyId)->update($update);
            return ['propertyId' => $propertyId, 'revisionId' => $revisionId, 'version' => $version, 'reviewStatus' => $status];
        });
    }

    public function reviewList(int $page, int $pageSize, ?int $status, string $keyword): array
    {
        $query = Db::table('merchant_property_content_revision as v')
            ->join('merchant_store as p', 'p.id', '=', 'v.property_id')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'v.merchant_id')
            ->whereNull('p.deleted_at');
        if (! AdminContext::isSuper()) $query->where('v.site_id', AdminContext::siteId());
        if ($status !== null) $query->where('v.status', $status);
        if ($keyword !== '') {
            $query->where(static fn ($q) => $q->where('p.store_name', 'like', "%{$keyword}%")
                ->orWhere('m.merchant_name', 'like', "%{$keyword}%"));
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('v.submitted_at')->orderByDesc('v.id')->forPage($page, $pageSize)
            ->get(['v.id', 'v.site_id', 'v.property_id', 'v.version', 'v.status', 'v.reject_reason',
                'v.submitted_at', 'v.reviewed_at', 'v.reviewed_by', 'v.review_remark',
                'p.store_name', 'p.content_approved_version', 'm.merchant_name'])
            ->map(static fn ($row) => (array) $row)->all();

        $statsQuery = Db::table('merchant_property_content_revision as v')
            ->join('merchant_store as p', 'p.id', '=', 'v.property_id')
            ->whereNull('p.deleted_at');
        if (! AdminContext::isSuper()) $statsQuery->where('v.site_id', AdminContext::siteId());
        $grouped = [];
        foreach ($statsQuery->selectRaw('v.status, COUNT(*) AS cnt')->groupBy('v.status')->get() as $row) {
            $grouped[(int) $row->status] = (int) $row->cnt;
        }
        $stats = [
            'total' => array_sum($grouped),
            'draft' => $grouped[0] ?? 0,
            'pending' => $grouped[1] ?? 0,
            'approved' => $grouped[2] ?? 0,
            'rejected' => $grouped[3] ?? 0,
        ];
        return compact('list', 'total', 'page', 'pageSize', 'stats');
    }

    public function reviewDetail(int $revisionId): array
    {
        $revision = Db::table('merchant_property_content_revision as v')
            ->join('merchant_store as p', 'p.id', '=', 'v.property_id')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'v.merchant_id')
            ->where('v.id', $revisionId)->whereNull('p.deleted_at')
            ->first(['v.*', 'p.store_name', 'm.merchant_name']);
        if (! $revision) throw new BusinessException(ErrorCode::NOT_FOUND, '物业资料版本不存在');
        $this->assertAdminSite((int) $revision->site_id);
        $item = $this->formatRevision((array) $revision);
        $effective = Db::table('merchant_store')->where('id', $revision->property_id)->first();
        return ['revision' => $item, 'effective' => $effective ? $this->formatProperty((array) $effective) : null];
    }

    public function audit(int $revisionId, int $auditStatus, string $remark): void
    {
        if (! in_array($auditStatus, [1, 2], true) || ($auditStatus === 2 && trim($remark) === '')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '审核结果或驳回原因不正确');
        }
        Db::transaction(function () use ($revisionId, $auditStatus, $remark): void {
            $revision = Db::table('merchant_property_content_revision')->where('id', $revisionId)->lockForUpdate()->first();
            if (! $revision) throw new BusinessException(ErrorCode::NOT_FOUND, '物业资料版本不存在');
            $this->assertAdminSite((int) $revision->site_id);
            if ((int) $revision->status !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核版本可审核');
            $property = Db::table('merchant_store')->where('id', $revision->property_id)->lockForUpdate()->first();
            if (! $property) throw new BusinessException(ErrorCode::NOT_FOUND, '物业不存在');
            $now = date('Y-m-d H:i:s');
            if ($auditStatus === 1) {
                $payload = $this->decode((string) $revision->payload_json);
                $approved = $payload + [
                    'content_status' => 2, 'content_approved_version' => (int) $revision->version,
                    'content_approved_at' => $now, 'content_reject_reason' => '',
                ];
                if ((int) $property->content_approved_version === 0) $approved['display_enabled'] = 1;
                Db::table('merchant_store')->where('id', $property->id)->update($approved);
            } elseif ((int) $property->content_approved_version === 0) {
                Db::table('merchant_store')->where('id', $property->id)->update([
                    'content_status' => 3, 'content_reject_reason' => mb_substr($remark, 0, 500),
                ]);
            }
            Db::table('merchant_property_content_revision')->where('id', $revisionId)->update([
                'status' => $auditStatus === 1 ? 2 : 3,
                'reject_reason' => $auditStatus === 2 ? mb_substr($remark, 0, 500) : '',
                'reviewed_by' => AdminContext::adminId(), 'reviewed_at' => $now,
                'review_remark' => mb_substr($remark, 0, 500),
            ]);
        });
    }

    public function publish(int $propertyId, bool $enabled): array
    {
        $property = $this->merchantProperty($propertyId);
        MerchantContext::assertPropertyAccess($propertyId, true);
        if ($enabled) {
            if ((int) $property['kyc_status'] !== 1 || (int) $property['content_status'] !== 2
                || (int) $property['content_approved_version'] === 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业 KYC 和资料审核通过后才能发布');
            }
            $roomCount = Db::table('hotel_room_type')->where('property_id', $propertyId)
                ->where('site_id', $property['site_id'])
                ->where('publish_status', 2)->where('approved_version', '>', 0)
                ->where('status', 1)->whereNull('deleted_at')->count();
            if ($roomCount === 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先发布至少一个在售房型');
        }
        $update = ['publish_status' => $enabled ? 1 : 2, 'published_at' => $enabled ? date('Y-m-d H:i:s') : null];
        if ($enabled) $update += ['status' => 1, 'operating_status' => 1];
        Db::table('merchant_store')->where('id', $propertyId)->update($update);
        return ['propertyId' => $propertyId, 'publishStatus' => $enabled ? 1 : 2];
    }

    private function merchantProperty(int $id, bool $lock = false): array
    {
        $query = Db::table('merchant_store')->where('id', $id)->where('site_id', MerchantContext::siteId())
            ->where('business_type', 'hotel')->whereNull('deleted_at');
        if ($lock) $query->lockForUpdate();
        $row = $query->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND, '酒店物业不存在');
        $property = (array) $row;
        MerchantContext::assertPropertyAccess((int) $property['id']);
        return $property;
    }

    private function collect(array $input, array $base): array
    {
        $map = ['propertyName' => 'store_name', 'location' => 'address', 'countryCode' => 'country_code',
            'cityKey' => 'city_key', 'description' => 'description', 'website' => 'website',
            'checkinTime' => 'checkin_time', 'checkoutTime' => 'checkout_time', 'emailAddress' => 'contact_email'];
        foreach ($map as $key => $column) {
            if (array_key_exists($key, $input)) $base[$column] = trim((string) $input[$key]);
        }
        $base['store_name'] = mb_substr((string) ($base['store_name'] ?? ''), 0, 100);
        $base['address'] = mb_substr((string) ($base['address'] ?? ''), 0, 255);
        $base['country_code'] = strtoupper((string) ($base['country_code'] ?? ''));
        if ($base['country_code'] !== '' && ! preg_match('/^[A-Z]{2}$/D', $base['country_code'])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '国家代码必须是两个英文字母');
        }
        $base['city_key'] = mb_substr((string) ($base['city_key'] ?? ''), 0, 80);
        $base['website'] = mb_substr((string) ($base['website'] ?? ''), 0, 255);
        $base['contact_email'] = mb_substr((string) ($base['contact_email'] ?? ''), 0, 100);
        if ($base['contact_email'] !== '' && filter_var($base['contact_email'], FILTER_VALIDATE_EMAIL) === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '邮箱格式不正确');
        }
        $base['checkin_time'] = mb_substr((string) ($base['checkin_time'] ?? ''), 0, 20);
        $base['checkout_time'] = mb_substr((string) ($base['checkout_time'] ?? ''), 0, 20);
        foreach (['phoneNumber1' => 'contact_phone', 'phoneNumber2' => 'contact_phone2'] as $key => $column) {
            if (array_key_exists($key, $input)) {
                $phone = mb_substr(trim((string) $input[$key]), 0, 50);
                $base[$column] = $phone === '' ? '' : CryptoHelper::encrypt($phone, $this->aesKey());
            }
        }
        foreach (['longitude' => [-180, 180], 'latitude' => [-90, 90]] as $key => [$min, $max]) {
            if (! array_key_exists($key, $input)) continue;
            $value = trim((string) $input[$key]);
            if ($value === '') {
                $base[$key] = null;
            } elseif (! is_numeric($value) || (float) $value < $min || (float) $value > $max) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, $key === 'longitude' ? '经度必须在 -180 到 180 之间' : '纬度必须在 -90 到 90 之间');
            } else {
                $base[$key] = round((float) $value, 7);
            }
        }
        if (array_key_exists('starLevel', $input)) $base['star_level'] = max(0, min(5, (int) $input['starLevel']));
        if (isset($input['facilities']) && is_array($input['facilities'])) {
            $base['facilities'] = $this->encode(array_values($input['facilities']));
        }
        if (isset($input['amenities']) && is_array($input['amenities'])) {
            $amenities = $this->normalizeAmenities($input['amenities']);
            $base['amenities'] = $this->encode($amenities);
            $base['facilities'] = $this->encode(array_values(array_unique(array_column(array_filter($amenities,
                static fn (array $item) => $item['enabled'] && $item['category'] !== 'tags'), 'name'))));
        }
        if (isset($input['imageGallery']) && is_array($input['imageGallery'])) {
            $gallery = $this->normalizeGallery($input['imageGallery']);
            $base['image_gallery'] = $this->encode($gallery);
            $base['images'] = $this->encode(array_column(array_filter($gallery, static fn (array $image) => $image['enabled']), 'url'));
        } elseif (isset($input['images']) && is_array($input['images'])) {
            $gallery = $this->normalizeGallery(array_map(static fn ($url) => ['url' => $url, 'enabled' => true], $input['images']));
            $base['image_gallery'] = $this->encode($gallery);
            $base['images'] = $this->encode(array_column($gallery, 'url'));
        }
        if (array_key_exists('longStay', $input)) {
            $base['long_stay'] = $this->encode($this->normalizeLongStay($input['longStay']));
        }
        if (array_key_exists('hotelPolicies', $input)) {
            $base['hotel_policies'] = $this->encode($this->normalizePolicies($input['hotelPolicies']));
        }
        if (array_key_exists('nearbyAttractions', $input)) {
            $base['nearby_attractions'] = $this->encode($this->normalizeNearby($input['nearbyAttractions']));
        }
        return array_intersect_key($base, array_flip(self::FIELDS));
    }

    private function formatProperty(array $property): array
    {
        foreach (self::JSON_FIELDS as $key) $property[$key] = $this->decode((string) ($property[$key] ?? ''));
        $property['amenities'] = $this->amenitiesWithLegacyFallback($property['amenities'], $property['facilities']);
        $property['image_gallery'] = $this->galleryWithLegacyFallback($property['image_gallery'], $property['images']);
        $property['long_stay'] = $this->normalizeLongStay($property['long_stay']);
        $property['hotel_policies'] = $this->normalizePolicies($property['hotel_policies']);
        $property['nearby_attractions'] = $this->normalizeNearby($property['nearby_attractions']);
        foreach (['contact_phone', 'contact_phone2'] as $key) $property[$key] = $this->decryptPhone((string) ($property[$key] ?? ''));
        unset($property['deleted_at']);
        return $property;
    }

    private function formatPayload(array $payload): array
    {
        foreach (self::JSON_FIELDS as $key) {
            if (isset($payload[$key]) && is_string($payload[$key])) $payload[$key] = $this->decode($payload[$key]);
        }
        $payload['images'] = is_array($payload['images'] ?? null) ? $payload['images'] : [];
        $payload['facilities'] = is_array($payload['facilities'] ?? null) ? $payload['facilities'] : [];
        $payload['amenities'] = $this->amenitiesWithLegacyFallback(
            is_array($payload['amenities'] ?? null) ? $payload['amenities'] : [], $payload['facilities']);
        $payload['image_gallery'] = $this->galleryWithLegacyFallback(
            is_array($payload['image_gallery'] ?? null) ? $payload['image_gallery'] : [], $payload['images']);
        $payload['long_stay'] = $this->normalizeLongStay($payload['long_stay'] ?? []);
        $payload['hotel_policies'] = $this->normalizePolicies($payload['hotel_policies'] ?? []);
        $payload['nearby_attractions'] = $this->normalizeNearby($payload['nearby_attractions'] ?? []);
        foreach (['contact_phone', 'contact_phone2'] as $key) $payload[$key] = $this->decryptPhone((string) ($payload[$key] ?? ''));
        return $payload;
    }

    private function formatRevision(array $revision): array
    {
        $revision['payload'] = $this->formatPayload($this->decode((string) $revision['payload_json']));
        unset($revision['payload_json']);
        return $revision;
    }

    private function assertAdminSite(int $siteId): void
    {
        if (! AdminContext::isSuper() && AdminContext::siteId() !== $siteId) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
    }

    private function encode(array $value): string
    {
        return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function decode(string $json): array
    {
        $value = json_decode($json, true);
        return is_array($value) ? $value : [];
    }

    /**
     * 长住促销与长住权益。status/bold 用布尔,与 amenities 的 enabled/highlighted 同口径。
     * 名称必填(空行直接丢弃),避免前端删空后落一堆无名行。
     */
    private function normalizeLongStay(mixed $value): array
    {
        $value = is_array($value) ? $value : [];
        return [
            'promotions' => $this->normalizeRows($value['promotions'] ?? [], self::LONG_STAY_LIMITS['promotions'],
                function (array $row, int $index): ?array {
                    $name = mb_substr(trim((string) ($row['name'] ?? '')), 0, 60);
                    if ($name === '') return null;
                    return [
                        'id' => $this->itemId($row['id'] ?? '', 'lsp', $index),
                        'name' => $name,
                        'discount' => max(0, min(100, (int) ($row['discount'] ?? 0))),
                        'status' => filter_var($row['status'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    ];
                }),
            'benefits' => $this->normalizeRows($value['benefits'] ?? [], self::LONG_STAY_LIMITS['benefits'],
                function (array $row, int $index): ?array {
                    $name = mb_substr(trim((string) ($row['name'] ?? '')), 0, 60);
                    if ($name === '') return null;
                    $status = filter_var($row['status'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    return [
                        'id' => $this->itemId($row['id'] ?? '', 'lsb', $index),
                        'name' => $name,
                        'status' => $status,
                        // 与 amenities 的 highlighted 同口径:停用的条目不可能同时是加粗项
                        'bold' => $status && filter_var($row['bold'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    ];
                }),
        ];
    }

    /** 酒店政策:预订条款 / 入住 / 退房 / 宠物 / 儿童加床 / 物业规则,结构固定,缺项补空。 */
    private function normalizePolicies(mixed $value): array
    {
        $value = is_array($value) ? $value : [];
        $booking = is_array($value['booking'] ?? null) ? $value['booking'] : [];
        $checkIn = is_array($value['checkIn'] ?? null) ? $value['checkIn'] : [];
        $checkOut = is_array($value['checkOut'] ?? null) ? $value['checkOut'] : [];
        $pet = is_array($value['pet'] ?? null) ? $value['pet'] : [];
        $documents = [];
        foreach (array_slice(array_values(is_array($checkIn['documents'] ?? null) ? $checkIn['documents'] : []), 0, 8) as $document) {
            $document = mb_substr(trim((string) $document), 0, 80);
            if ($document !== '') $documents[] = $document;
        }
        return [
            'booking' => [
                'cancellation' => $this->policyText($booking['cancellation'] ?? ''),
                'prepayment' => $this->policyText($booking['prepayment'] ?? ''),
                'taxesFees' => $this->policyText($booking['taxesFees'] ?? ''),
            ],
            'checkIn' => [
                'time' => mb_substr(trim((string) ($checkIn['time'] ?? '')), 0, 20),
                'description' => $this->policyText($checkIn['description'] ?? ''),
                'documents' => $documents,
            ],
            'checkOut' => [
                'time' => mb_substr(trim((string) ($checkOut['time'] ?? '')), 0, 20),
                'description' => $this->policyText($checkOut['description'] ?? ''),
            ],
            // status=0 表示该条宠物政策停用(编辑稿卡头就是一个开关);缺省视为启用,兼容旧数据
            'pet' => [
                'description' => $this->policyText($pet['description'] ?? ''),
                'status' => filter_var($pet['status'] ?? true, FILTER_VALIDATE_BOOLEAN),
            ],
            'children' => $this->normalizeRows($value['children'] ?? [], self::POLICY_LIMITS['children'],
                function (array $row, int $index): ?array {
                    $name = mb_substr(trim((string) ($row['name'] ?? '')), 0, 60);
                    if ($name === '') return null;
                    return [
                        'id' => $this->itemId($row['id'] ?? '', 'chd', $index),
                        'name' => $name,
                        'description' => $this->policyText($row['description'] ?? ''),
                        'amount' => mb_substr(trim((string) ($row['amount'] ?? '')), 0, 40),
                        // 该条政策金额用的币种(弹窗下拉所选);大写、限长,空值允许
                        'currency' => strtoupper(mb_substr(trim((string) ($row['currency'] ?? '')), 0, 8)),
                        'unit' => mb_substr(trim((string) ($row['unit'] ?? '')), 0, 20),
                        'status' => filter_var($row['status'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    ];
                }),
            'rules' => $this->normalizeRows($value['rules'] ?? [], self::POLICY_LIMITS['rules'],
                function (array $row, int $index): ?array {
                    $name = mb_substr(trim((string) ($row['name'] ?? '')), 0, 60);
                    if ($name === '') return null;
                    return [
                        'id' => $this->itemId($row['id'] ?? '', 'rule', $index),
                        'name' => $name,
                        'description' => $this->policyText($row['description'] ?? ''),
                        'icon' => mb_substr(trim((string) ($row['icon'] ?? '')), 0, 40) ?: 'sparkles',
                        'status' => filter_var($row['status'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    ];
                }),
        ];
    }

    /**
     * 附近景点:一张卡 = 一张图片 + 若干「地点」(Figma 696:4992:图片 + 若干个 36 圆形图标行,地点之间用竖虚线相连)。
     * 兼容第一版的扁平结构(景点字段直接挂在卡片上):视为只有一个地点。
     */
    private function normalizeNearby(mixed $value): array
    {
        $items = [];
        foreach (array_slice(array_values(is_array($value) ? $value : []), 0, self::NEARBY_LIMIT) as $index => $row) {
            if (! is_array($row)) continue;
            $image = mb_substr(trim((string) ($row['image'] ?? '')), 0, 1000);
            $rawStops = is_array($row['stops'] ?? null) ? $row['stops'] : [];
            if ($rawStops === [] && (isset($row['name']) || isset($row['distance']))) $rawStops = [$row];
            $stops = [];
            foreach (array_slice(array_values($rawStops), 0, self::NEARBY_STOP_LIMIT) as $stopIndex => $stop) {
                if (! is_array($stop)) continue;
                $name = mb_substr(trim((string) ($stop['name'] ?? '')), 0, 80);
                $distance = mb_substr(trim((string) ($stop['distance'] ?? '')), 0, 40);
                if ($name === '' && $distance === '') continue;
                $stops[] = [
                    'id' => $this->itemId($stop['id'] ?? '', 'stop', $stopIndex),
                    'icon' => mb_substr(trim((string) ($stop['icon'] ?? '')), 0, 40) ?: 'location',
                    'name' => $name,
                    'travelTime' => mb_substr(trim((string) ($stop['travelTime'] ?? '')), 0, 40),
                    'travelMode' => mb_substr(trim((string) ($stop['travelMode'] ?? '')), 0, 20) ?: 'drive',
                    'distance' => $distance,
                ];
            }
            if ($stops === [] && $image === '') continue;
            $items[] = [
                'id' => $this->itemId($row['id'] ?? '', 'nby', $index),
                'image' => $image,
                'status' => filter_var($row['status'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'stops' => $stops,
            ];
        }
        return $items;
    }

    /** @param callable(array,int):?array $mapper 返回 null 表示该行无效,直接丢弃 */
    private function normalizeRows(mixed $rows, int $limit, callable $mapper): array
    {
        $result = [];
        foreach (array_slice(array_values(is_array($rows) ? $rows : []), 0, $limit) as $index => $row) {
            if (! is_array($row)) continue;
            $item = $mapper($row, $index);
            if ($item !== null) $result[] = $item;
        }
        return $result;
    }

    private function policyText(mixed $value): string
    {
        return mb_substr(trim((string) $value), 0, self::POLICY_TEXT_LIMIT);
    }

    private function itemId(mixed $raw, string $prefix, int $index): string
    {
        $id = mb_substr(trim((string) $raw), 0, 40);
        return $id !== '' ? $id : $prefix . '-' . ($index + 1);
    }

    private function normalizeGallery(array $images): array
    {
        $result = [];
        $seen = [];
        foreach ($images as $image) {
            if (! is_array($image)) continue;
            $url = mb_substr(trim((string) ($image['url'] ?? '')), 0, 1000);
            if ($url === '' || isset($seen[$url])) continue;
            $seen[$url] = true;
            $result[] = ['url' => $url, 'enabled' => filter_var($image['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN)];
        }
        return $result;
    }

    private function normalizeAmenities(array $amenities, bool $enforceLimits = true): array
    {
        $result = [];
        $seenIds = [];
        $counts = [];
        foreach (array_slice($amenities, 0, 200) as $index => $amenity) {
            if (! is_array($amenity)) continue;
            $category = (string) ($amenity['category'] ?? '');
            if (! in_array($category, ['essential', 'reception', 'dining', 'tags'], true)) continue;
            $name = mb_substr(trim((string) ($amenity['name'] ?? '')), 0, 80);
            if ($name === '') continue;
            $id = mb_substr(trim((string) ($amenity['id'] ?? '')), 0, 64);
            if ($id === '' || isset($seenIds[$id])) $id = substr(hash('sha256', $category . '|' . $name . '|' . $index), 0, 20);
            $seenIds[$id] = true;
            $enabled = filter_var($amenity['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $highlighted = $enabled && filter_var($amenity['highlighted'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $counts[$category]['enabled'] = ($counts[$category]['enabled'] ?? 0) + ($enabled ? 1 : 0);
            $counts[$category]['highlighted'] = ($counts[$category]['highlighted'] ?? 0) + ($highlighted ? 1 : 0);
            if ($enforceLimits && ($counts[$category]['enabled'] > 5 || $counts[$category]['highlighted'] > 5)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '每类设施最多启用5项并标记5项亮点');
            }
            $result[] = [
                'id' => $id, 'category' => $category, 'name' => $name,
                'icon' => mb_substr(trim((string) ($amenity['icon'] ?? 'sparkles')), 0, 30) ?: 'sparkles',
                'description' => mb_substr(trim((string) ($amenity['description'] ?? '')), 0, 160),
                'enabled' => $enabled, 'highlighted' => $highlighted,
            ];
        }
        return $result;
    }

    private function amenitiesWithLegacyFallback(array $amenities, array $facilities): array
    {
        $normalized = $this->normalizeAmenities($amenities, false);
        if ($normalized !== []) return $normalized;
        return $this->normalizeAmenities(array_map(static fn ($name, $index) => [
            'id' => 'legacy-' . ($index + 1), 'category' => 'essential', 'name' => $name,
            'icon' => 'sparkles', 'description' => '', 'enabled' => true, 'highlighted' => false,
        ], $facilities, array_keys($facilities)), false);
    }

    private function galleryWithLegacyFallback(array $gallery, array $images): array
    {
        $normalized = $this->normalizeGallery($gallery);
        return $normalized !== [] ? $normalized
            : $this->normalizeGallery(array_map(static fn ($url) => ['url' => $url, 'enabled' => true], $images));
    }

    private function decryptPhone(string $ciphertext): string
    {
        if ($ciphertext === '') return '';
        try {
            return CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return '';
        }
    }

    private function aesKey(): string
    {
        $key = (string) config('mtrip.aes_key', '');
        if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置');
        return $key;
    }
}
