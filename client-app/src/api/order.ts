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
  /** 酒店订单使用物业与房型主键 */
  propertyId?: number;
  roomTypeId?: number;
  /** 门票订单保持商品与票种主键 */
  goodsId?: number;
  skuId?: number;
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

/** 支付统一在 `@/api/pay`(唯一一份 payOrder,当前只走余额),这里转出方便订单相关的集中引入 */
export { PAY_METHOD, payOrder, type PayMethod } from '@/api/pay';

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

/**
 * 取消/退款试算(PRD 模块 11:结账不收平台费,**取消时才从可退额里扣**)。
 * 取消页的「Cancellation Fee / Refund Amount / 退款去向」三处数字全部来自它,前端不自己算。
 * 仅「已支付且未使用」的订单可试算,其余后端直接拒。
 */
export interface RefundQuote {
  payAmount: number;
  /** 按退改规则可退的部分(未扣平台费) */
  refundable: number;
  /** 稿面「Cancellation Fee」= payAmount − refundable */
  cancellationFee: number;
  platformFee: number;
  /** 实际到账 = refundable − platformFee */
  refundAmount: number;
  /** 1 = mTrip 钱包(目前只有这一种) */
  refundChannel: number;
  refundChannelText: string;
}

export function fetchRefundQuote(orderId: number): Promise<RefundQuote> {
  return get<RefundQuote>('/api/v1/app/order/refund/quote', { orderId });
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
