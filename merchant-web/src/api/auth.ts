import { get, post, request } from '@/utils/http';
import { encryptPayload, LOGIN_AES_KEY } from '@/utils/crypto';
import type { MerchantProfile, MenuNode } from '@/api/types';

export interface LoginResult {
  token: string;
  admin: MerchantProfile;
}

export interface MenusResult {
  menus: MenuNode[];
  perms: string[];
}

export function apiLogin(username: string, password: string): Promise<LoginResult> {
  // 登录参数 AES 加密传输(VITE_LOGIN_AES_KEY 未配置时回退明文,需后端关闭强制加密)
  if (!LOGIN_AES_KEY) {
    return post<LoginResult>('/merchant/auth/login', { username, password });
  }
  return request<LoginResult>({
    method: 'POST',
    url: '/merchant/auth/login',
    data: { payload: encryptPayload({ username, password }, LOGIN_AES_KEY) },
    headers: { 'X-Encrypted': '1' },
  });
}

export function apiLogout(): Promise<null> {
  return post<null>('/merchant/auth/logout');
}

export function apiMe(): Promise<MerchantProfile> {
  return get<MerchantProfile>('/merchant/auth/me');
}

export function apiMenus(): Promise<MenusResult> {
  return get<MenusResult>('/merchant/auth/menus');
}

export function apiUpdatePassword(oldPassword: string, newPassword: string): Promise<null> {
  return post<null>('/merchant/auth/password', { oldPassword, newPassword });
}
