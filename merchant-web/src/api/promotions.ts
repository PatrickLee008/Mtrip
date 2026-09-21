import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/**
 * Merchant M8 促销接口。
 *
 * 设计源:Figma `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`「Promotion tables」。
 *
 * ⚠ 两个折扣口径不要混:
 * - **设计口径**(本文件 `discountValue` 入参):`promotionKind=1/4` 或 `discountUnit=1` 时表示
 *   「立减百分比」(15 = 15% off);`promotionKind=2` 或 `discountUnit=2` 时表示金额。
 * - **计价口径**(接口返回的 `discount_value`):后端 `coupon_type=2` 时是 10 分制折扣率
 *   (8.50 = 用户付 85%)。转换在后端 `PromotionController::discountPair()` 收口,
 *   前端展示百分比请直接用后端算好的 `discount_percent_off`,不要自己再换算一次。
 */

/** 促销形态(与后端 promotion_kind 一致;决定页面分 Tab 与抽屉字段组) */
export const PROMOTION_KIND = {
  percentage: 1,
  fixedAmount: 2,
  promoCode: 3,
  longStay: 4,
} as const;

/** 折扣单位(仅 promotionKind=3 由用户选择;其余由 kind 推定) */
export const DISCOUNT_UNIT = {
  percent: 1,
  amount: 2,
} as const;

/** 促销状态(与 marketing_coupon.status 一致) */
export const PROMOTION_STATUS = {
  draft: 0,
  active: 1,
  paused: 2,
  ended: 3,
} as const;

/** 出资方(与 marketing_coupon.funding_source 一致) */
export const FUNDING_SOURCE = {
  platform: 1,
  merchant: 2,
  partner: 3,
  shared: 4,
} as const;

export interface PromotionSummary {
  total: number;
  percentage: number;
  fixedAmount: number;
  promoCode: number;
  longStay: number;
  draft: number;
  active: number;
  paused: number;
  ended: number;
  claimed: number;
  used: number;
  impressions: number;
}

export interface MerchantPromotion {
  id: number;
  site_id: number;
  merchant_id: number;
  merchant_name: string;
  coupon_name: string;
  description: string;
  coupon_type: number;
  promotion_kind: number;
  promo_code: string;
  discount_value: number;
  /** 后端换算好的「立减百分比」(仅 coupon_type=2 有意义) */
  discount_percent_off: number;
  min_amount: number;
  max_discount: number;
  funding_source: number;
  funding_rules: Record<string, number>;
  goods_scope: number;
  goods_ids: number[];
  property_ids: number[];
  sku_ids: number[];
  room_type_ids: number[];
  total_count: number;
  received_count: number;
  used_count: number;
  per_user_limit: number;
  min_nights: number;
  max_nights: number;
  book_advance_days: number;
  valid_type: number;
  valid_start: string | null;
  valid_end: string | null;
  valid_days: number;
  status: number;
  remark: string;
  staff_note: string;
  budget_estimate: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionOptionProperty {
  id: number;
  merchant_id: number;
  merchant_name: string;
  property_name: string;
  city_key: string;
}

export interface PromotionOptionRoomType {
  id: number;
  property_id: number;
  room_name: string;
  base_price: number;
  currency: string;
}

export interface PromotionOptions {
  properties: PromotionOptionProperty[];
  roomTypes: PromotionOptionRoomType[];
  /** 整页只读币种(取范围内房型已配置币种,与房量价格页同一口径) */
  currency: string;
}

/** 效果分析里单张促销的一行 */
export interface PromotionPerformanceRow {
  id: number;
  coupon_name: string;
  promotion_kind: number;
  coupon_type: number;
  discount_value: number;
  status: number;
  impressions: number;
  claims: number;
  redemptions: number;
  conversionRate: number;
  promotionRevenue: number;
  merchantFunding: number;
  roi: number;
}

export interface PromotionPerformanceTrendPoint {
  date: string;
  impressions: number;
  claims: number;
}

export interface PromotionPerformance {
  range: string;
  from: string | null;
  impressions: number;
  claims: number;
  redemptions: number;
  bookings: number;
  conversionRate: number;
  promotionRevenue: number;
  merchantFunding: number;
  platformFunding: number;
  discountTotal: number;
  roi: number;
  list: PromotionPerformanceRow[];
  trend: PromotionPerformanceTrendPoint[];
}

/** 新建/编辑抽屉的表单载荷(字段名与后端入参一致,全部驼峰) */
export interface PromotionPayload {
  id?: number;
  merchantId?: number;
  couponName: string;
  description: string;
  promotionKind: number;
  discountUnit?: number;
  discountValue: number;
  minAmount: number;
  maxDiscount: number;
  totalCount: number;
  perUserLimit: number;
  minNights?: number;
  maxNights?: number;
  bookAdvanceDays?: number;
  validType: number;
  validStart?: string;
  validEnd?: string;
  validDays?: number;
  noExpiry?: number;
  promoCode?: string;
  propertyIds: number[];
  roomTypeIds: number[];
  remark: string;
  staffNote: string;
}

export function apiPromotionSummary(): Promise<PromotionSummary> {
  return get('/merchant/promotions/summary');
}

export function apiPromotionList(params: Record<string, unknown>): Promise<PageData<MerchantPromotion>> {
  return get('/merchant/promotions/list', params);
}

export function apiPromotionDetail(id: number): Promise<MerchantPromotion> {
  return get('/merchant/promotions/detail', { id });
}

export function apiPromotionOptions(): Promise<PromotionOptions> {
  return get('/merchant/promotions/options');
}

export function apiPromotionPerformance(params: Record<string, unknown>): Promise<PromotionPerformance> {
  return get('/merchant/promotions/performance', params);
}

export function apiPromotionAdd(data: PromotionPayload): Promise<{ id: number }> {
  return post('/merchant/promotions/add', data as unknown as Record<string, unknown>);
}

export function apiPromotionUpdate(data: PromotionPayload): Promise<null> {
  return post('/merchant/promotions/update', data as unknown as Record<string, unknown>);
}

export function apiPromotionDuplicate(id: number): Promise<{ id: number }> {
  return post('/merchant/promotions/duplicate', { id });
}

export function apiPromotionPublish(id: number): Promise<{ status: number }> {
  return post('/merchant/promotions/publish', { id });
}

export function apiPromotionToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/promotions/toggle-status', { id });
}

export function apiPromotionDelete(id: number): Promise<null> {
  return post('/merchant/promotions/delete', { id });
}
