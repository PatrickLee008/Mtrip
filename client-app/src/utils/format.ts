/**
 * 格式化工具:多币种金额 / 时间 / 脱敏(GDPR)
 */

import { CURRENCY_SYMBOLS } from '@/config/global';

/** 多币种价格:formatMoney(1234.5, 'EUR') => €1,234.50 */
export function formatMoney(amount: number | string, currency = 'EUR'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '-';
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const fixed = value.toFixed(2);
  const [int, dec] = fixed.split('.');
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${withComma}.${dec}`;
}

/** 日期:2026-07-28 或含时间 */
export function formatDate(input?: string | number | Date | null, withTime = false): string {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!withTime) return date;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 手机号脱敏:138****8000(后端已脱敏,此处兜底) */
export function maskMobile(mobile?: string | null): string {
  if (!mobile) return '';
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

/** 邮箱脱敏:a***@x.com */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return email ?? '';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}
