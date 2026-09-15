import { get, post, request } from '@/utils/http';
import { encryptPayload, LOGIN_AES_KEY } from '@/utils/crypto';
import type { MerchantProperty, MerchantProfile, MenuNode } from '@/api/types';

export interface ChallengeResult { challengeToken: string; requiresEnrollment: boolean; expiresIn: number }
export type LoginMethod = 'access_code' | 'email' | 'sms' | 'google';
export interface AuthConfig {
  testMode?: boolean;
  methods: LoginMethod[];
  googleAvailable: boolean;
  otpExpiresIn: number;
  resendAfter: number;
  maxAttempts: number;
  biometricAvailableOnWeb: boolean;
}
export interface AuthChallengeResult {
  testMode?: boolean;
  challengeToken: string;
  method: LoginMethod;
  verification: 'totp' | 'mtrip_otp';
  recipient: string;
  expiresIn: number;
  resendAfter?: number;
}
export interface ActivationProfile {
  accountId: number;
  merchantId: number;
  username: string;
  email: string;
  mobile: string;
  otpVerified: boolean;
  activated: boolean;
  methods: { email: boolean; sms: boolean; google: boolean; accessCode: boolean };
}
export interface ActivationStartResult { activationToken: string; expiresIn: number; profile: ActivationProfile }
export interface ActivationVerifyResult extends ActivationStartResult {}
export interface RecoveryVerifyResult { recoveryToken: string; expiresIn: number }
export interface SetupResult { manualKey: string; otpauthUri: string }
export function apiTwoFaSetup(challengeToken: string): Promise<SetupResult> { return post('/merchant/auth/2fa/setup', { challengeToken }); }
export function apiTwoFaVerify(challengeToken: string, twoFaCode: string): Promise<LoginResult> { return post('/merchant/auth/2fa/verify', { challengeToken, twoFaCode }); }
export function apiSupportExchange(exchangeCode: string): Promise<LoginResult> { return post('/merchant/auth/impersonation/exchange', { exchangeCode }); }

export interface LoginResult {
  token: string;
  admin: MerchantProfile;
}

export interface MenusResult {
  menus: MenuNode[];
  perms: string[];
  businesses: MerchantProperty[];
}

export function apiLogin(username: string, password: string): Promise<ChallengeResult> {
  if (!LOGIN_AES_KEY) return post('/merchant/auth/login', { username, password });
  return request({ method: 'POST', url: '/merchant/auth/login', data: { payload: encryptPayload({ username, password }, LOGIN_AES_KEY) }, headers: { 'X-Encrypted': '1' } });
}

function securePost<T>(url: string, data: Record<string, unknown>): Promise<T> {
  if (!LOGIN_AES_KEY) return post<T>(url, data);
  return request<T>({ method: 'POST', url, data: { payload: encryptPayload(data, LOGIN_AES_KEY) }, headers: { 'X-Encrypted': '1' } });
}

export function apiAuthConfig(): Promise<AuthConfig> { return get('/merchant/auth/config'); }
export function apiAuthChallenge(data: { method: LoginMethod; identifier?: string; googleIdToken?: string }): Promise<AuthChallengeResult> {
  return securePost('/merchant/auth/challenge', data);
}
export function apiAuthChallengeVerify(method: LoginMethod, challengeToken: string, otpCode: string): Promise<LoginResult> {
  return securePost('/merchant/auth/challenge/verify', { method, challengeToken, otpCode });
}
export function apiActivationStart(data: { accessCode?: string; username?: string; temporaryPassword?: string }): Promise<ActivationStartResult> {
  return securePost('/merchant/activation/start', data);
}
export function apiActivationProfile(activationToken: string): Promise<ActivationProfile> {
  return get('/merchant/activation/profile', { activationToken });
}
export function apiActivationOtpSend(activationToken: string, channel: 'email' | 'sms'): Promise<AuthChallengeResult> {
  return securePost('/merchant/activation/otp-send', { activationToken, channel });
}
export function apiActivationOtpVerify(challengeToken: string, otpCode: string): Promise<ActivationVerifyResult> {
  return securePost('/merchant/activation/otp-verify', { challengeToken, otpCode });
}
export function apiActivationTotpSetup(activationToken: string): Promise<SetupResult> {
  return securePost('/merchant/activation/totp/setup', { activationToken });
}
export function apiActivationTotpVerify(activationToken: string, twoFaCode: string): Promise<ActivationProfile> {
  return securePost('/merchant/activation/totp/verify', { activationToken, twoFaCode });
}
export function apiActivationGoogleLink(activationToken: string, googleIdToken: string): Promise<ActivationProfile> {
  return securePost('/merchant/activation/google-link', { activationToken, googleIdToken });
}
export function apiActivationFinish(activationToken: string): Promise<LoginResult> {
  return securePost('/merchant/activation/finish', { activationToken });
}
export function apiRecoveryChallenge(method: 'email' | 'sms', identifier: string): Promise<AuthChallengeResult> {
  return securePost('/merchant/auth/recovery/challenge', { method, identifier });
}
export function apiRecoveryVerify(challengeToken: string, otpCode: string): Promise<RecoveryVerifyResult> {
  return securePost('/merchant/auth/recovery/verify', { challengeToken, otpCode });
}
export function apiRecoveryTotpSetup(recoveryToken: string): Promise<SetupResult> {
  return securePost('/merchant/auth/recovery/totp/setup', { recoveryToken });
}
export function apiRecoveryTotpVerify(recoveryToken: string, twoFaCode: string): Promise<LoginResult> {
  return securePost('/merchant/auth/recovery/totp/verify', { recoveryToken, twoFaCode });
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
