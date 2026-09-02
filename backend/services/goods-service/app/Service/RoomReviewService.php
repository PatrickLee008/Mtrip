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
    ];

    public function save(array $goods, int $roomId, array $payload, bool $submit): array
    {
        return Db::transaction(function () use ($goods, $roomId, $payload, $submit) {
            $now = date('Y-m-d H:i:s');
            $merchantId = (int) $goods['merchant_id'];
            $payload = $this->normalizePayload($payload);
            if ((string) ($payload['room_name'] ?? '') === '' || (string) ($payload['bed_type'] ?? '') === '' || (string) ($payload['area'] ?? '') === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '房型名称、床型和面积不能为空');
            }
            if ((int) ($payload['launch_stock'] ?? 0) > (int) ($payload['base_stock'] ?? 0)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '首发可售库存不能超过实体房间总数');
            }
            if ($submit && $this->decode((string) ($payload['images'] ?? '[]')) === []) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '提交审核前至少上传一张房型图片');
            }
            $this->assertRoomCodeUnique((int) $goods['id'], $roomId, (string) $payload['room_code']);

            $room = null;
            if ($roomId > 0) {
                $room = Db::table('hotel_room_type')->where('id', $roomId)->lockForUpdate()->first();
                if (! $room) {
                    throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
                }
                $room = (array) $room;
            } else {
                $draft = $payload;
                $draft['site_id'] = (int) $goods['site_id'];
                $draft['goods_id'] = (int) $goods['id'];
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

            $revisionStatus = $submit ? 1 : 0;
            $submittedAt = $submit ? $now : null;
            if ($latest && (int) $latest->status === 0) {
                $revisionId = (int) $latest->id;
                $version = (int) $latest->version;
                Db::table('hotel_room_type_revision')->where('id', $revisionId)->update([
                    'payload_json' => $this->encode($payload),
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
                    'site_id' => (int) $goods['site_id'],
                    'merchant_id' => $merchantId,
                    'goods_id' => (int) $goods['id'],
                    'room_id' => $roomId,
                    'version' => $version,
                    'action' => 'upsert',
                    'status' => $revisionStatus,
                    'payload_json' => $this->encode($payload),
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

    public function copy(array $goods, array $source): array
    {
        $payload = array_intersect_key($source, array_flip(self::LIVE_FIELDS));
        $payload['room_name'] = mb_substr((string) $payload['room_name'] . ' Copy', 0, 100);
        $payload['room_code'] = '';
        $payload['base_stock'] = 0;
        $payload['launch_stock'] = 0;
        $payload['status'] = 1;
        return $this->save($goods, 0, $payload, false);
    }

    public function remove(array $goods, array $room): array
    {
        if ((int) ($room['approved_version'] ?? 0) === 0) {
            Db::transaction(function () use ($room) {
                Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->whereIn('status', [0, 1, 3])->update(['status' => 4]);
                Db::table('hotel_room_type')->where('id', $room['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
            });
            return ['reviewRequired' => false];
        }

        return Db::transaction(function () use ($goods, $room) {
            $pending = Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->where('status', 1)->lockForUpdate()->exists();
            if ($pending) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '房型已有待审核变更');
            }
            $version = max((int) $room['approved_version'], (int) Db::table('hotel_room_type_revision')->where('room_id', $room['id'])->max('version')) + 1;
            $id = (int) Db::table('hotel_room_type_revision')->insertGetId([
                'site_id' => (int) $goods['site_id'], 'merchant_id' => (int) $goods['merchant_id'],
                'goods_id' => (int) $goods['id'], 'room_id' => (int) $room['id'], 'version' => $version,
                'action' => 'delete', 'status' => 1, 'payload_json' => $this->encode(array_intersect_key($room, array_flip(self::LIVE_FIELDS))),
                'submitted_by' => MerchantContext::adminId(), 'submitted_at' => date('Y-m-d H:i:s'),
            ]);
            return ['reviewRequired' => true, 'revisionId' => $id];
        });
    }

    public function withdraw(int $revisionId, array $merchantIds): void
    {
        $revision = Db::table('hotel_room_type_revision')->where('id', $revisionId)->first();
        if (! $revision || ! in_array((int) $revision->merchant_id, $merchantIds, true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        if ((int) $revision->status !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核版本可撤回');
        }
        Db::table('hotel_room_type_revision')->where('id', $revisionId)->update(['status' => 4]);
        $room = Db::table('hotel_room_type')->where('id', $revision->room_id)->first();
        if ($room && (int) $room->approved_version === 0) {
            Db::table('hotel_room_type')->where('id', $revision->room_id)->update(['publish_status' => 0, 'submitted_at' => null]);
        }
    }

    public function audit(int $revisionId, int $auditStatus, string $remark): void
    {
        if (! in_array($auditStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
        }
        if ($auditStatus === 2 && $remark === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
        }

        Db::transaction(function () use ($revisionId, $auditStatus, $remark) {
            $revision = Db::table('hotel_room_type_revision')->where('id', $revisionId)->lockForUpdate()->first();
            if (! $revision) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '审核版本不存在');
            }
            $this->assertAdminSite((int) $revision->site_id);
            if ((int) $revision->status !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核版本可审核');
            }
            $room = Db::table('hotel_room_type')->where('id', $revision->room_id)->lockForUpdate()->first();
            if (! $room) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在');
            }
            $now = date('Y-m-d H:i:s');
            if ($auditStatus === 1) {
                if ((string) $revision->action === 'delete') {
                    Db::table('hotel_room_type')->where('id', $revision->room_id)->update(['deleted_at' => $now]);
                } else {
                    $payload = $this->decode((string) $revision->payload_json);
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

    private function normalizePayload(array $payload): array
    {
        $data = array_intersect_key($payload, array_flip(self::LIVE_FIELDS));
        $data['currency'] = in_array(strtoupper((string) ($data['currency'] ?? 'THB')), ['THB', 'USD', 'SGD', 'EUR'], true)
            ? strtoupper((string) ($data['currency'] ?? 'THB')) : 'THB';
        foreach (['images', 'facilities'] as $key) {
            $value = $data[$key] ?? [];
            $data[$key] = is_string($value) ? $value : $this->encode(array_values((array) $value));
        }
        return $data;
    }

    private function assertRoomCodeUnique(int $goodsId, int $roomId, string $code): void
    {
        if ($code === '') return;
        $query = Db::table('hotel_room_type')->where('goods_id', $goodsId)->where('room_code', $code)->whereNull('deleted_at');
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
