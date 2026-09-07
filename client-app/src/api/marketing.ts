/**
 * 营销接口(marketing-service /api/v1/app/marketing/*)
 *
 * 全部要登录(路由挂 UserAuthMiddleware),未登录时不要调用 —— 页面自行走示例数据/登录引导。
 * 券字段口径由后端 `App\Service\CouponView` 统一产出,活动详情 / 领券中心 / 券详情 /
 * 我的券 / 结账择优拿到的是同一套字段,见 types/models.ts 的 CouponView。
 */

import { get, post } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type {
  CampaignDetail,
  CampaignItem,
  CouponView,
  MyCouponType,
  PromoBanner,
  PromoRedeemResult,
} from '@/types/models';

/* ---- 活动 ---- */

export function fetchCampaigns(): Promise<CampaignItem[]> {
  return get<CampaignItem[]>('/api/v1/app/marketing/campaigns');
}

export function fetchCampaignDetail(id: number): Promise<CampaignDetail> {
  return get<CampaignDetail>('/api/v1/app/marketing/campaign/detail', { id });
}

export function fetchPromotionBanners(): Promise<PromoBanner[]> {
  return get<PromoBanner[]>('/api/v1/app/marketing/promotion/banners');
}

/* ---- 领券中心 / 我的券 ---- */

/** 领券中心:进行中的券模板,带 canClaim 与不可领原因 */
export function fetchAvailableCoupons(params?: PageParams): Promise<PageData<CouponView>> {
  return get('/api/v1/app/marketing/coupon/available', { ...params });
}

/** 我的券:available 可用 / used 已用 / expired 已失效 */
export function fetchMyCoupons(
  type: MyCouponType,
  params?: PageParams,
): Promise<PageData<CouponView>> {
  return get('/api/v1/app/marketing/coupon/my', { type, ...params });
}

/**
 * 券详情:传 receiveId = 我的券(带券码),传 couponId = 未领取的券模板。
 * 两者返回同一套字段,页面不必分支。
 */
export function fetchCouponDetail(params: {
  receiveId?: number;
  couponId?: number;
}): Promise<CouponView> {
  return get<CouponView>('/api/v1/app/marketing/coupon/detail', { ...params });
}

export interface ClaimResult {
  receiveId: number;
  couponCode: string;
  validStart: string | null;
  validEnd: string | null;
}

export function claimCoupon(couponId: number): Promise<ClaimResult> {
  return post<ClaimResult>('/api/v1/app/marketing/coupon/claim', { couponId });
}

/**
 * 促销码兑换:成功即把绑定的券写进「我的优惠券」。
 * 失败按 API_CODE.PROMO_* 区分「不存在 / 过期 / 兑完 / 重复 / 资格不符」,
 * 调用方应捕获 ApiError 后按 code 取文案(request.ts 已经把后端中文 message 弹过一次 Toast)。
 */
export function redeemPromoCode(code: string): Promise<PromoRedeemResult> {
  return post<PromoRedeemResult>('/api/v1/app/marketing/coupon/redeem', { code });
}

/* ---- 结账择优(C-M6 第2周结账接入时使用) ---- */

export interface BestCouponParams {
  orderType?: number;
  goodsId?: number;
  skuId?: number;
  amount: number;
}

export interface BestCoupon {
  /** 领券记录ID(下单时提交的 couponId) */
  couponId: number;
  couponName: string;
  discount: number;
}

/** 无可用券时后端返回 null */
export function fetchBestCoupon(params: BestCouponParams): Promise<BestCoupon | null> {
  return get<BestCoupon | null>('/api/v1/app/marketing/coupon/best-match', { ...params });
}

export interface CouponMatchList {
  /** 本人全部未使用券:可用的排前面并按抵扣额从大到小,不可用的带 unusableReason */
  list: CouponView[];
  /** 抵扣最高的一张;无可用券时为 null */
  best: BestCoupon | null;
}

/**
 * 结账选券列表:每张券带**本单实际抵扣额** `discount` 与不可用原因。
 * 抵扣额一律由服务端算(与下单时 `PricingService::resolveCoupon` 同一公式),
 * 前端不要自己算,否则复核页显示的优惠会与实际扣款对不上。
 */
export function fetchCouponMatchList(params: BestCouponParams): Promise<CouponMatchList> {
  return get<CouponMatchList>('/api/v1/app/marketing/coupon/match-list', { ...params });
}
