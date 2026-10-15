/**
 * 评价分项(维度条)的取数口径:四处宿主共用(详情页 / 评价整页 / 两个关怀模式页)
 *
 * 后端 `/app/hotels/detail` 的 `reviewSummary.dimensions` 下发住客对「清洁度 / 位置 / 服务 / 设施」的平均分
 * (1-5,只算打了分的评价;某项没人评是 null)。
 *   - 传 `undefined`  = 演示酒店(没有真实详情)→ 回落到设计稿的四条演示数值,与页面其余部分的兜底口径一致;
 *   - 传对象(含空对象)= 真实酒店 → 只画有评分的维度,一条都没有就返回空数组,调用方整块不画,
 *     **不拿设计稿的假数字顶替真实酒店**。
 */

import { DETAIL_REVIEW_SCORES } from '@/screens/hotel/detailDemo';

export const REVIEW_DIMENSION_KEYS = ['cleanliness', 'location', 'service', 'amenities'] as const;
export type ReviewDimensionKey = (typeof REVIEW_DIMENSION_KEYS)[number];
export type ReviewDimensions = Partial<Record<ReviewDimensionKey, number | null>>;

export interface DimensionRow {
  key: string;
  score: number;
}

export function dimensionRows(dimensions?: ReviewDimensions | null): readonly DimensionRow[] {
  if (!dimensions) return DETAIL_REVIEW_SCORES;
  const rows: DimensionRow[] = [];
  for (const key of REVIEW_DIMENSION_KEYS) {
    const score = dimensions[key];
    if (typeof score === 'number' && Number.isFinite(score) && score > 0) rows.push({ key, score });
  }
  return rows;
}
