import { get, post, request } from '@/utils/http';
import { encryptPayload, LOGIN_AES_KEY } from '@/utils/crypto';
import type { AdminProfile, MenuNode } from '@/api/types';

export interface LoginResult {
  token: string;
  admin: AdminProfile;
}

export interface MenusResult {
  menus: MenuNode[];
  perms: string[];
}

export function apiLogin(username: string, password: string): Promise<LoginResult> {
  // 登录参数 AES 加密传输(VITE_LOGIN_AES_KEY 未配置时回退明文,需后端关闭强制加密)
  if (!LOGIN_AES_KEY) {
    return post<LoginResult>('/admin/auth/login', { username, password });
  }
  return request<LoginResult>({
    method: 'POST',
    url: '/admin/auth/login',
    data: { payload: encryptPayload({ username, password }, LOGIN_AES_KEY) },
    headers: { 'X-Encrypted': '1' },
  });
}

export function apiLogout(): Promise<null> {
  return post<null>('/admin/auth/logout');
}

export function apiMe(): Promise<AdminProfile> {
  return get<AdminProfile>('/admin/auth/me');
}

export function apiMenus(): Promise<MenusResult> {
  return get<MenusResult>('/admin/auth/menus');
}

export function apiUpdatePassword(oldPassword: string, newPassword: string): Promise<null> {
  return post<null>('/admin/auth/password', { oldPassword, newPassword });
}
