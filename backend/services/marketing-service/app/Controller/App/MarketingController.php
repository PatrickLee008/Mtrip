<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AppAbstractController;
use App\Service\CouponView;

use Hyperf\Di\Annotation\Inject;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端营销:促销中心 Banner / 活动 / 领券中心 / 我的优惠券 / 券详情 / 促销码兑换 / 自动择优
 * PRD 模块 6.1;2026-09 计划 C-M6(后端)+ C-M6.1(App)
 *
 * 全部券字段统一由 CouponView 产出 —— 领券中心、活动详情、券详情、我的券、结账择优
 * 共用同一套口径(见 App\Service\CouponView 头注释)。
 */
class MarketingController extends AppAbstractController
{
    #[Inject]
    protected CouponView $couponView;

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
            ->get(['id', 'title', 'subtitle', 'banner', 'landing_url', 'start_time', 'end_time'])
            ->map(static fn ($r) => (array) $r)->all();
        return Result::success($rows);
    }

    /** 活动详情:含落地页 + 可领优惠券(统一券口径,带本人已领数与可领判定) */
    public function campaignDetail(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $c = Db::table('marketing_campaign')
            ->where('id', $this->requireId())->where('site_id', $siteId)
            ->where('status', 1)->whereNull('deleted_at')->first();
        if (! $c) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '活动不存在或已下架');
        }
        $c = (array) $c;
        $couponIds = $c['coupon_ids'] ? (json_decode((string) $c['coupon_ids'], true) ?: []) : [];
        $c['coupon_ids'] = array_map('intval', is_array($couponIds) ? $couponIds : []);
        $c['coupons'] = [];
        if ($c['coupon_ids'] !== []) {
            $rows = Db::table('marketing_coupon')
                ->whereIn('id', $c['coupon_ids'])->where('site_id', $siteId)
                ->whereNull('deleted_at')
                ->get(CouponView::TEMPLATE_COLUMNS)
                ->map(static fn ($r) => (array) $r)->all();
            $c['coupons'] = $this->templateViews($rows, $userId);
        }
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

    /** 领券中心:进行中的券模板(附本人已领数 / 可领判定 / 不可领原因) */
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
            ->get(CouponView::TEMPLATE_COLUMNS)
            ->map(static fn ($row) => (array) $row)->all();

        return Result::page($this->templateViews($rows, $userId), $total, $page, $pageSize);
    }

    /**
     * 券详情(统一口径):传 receiveId = 我的券(带券码/状态),传 couponId = 券模板(带可领判定)
     */
    public function couponDetail(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $receiveId = $this->intInput('receiveId');

        if ($receiveId > 0) {
            $row = Db::table('marketing_coupon_receive as r')
                ->join('marketing_coupon as c', 'c.id', '=', 'r.coupon_id')
                ->where('r.id', $receiveId)->where('r.user_id', $userId)
                ->whereNull('r.deleted_at')
                ->first(CouponView::RECEIVE_COLUMNS);
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
            }
            $view = $this->couponView->receive((array) $row);
            return Result::success($this->couponView->attachApplicableOne($view));
        }

        $couponId = $this->requireId('couponId');
        $row = Db::table('marketing_coupon')
            ->where('id', $couponId)->where('site_id', $siteId)->whereNull('deleted_at')
            ->first(CouponView::TEMPLATE_COLUMNS);
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
        }
        $mine = Db::table('marketing_coupon_receive')
            ->where('coupon_id', $couponId)->where('user_id', $userId)->whereNull('deleted_at')->count();
        $views = $this->templateViews([(array) $row], $userId, [$couponId => $mine]);
        return Result::success($views[0]);
    }

    /** 领取优惠券:校验进行中/未领满/未超个人限领,生成券码写领券记录 */
    public function claim(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $couponId = $this->requireId('couponId');

        $issued = Db::transaction(function () use ($siteId, $userId, $couponId) {
            $c = Db::table('marketing_coupon')
                ->where('id', $couponId)->where('site_id', $siteId)->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if (! $c) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
            }
            $c = (array) $c;
            $mine = Db::table('marketing_coupon_receive')
                ->where('coupon_id', $couponId)->where('user_id', $userId)->whereNull('deleted_at')->count();
            $blocker = $this->assertClaimable($c, (int) $mine);
            if ($blocker !== null) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, $blocker);
            }
            return $this->issueCoupon($siteId, $userId, $c);
        });
        return Result::success($issued, '领取成功');
    }

    /**
     * 促销码兑换(C-M6):校验站点、用户、活动状态、有效期、总量、每人限兑与重复兑换,
     * 成功后按促销码绑定的券模板写入领券记录。
     *
     * 错误码按「不存在 / 过期 / 领完 / 重复 / 资格不符」分开返回,App 据此给不同文案。
     */
    public function redeemPromoCode(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        if ($userId <= 0) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        $code = strtoupper($this->strInput('code'));
        if ($code === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请输入促销码');
        }

        $result = Db::transaction(function () use ($siteId, $userId, $code) {
            $promo = Db::table('marketing_promo_code')
                ->whereRaw('UPPER(`code`) = ?', [$code])
                ->whereNull('deleted_at')
                ->lockForUpdate()->first();
            // 站点不符与不存在返回同一个码,避免暴露其他站点的促销码
            if (! $promo || ((int) $promo->site_id !== 0 && (int) $promo->site_id !== $siteId)) {
                throw new BusinessException(ErrorCode::PROMO_CODE_NOT_FOUND);
            }
            $promo = (array) $promo;

            $this->assertPromoUsable($promo);

            $couponId = (int) $promo['coupon_id'];
            if ($couponId <= 0) {
                // 促销码未绑定券模板(后台只填了 discount_type/value 的旧数据):C端无券可发
                throw new BusinessException(ErrorCode::PROMO_CODE_INELIGIBLE, '该促销码暂不支持在 App 兑换');
            }

            // 每人限兑:促销码天然「一人一次」,后台未配置(<=0)时按 1 处理
            $perUser = (int) $promo['per_user_limit'];
            $perUser = $perUser > 0 ? $perUser : 1;
            $redeemed = Db::table('marketing_promo_code_redeem')
                ->where('promo_code_id', $promo['id'])->where('user_id', $userId)->count();
            if ($redeemed >= $perUser) {
                throw new BusinessException(ErrorCode::PROMO_CODE_DUPLICATED);
            }

            $c = Db::table('marketing_coupon')
                ->where('id', $couponId)->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if (! $c) {
                throw new BusinessException(ErrorCode::PROMO_CODE_INELIGIBLE, '促销码关联的优惠券已不存在');
            }
            $c = (array) $c;
            if ((int) $c['site_id'] !== 0 && (int) $c['site_id'] !== $siteId) {
                throw new BusinessException(ErrorCode::PROMO_CODE_INELIGIBLE, '该促销码不适用于当前站点');
            }
            $mine = Db::table('marketing_coupon_receive')
                ->where('coupon_id', $couponId)->where('user_id', $userId)->whereNull('deleted_at')->count();
            $this->assertCouponIssuable($c, (int) $mine);

            $issued = $this->issueCoupon($siteId, $userId, $c);
            Db::table('marketing_promo_code_redeem')->insert([
                'site_id' => $siteId,
                'promo_code_id' => $promo['id'],
                'code' => $promo['code'],
                'user_id' => $userId,
                'coupon_id' => $couponId,
                'receive_id' => $issued['receiveId'],
            ]);
            Db::table('marketing_promo_code')->where('id', $promo['id'])->increment('usage_count');
            $issued['couponName'] = (string) $c['coupon_name'];
            return $issued;
        });
        return Result::success($result, '兑换成功');
    }

    /** 我的优惠券:type=available 可用 / used 已用 / expired 已失效(统一券口径) */
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
        $rows = $query->orderByDesc('r.id')->forPage($page, $pageSize)
            ->get(CouponView::RECEIVE_COLUMNS)->map(static fn ($row) => (array) $row)->all();

        $views = array_map(fn (array $row) => $this->couponView->receive($row), $rows);
        $this->couponView->attachApplicable($views);
        return Result::page($views, $total, $page, $pageSize);
    }

    /**
     * 结账选券(C-M6):给定下单上下文,返回本人**全部未使用券**的
     * 「可用 / 不可用 + 本单实际抵扣额 + 不可用原因」,外加抵扣最高的一张 best。
     *
     * 与 bestMatch 的区别:bestMatch 只回一张,用于「进入结账自动应用」;
     * 这里回整张列表,用于「打开券列表手动更换」—— App 要能解释每一张为什么不能选,
     * 且**抵扣额必须由服务端算**(与 order-service `PricingService::resolveCoupon` 同一公式),
     * 否则复核页显示的优惠与实际扣款会对不上。
     *
     * 已使用/已作废的券不返回(结账场景无意义);过期与未生效的会返回并带上原因。
     */
    public function couponMatchList(): array
    {
        $userId = UserContext::userId();
        $ctx = [
            'orderType' => $this->intInput('orderType', 1),
            'goodsId' => $this->intInput('goodsId'),
            'skuId' => $this->intInput('skuId'),
            'amount' => round($this->floatInput('amount'), 2),
        ];

        $rows = Db::table('marketing_coupon_receive as r')
            ->join('marketing_coupon as c', 'c.id', '=', 'r.coupon_id')
            ->where('r.user_id', $userId)
            ->where('r.status', 0)
            ->whereNull('r.deleted_at')
            ->orderByDesc('r.id')
            ->limit(100)
            ->get(CouponView::RECEIVE_COLUMNS);

        $views = [];
        foreach ($rows as $row) {
            $views[] = $this->couponView->receive((array) $row, $ctx);
        }
        $this->couponView->attachApplicable($views);

        // 可用的排前面并按抵扣额从大到小;不可用的保持领取时间倒序
        usort($views, static function (array $a, array $b) {
            $ua = $a['unusableReason'] === null ? 0 : 1;
            $ub = $b['unusableReason'] === null ? 0 : 1;
            if ($ua !== $ub) {
                return $ua <=> $ub;
            }
            return $b['discount'] <=> $a['discount'];
        });

        $best = null;
        foreach ($views as $view) {
            if ($view['unusableReason'] === null && $view['discount'] > 0) {
                $best = [
                    'couponId' => $view['receive_id'],
                    'couponName' => $view['coupon_name'],
                    'discount' => $view['discount'],
                ];
                break;
            }
        }
        return Result::success(['list' => $views, 'best' => $best]);
    }

    /**
     * 自动择优:给定 orderType/goodsId/skuId/amount,在本人可用券中返回抵扣最高的一张
     * 返回 { couponId(领券记录ID), couponName, discount } 或 null(无可用券)
     */
    public function bestMatch(): array
    {
        $userId = UserContext::userId();
        $ctx = [
            'orderType' => $this->intInput('orderType', 1),
            'goodsId' => $this->intInput('goodsId'),
            'skuId' => $this->intInput('skuId'),
            'amount' => round($this->floatInput('amount'), 2),
        ];
        $now = date('Y-m-d H:i:s');

        $rows = Db::table('marketing_coupon_receive as r')
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
            ->get(CouponView::RECEIVE_COLUMNS);

        $best = null;
        foreach ($rows as $row) {
            $view = $this->couponView->receive((array) $row, $ctx);
            if ($view['unusableReason'] !== null || $view['discount'] <= 0) {
                continue;
            }
            if ($best === null || $view['discount'] > $best['discount']) {
                $best = [
                    'couponId' => $view['receive_id'],
                    'couponName' => $view['coupon_name'],
                    'discount' => $view['discount'],
                ];
            }
        }
        return Result::success($best);
    }

    /**
     * 批量把券模板行转成统一视图(补本人已领数,避免 N+1)
     *
     * @param array<int, array>     $rows
     * @param array<int, int>|null  $received 已知的「券模板ID => 本人已领数」;为 null 时自行查询
     */
    private function templateViews(array $rows, int $userId, ?array $received = null): array
    {
        if ($rows === []) {
            return [];
        }
        if ($received === null) {
            $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
            $received = Db::table('marketing_coupon_receive')
                ->where('user_id', $userId)
                ->whereIn('coupon_id', $ids)
                ->whereNull('deleted_at')
                ->select('coupon_id', Db::raw('COUNT(*) as c'))
                ->groupBy('coupon_id')->pluck('c', 'coupon_id')->all();
        }
        $views = array_map(
            fn (array $row) => $this->couponView->template($row, (int) ($received[$row['id']] ?? 0)),
            $rows
        );
        $this->couponView->attachApplicable($views);
        return $views;
    }

    /** 生成券码并写领券记录 + 累加已领数;返回 { receiveId, couponCode, validStart, validEnd } */
    private function issueCoupon(int $siteId, int $userId, array $c): array
    {
        $now = time();
        // 有效期:领后N天型从当前算,固定型取模板区间
        if ((int) $c['valid_type'] === 2) {
            $validStart = date('Y-m-d H:i:s', $now);
            $validEnd = date('Y-m-d H:i:s', $now + max(0, (int) $c['valid_days']) * 86400);
        } else {
            $validStart = $c['valid_start'];
            $validEnd = $c['valid_end'];
        }
        $code = 'CP' . date('ymd') . strtoupper(bin2hex(random_bytes(6)));
        $receiveId = Db::table('marketing_coupon_receive')->insertGetId([
            'site_id' => $siteId,
            'coupon_id' => (int) $c['id'],
            'user_id' => $userId,
            'coupon_code' => $code,
            'status' => 0,
            'valid_start' => $validStart,
            'valid_end' => $validEnd,
        ]);
        Db::table('marketing_coupon')->where('id', $c['id'])->increment('received_count');
        return [
            'receiveId' => (int) $receiveId,
            'couponCode' => $code,
            'validStart' => $validStart,
            'validEnd' => $validEnd,
        ];
    }

    /** 领券侧校验:返回中文提示(null = 可领),供 claim 抛 DATA_CONFLICT */
    private function assertClaimable(array $c, int $mine): ?string
    {
        return match ($this->claimBlocker($c, $mine)) {
            CouponView::REASON_OFFLINE => '活动未进行或已结束',
            CouponView::REASON_NOT_STARTED => '优惠券尚未开始发放',
            CouponView::REASON_EXPIRED => '优惠券已过期',
            CouponView::REASON_SOLD_OUT => '优惠券已领完',
            CouponView::REASON_LIMIT_REACHED => '已达个人限领数量',
            default => null,
        };
    }

    /** 兑换侧校验:同一套判定,但映射到促销码的细分错误码 */
    private function assertCouponIssuable(array $c, int $mine): void
    {
        $blocker = $this->claimBlocker($c, $mine);
        match ($blocker) {
            CouponView::REASON_SOLD_OUT => throw new BusinessException(ErrorCode::PROMO_CODE_EXHAUSTED),
            CouponView::REASON_LIMIT_REACHED => throw new BusinessException(ErrorCode::PROMO_CODE_DUPLICATED),
            CouponView::REASON_EXPIRED, CouponView::REASON_NOT_STARTED => throw new BusinessException(ErrorCode::PROMO_CODE_EXPIRED),
            CouponView::REASON_OFFLINE => throw new BusinessException(ErrorCode::PROMO_CODE_INELIGIBLE, '促销码关联的优惠券未在发放中'),
            default => null,
        };
    }

    /** 券模板可领判定:复用 CouponView 的口径,保证「能不能领」与「列表上显示能不能领」一致 */
    private function claimBlocker(array $c, int $mine): ?string
    {
        return $this->couponView->template($c, $mine)['unusableReason'];
    }

    /** 促销码本身的状态与有效期校验 */
    private function assertPromoUsable(array $promo): void
    {
        $status = (int) $promo['status'];
        if ($status === 3) {
            throw new BusinessException(ErrorCode::PROMO_CODE_EXPIRED);
        }
        if ($status === 4) {
            throw new BusinessException(ErrorCode::PROMO_CODE_EXPIRED, '促销码尚未生效');
        }
        if ($status !== 1) {
            // 2 暂停 / 5 草稿
            throw new BusinessException(ErrorCode::PROMO_CODE_INELIGIBLE, '促销码当前不可用');
        }
        $today = date('Y-m-d');
        if (! empty($promo['start_date']) && $today < (string) $promo['start_date']) {
            throw new BusinessException(ErrorCode::PROMO_CODE_EXPIRED, '促销码尚未生效');
        }
        if (! empty($promo['end_date']) && $today > (string) $promo['end_date']) {
            throw new BusinessException(ErrorCode::PROMO_CODE_EXPIRED);
        }
        $limit = (int) $promo['usage_limit'];
        if ($limit > 0 && (int) $promo['usage_count'] >= $limit) {
            throw new BusinessException(ErrorCode::PROMO_CODE_EXHAUSTED);
        }
    }
}
