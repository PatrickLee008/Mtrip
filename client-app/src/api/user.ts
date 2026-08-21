/**
 * 用户接口(user-service /api/v1/app/auth|user/*)
 */

import { get, post, postEncrypted } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { AuthResult, FavoriteItem, UserProfile } from '@/types/models';

export function apiRegister(params: {
  mobile: string;
  password: string;
  nickname?: string;
}): Promise<AuthResult> {
  // 敏感接口:请求体 AES 加密传输
  return postEncrypted<AuthResult>('/api/v1/app/auth/register', params);
}

export function apiLogin(params: { mobile: string; password: string }): Promise<AuthResult> {
  return postEncrypted<AuthResult>('/api/v1/app/auth/login', params);
}

export function apiLogout(): Promise<null> {
  return post<null>('/api/v1/app/auth/logout');
}

export function apiRefreshToken(): Promise<AuthResult> {
  return post<AuthResult>('/api/v1/app/auth/refresh');
}

export function fetchMe(): Promise<UserProfile> {
  return get<UserProfile>('/api/v1/app/user/me');
}

export function updateProfile(params: { nickname?: string; avatar?: string }): Promise<UserProfile> {
  return post<UserProfile>('/api/v1/app/user/update', params);
}

export function changePassword(params: {
  oldPassword: string;
  newPassword: string;
}): Promise<null> {
  return post<null>('/api/v1/app/user/change-password', params);
}

export function fetchBalanceLogs(params: PageParams): Promise<PageData<Record<string, unknown>>> {
  return get('/api/v1/app/user/balance-logs', { ...params });
}

export function fetchPointsLogs(params: PageParams): Promise<PageData<Record<string, unknown>>> {
  return get('/api/v1/app/user/points-logs', { ...params });
}

/* ---- 收藏(Saved Hotels,需登录) ---- */

export function fetchFavoriteList(params: PageParams): Promise<PageData<FavoriteItem>> {
  return get('/api/v1/app/user/favorite/list', { ...params });
}

export function addFavorite(goodsId: number): Promise<null> {
  return post<null>('/api/v1/app/user/favorite/add', { goodsId });
}

export function removeFavorite(goodsId: number): Promise<null> {
  return post<null>('/api/v1/app/user/favorite/remove', { goodsId });
}

export function addFeedback(params: {
  content: string;
  feedbackType?: number;
  images?: string[];
  orderId?: number;
}): Promise<null> {
  return post<null>('/api/v1/app/user/feedback/add', params);
}

export function fetchFeedbackList(params: PageParams): Promise<PageData<Record<string, unknown>>> {
  return get('/api/v1/app/user/feedback/list', { ...params });
}
