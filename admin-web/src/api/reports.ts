import { get } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 自定义报表(Super Admin Portal 模块 10,order-service /api/v1/admin/order/stats/custom) */
type Row = Record<string, any>;

export function apiCustomReport(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/stats/custom', params);
}
