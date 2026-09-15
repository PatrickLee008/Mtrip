<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;

/** Property content drafts and the approved live projection. */
class PropertyProfileService
{
    private const FIELDS = [
        'store_name', 'address', 'country_code', 'city_key', 'description', 'star_level',
        'facilities', 'images', 'website', 'checkin_time', 'checkout_time',
    ];

    public function detail(int $propertyId): array
    {
        $property = $this->merchantProperty($propertyId);
        $latest = Db::table('merchant_property_content_revision')->where('property_id', $propertyId)
            ->orderByDesc('version')->first();
        $live = $this->formatProperty($property);
        $live['live_room_count'] = Db::table('hotel_room_type')->where('property_id', $propertyId)
            ->where('site_id', $property['site_id'])->where('status', 1)->where('publish_status', 2)
            ->where('approved_version', '>', 0)->whereNull('deleted_at')->count();
        $editable = $latest && in_array((int) $latest->status, [0, 3], true)
            ? $this->decode((string) $latest->payload_json) : array_intersect_key($live, array_flip(self::FIELDS));
        return [
            'property' => $live,
            'editable' => $this->formatPayload($editable),
            'latestRevision' => $latest ? $this->formatRevision((array) $latest) : null,
        ];
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
                'v.submitted_at', 'v.reviewed_at', 'p.store_name', 'p.content_approved_version', 'm.merchant_name'])
            ->map(static fn ($row) => (array) $row)->all();
        return compact('list', 'total', 'page', 'pageSize');
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
            'checkinTime' => 'checkin_time', 'checkoutTime' => 'checkout_time'];
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
        $base['checkin_time'] = mb_substr((string) ($base['checkin_time'] ?? ''), 0, 20);
        $base['checkout_time'] = mb_substr((string) ($base['checkout_time'] ?? ''), 0, 20);
        if (array_key_exists('starLevel', $input)) $base['star_level'] = max(0, min(5, (int) $input['starLevel']));
        foreach (['images', 'facilities'] as $key) {
            if (isset($input[$key]) && is_array($input[$key])) $base[$key] = $this->encode(array_values($input[$key]));
        }
        return array_intersect_key($base, array_flip(self::FIELDS));
    }

    private function formatProperty(array $property): array
    {
        foreach (['images', 'facilities'] as $key) $property[$key] = $this->decode((string) ($property[$key] ?? ''));
        unset($property['deleted_at']);
        return $property;
    }

    private function formatPayload(array $payload): array
    {
        foreach (['images', 'facilities'] as $key) {
            if (isset($payload[$key]) && is_string($payload[$key])) $payload[$key] = $this->decode($payload[$key]);
        }
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
}
