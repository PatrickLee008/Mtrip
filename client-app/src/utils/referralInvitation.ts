import { Platform } from 'react-native';

import { REFERRAL_LINK_BASE } from '@/config/env';

/** Only referral codes are accepted from the URL; no redirect or account binding is trusted. */
export function parseReferralInvitation(url: string): string | null {
  const base = REFERRAL_LINK_BASE.replace(/\/+$/, '');
  const prefix = url.startsWith('/') ? base.replace(/^https?:\/\/[^/]+/i, '') + '/' : base + '/';
  const address = url.split(/[?#]/, 1)[0];
  if (!address.startsWith(prefix)) return null;
  const match = /^([a-z0-9]{4,32})\/?$/i.exec(address.slice(prefix.length));
  return match ? match[1].toUpperCase() : null;
}

export function referralLink(code: string): string {
  return `${REFERRAL_LINK_BASE.replace(/\/+$/, '')}/${encodeURIComponent(code)}`;
}

export function referralCodeFromInstall(referrer: string): string | null {
  const matches = referrer.split('&').filter((part) => part.startsWith('mtrip_referral='));
  const code = matches.length === 1 ? matches[0].slice('mtrip_referral='.length) : '';
  return /^[a-z0-9]{4,32}$/i.test(code) ? code.toUpperCase() : null;
}

export function referralPlayStoreUrl(code: string): string {
  const base = 'https://play.google.com/store/apps/details?id=com.mtrip.clientapp';
  return base + '&referrer=' + encodeURIComponent('mtrip_referral=' + code);
}

let invitation: string | null = null;

export function captureReferralInvitation(url?: string): string | null {
  const address = url ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : '');
  const code = address ? parseReferralInvitation(address) : null;
  if (code) invitation = code;
  return code;
}

export function getReferralInvitation(): string | null {
  return invitation;
}

/** A successful login never attaches an invitation to an existing account. */
export function clearReferralInvitation(): void {
  invitation = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined'
    && parseReferralInvitation(window.location.pathname)) {
    window.history.replaceState(null, '', '/');
  }
}
