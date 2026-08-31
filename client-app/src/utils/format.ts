/**
 * 格式化工具:多币种金额 / 时间 / 脱敏(GDPR)
 */

import { CURRENCY_SYMBOLS, ZERO_DECIMAL_CURRENCIES } from '@/config/global';

/** 多币种价格:formatMoney(1234.5, 'EUR') => €1,234.50;零小数币种 => MMK 185,000 */
export function formatMoney(amount: number | string, currency = 'EUR'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '-';
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const digits = ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
  const [int, dec] = value.toFixed(digits).split('.');
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${symbol}${withComma}.${dec}` : `${symbol}${withComma}`;
}

/**
 * 只要数字部分的金额(千分位,币种小数位规则同 formatMoney)
 * 用于设计稿把币种码与数字分开排版的地方(如「更多」页的钱包卡:MMK / 250,000)
 */
export function formatAmount(amount: number | string, currency = 'EUR'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '-';
  const digits = ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
  const [int, dec] = value.toFixed(digits).split('.');
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${withComma}.${dec}` : withComma;
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
