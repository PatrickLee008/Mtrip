import { get, post, request } from '@/utils/http';
import { encryptPayload, LOGIN_AES_KEY } from '@/utils/crypto';
import type { MerchantBusiness, MerchantProfile, MenuNode } from '@/api/types';

export interface ChallengeResult { challengeToken: string; requiresEnrollment: boolean; expiresIn: number }
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
  businesses: MerchantBusiness[];
}

export function apiLogin(username: string, password: string): Promise<ChallengeResult> {
  if (!LOGIN_AES_KEY) return post('/merchant/auth/login', { username, password });
  return request({ method: 'POST', url: '/merchant/auth/login', data: { payload: encryptPayload({ username, password }, LOGIN_AES_KEY) }, headers: { 'X-Encrypted': '1' } });
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
