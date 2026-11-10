import { post } from '@/api/request';
import type { AuthResult } from '@/types/models';

export interface AppleSettings {
  termsUrl: string;
  privacyUrl: string;
  consentVersion: string;
}

export function appleSettings(): Promise<AppleSettings> {
  return post('/api/v1/app/auth/apple/settings', {}, { silent: true });
}

export function appleStart(consentVersion: string, returnTo: 'home' | 'more') {
  return post<{ authorizationUrl: string }>('/api/v1/app/auth/apple/start', { consentVersion, returnTo }, { silent: true });
}

export function appleExchange(ticket: string) {
  return post<AuthResult & { isNewUser: boolean; returnTo: 'home' | 'more' }>(
    '/api/v1/app/auth/apple/exchange', { ticket }, { silent: true },
  );
}
