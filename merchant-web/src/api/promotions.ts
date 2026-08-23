import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface PromotionSummary {
  total: number;
  draft: number;
  active: number;
  paused: number;
  ended: number;
  claimed: number;
  used: number;
  estimatedBudget: number;
}

export interface MerchantPromotion {
  id: number;
  site_id: number;
  merchant_id: number;
  merchant_name: string;
  coupon_name: string;
  coupon_type: number;
  discount_value: number;
  min_amount: number;
  max_discount: number;
  funding_source: number;
  goods_scope: number;
  goods_ids: number[];
  total_count: number;
  received_count: number;
  used_count: number;
  per_user_limit: number;
  valid_type: number;
  valid_start: string | null;
  valid_end: string | null;
  valid_days: number;
  status: number;
  remark: string;
  budget_estimate: number;
  created_at: string;
  updated_at: string;
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

export function apiPromotionAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/merchant/promotions/add', data);
}

export function apiPromotionUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/merchant/promotions/update', data);
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
