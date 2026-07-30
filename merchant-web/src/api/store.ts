import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 门店列表行(后端 snake_case 直出 + merchant_name) */
export interface MerchantStore {
  id: number;
  merchant_id: number;
  merchant_name: string;
  store_name: string;
  contact_name: string;
  contact_phone: string;
  address: string;
  is_main: number;
  status: number;
  created_at: string;
}

export function apiStoreList(params: Record<string, unknown>): Promise<PageData<MerchantStore>> {
  return get('/merchant/store/list', params);
}

export function apiStoreDetail(id: number): Promise<Record<string, unknown>> {
  return get('/merchant/store/detail', { id });
}

export function apiStoreAdd(data: Record<string, unknown>): Promise<{ id: number; isMain: number }> {
  return post('/merchant/store/add', data);
}

export function apiStoreUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/merchant/store/update', data);
}

export function apiStoreSetMain(id: number): Promise<null> {
  return post('/merchant/store/set-main', { id });
}

export function apiStoreToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/store/toggle-status', { id });
}
