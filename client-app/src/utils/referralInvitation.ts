import { Platform } from 'react-native';

import { REFERRAL_LINK_BASE } from '@/config/env';

export interface ReferralDestination {
  code: string;
  propertyId?: number;
}

export function parseReferralDestination(url: string): ReferralDestination | null {
  const base = REFERRAL_LINK_BASE.replace(/\/+$/, '');
  const prefix = url.startsWith('/') ? base.replace(/^https?:\/\/[^/]+/i, '') + '/' : base + '/';
  const address = url.split(/[?#]/, 1)[0];
  if (!address.startsWith(prefix)) return null;
  const match = /^([a-z0-9]{4,32})(?:\/hotel\/([1-9][0-9]*))?\/?$/i.exec(address.slice(prefix.length));
  if (!match) return null;
  const code = match[1].toUpperCase();
  if (!match[2]) return { code };
  const propertyId = Number(match[2]);
  return Number.isSafeInteger(propertyId) ? { code, propertyId } : null;
}

export function parseReferralInvitation(url: string): string | null {
  return parseReferralDestination(url)?.code ?? null;
}

export function referralLink(code: string, propertyId?: number): string {
  const path = propertyId ? `/hotel/${propertyId}` : '';
  return `${REFERRAL_LINK_BASE.replace(/\/+$/, '')}/${encodeURIComponent(code)}${path}`;
}

export function referralDestinationFromInstall(referrer: string): ReferralDestination | null {
  const parts = referrer.split('&');
  const codes = parts.filter((part) => part.startsWith('mtrip_referral='));
  const hotels = parts.filter((part) => part.startsWith('mtrip_hotel='));
  if (codes.length !== 1 || hotels.length > 1) return null;
  const code = codes[0].slice('mtrip_referral='.length);
  if (!/^[a-z0-9]{4,32}$/i.test(code)) return null;
  if (hotels.length === 0) return { code: code.toUpperCase() };
  const hotel = hotels[0].slice('mtrip_hotel='.length);
  return /^[1-9][0-9]*$/.test(hotel) ? parseReferralDestination(referralLink(code, Number(hotel))) : null;
}

export function referralCodeFromInstall(referrer: string): string | null {
  return referralDestinationFromInstall(referrer)?.code ?? null;
}

export function referralPlayStoreUrl(code: string, propertyId?: number): string {
  const base = 'https://play.google.com/store/apps/details?id=com.mtrip.clientapp';
  const hotel = propertyId ? `&mtrip_hotel=${propertyId}` : '';
  return base + '&referrer=' + encodeURIComponent('mtrip_referral=' + code + hotel);
}

let invitation: ReferralDestination | null = null;

export function captureReferralInvitation(url?: string): string | null {
  const address = url ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : '');
  const destination = address ? parseReferralDestination(address) : null;
  if (destination) invitation = destination;
  return destination?.code ?? null;
}

export function getReferralInvitation(): string | null {
  return invitation?.code ?? null;
}

export function getReferralDestination(): ReferralDestination | null {
  return invitation;
}

/** A successful login never attaches an invitation to an existing account. */
export function clearReferralInvitation(keepHotelLink = false): void {
  invitation = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const destination = parseReferralDestination(window.location.pathname);
    if (destination && !(keepHotelLink && destination.propertyId)) window.history.replaceState(null, '', '/');
  }
}
