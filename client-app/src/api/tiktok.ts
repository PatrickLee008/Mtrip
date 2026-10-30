import { post } from '@/api/request';
import type { AuthResult } from '@/types/models';

export interface TikTokSettings {
  termsUrl: string;
  privacyUrl: string;
  consentVersion: string;
}

export function tiktokSettings(): Promise<TikTokSettings> {
  return post('/api/v1/app/auth/tiktok/settings', {}, { silent: true });
}

export function tiktokStart(consentVersion: string, returnTo: 'home' | 'more') {
  return post<{ authorizationUrl: string }>('/api/v1/app/auth/tiktok/start', { consentVersion, returnTo }, { silent: true });
}

export function tiktokExchange(ticket: string) {
  return post<AuthResult & { isNewUser: boolean; returnTo: 'home' | 'more' }>(
    '/api/v1/app/auth/tiktok/exchange', { ticket }, { silent: true },
  );
}
