import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 商品列表行(后端 goods_info 精选列 + 分类名/商户名) */
export interface MerchantGoods {
  id: number;
  merchant_id: number;
  merchant_name: string;
  goods_type: number;
  category_id: number;
  category_name: string;
  goods_name: string;
  cover_image: string;
  status: number;
  audit_remark: string;
  sort_weight: number;
  sales_count: number;
  created_at: string;
}

export function apiGoodsList(params: Record<string, unknown>): Promise<PageData<MerchantGoods>> {
  return get('/merchant/goods/list', params);
}

export function apiGoodsDetail(id: number): Promise<Record<string, unknown>> {
  return get('/merchant/goods/detail', { id });
}

export function apiGoodsAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/merchant/goods/add', data);
}

export function apiGoodsUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/merchant/goods/update', data);
}

/** 提交审核:0草稿/2驳回 → 1待审核 */
export function apiGoodsSubmit(id: number): Promise<null> {
  return post('/merchant/goods/submit', { id });
}

/** 上下架:3已上架 ⇄ 4已下架 */
export function apiGoodsToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/goods/toggle-status', { id });
}
