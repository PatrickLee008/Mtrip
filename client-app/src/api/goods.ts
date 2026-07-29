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

export interface GoodsListParams extends PageParams {
  goodsType?: number;
  categoryId?: number;
  keyword?: string;
  starLevel?: number;
  sortBy?: 'default' | 'sales' | 'new';
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
