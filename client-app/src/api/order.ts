/**
 * 订单接口(order-service /api/v1/app/order/*,需登录)
 */

import { get, post } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { OrderDetail, OrderItemData, VerifyCodeData } from '@/types/models';

export interface CreateOrderParams {
  goodsId: number;
  skuId: number;
  quantity: number;
  useDate: string;
  /** 酒店必填(离店日期) */
  endDate?: string;
  contactName: string;
  contactPhone: string;
  remark?: string;
  [key: string]: unknown;
}

export function createOrder(params: CreateOrderParams): Promise<{ orderId: number; orderNo: string }> {
  return post('/api/v1/app/order/create', params);
}

export function fetchOrderList(
  params: PageParams & { status?: number },
): Promise<PageData<OrderItemData>> {
  return get('/api/v1/app/order/list', { ...params });
}

export function fetchOrderDetail(orderId: number): Promise<OrderDetail> {
  return get('/api/v1/app/order/detail', { orderId });
}

export function cancelOrder(orderId: number, reason?: string): Promise<null> {
  return post('/api/v1/app/order/cancel', { orderId, reason });
}

export function applyRefund(params: {
  orderId: number;
  reason: string;
  images?: string[];
}): Promise<{ refundNo: string }> {
  return post('/api/v1/app/order/refund/apply', params);
}

export function fetchVerifyCode(orderId: number): Promise<VerifyCodeData> {
  return get('/api/v1/app/order/verify-code', { orderId });
}
