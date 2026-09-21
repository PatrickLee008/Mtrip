/**
 * 多房间 / 多住宿预订(order-service `/api/v1/app/order/trip/*`)
 *
 * 一个 Trip = 1~10 个酒店预订,**同一家酒店的不同房型也算多个预订**,正好对应房型购物车。
 * 与单房型的 `order/create` + `order/pay` 是两条独立链路:Trip 整单一次支付、券只消耗一次。
 *
 * `trip/pay` 支持 1 Stripe / 2 PayPal(均 mock)/ 3 余额。余额是**整单扣一次**
 * (按 `order_trip.pay_amount`),不是逐个预订各扣一次 —— 否则同一笔钱会被拆成多条流水,
 * 且中途余额不足会只成功一半。余额不足后端抛错,整个事务回滚。
 */

import { get, post } from '@/api/request';
import type { PageData, PageParams } from '@/api/types';

export interface TripCreateItem {
  propertyId: number;
  roomTypeId: number;
  /** 间数 1~10 */
  quantity: number;
  /** 入住日 YYYY-MM-DD */
  useDate: string;
  /** 离店日 YYYY-MM-DD */
  endDate: string;
  contactName: string;
  contactPhone: string;
  isCitizen?: number;
  remark?: string;
}

export interface TripBooking {
  orderId: number;
  orderNo: string;
  propertyName: string;
  payAmount: number;
}

export interface TripCreateResult {
  tripId: number;
  tripNo: string;
  totalAmount: number;
  couponDiscount: number;
  payAmount: number;
  bookings: TripBooking[];
}

/** 创建 Trip(15 分钟内需支付);`items` 每项都要带入离日期与联系人 */
export function apiTripCreate(params: {
  items: TripCreateItem[];
  couponId?: number;
}): Promise<TripCreateResult> {
  return post<TripCreateResult>('/api/v1/app/order/trip/create', params);
}

/** 支付整个 Trip;返回各预订的核销码 */
export function apiTripPay(params: {
  tripId: number;
  /** 1 Stripe / 2 PayPal / 3 余额 */
  payMethod: number;
}): Promise<{ codes: { orderNo: string; verifyCode: string }[] }> {
  return post('/api/v1/app/order/trip/pay', params);
}

export function fetchTripDetail(tripId: number): Promise<Record<string, unknown>> {
  return get('/api/v1/app/order/trip/detail', { tripId });
}

export function fetchTripList(params: PageParams): Promise<PageData<Record<string, unknown>>> {
  return get('/api/v1/app/order/trip/list', { ...params });
}
