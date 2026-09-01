/**
 * 订房流程的日期 / 晚数文案助手
 *
 * 设计稿里同一个日期有四种写法:
 *   「Thu, 4 Jun」摘要条与复核卡 /「4 Jun」支付页汇总 /「Thu, 4 Jun 2025」成功页 /「Jun 2, 2024」取消政策
 * 都走 `toLocaleDateString` 跟随当前语言,不硬写英文月份(同日期选择器的既有做法)。
 *
 * 晚数不走 i18next 的复数机制 —— 本仓库既有约定是避开保留字 `count`,
 * 所以用 `nights.one` / `nights.many` 两个显式键(见 `hotels.booking.nights`)。
 */

import type { TFunction } from 'i18next';

/** `YYYY-MM-DD` → Date(本地时区,避免 UTC 解析导致差一天) */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 「Thu, 4 Jun」 */
export function formatWeekdayDate(key: string, locale: string): string {
  return parseDateKey(key).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** 「4 Jun」 */
export function formatDayMonth(key: string, locale: string): string {
  return parseDateKey(key).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** 「Thu, 4 Jun 2025」 */
export function formatWeekdayDateYear(key: string, locale: string): string {
  return parseDateKey(key).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** 「Jun 2, 2024」(取消政策里的最后免费取消日) */
export function formatMonthDayYear(key: string, locale: string): string {
  return parseDateKey(key).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 两个日期键之间的晚数 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const ms = parseDateKey(checkOut).getTime() - parseDateKey(checkIn).getTime();
  return Math.max(Math.round(ms / 86_400_000), 0);
}

/** 「1 Night」/「2 Nights」 */
export function nightsLabel(t: TFunction, nights: number): string {
  return nights === 1 ? t('hotels.booking.nights.one') : t('hotels.booking.nights.many', { nights });
}

/** 「1 night」/「2 nights」(价格明细行里小写) */
export function nightsLowerLabel(t: TFunction, nights: number): string {
  return nights === 1
    ? t('hotels.booking.nightsLower.one')
    : t('hotels.booking.nightsLower.many', { nights });
}

/** 免费取消截止日 = 入住日前两天(设计稿写死 Jun 2 对 Jun 4 入住,即 -2 天) */
export function freeCancelDeadline(checkIn: string): string {
  const d = parseDateKey(checkIn);
  d.setDate(d.getDate() - 2);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
