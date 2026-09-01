/**
 * 订单接口(order-service /api/v1/app/order/*,需登录)
 */

import { get, post } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';
import type { OrderDetail, OrderItemData, VerifyCodeData } from '@/types/models';

export interface OrderTraveler {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface CreateOrderParams {
  goodsId: number;
  /** 酒店=hotel_room_type.id,门票=ticket_type.id */
  skuId: number;
  /** 酒店即间数,后端限制 1-10 */
  quantity: number;
  /** 入住日,不能早于今天(后端校验) */
  useDate: string;
  /** 酒店必填(离店日期) */
  endDate?: string;
  contactName: string;
  contactPhone: string;
  remark?: string;
  /** 1=按缅甸公民价 */
  isCitizen?: number;
  couponId?: number;
  /** 入住人,后端 PricingService::normalizeGuests 只取 firstName/lastName/phone/email 四个字段 */
  travelers?: OrderTraveler[];
  [key: string]: unknown;
}

export interface CreateOrderResult {
  orderId: number;
  orderNo: string;
  priceDetail: {
    original: number;
    longstayDiscount: number;
    couponDiscount: number;
    payAmount: number;
  };
}

export function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  return post('/api/v1/app/order/create', params);
}

/**
 * 支付。后端 `OrderController::pay` **本来就是 mock** —— 直接置为已支付、扣库存、发确认通知,
 * 流水号写成 `MOCK...`,没有接真实渠道。所以「点支付即成功」不需要前端造假。
 * payMethod:1 / 2(后端白名单),当前订房向导统一传 1。
 */
export function payOrder(orderId: number, payMethod = 1): Promise<{ verifyCode: string }> {
  return post('/api/v1/app/order/pay', { orderId, payMethod });
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
