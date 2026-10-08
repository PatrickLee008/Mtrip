import type { BookingOrder, MerchantProfile, PaymentFilter } from '@/api/types';

export function hasBookingPermission(profile: MerchantProfile | null, action: string): boolean {
  return !!profile && (profile.isOwner || profile.permissions.includes(`mch:order:${action}`));
}
export function paymentLabel(order: Pick<BookingOrder, 'payment_status' | 'pay_method'>): PaymentFilter | 'unknown' {
  const status = Number(order.payment_status);
  if (Number(order.pay_method) === 4 && (status === 1 || status === 5)) return 'hotel';
  return ({ 1: 'unpaid', 2: 'paid', 3: 'partial', 4: 'refunded', 5: 'failed' } as Record<number, PaymentFilter>)[status] || 'unknown';
}
export function bookingNights(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const value = (Date.parse(end.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 86400000;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
export function bookingDate(raw: string | null, language: string, compact = false): string {
  if (!raw) return '--';
  const date = new Date(`${raw.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', ...(compact ? {} : { year: 'numeric' as const }), timeZone: 'UTC' }).format(date);
}
export function bookingMoney(value: number | string, currency: string, language: string): string {
  return `${currency || ''} ${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(Number(value))}`.trim();
}
export function remainingSeconds(expires: string | null, now: number): number | null {
  if (!expires) return null;
  const time = Date.parse(expires);
  return Number.isFinite(time) ? Math.max(0, Math.ceil((time - now) / 1000)) : null;
}
