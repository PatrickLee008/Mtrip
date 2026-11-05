<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Immutable claim-time terms and append-only promotion history (Merchant M8 v1.0.12). */
final class CouponVersion
{
    private const RULES = [
        'coupon_name', 'coupon_type', 'promotion_kind', 'discount_value', 'min_amount', 'max_discount',
        'goods_scope', 'goods_ids', 'property_ids', 'sku_ids', 'room_type_ids', 'stackable',
        'remark', 'description', 'min_nights', 'max_nights', 'book_advance_days', 'min_room_count',
        'min_hotel_count', 'stay_start', 'stay_end', 'funding_source', 'funding_rules', 'per_user_limit', 'merchant_policy',
    ];

    /** Caller must hold the template row lock. Legacy terms are frozen before any mutation. */
    public static function ensure(array $coupon): int
    {
        $id = (int) ($coupon['current_version_id'] ?? 0);
        if ($id === 0) {
            $id = self::record($coupon, 'legacy_baseline', 'system', 0);
            Db::table('marketing_coupon_receive')->where('coupon_id', $coupon['id'])
                ->where('coupon_version_id', 0)->update(['coupon_version_id' => $id]);
        }
        return $id;
    }

    public static function record(array $coupon, string $action, string $actorType, int $actorId): int
    {
        unset($coupon['current_version_id']);
        $id = (int) Db::table('marketing_coupon_version')->insertGetId([
            'site_id' => $coupon['site_id'], 'coupon_id' => $coupon['id'], 'action' => $action,
            'actor_type' => $actorType, 'actor_id' => $actorId,
            'rules_snapshot' => json_encode($coupon, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ]);
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['current_version_id' => $id]);
        return $id;
    }

    public static function change(int $id, string $action, string $actorType, int $actorId, \Closure $change): void
    {
        Db::transaction(static function () use ($id, $action, $actorType, $actorId, $change) {
            $row = Db::table('marketing_coupon')->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, 'promotion not found');
            }
            self::ensure((array) $row);
            $change((array) $row);
            self::record((array) Db::table('marketing_coupon')->find($id), $action, $actorType, $actorId);
        });
    }

    /** Apply only entitlement rules; receipt dates/status and identifiers remain authoritative. */
    public static function overlay(array $row, mixed $snapshot): array
    {
        $rules = is_string($snapshot) ? json_decode($snapshot, true) : $snapshot;
        return is_array($rules) ? array_replace($row, array_intersect_key($rules, array_flip(self::RULES))) : $row;
    }

    public static function forReceive(array $coupon, array $receive): array
    {
        if (! empty($receive['rules_snapshot'])) return self::overlay($coupon, $receive['rules_snapshot']);
        $id = (int) ($receive['coupon_version_id'] ?? 0);
        if ($id === 0) {
            return $coupon;
        }
        $snapshot = Db::table('marketing_coupon_version')->where('id', $id)
            ->where('coupon_id', $coupon['id'])->value('rules_snapshot');
        if ($snapshot === null) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'coupon entitlement version unavailable');
        }
        return self::overlay($coupon, $snapshot);
    }
}
