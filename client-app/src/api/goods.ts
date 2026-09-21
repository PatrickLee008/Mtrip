/**
 * 商品接口(goods-service /api/v1/app/goods/*,公开)
 */

import { get } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { CalendarDay, GoodsCategory, GoodsDetail, GoodsItem } from '@/types/models';

export interface MarketplaceDestination { id: number; name: string; tagline: string; image_url: string; country_code: string; city_key: string; region: string }
export function fetchHome(): Promise<{ recommend: GoodsItem[]; hot: GoodsItem[]; destinations: MarketplaceDestination[] }> {
  return get('/api/v1/app/goods/home');
}

export function fetchCategories(goodsType?: number): Promise<GoodsCategory[]> {
  return get('/api/v1/app/goods/category', goodsType ? { goodsType } : undefined);
}

/** 后端 applySort 的白名单(GoodsController::applySort) */
export type GoodsSortBy =
  | 'default'
  | 'price_asc'
  | 'price_desc'
  | 'star'
  | 'rating'
  | 'sales'
  | 'new'
  /** 需同时带 lat/lng,否则后端静默回退成综合排序 */
  | 'distance';

export interface GoodsListParams extends PageParams {
  countryCode?: string;
  cityKey?: string;
  goodsType?: number;
  categoryId?: number;
  keyword?: string;
  /** 精确星级(非「N 星及以上」) */
  starLevel?: number;
  sortBy?: GoodsSortBy;
  /* ---- 以下对应后端 applyFilters(PRD 模块3 可配置筛选) ---- */
  priceMin?: number;
  priceMax?: number;
  /** 设施标签,酒店列表按物业 facilities 匹配 */
  amenities?: string;
  /** 1=只看含早 */
  breakfast?: number;
  /** 1=只看免费取消 */
  freeCancel?: number;
  /** 评价均分下限(1~5) */
  reviewScore?: number;
}

export function fetchGoodsList(params: GoodsListParams): Promise<PageData<GoodsItem>> {
  return get('/api/v1/app/goods/list', { ...params });
}

export function fetchGoodsDetail(id: number): Promise<GoodsDetail> {
  return get('/api/v1/app/goods/detail', { id });
}

export function fetchHotelList(params: Omit<GoodsListParams, 'goodsType'>): Promise<PageData<GoodsItem>> {
  return get('/api/v1/app/hotels/list', { ...params });
}

export function fetchHotelDetail(propertyId: number): Promise<GoodsDetail> {
  return get('/api/v1/app/hotels/detail', { propertyId });
}

/**
 * 一条住客评价(`/app/hotels/reviews` 的行,字段 snake_case 直出)。
 *
 * **设计稿有、这里没有的字段**:评论标题、同行类型(Solo/Couple/Family)、分维度评分 ——
 * `goods_review` 表只有单一 `rating`,这些行在页面上不渲染(见 `HotelReviewCard`)。
 * `nickname` 后端在为空时会填中文字面量「匿名用户」,客户端要按「没有昵称」处理。
 */
export interface HotelReview {
  id: number;
  /** 1-5 分制,页面按 ×2 换算成设计稿的 /10 */
  rating: number;
  content: string;
  images: string[] | null;
  reply_content: string;
  created_at: string;
  nickname: string;
  avatar: string | null;
}

export function fetchHotelReviews(params: { propertyId: number } & PageParams): Promise<PageData<HotelReview>> {
  return get('/api/v1/app/hotels/reviews', { ...params });
}

export function fetchHotelCalendar(params: {
  propertyId: number;
  roomTypeId: number;
  startDate?: string;
  days?: number;
}): Promise<{ propertyId: number; roomTypeId: number; calendar: CalendarDay[] }> {
  return get('/api/v1/app/hotels/calendar', { ...params });
}

export function fetchCalendar(params: {
  skuType: number;
  skuId: number;
  startDate?: string;
  days?: number;
}): Promise<{ skuType: number; skuId: number; calendar: CalendarDay[] }> {
  return get('/api/v1/app/goods/calendar', { ...params });
}
