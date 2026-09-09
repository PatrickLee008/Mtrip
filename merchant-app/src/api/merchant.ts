import { get, post, postEncrypted } from '@/api/request';
import type { ChallengeResult, LoginResult, MenusResult, MerchantProfile, TwoFaSetupResult } from '@/api/types';

export function apiLogin(username: string, password: string): Promise<ChallengeResult> {
  return postEncrypted('/auth/login', { username, password });
}

export function apiTwoFaSetup(challengeToken: string): Promise<TwoFaSetupResult> {
  return post('/auth/2fa/setup', { challengeToken });
}

export function apiTwoFaVerify(challengeToken: string, twoFaCode: string): Promise<LoginResult> {
  return post('/auth/2fa/verify', { challengeToken, twoFaCode });
}

export function apiLogout(): Promise<null> {
  return post<null>('/auth/logout');
}

export function apiMe(): Promise<MerchantProfile> {
  return get<MerchantProfile>('/auth/me');
}

export function apiMenus(): Promise<MenusResult> {
  return get<MenusResult>('/auth/menus');
}
