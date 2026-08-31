<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AppAbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端营销:促销中心 Banner / 领券中心 / 我的优惠券 / 自动择优
 * PRD 模块 6.1:领取/管理/自动应用最优券
 */
class MarketingController extends AppAbstractController
{
    private const COUPON_FIELDS = [
        'c.id as coupon_id', 'c.coupon_name', 'c.coupon_type', 'c.discount_value',
        'c.min_amount', 'c.max_discount', 'c.goods_scope', 'c.goods_ids', 'c.remark',
    ];

    /** 促销中心活动列表(展示中):PRD 模块6.1 */
    public function campaigns(): array
    {
        $siteId = $this->requireSiteId();
        $now = date('Y-m-d H:i:s');
        $rows = Db::table('marketing_campaign')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where(static function ($q) use ($now) {
                $q->whereNull('start_time')->orWhere('start_time', '<=', $now);
            })
            ->where(static function ($q) use ($now) {
                $q->whereNull('end_time')->orWhere('end_time', '>=', $now);
            })
            ->orderBy('sort')->orderByDesc('id')
            ->get(['id', 'title', 'subtitle', 'banner', 'landing_url'])
            ->map(static fn ($r) => (array) $r)->all();
        return Result::success($rows);
    }

    /** 活动详情:含落地页 + 可领优惠券模板 */
    public function campaignDetail(): array
    {
        $siteId = $this->requireSiteId();
        $c = Db::table('marketing_campaign')
            ->where('id', $this->requireId())->where('site_id', $siteId)
            ->where('status', 1)->whereNull('deleted_at')->first();
        if (! $c) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '活动不存在或已下架');
        }
        $c = (array) $c;
        $couponIds = $c['coupon_ids'] ? (json_decode((string) $c['coupon_ids'], true) ?: []) : [];
        $c['coupon_ids'] = array_map('intval', is_array($couponIds) ? $couponIds : []);
        $coupons = [];
        if ($c['coupon_ids'] !== []) {
            $coupons = Db::table('marketing_coupon')
                ->whereIn('id', $c['coupon_ids'])->where('site_id', $siteId)
                ->where('status', 1)->whereNull('deleted_at')
                ->get(['id', 'coupon_name', 'coupon_type', 'discount_value', 'min_amount', 'max_discount', 'goods_scope'])
                ->map(static fn ($r) => (array) $r)->all();
        }
        $c['coupons'] = $coupons;
        unset($c['deleted_at']);
        return Result::success($c);
    }

    /** 促销中心 Banner:复用 marketing_banner 专题位(position=3),展示中 */
    public function promotionBanners(): array
    {
        $siteId = $this->requireSiteId();
        $now = date('Y-m-d H:i:s');
        $rows = Db::table('marketing_banner')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->where('position', 3)
            ->whereNull('deleted_at')
            ->where(static function ($q) use ($now) {
                $q->whereNull('start_time')->orWhere('start_time', '<=', $now);
            })
            ->where(static function ($q) use ($now) {
                $q->whereNull('end_time')->orWhere('end_time', '>=', $now);
            })
            ->orderBy('sort')->orderByDesc('id')
            ->get(['id', 'title', 'image', 'link_type', 'link_value'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::success($rows);
    }

    /** 领券中心:进行中且当前可领的券模板(附本人已领数/是否可领) */
    public function availableCoupons(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        [$page, $pageSize] = $this->pageParams();
        $now = date('Y-m-d H:i:s');

        $query = Db::table('marketing_coupon')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where(static function ($q) use ($now) {
                // 固定有效期未结束,或领后N天型(无固定结束)
                $q->where('valid_type', 2)
                    ->orWhere(static function ($q2) use ($now) {
                        $q2->where('valid_type', 1)->where(static function ($q3) use ($now) {
                            $q3->whereNull('valid_end')->orWhere('valid_end', '>=', $now);
                        });
                    });
            });
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'coupon_name', 'coupon_type', 'discount_value', 'min_amount',
                'max_discount', 'goods_scope', 'total_count', 'received_count', 'per_user_limit', 'valid_end', 'remark'])
            ->map(static fn ($row) => (array) $row)->all();

        // 一次查出本人对这批券的已领数,避免 N+1
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        $mine = $ids === [] ? [] : Db::table('marketing_coupon_receive')
            ->where('user_id', $userId)
            ->whereIn('coupon_id', $ids)
            ->whereNull('deleted_at')
            ->select('coupon_id', Db::raw('COUNT(*) as c'))
            ->groupBy('coupon_id')->pluck('c', 'coupon_id');
        foreach ($rows as &$row) {
            $received = (int) ($mine[$row['id']] ?? 0);
            $limitOk = (int) $row['per_user_limit'] === 0 || $received < (int) $row['per_user_limit'];
            $stockOk = (int) $row['total_count'] === 0 || (int) $row['received_count'] < (int) $row['total_count'];
            $row['canClaim'] = $limitOk && $stockOk;
            $row['myReceived'] = $received;
        }
        unset($row);
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 领取优惠券:校验进行中/未领满/未超个人限领,生成券码写领券记录 */
    public function claim(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $couponId = $this->requireId('couponId');

        $code = Db::transaction(function () use ($siteId, $userId, $couponId) {
            $c = Db::table('marketing_coupon')
                ->where('id', $couponId)->where('site_id', $siteId)->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if (! $c) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
            }
            $c = (array) $c;
            if ((int) $c['status'] !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '活动未进行或已结束');
            }
            $now = time();
            if ((int) $c['valid_type'] === 1 && $c['valid_end'] && $now > strtotime((string) $c['valid_end'])) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券已过期');
            }
            if ((int) $c['total_count'] > 0 && (int) $c['received_count'] >= (int) $c['total_count']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券已领完');
            }
            $mine = Db::table('marketing_coupon_receive')
                ->where('coupon_id', $couponId)->where('user_id', $userId)->whereNull('deleted_at')->count();
            if ((int) $c['per_user_limit'] > 0 && $mine >= (int) $c['per_user_limit']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '已达个人限领数量');
            }
            // 有效期:领后N天型从当前算,固定型取模板区间
            if ((int) $c['valid_type'] === 2) {
                $validStart = date('Y-m-d H:i:s', $now);
                $validEnd = date('Y-m-d H:i:s', $now + max(0, (int) $c['valid_days']) * 86400);
            } else {
                $validStart = $c['valid_start'];
                $validEnd = $c['valid_end'];
            }
            $code = 'CP' . date('ymd') . strtoupper(bin2hex(random_bytes(6)));
            Db::table('marketing_coupon_receive')->insert([
                'site_id' => $siteId,
                'coupon_id' => $couponId,
                'user_id' => $userId,
                'coupon_code' => $code,
                'status' => 0,
                'valid_start' => $validStart,
                'valid_end' => $validEnd,
            ]);
            Db::table('marketing_coupon')->where('id', $couponId)->increment('received_count');
            return $code;
        });
        return Result::success(['couponCode' => $code], '领取成功');
    }

    /** 我的优惠券:type=available 可用 / used 已用 / expired 已失效 */
    public function myCoupons(): array
    {
        $userId = UserContext::userId();
        [$page, $pageSize] = $this->pageParams();
        $type = $this->strInput('type', 'available');
        $now = date('Y-m-d H:i:s');

        $query = Db::table('marketing_coupon_receive as r')
            ->join('marketing_coupon as c', 'c.id', '=', 'r.coupon_id')
            ->where('r.user_id', $userId)
            ->whereNull('r.deleted_at');
        match ($type) {
            'used' => $query->where('r.status', 1),
            'expired' => $query->where(static function ($q) use ($now) {
                $q->whereIn('r.status', [2, 3])
                    ->orWhere(static function ($q2) use ($now) {
                        $q2->where('r.status', 0)->whereNotNull('r.valid_end')->where('r.valid_end', '<', $now);
                    });
            }),
            default => $query->where('r.status', 0)->where(static function ($q) use ($now) {
                $q->whereNull('r.valid_end')->orWhere('r.valid_end', '>=', $now);
            }),
        };
        $total = (clone $query)->count();
        $fields = array_merge(['r.id', 'r.coupon_code', 'r.status', 'r.valid_start', 'r.valid_end'], self::COUPON_FIELDS);
        $list = $query->orderByDesc('r.id')->forPage($page, $pageSize)
            ->get($fields)->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /**
     * 自动择优:给定 orderType/goodsId/amount,在本人可用券中返回抵扣最高的一张
     * 返回 { couponId(领券记录ID), couponName, discount } 或 null(无可用券)
     */
    public function bestMatch(): array
    {
        $userId = UserContext::userId();
        $orderType = $this->intInput('orderType', 1);
        $goodsId = $this->intInput('goodsId');
        $amount = round($this->floatInput('amount'), 2);
        $now = date('Y-m-d H:i:s');

        $receives = Db::table('marketing_coupon_receive as r')
            ->join('marketing_coupon as c', 'c.id', '=', 'r.coupon_id')
            ->where('r.user_id', $userId)
            ->where('r.status', 0)
            ->whereNull('r.deleted_at')
            ->where(static function ($q) use ($now) {
                $q->whereNull('r.valid_start')->orWhere('r.valid_start', '<=', $now);
            })
            ->where(static function ($q) use ($now) {
                $q->whereNull('r.valid_end')->orWhere('r.valid_end', '>=', $now);
            })
            ->get(array_merge(['r.id as receive_id'], self::COUPON_FIELDS));

        $best = null;
        foreach ($receives as $row) {
            $row = (array) $row;
            $discount = $this->couponDiscount($row, $orderType, $goodsId, $amount);
            if ($discount <= 0) {
                continue;
            }
            if ($best === null || $discount > $best['discount']) {
                $best = [
                    'couponId' => (int) $row['receive_id'],
                    'couponName' => (string) $row['coupon_name'],
                    'discount' => $discount,
                ];
            }
        }
        return Result::success($best);
    }

    /** 计算某券对给定订单的抵扣(不适用返回0);与 order-service resolveCoupon 规则一致 */
    private function couponDiscount(array $coupon, int $orderType, int $goodsId, float $base): float
    {
        $scope = (int) $coupon['goods_scope'];
        if (($scope === 1 && $orderType !== 1) || ($scope === 2 && $orderType !== 2)) {
            return 0.0;
        }
        if ($scope === 3) {
            $ids = is_string($coupon['goods_ids'] ?? null) ? (json_decode((string) $coupon['goods_ids'], true) ?: []) : (array) ($coupon['goods_ids'] ?? []);
            if (! in_array($goodsId, array_map('intval', $ids), true)) {
                return 0.0;
            }
        }
        if ((float) $coupon['min_amount'] > 0 && $base < (float) $coupon['min_amount']) {
            return 0.0;
        }
        $type = (int) $coupon['coupon_type'];
        $val = (float) $coupon['discount_value'];
        $maxD = (float) $coupon['max_discount'];
        if ($type === 2) {
            $discount = round($base * (1 - $val / 10), 2);
            if ($maxD > 0 && $discount > $maxD) {
                $discount = $maxD;
            }
        } else {
            $discount = $val;
        }
        return max(0.0, min(round($discount, 2), $base));
    }
}
