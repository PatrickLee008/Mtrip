import { post } from '@/api/request';
import type { AuthResult } from '@/types/models';

export interface FacebookSettings {
  termsUrl: string;
  privacyUrl: string;
  consentVersion: string;
}

export function facebookSettings(): Promise<FacebookSettings> {
  return post('/api/v1/app/auth/facebook/settings', {}, { silent: true });
}

export function facebookStart(consentVersion: string, returnTo: 'home' | 'more') {
  return post<{ authorizationUrl: string }>('/api/v1/app/auth/facebook/start', { consentVersion, returnTo }, { silent: true });
}

export function facebookExchange(ticket: string) {
  return post<AuthResult & { isNewUser: boolean; returnTo: 'home' | 'more' }>(
    '/api/v1/app/auth/facebook/exchange', { ticket }, { silent: true },
  );
}
