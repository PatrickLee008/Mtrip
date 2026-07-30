import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 供货商品列表行(supplier_goods snake_case 直出) */
export interface SupplierGoods {
  id: number;
  supplier_id: number;
  goods_id: number;
  goods_name: string;
  goods_type: number;
  supply_price: string | number;
  retail_price: string | number;
  sync_type: number;
  status: number;
  remark: string;
  created_at: string;
}

export function apiGoodsList(params: Record<string, unknown>): Promise<PageData<SupplierGoods>> {
  return get('/supplier/goods/list', params);
}

export function apiGoodsDetail(id: number): Promise<{ goods: Record<string, unknown> }> {
  return get('/supplier/goods/detail', { id });
}

export function apiGoodsAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/supplier/goods/add', data);
}

export function apiGoodsUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/supplier/goods/update', data);
}

/** 停供/恢复供货(1供货中 ⇄ 2已停供) */
export function apiGoodsToggleStatus(id: number): Promise<{ status: number }> {
  return post('/supplier/goods/toggle-status', { id });
}

/** 删除供货商品(软删) */
export function apiGoodsDelete(id: number): Promise<null> {
  return post('/supplier/goods/delete', { id });
}
