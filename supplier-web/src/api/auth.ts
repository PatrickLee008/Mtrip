import { get, post, request } from '@/utils/http';
import { encryptPayload, LOGIN_AES_KEY } from '@/utils/crypto';
import type { SupplierProfile, MenuNode } from '@/api/types';

export interface LoginResult {
  token: string;
  admin: SupplierProfile;
}

export interface MenusResult {
  menus: MenuNode[];
  perms: string[];
}

export function apiLogin(username: string, password: string): Promise<LoginResult> {
  // 登录参数 AES 加密传输(VITE_LOGIN_AES_KEY 未配置时回退明文,需后端关闭强制加密)
  if (!LOGIN_AES_KEY) {
    return post<LoginResult>('/supplier/auth/login', { username, password });
  }
  return request<LoginResult>({
    method: 'POST',
    url: '/supplier/auth/login',
    data: { payload: encryptPayload({ username, password }, LOGIN_AES_KEY) },
    headers: { 'X-Encrypted': '1' },
  });
}

export function apiLogout(): Promise<null> {
  return post<null>('/supplier/auth/logout');
}

export function apiMe(): Promise<SupplierProfile> {
  return get<SupplierProfile>('/supplier/auth/me');
}

export function apiMenus(): Promise<MenusResult> {
  return get<MenusResult>('/supplier/auth/menus');
}

export function apiUpdatePassword(oldPassword: string, newPassword: string): Promise<null> {
  return post<null>('/supplier/auth/password', { oldPassword, newPassword });
}
