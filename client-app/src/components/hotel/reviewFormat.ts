/**
 * 住客评价的取值口径(完整模式 `HotelReviewCard` 与关怀模式 `HotelReviewsLiteScreen` 共用,
 * 两种模式对同一条评价的昵称/日期/分数必须显示一致)。
 */

import type { TFunction } from 'i18next';

import type { HotelReview } from '@/api/goods';

/**
 * 后端 `HotelController::reviews` 在 `nickname` 为空时会填这个中文字面量。
 * 它是服务端的兜底值、不是用户昵称,直接显示会让英文/缅文界面冒出一句中文,
 * 所以客户端把它当成「没有昵称」,换成 i18n 文案。
 */
const BACKEND_ANON_NICKNAME = '匿名用户';

/** 10 分制下达到这个分数才贴「Excellent」(与评价总览卡同一阈值) */
export const EXCELLENT_FROM_SCORE = 8;

export function reviewNickname(review: HotelReview, t: TFunction): string {
  const raw = typeof review.nickname === 'string' ? review.nickname.trim() : '';
  return raw === '' || raw === BACKEND_ANON_NICKNAME ? t('hotels.reviewsPage.anonymous') : raw;
}

/** 后端 `created_at` 是 `YYYY-MM-DD HH:mm:ss`,Hermes 对带空格的写法不保证能解析 */
function parseCreatedAt(value: string): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 稿面「August 14, 2024」;解析不出来返回空串,由调用方决定整行不渲染 */
export function formatReviewDate(value: string, locale: string): string {
  const date = parseCreatedAt(value);
  if (!date) return '';
  return date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** 1-5 分制 → 稿面的 10 分制;脏值按 0 处理,不产生 NaN */
export function toTenPointScore(rating: number): string {
  const value = Number(rating);
  return (Number.isFinite(value) && value > 0 ? value * 2 : 0).toFixed(1);
}
