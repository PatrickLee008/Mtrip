import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 订单列表行(后端 order_main snake_case 直出) */
export interface MerchantOrder {
  id: number;
  order_no: string;
  order_type: number;
  goods_name: string;
  merchant_id: number;
  contact_name: string;
  contact_phone: string;
  pay_amount: string | number;
  order_status: number;
  verify_code: string;
  use_date: string | null;
  created_at: string;
}

export function apiOrderList(params: Record<string, unknown>): Promise<PageData<MerchantOrder>> {
  return get('/merchant/order/list', params);
}

export function apiOrderDetail(id: number): Promise<{ order: Record<string, unknown>; verifyLogs: Record<string, unknown>[] }> {
  return get('/merchant/order/detail', { id });
}

/** 手工核销:按订单ID或核销码 */
export function apiOrderVerify(payload: { id?: number; verifyCode?: string }): Promise<{ orderId: number }> {
  return post('/merchant/order/verify', payload);
}
