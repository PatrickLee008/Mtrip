import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 子账号列表行 */
export interface SupplierAccount {
  id: number;
  username: string;
  realName: string;
  mobile: string;
  isOwner: boolean;
  status: number;
  lastLoginAt: string;
  createdAt: string;
}

export function apiAccountList(params: Record<string, unknown>): Promise<PageData<SupplierAccount>> {
  return get('/supplier/account/list', params);
}

export function apiAccountAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/supplier/account/add', data);
}

export function apiAccountUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/supplier/account/update', data);
}

export function apiAccountToggleStatus(id: number): Promise<{ status: number }> {
  return post('/supplier/account/toggle-status', { id });
}

export function apiAccountResetPassword(id: number, password: string): Promise<null> {
  return post('/supplier/account/reset-password', { id, password });
}
