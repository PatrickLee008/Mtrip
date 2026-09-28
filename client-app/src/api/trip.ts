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
import { API_CODE, type PageData, type PageParams } from '@/api/types';

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

/**
 * 创建 Trip(10 分钟内需支付);`items` 每项都要带入离日期与联系人。
 * `expectedPayAmount` = 用户看到的应付(金额确认),与服务端计价不一致时不建单并抛
 * `API_CODE.PRICE_CHANGED`(不自动 Toast,调用方弹确认框)。
 */
export function apiTripCreate(params: {
  items: TripCreateItem[];
  couponId?: number;
  expectedPayAmount?: number;
}): Promise<TripCreateResult> {
  return post<TripCreateResult>('/api/v1/app/order/trip/create', params, {
    silentCodes: [API_CODE.PRICE_CHANGED],
  });
}

/** 试算入参:与 `TripCreateItem` 相同,但此时还没有联系人 */
export type TripQuoteItem = Omit<TripCreateItem, 'contactName' | 'contactPhone' | 'remark'>;

/** 试算结果的一行(与 `items` 下标一一对应) */
export interface TripQuoteLine {
  propertyId: number;
  roomTypeId: number;
  quantity: number;
  nights: number;
  original: number;
  longstayDiscount: number;
  /** 整单券按净额占比分摊到本行的金额 */
  couponDiscount: number;
  payAmount: number;
}

export interface TripQuoteResult {
  /** 日历价合计(已按公民价/各晚价格算) */
  original: number;
  longstayDiscount: number;
  /** 实际生效的领券记录 id;券不可用时为 0 */
  couponId: number;
  couponDiscount: number;
  /** 券不可用的原因(与下单时会报的错一致);可用为 null */
  couponError: string | null;
  payAmount: number;
  items: TripQuoteLine[];
}

/**
 * 只读试算(`trip/quote`):与 `trip/create` 同一套取价/长住/券/分摊代码,不占库存、不建单。
 * 复核页与支付页的金额一律以它为准 —— 前端不自己算钱。售罄/库存不足会直接报错。
 *
 * **静默**:改日期/间数/换券都会重算,报错若自动 Toast 会连弹;失败时调用方退回预估值,
 * 真正的错误留给提交时的 `trip/create` 报出来(两者同一套校验)。
 */
export function apiTripQuote(params: {
  items: TripQuoteItem[];
  couponId?: number;
}): Promise<TripQuoteResult> {
  return post<TripQuoteResult>('/api/v1/app/order/trip/quote', params, { silent: true });
}

/** 支付整个 Trip;返回各预订的核销码 */
export function apiTripPay(params: {
  tripId: number;
  /** 1 Stripe / 2 PayPal / 3 余额 */
  payMethod: number;
}): Promise<{ codes: { orderNo: string; verifyCode: string }[] }> {
  return post('/api/v1/app/order/trip/pay', params);
}

/**
 * Trip 详情里的一条预订(`order_main` 的子集)。
 * `property_id` / `room_type_id` 是订单详情页拿来去 `/hotels/detail` 取封面与房型属性用的
 * (订单快照里没有人数/床型/含早)。
 */
export interface TripBookingRow {
  id: number;
  order_no: string;
  property_id: number;
  room_type_id: number;
  goods_name: string;
  goods_image: string;
  sku_name: string;
  quantity: number;
  pay_amount: string;
  order_status: number;
  refund_status: number;
  use_date: string | null;
  end_date: string | null;
  /** 支付截止时间(待支付单才有值);结果页据此倒计时 */
  payment_expires_at?: string | null;
}

export interface TripDetailResult {
  id: number;
  trip_no: string;
  total_amount: string;
  coupon_discount: string;
  pay_amount: string;
  booking_count: number;
  pay_status: number;
  created_at: string;
  /** 后端按入住日 + id 排序返回(对应 PRD 的 Trip Timeline) */
  bookings: TripBookingRow[];
}

export function fetchTripDetail(tripId: number): Promise<TripDetailResult> {
  return get<TripDetailResult>('/api/v1/app/order/trip/detail', { tripId });
}

export function fetchTripList(params: PageParams): Promise<PageData<Record<string, unknown>>> {
  return get('/api/v1/app/order/trip/list', { ...params });
}
