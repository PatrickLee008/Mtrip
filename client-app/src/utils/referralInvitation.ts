import { Platform } from 'react-native';

import { REFERRAL_LINK_BASE } from '@/config/env';

/** Only referral codes are accepted from the URL; no redirect or account binding is trusted. */
export function parseReferralInvitation(url: string): string | null {
  try {
    const path = new URL(url, 'https://m.myanmartrip.com').pathname;
    const match = /^\/r\/([a-z0-9]{4,32})\/?$/i.exec(path);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

export function referralLink(code: string): string {
  return `${REFERRAL_LINK_BASE.replace(/\/+$/, '')}/${encodeURIComponent(code)}`;
}

let invitation: string | null = null;

/** Kept in memory through the onboarding screens; the URL preserves it across reloads. */
export function captureReferralInvitation(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    invitation = parseReferralInvitation(window.location.href);
  }
}

export function getReferralInvitation(): string | null {
  return invitation;
}

/** A successful login never attaches an invitation to an existing account. */
export function clearReferralInvitation(): void {
  invitation = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined'
    && parseReferralInvitation(window.location.href)) {
    window.history.replaceState(null, '', '/');
  }
}
