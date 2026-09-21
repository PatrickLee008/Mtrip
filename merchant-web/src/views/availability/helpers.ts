import type { AvailabilityDay } from '@/api/availability';

/**
 * 单元格状态。判定顺序必须与后端 `AvailabilityController::summary()` 一致:
 * 已屏蔽(is_closed=1)→ 售罄(stockLeft=0)→ 低库存(<= 阈值)→ 可售。
 */
export type CellState = 'available' | 'low' | 'sold' | 'blocked';

/** 后端 summary() 用的是硬编码 `stockLeft <= 2`,此处保持同值 */
export const LOW_STOCK_THRESHOLD = 2;

export function cellState(day: AvailabilityDay): CellState {
  if (day.isClosed === 1) return 'blocked';
  if (day.stockLeft <= 0) return 'sold';
  if (day.stockLeft <= LOW_STOCK_THRESHOLD) return 'low';
  return 'available';
}

/**
 * 稿面价格写法 `MMK 85K`:≥1000 折成 K 且不留尾随 `.0`(85000 → `85K`,8500 → `8.5K`),
 * 不足 1000 直出整数。
 */
export function priceShort(price: number): string {
  if (!Number.isFinite(price)) return '-';
  if (Math.abs(price) < 1000) return String(Math.round(price));
  const k = price / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
}
