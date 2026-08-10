import { get } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 库存与可用量(Super Admin Portal 模块 04b),复用 goods-service AdminStockController */
type Row = Record<string, any>;

/** 库存总览:按上架商品聚合未来 daysAhead 天库存 */
export function apiInventoryOverview(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/overview', params);
}

/** 库存告警:未来 daysAhead 天内剩余 ≤ threshold 的分时库存 */
export function apiInventoryAlerts(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/low-warning', params);
}

/** 可用量日历:单 SKU(goodsId+skuId)的分日库存价格 */
export function apiInventoryCalendar(params: Record<string, unknown>): Promise<{
  goodsId: number; skuType: number; skuId: number; basePrice: number; baseStock: number;
  days: Row[];
}> {
  return get('/admin/goods/stock/calendar', params);
}

/** 库存变动流水(时间线) */
export function apiInventoryLogs(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/logs', params);
}
