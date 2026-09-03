/**
 * 用户接口(user-service /api/v1/app/auth|user/*)
 */

import { get, post, postEncrypted } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { AuthResult, FavoriteItem, TravelerItem, UserProfile } from '@/types/models';

export function apiRegister(params: {
  mobile: string;
  password: string;
  nickname?: string;
  /**
   * 注册页(Figma 505:1498)有邮箱栏,`user_info.email` 列也在,
   * 但 user-service AuthController::register 目前只读 mobile/password/nickname/referralCode,
   * 这里先按设计稿把值传上去,后端补上入参即可落库,无需再动前端
   */
  email?: string;
  /**
   * 推荐人的推荐码(Figma Onboarding 的 Referral Code 页,选填)。
   * 后端 `UserAuthService::setupReferral` 会据此写 `user_referral`;**填错会直接注册失败**(推荐码无效)
   */
  referralCode?: string;
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

/* ---- 常旅客(Frequent Traveler,需登录) ---- */

/** 列表:后端直接返回数组(不是分页对象),按 is_default / id 倒序 */
export function fetchTravelerList(): Promise<TravelerItem[]> {
  return get<TravelerItem[]>('/api/v1/app/user/traveler/list');
}

export interface TravelerPayload {
  nationality?: string;
  firstName: string;
  lastName: string;
  /** 1 NRC 2 护照 3 其他,缺省 2 */
  idType?: number;
  /** 新增必填;**编辑时留空 = 保持原值**(列表返回的是脱敏值,回填不了原文) */
  idNo?: string;
  /** YYYY-MM-DD */
  idExpireDate?: string;
  isDefault?: number;
}

export function addTraveler(params: TravelerPayload): Promise<{ id: number }> {
  return post<{ id: number }>('/api/v1/app/user/traveler/add', { ...params });
}

export function updateTraveler(id: number, params: TravelerPayload): Promise<null> {
  return post<null>('/api/v1/app/user/traveler/update', { id, ...params });
}

export function deleteTraveler(id: number): Promise<null> {
  return post<null>('/api/v1/app/user/traveler/delete', { id });
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
