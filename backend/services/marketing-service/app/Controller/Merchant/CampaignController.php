<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端 M8 平台活动参与(功能需求「参与平台活动」)。
 *
 * 平台活动由 admin 端 `Admin\CampaignController` 建立在 `marketing_campaign`,本控制器只做商户视角:
 * 看得到什么(资格)、要不要参加(接受/拒绝)、钱怎么分(出资模式)、条款是什么。
 * 参与关系落在 `marketing_campaign_participant`(uk: campaign_id + merchant_id)。
 *
 * ## 可见性
 * - `invite_mode = 1`(定向邀请):只有已建 participant 行(被邀请)的商户能看到;
 * - `invite_mode = 2`(公开报名):同站点全部商户可见并可报名。
 * 两种模式下都要求活动 `status = 1`(上架)且当前时间落在 `[start_time, end_time]` 内。
 *
 * ## 隔离
 * 站点取 `MerchantContext::siteId()`;商户取 `scopeMerchantIds()`;响应里的
 * `accepted` 只代表「当前登录商户」的参与状态。
 */
class CampaignController extends AbstractController
{
    public const STATUS_INVITED = 0;
    public const STATUS_ACCEPTED = 1;
    public const STATUS_DECLINED = 2;
    public const STATUS_WITHDRAWN = 3;

    /** 活动统计(商户视角:待响应 / 已参加 / 已拒绝 / 已退出 / 全部) */
    public function summary(): array
    {
        $total = $this->visibleCampaignQuery()->count();

        // 计数口径必须与列表一致:只在「当前可见」的活动里统计参与状态,
        // 否则已下架/已结束的活动会让待响应角标一直挂着数字
        $counts = [0, 0, 0, 0];
        $rows = $this->visibleCampaignQuery()
            ->whereNotNull('p.id')
            ->groupBy('p.status')
            ->get([Db::raw('p.status AS status'), Db::raw('COUNT(*) AS total')]);
        foreach ($rows as $row) {
            $status = (int) $row->status;
            if (isset($counts[$status])) {
                $counts[$status] = (int) $row->total;
            }
        }

        return Result::success([
            'total' => $total,
            'pending' => $counts[self::STATUS_INVITED],
            'accepted' => $counts[self::STATUS_ACCEPTED],
            'declined' => $counts[self::STATUS_DECLINED],
            'withdrawn' => $counts[self::STATUS_WITHDRAWN],
        ]);
    }

    /**
     * 活动列表。
     * 每行带上当前商户的参与状态(未参加时为 null)与出资模式,供卡片直接渲染。
     */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->visibleCampaignQuery();

        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('c.title', 'like', "%{$keyword}%")
                    ->orWhere('c.subtitle', 'like', "%{$keyword}%");
            });
        }
        $participant = $this->strInput('participation');
        if ($participant === 'pending') {
            $query->where('p.status', self::STATUS_INVITED);
        } elseif ($participant === 'accepted') {
            $query->where('p.status', self::STATUS_ACCEPTED);
        } elseif ($participant === 'declined') {
            $query->where('p.status', self::STATUS_DECLINED);
        }

        $total = (clone $query)->count();
        $list = $query->orderBy('c.sort')->orderByDesc('c.id')
            ->forPage($page, $pageSize)
            ->get($this->columns())
            ->map(fn ($row) => $this->normalize((array) $row))
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $row = $this->visibleCampaignQuery()->where('c.id', $this->requireId())->first($this->columns());
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'campaign not found');
        }
        $campaign = $this->normalize((array) $row);
        $campaign['coupons'] = $this->linkedCoupons($campaign['coupon_ids']);

        return Result::success($campaign);
    }

    /**
     * 接受 / 拒绝活动邀请。
     * 入参:`id`(活动ID)+ `action`(accept|decline)+ 可选 `remark`(拒绝原因)。
     */
    #[Permission('mch:campaigns:respond')]
    public function respond(): array
    {
        $campaignId = $this->requireId();
        $action = strtolower($this->strInput('action'));
        if (! in_array($action, ['accept', 'decline'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'action must be accept or decline');
        }
        $merchantIds = $this->scopeMerchantIds();
        if ($merchantIds === []) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        $merchantId = $this->resolveMerchantId($merchantIds);

        $campaign = $this->visibleCampaignQuery()->where('c.id', $campaignId)->first($this->columns());
        if (! $campaign) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'campaign not found');
        }
        $campaign = $this->normalize((array) $campaign);

        $existing = Db::table('marketing_campaign_participant')
            ->where('campaign_id', $campaignId)->where('merchant_id', $merchantId)->whereNull('deleted_at')
            ->first();
        if ((int) $campaign['invite_mode'] === 1 && ! $existing) {
            // 定向邀请的活动,未被邀请的商户不能自行报名
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'this campaign is invitation only');
        }

        $status = $action === 'accept' ? self::STATUS_ACCEPTED : self::STATUS_DECLINED;
        $data = [
            'site_id' => (int) $campaign['site_id'],
            'campaign_id' => $campaignId,
            'merchant_id' => $merchantId,
            'status' => $status,
            // 出资模式在参与时快照,后续平台改活动不影响已确认的结算口径
            'funding_source' => (int) $campaign['funding_source'],
            'funding_rules' => $campaign['funding_rules'] === [] ? null : json_encode($campaign['funding_rules'], JSON_UNESCAPED_UNICODE),
            'responded_at' => date('Y-m-d H:i:s'),
            'remark' => mb_substr($this->strInput('remark'), 0, 500),
        ];
        if ($existing) {
            Db::table('marketing_campaign_participant')->where('id', (int) $existing->id)->update($data);
            $participantId = (int) $existing->id;
        } else {
            $data['invited_at'] = date('Y-m-d H:i:s');
            $participantId = (int) Db::table('marketing_campaign_participant')->insertGetId($data);
        }

        return Result::success(
            ['id' => $participantId, 'status' => $status],
            $action === 'accept' ? 'campaign joined' : 'campaign declined',
        );
    }

    // ─────────────────────────── 内部 ───────────────────────────

    /**
     * 商户可见的活动查询(含当前商户的参与行)。
     * 用 `leftJoin` 而非 `join`:公开报名且尚未报名的活动也要出现在列表里。
     */
    private function visibleCampaignQuery(): mixed
    {
        $now = date('Y-m-d H:i:s');
        $merchantIds = $this->scopeMerchantIds();

        return Db::table('marketing_campaign as c')
            ->leftJoin('marketing_campaign_participant as p', static function ($join) use ($merchantIds) {
                $join->on('p.campaign_id', '=', 'c.id')
                    ->whereIn('p.merchant_id', $merchantIds)
                    ->whereNull('p.deleted_at');
            })
            ->whereNull('c.deleted_at')
            ->where('c.status', 1)
            ->where(static function ($q) use ($now) {
                $q->whereNull('c.start_time')->orWhere('c.start_time', '<=', $now);
            })
            ->where(static function ($q) use ($now) {
                $q->whereNull('c.end_time')->orWhere('c.end_time', '>=', $now);
            })
            ->where(static function ($q) {
                // 定向邀请:必须有参与行;公开报名:全部可见
                $q->where('c.invite_mode', 2)->orWhereNotNull('p.id');
            })
            ->where(static function ($q) {
                $q->where('c.site_id', 0)->orWhere('c.site_id', MerchantContext::siteId());
            });
    }

    private function columns(): array
    {
        return [
            'c.id', 'c.site_id', 'c.title', 'c.subtitle', 'c.banner', 'c.landing_url', 'c.coupon_ids',
            'c.funding_source', 'c.funding_rules', 'c.requirements', 'c.terms', 'c.invite_mode',
            'c.start_time', 'c.end_time', 'c.sort', 'c.status', 'c.created_at',
            'p.id as participation_id', 'p.status as participation_status',
            'p.funding_source as participation_funding_source', 'p.responded_at', 'p.remark as participation_remark',
        ];
    }

    private function normalize(array $row): array
    {
        $row['coupon_ids'] = $this->jsonDecode($row['coupon_ids'] ?? null);
        $row['funding_rules'] = $this->jsonDecode($row['funding_rules'] ?? null);
        $row['invite_mode'] = (int) ($row['invite_mode'] ?? 1);
        $row['funding_source'] = (int) ($row['funding_source'] ?? 1);
        $row['participation_id'] = (int) ($row['participation_id'] ?? 0);
        // null = 未参加(公开报名且尚未响应);有值时为 0待响应/1已接受/2已拒绝/3已退出
        $row['participation_status'] = $row['participation_id'] > 0 ? (int) $row['participation_status'] : null;
        $row['can_respond'] = (int) $row['invite_mode'] === 2
            ? ! in_array($row['participation_status'], [self::STATUS_ACCEPTED], true)
            : in_array($row['participation_status'], [self::STATUS_INVITED, self::STATUS_DECLINED, self::STATUS_WITHDRAWN], true);
        unset($row['deleted_at']);

        return $row;
    }

    /** 活动关联的可领券(商户端只看得到券名与面额,不看领取明细) */
    private function linkedCoupons(array $couponIds): array
    {
        $ids = array_values(array_filter(array_map('intval', $couponIds)));
        if ($ids === []) {
            return [];
        }

        return Db::table('marketing_coupon')
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->get(['id', 'coupon_name', 'coupon_type', 'discount_value'])
            ->map(static fn ($row) => [
                'id' => (int) $row->id,
                'coupon_name' => (string) $row->coupon_name,
                'coupon_type' => (int) $row->coupon_type,
                'discount_value' => (float) $row->discount_value,
            ])
            ->all();
    }

    /**
     * 落到具体商户。
     *
     * ⚠ 集团账号(account_type=1)的 `scopeMerchantIds()` 可能是**多个**商户,
     * 「替哪家商户接受邀请」不能靠猜,必须由前端显式传 `merchantId`(活动页的商户选择器);
     * 门店账号(account_type=3)的 scope 是哨兵 `[-1]`,不能拿它当 merchant_id 落库。
     */
    private function resolveMerchantId(array $scope): int
    {
        if (MerchantContext::accountType() === 1) {
            $merchantId = $this->intInput('merchantId');
            if ($merchantId <= 0) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'merchantId is required for group accounts');
            }
            if (! in_array($merchantId, $scope, true)) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'merchant out of scope');
            }

            return $merchantId;
        }

        $merchantId = (int) ($scope[0] ?? 0);
        if ($merchantId <= 0) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'no merchant in scope');
        }

        return $merchantId;
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();

        return $ids === [] ? [0] : $ids;
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }
}
