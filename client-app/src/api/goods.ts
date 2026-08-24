/**
 * 商品接口(goods-service /api/v1/app/goods/*,公开)
 */

import { get } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { CalendarDay, GoodsCategory, GoodsDetail, GoodsItem } from '@/types/models';

export function fetchHome(): Promise<{ recommend: GoodsItem[]; hot: GoodsItem[] }> {
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
  goodsType?: number;
  categoryId?: number;
  keyword?: string;
  /** 精确星级(非「N 星及以上」) */
  starLevel?: number;
  sortBy?: GoodsSortBy;
  /* ---- 以下对应后端 applyFilters(PRD 模块3 可配置筛选) ---- */
  priceMin?: number;
  priceMax?: number;
  /** 设施标签,后端按 JSON_CONTAINS 逐项与 goods_info.facilities 匹配 */
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

export function fetchCalendar(params: {
  skuType: number;
  skuId: number;
  startDate?: string;
  days?: number;
}): Promise<{ skuType: number; skuId: number; calendar: CalendarDay[] }> {
  return get('/api/v1/app/goods/calendar', { ...params });
}
