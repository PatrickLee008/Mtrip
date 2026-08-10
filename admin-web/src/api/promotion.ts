import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 促销独立实体:代金券/促销码/新客奖励(Super Admin Portal 模块 05,marketing-service) */
type Row = Record<string, any>;

// 代金券
export function apiVouchers(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/voucher/list', params);
}
export function apiVoucherSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/marketing/voucher/save', data);
}
export function apiVoucherDelete(id: number): Promise<null> {
  return post('/admin/marketing/voucher/delete', { id });
}

// 促销码
export function apiPromoCodes(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/promo-code/list', params);
}
export function apiPromoCodeSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/marketing/promo-code/save', data);
}
export function apiPromoCodeDelete(id: number): Promise<null> {
  return post('/admin/marketing/promo-code/delete', { id });
}

// 新客奖励
export function apiWelcomes(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/welcome/list', params);
}
export function apiWelcomeSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/marketing/welcome/save', data);
}
export function apiWelcomeDelete(id: number): Promise<null> {
  return post('/admin/marketing/welcome/delete', { id });
}
