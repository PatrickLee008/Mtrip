import { get, post } from '@/utils/http';
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
  return post<LoginResult>('/admin/auth/login', { username, password });
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
