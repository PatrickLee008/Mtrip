import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 子账号列表行 */
export interface MerchantAccount {
  id: number;
  username: string;
  realName: string;
  mobile: string;
  isOwner: boolean;
  status: number;
  lastLoginAt: string;
  createdAt: string;
}

export interface PropertyOption {
  id: number;
  store_name: string;
  merchant_id: number;
  merchant_name: string;
}

export function apiAccountList(params: Record<string, unknown>): Promise<PageData<MerchantAccount>> {
  return get('/merchant/account/list', params);
}

/** 子账号配额(平台在商户/集团上配置,主账号不占额) */
export function apiAccountQuota(): Promise<{ limit: number; used: number; remaining: number }> {
  return get('/merchant/account/quota');
}

export function apiAccountPropertyOptions(): Promise<PropertyOption[]> {
  return get('/merchant/account/property-options');
}

export function apiAccountProperties(adminId: number): Promise<{ propertyIds: number[] }> {
  return get('/merchant/account/properties', { adminId });
}

export function apiAccountAssignProperties(adminId: number, propertyIds: number[]): Promise<null> {
  return post('/merchant/account/properties/assign', { adminId, propertyIds });
}

export function apiAccountAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/merchant/account/add', data);
}

export function apiAccountUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/merchant/account/update', data);
}

export function apiAccountToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/account/toggle-status', { id });
}

export function apiAccountResetPassword(id: number, password: string): Promise<null> {
  return post('/merchant/account/reset-password', { id, password });
}
