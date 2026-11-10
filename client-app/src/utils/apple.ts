import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config/env';

export const APPLE_COMPLETE_PATH = '/auth/apple/complete';

export function isAppleCompletion(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && window.location.pathname === APPLE_COMPLETE_PATH;
}

export function canUseAppleWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || window.location.protocol !== 'https:') return false;
  return new URL(API_BASE_URL || '/', window.location.origin).origin === window.location.origin;
}

// Read once at application startup, before rendering or API traffic. Never persist the ticket.
let completion: { ticket: string; error: string } | undefined;
export function captureAppleCompletion(): void {
  if (!isAppleCompletion() || completion) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  completion = { ticket: params.get('ticket') ?? '', error: params.get('error') ?? '' };
  window.history.replaceState(null, '', APPLE_COMPLETE_PATH);
}

export function takeAppleCompletion() {
  const result = completion ?? { ticket: '', error: 'expired' };
  completion = undefined;
  return result;
}

export function clearApplePath(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', '/');
}
