/**
 * 用户接口(user-service /api/v1/app/auth|user/*)
 */

import { get, post, postEncrypted, postForm, type RequestOptions } from '@/api/request';
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
   * 姓名(注册页取代了原邮箱栏):后端 `AuthController::register` 收 `realName`,
   * AES 加密后落 `user_info.real_name`;不改 `real_name_status`(填名字不等于实名认证)
   */
  realName?: string;
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

/* ---- 资料向导(Set Up Profile,Figma Onboarding 2485:8211 / 2485:8355) ---- */

/** 向导回填:本人明文资料(姓名 / 住址不脱敏,只给本人) */
export interface ProfileSetupDetail {
  avatar: string;
  fullName: string;
  birthday: string | null;
  gender: number;
  city: string;
  homeAddress: string;
  nationality: string;
  realNameStatus: number;
  profileCompleted: boolean;
}

export function fetchProfileSetup(): Promise<ProfileSetupDetail> {
  return get<ProfileSetupDetail>('/api/v1/app/user/profile-setup/detail');
}

/** 第 1 步 Complete Your Profile;成功后后端记 profile_setup_at,返回最新资料 */
export function saveProfileSetup(params: {
  avatar?: string;
  fullName: string;
  /** yyyy-mm-dd */
  birthday: string;
  gender: number;
  city?: string;
  homeAddress?: string;
}): Promise<UserProfile> {
  return post<UserProfile>('/api/v1/app/user/profile-setup/profile', params);
}

/** 第 2 步 Identity Verification;提交后 realNameStatus=3 审核中 */
export function submitIdentity(params: {
  /** ISO 3166-1 alpha-2 */
  nationality: string;
  name: string;
  /** 缅甸国籍为 NRC(如 `12/OoKaMa(N)123456`),其余国籍为护照号 */
  idNumber: string;
  idCardFront: string;
  /** 护照只有资料页,可空;NRC 必填 */
  idCardBack?: string;
  selfieImage: string;
}): Promise<UserProfile> {
  return post<UserProfile>('/api/v1/app/user/profile-setup/identity', params);
}

export type UserUploadScene = 'avatar' | 'id_front' | 'id_back' | 'selfie';

/** 本地选好的图片(expo-image-picker 结果);web 端带 File,原生端只有 uri */
export interface LocalImage {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
}

/** 图片上传,返回 `/uploads/user/{id}/...` 相对地址(展示时用 resolveMediaUri 拼域名) */
export function uploadUserImage(scene: UserUploadScene, image: LocalImage): Promise<{ url: string }> {
  const body = new FormData();
  body.append('scene', scene);
  if (image.file) body.append('file', image.file, image.name);
  // RN 的 FormData 认 { uri, name, type } 形态的文件描述,类型声明里没有,只能断言
  else body.append('file', { uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
  return postForm<{ url: string }>('/api/v1/app/user/upload', body);
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

export function addFavorite(propertyId: number): Promise<null> {
  return post<null>('/api/v1/app/user/favorite/add', { propertyId });
}

export function removeFavorite(propertyId: number): Promise<null> {
  return post<null>('/api/v1/app/user/favorite/remove', { propertyId });
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

/* ---- 推荐返利(Refer & Earn,需登录) ---- */

/** 奖励状态:0 待达成 1 已发放 2 已失效(对齐 `user_referral.reward_status`) */
export const REFERRAL_STATUS = {
  PENDING: 0,
  REWARDED: 1,
  EXPIRED: 2,
} as const;

export interface ReferralSummary {
  /** 本人推荐码;后端首次访问时惰性生成,不会为空 */
  referralCode: string;
  inviteeCount: number;
  pendingCount: number;
  rewardedCount: number;
  /** 累计已到账奖励(仅 reward_status=1 的合计) */
  rewardTotal: number;
}

/** 被推荐人行(列表行按后端约定 snake_case 直出) */
export interface RefereeItem {
  id: number;
  reward_status: number;
  reward_amount: string | number;
  reward_order_id: number;
  bind_time: string | null;
  reward_time: string | null;
  nickname: string;
  avatar: string | null;
}

/** 我的推荐码与战绩(统计卡 + 推荐码/链接卡) */
export function fetchReferralMy(): Promise<ReferralSummary> {
  return get<ReferralSummary>('/api/v1/app/user/referral/my');
}

/** 我邀请的人;`status` 不传为全部,推荐明细页按页签传 0/1 */
export function fetchReferralInvitees(
  params: PageParams & { status?: number },
): Promise<PageData<RefereeItem>> {
  return get('/api/v1/app/user/referral/invitees', { ...params });
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
