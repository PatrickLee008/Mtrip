<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/** Narrow new campaign claims to merchants whose platform offer remains accepted. */
final class CampaignCouponEligibility
{
    public static function apply(array $coupon, bool $lock = false): ?array
    {
        $campaigns = Db::table('marketing_campaign')
            ->whereRaw('JSON_CONTAINS(COALESCE(coupon_ids, JSON_ARRAY()), ?)', [json_encode((int) $coupon['id'])])->get();
        if ($campaigns->isEmpty()) return $coupon;
        $now = gmdate('Y-m-d H:i:s');
        $active = $campaigns->filter(static fn ($c) => $c->deleted_at === null && (int) $c->status === 1
            && (! $c->start_time || $c->start_time <= $now) && (! $c->end_time || $c->end_time > $now))->pluck('id')->all();
        $query = Db::table('marketing_campaign_participant')->whereIn('campaign_id', $active)->whereNull('deleted_at')->orderBy('id');
        $participants = ($lock ? $query->lockForUpdate() : $query)->get();
        $merchants = $participants->filter(static fn ($p) => (int) $p->status === 1)->pluck('merchant_id')->all();
        if ($merchants === []) return null;
        $properties = Db::table('merchant_store')->whereIn('merchant_id', $merchants)->whereNull('deleted_at')
            ->where('business_type', 'hotel')->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $original = $coupon['property_ids'] ?? null;
        $original = is_string($original) ? (json_decode($original, true) ?: []) : (array) $original;
        if ((int) ($coupon['goods_scope'] ?? 0) === 3) $properties = array_values(array_intersect($properties, $original));
        if ($properties === [] || (int) ($coupon['goods_scope'] ?? 0) === 2) return null;
        $coupon['goods_scope'] = 3;
        $coupon['property_ids'] = json_encode($properties);
        return $coupon;
    }
}
