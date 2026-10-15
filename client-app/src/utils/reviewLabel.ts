/**
 * 酒店评分档位(Consumer App PRD 模块 11「Hotel Rating Score & Label Criteria」,10 分制)
 *
 *   9.0–10.0 Exceptional / 8.0–8.9 Excellent / 7.0–7.9 Very Good / 6.0–6.9 Good / 5.0–5.9 Average
 *   4.0–4.9 Below Average / 3.0–3.9 Poor / 2.0–2.9 Very Poor / 1.0–1.9 Terrible
 *
 * 档位按「展示出来的一位小数」判:8.96 展示为 9.0 就是 Exceptional。没有评分(0)返回 null,
 * 调用方显示「New · No reviews yet」或不画。文案键见 `hotels.reviewLabel.*`。
 */

export type ReviewLabelKey =
  | 'exceptional'
  | 'excellent'
  | 'veryGood'
  | 'good'
  | 'average'
  | 'belowAverage'
  | 'poor'
  | 'veryPoor'
  | 'terrible';

const TIERS: readonly { from: number; key: ReviewLabelKey }[] = [
  { from: 9, key: 'exceptional' },
  { from: 8, key: 'excellent' },
  { from: 7, key: 'veryGood' },
  { from: 6, key: 'good' },
  { from: 5, key: 'average' },
  { from: 4, key: 'belowAverage' },
  { from: 3, key: 'poor' },
  { from: 2, key: 'veryPoor' },
  { from: 0, key: 'terrible' },
];

export function reviewLabelKey(score10: number): ReviewLabelKey | null {
  if (!Number.isFinite(score10) || score10 <= 0) return null;
  const shown = Math.round(score10 * 10) / 10;
  return TIERS.find((tier) => shown >= tier.from)?.key ?? 'terrible';
}
