/**
 * 用户接口(user-service /api/v1/app/auth|user/*)
 */

import { get, post, postEncrypted, type RequestOptions } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { AuthResult, FavoriteItem, TravelerItem, UserProfile } from '@/types/models';

/** 短信验证码场景(对齐后端 SmsVerifyService::SCENES) */
export type SmsScene = 'register' | 'login' | 'reset';

export interface SmsSendResult {
  /** 验证码有效期(秒) */
  expiresIn: number;
  /** 重发冷却(秒),验证码页的倒计时按它起跳 */
  resendAfter: number;
  /** 验证码位数(后台可配 4~8,默认 6);验证码页按它决定画几个格 */
  pinLength: number;
  /** 后端脱敏后的目标号码,用于「已发送到 097****56」的展示 */
  mobile: string;
}

export interface SmsVerifyResult {
  /** 一次性票据,交给 register / login-by-sms / reset-password 兑换 */
  verifyToken: string;
  expiresIn: number;
}

/**
 * 发送短信验证码(SMSPoh Verify API V3)
 *
 * 站点未配置短信渠道时返回 `SMS_CHANNEL_UNAVAILABLE`(50021)——
 * 注册流程据此跳过验证码步骤,与后端「渠道启用才强制」的口径一致。
 */
export function apiSmsSend(
  params: { mobile: string; scene: SmsScene },
  options?: RequestOptions,
): Promise<SmsSendResult> {
  return post<SmsSendResult>('/api/v1/app/auth/sms/send', params, options);
}

/** 校验短信验证码,换取一次性 verifyToken */
export function apiSmsVerify(params: {
  mobile: string;
  scene: SmsScene;
  code: string;
}): Promise<SmsVerifyResult> {
  return post<SmsVerifyResult>('/api/v1/app/auth/sms/verify', params);
}

/** 短信验证码登录(免密):凭 scene=login 的 verifyToken 换 Token */
export function apiLoginBySms(params: { mobile: string; verifyToken: string }): Promise<AuthResult> {
  return post<AuthResult>('/api/v1/app/auth/login-by-sms', params);
}

/** 忘记密码:凭 scene=reset 的 verifyToken 重置密码(后端不自动登录) */
export function apiResetPassword(params: {
  mobile: string;
  password: string;
  verifyToken: string;
}): Promise<null> {
  // 带明文新密码,与注册/登录同级:请求体 AES 加密传输
  return postEncrypted<null>('/api/v1/app/auth/reset-password', params);
}

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
  /**
   * 短信验证票据(`apiSmsVerify` 返回)。
   * 站点配了启用中的短信渠道时**必填**,否则后端返回 40111;未配渠道时可省略。
   */
  verifyToken?: string;
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
