<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;

/** 房型正式投影与不可覆盖审核版本之间的唯一写入入口。 */
class RoomReviewService
{
    private const LIVE_FIELDS = [
        'room_name', 'room_code', 'description', 'bed_type', 'bed_count', 'area',
        'max_adults', 'max_children', 'max_guests', 'floor_name', 'room_view', 'smoking',
        'breakfast', 'meal_plan', 'cancellation_policy', 'currency', 'checkin_notes',
        'base_price', 'weekend_price', 'extra_bed_price', 'base_stock', 'launch_stock',
        'images', 'video_url', 'facilities', 'status', 'sort',
        'bedding', 'area_unit', 'image_gallery', 'panorama', 'vr_tour', 'floor_plan', 'refund_policy',
    ];

    public function save(array $property, int $roomId, array $payload, bool $submit, array $copySource = []): array
    {
        return Db::transaction(function () use ($property, $roomId, $payload, $submit, $copySource) {
            $now = date('Y-m-d H:i:s');
            $merchantId = (int) $property['merchant_id'];
            // Serialize room codes and new drafts within the property.
            Db::table('merchant_store')->where('id', $property['id'])->lockForUpdate()->first();
            $room = null;
            if ($roomId > 0) {
                $room = Db::table('hotel_room_type')->where('id', $roomId)->lockForUpdate()->first();
                if (! $room) {
                    throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
                }
                $room = (array) $room;
                if ((int) $room['property_id'] !== (int) $property['id'] || $room['deleted_at'] !== null) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            }
            if ($room && (int) ($room['approved_version'] ?? 0) > 0 && isset($payload['status']) && (int) $payload['status'] !== (int) $room['status'] && ! MerchantContext::hasPermission('mch:rooms:status')) throw new BusinessException(ErrorCode::FORBIDDEN);
            $payload = array_intersect_key($payload, array_flip(self::LIVE_FIELDS));
            $payload = (new RoomContentService())->normalize($payload, $property, $submit, $room ?? $copySource);
            $this->assertRoomCodeUnique((int) $property['id'], $roomId, (string) ($payload['room_code'] ?? ''));
            if ($roomId === 0) {
                $draft = $payload;
                $draft['site_id'] = (int) $property['site_id'];
                $draft['property_id'] = (int) $property['id'];
                $draft['status'] = 2;
                $draft['publish_status'] = 0;
                $draft['approved_version'] = 0;
                $roomId = (int) Db::table('hotel_room_type')->insertGetId($draft);
                $room = ['id' => $roomId, 'approved_version' => 0];
            }

            $latest = Db::table('hotel_room_type_revision')->where('room_id', $roomId)->orderByDesc('version')->lockForUpdate()->first();
            if ($latest && (int) $latest->status === 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型正在审核中,请等待审核结果');
            }

            $snapshot = $payload + ['_status_version' => (int) ($room['status_version'] ?? 0)];
            $revisionStatus = $submit ? 1 : 0;
            $submittedAt = $submit ? $now : null;
            if ($latest && (int) $latest->status === 0) {
                $revisionId = (int) $latest->id;
                $version = (int) $latest->version;
                Db::table('hotel_room_type_revision')->where('id', $revisionId)->update([
                    'payload_json' => $this->encode($snapshot),
                    'status' => $revisionStatus,
                    'reject_reason' => '',
                    'submitted_by' => $submit ? MerchantContext::adminId() : 0,
                    'submitted_at' => $submittedAt,
                    'reviewed_by' => 0,
                    'reviewed_at' => null,
                    'review_remark' => '',
                    'updated_at' => $now,
                ]);
            } else {
                $version = max((int) ($room['approved_version'] ?? 0), (int) ($latest->version ?? 0)) + 1;
                $revisionId = (int) Db::table('hotel_room_type_revision')->insertGetId([
                    'site_id' => (int) $property['site_id'],
                    'merchant_id' => $merchantId,
                    'property_id' => (int) $property['id'],
                    'room_id' => $roomId,
                    'version' => $version,
                    'action' => 'upsert',
                    'status' => $revisionStatus,
                    'payload_json' => $this->encode($snapshot),
                    'submitted_by' => $submit ? MerchantContext::adminId() : 0,
                    'submitted_at' => $submittedAt,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            if ((int) ($room['approved_version'] ?? 0) === 0) {
                $draft = $payload;
                $draft['status'] = 2;
                $draft['publish_status'] = $submit ? 1 : 0;
                $draft['submitted_at'] = $submittedAt;
                Db::table('hotel_room_type')->where('id', $roomId)->update($draft);
            }

            return ['id' => $roomId, 'revisionId' => $revisionId, 'version' => $version, 'reviewStatus' => $revisionStatus];
        });
    }

    public function copy(array $property, array $source): array
    {
        if ((int) $source['property_id'] !== (int) $property['id']) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        $payload = array_intersect_key($source, array_flip(self::LIVE_FIELDS));
        $payload['room_name'] = mb_substr((string) $payload['room_name'] . ' Copy', 0, 100);
        $payload['room_code'] = '';
        $payload['base_stock'] = 0;
        $payload['launch_stock'] = 0;
        $payload['status'] = 1;
        return $this->save($property, 0, $payload, false, $source);
    }

    public function remove(array $property, array $room): array
    {
        return Db::transaction(function () use ($property, $room) {
            $room = (array) Db::table('hotel_room_type')->where('id', $room['id'])->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $room) throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
            $this->assertNoActiveOrders($room);
            if ((int) $room['approved_version'] === 0) {
                Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->whereIn('status', [0, 1, 3])->update(['status' => 4]);
                Db::table('hotel_room_type')->where('id', $room['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
                return ['reviewRequired' => false];
            }
            $pending = Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->where('status', 1)->lockForUpdate()->exists();
            if ($pending) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型已有待审核变更');
            }
            $version = max((int) $room['approved_version'], (int) Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->max('version')) + 1;
            $id = (int) Db::table('hotel_room_type_revision')->insertGetId([
                'site_id' => (int) $property['site_id'], 'merchant_id' => (int) $property['merchant_id'],
                'property_id' => (int) $property['id'], 'room_id' => (int) $room['id'], 'version' => $version,
                'action' => 'delete', 'status' => 1, 'payload_json' => $this->encode(array_intersect_key($room, array_flip(self::LIVE_FIELDS))),
                'submitted_by' => MerchantContext::adminId(), 'submitted_at' => date('Y-m-d H:i:s'),
            ]);
            return ['reviewRequired' => true, 'revisionId' => $id];
        });
    }

    public function withdraw(int $revisionId): void
    {
        $initial = Db::table('hotel_room_type_revision')->where('id', $revisionId)->first();
        if (! $initial) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        MerchantContext::assertPropertyAccess((int) $initial->property_id, true);
        Db::transaction(function () use ($initial, $revisionId) {
            $room = Db::table('hotel_room_type')->where('id', $initial->room_id)->lockForUpdate()->first();
            $revision = Db::table('hotel_room_type_revision')->where('id', $revisionId)->lockForUpdate()->first();
            if (! $revision || (int) $revision->status !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核版本可撤回');
            Db::table('hotel_room_type_revision')->where('id', $revisionId)->update(['status' => 4]);
            if ($room && (int) $room->approved_version === 0) {
                Db::table('hotel_room_type')->where('id', $initial->room_id)->update(['publish_status' => 0, 'submitted_at' => null]);
            }
        });
    }

    public function audit(int $revisionId, int $auditStatus, string $remark): void
    {
        if (! in_array($auditStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
        }
        if ($auditStatus === 2 && $remark === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
        }

        $initial = Db::table('hotel_room_type_revision')->where('id', $revisionId)->first();
        if (! $initial) throw new BusinessException(ErrorCode::NOT_FOUND, '审核版本不存在');
        Db::transaction(function () use ($initial, $revisionId, $auditStatus, $remark) {
            Db::table('merchant_store')->where('id', $initial->property_id)->lockForUpdate()->first();
            $room = Db::table('hotel_room_type')->where('id', $initial->room_id)->whereNull('deleted_at')->lockForUpdate()->first();
            $revision = Db::table('hotel_room_type_revision')->where('id', $revisionId)->lockForUpdate()->first();
            if (! $revision) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '审核版本不存在');
            }
            $this->assertAdminSite((int) $revision->site_id);
            if ((int) $revision->status !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核版本可审核');
            }
            if (! $room) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
            }
            $now = date('Y-m-d H:i:s');
            if ($auditStatus === 1) {
                if ((string) $revision->action === 'delete') {
                    $this->assertNoActiveOrders((array) $room);
                    Db::table('hotel_room_type')->where('id', $revision->room_id)->update(['deleted_at' => $now]);
                } else {
                    $payload = $this->decode((string) $revision->payload_json);
                    $statusVersion = $payload['_status_version'] ?? -1;
                    $payload = array_intersect_key($payload, array_flip(self::LIVE_FIELDS));
                    if ((int) $room->approved_version > 0 && (int) $statusVersion !== (int) $room->status_version) unset($payload['status']);
                    $this->assertRoomCodeUnique((int) $room->property_id, (int) $room->id, (string) ($payload['room_code'] ?? ''));
                    $this->publishRefundPolicy((array) $room, $payload);
                    $payload['publish_status'] = 2;
                    $payload['approved_version'] = (int) $revision->version;
                    $payload['submitted_at'] = $revision->submitted_at;
                    Db::table('hotel_room_type')->where('id', $revision->room_id)->update($payload);
                }
            } elseif ((int) $room->approved_version === 0) {
                Db::table('hotel_room_type')->where('id', $revision->room_id)->update(['publish_status' => 3]);
            }
            Db::table('hotel_room_type_revision')->where('id', $revisionId)->update([
                'status' => $auditStatus === 1 ? 2 : 3,
                'reject_reason' => $auditStatus === 2 ? mb_substr($remark, 0, 500) : '',
                'reviewed_by' => AdminContext::adminId(), 'reviewed_at' => $now,
                'review_remark' => mb_substr($remark, 0, 500), 'updated_at' => $now,
            ]);
        });
    }

    public function decode(string $json): array
    {
        $value = json_decode($json, true);
        return is_array($value) ? $value : [];
    }

    private function assertNoActiveOrders(array $room): void
    {
        $pending = Db::table('order_main')->where('site_id', $room['site_id'])->where('property_id', $room['property_id'])
            ->where('order_type', 1)->whereNull('deleted_at')
            ->where(function ($q) use ($room) {
                $q->where('room_type_id', $room['id'])->orWhere(function ($legacy) use ($room) {
                    $legacy->where('room_type_id', 0)->where('sku_id', $room['id']);
                });
            })->where(function ($q) {
                $q->whereIn('booking_status', [1, 2, 3])->orWhere(function ($legacy) {
                    $legacy->where('booking_status', 0)->whereIn('order_status', [0, 1, 2, 5]);
                });
            })->exists();
        if ($pending) throw new BusinessException(ErrorCode::DATA_CONFLICT, '存在进行中订单，禁止删除房型');
    }

    private function publishRefundPolicy(array $room, array $payload): void
    {
        $policy = $payload['refund_policy'] ?? null;
        if (is_string($policy)) $policy = $this->decode($policy);
        if (! $policy) return;
        Db::table('goods_refund_rule')->where('site_id', $room['site_id'])->where('property_id', $room['property_id'])
            ->where('sku_type', 1)->where('sku_id', $room['id'])->whereNull('deleted_at')->update(['deleted_at' => date('Y-m-d H:i:s')]);
        Db::table('goods_refund_rule')->insert([
            'site_id' => $room['site_id'], 'property_id' => $room['property_id'], 'goods_id' => 0,
            'sku_type' => 1, 'sku_id' => $room['id'], 'rule_type' => $policy['ruleType'],
            'rules' => $this->encode($policy['rules'] ?? []), 'remark' => $policy['remark'] ?? '',
        ]);
    }

    private function assertRoomCodeUnique(int $propertyId, int $roomId, string $code): void
    {
        if ($code === '') return;
        $query = Db::table('hotel_room_type')->where('property_id', $propertyId)->where('room_code', $code)->whereNull('deleted_at');
        if ($roomId > 0) $query->where('id', '<>', $roomId);
        if ($query->exists()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '同一酒店内房型编码不能重复');
    }

    private function assertAdminSite(int $siteId): void
    {
        if (! AdminContext::isSuper() && AdminContext::siteId() !== $siteId) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }

    private function encode(array $value): string
    {
        return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
