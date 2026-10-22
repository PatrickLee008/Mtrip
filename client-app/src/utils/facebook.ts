import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config/env';

export const FACEBOOK_COMPLETE_PATH = '/auth/facebook/complete';

export function isFacebookCompletion(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && window.location.pathname === FACEBOOK_COMPLETE_PATH;
}

export function canUseFacebookWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || window.location.protocol !== 'https:') return false;
  return new URL(API_BASE_URL || '/', window.location.origin).origin === window.location.origin;
}

// Read once at application startup, before rendering or API traffic. Never persist the ticket.
let completion: { ticket: string; error: string } | undefined;
export function captureFacebookCompletion(): void {
  if (!isFacebookCompletion() || completion) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  completion = { ticket: params.get('ticket') ?? '', error: params.get('error') ?? '' };
  window.history.replaceState(null, '', FACEBOOK_COMPLETE_PATH);
}

export function takeFacebookCompletion() {
  const result = completion ?? { ticket: '', error: 'expired' };
  completion = undefined;
  return result;
}

export function clearFacebookPath(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', '/');
}
