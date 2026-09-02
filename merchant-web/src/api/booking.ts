import axios from 'axios';
import { get, post } from '@/utils/http';
import { getToken } from '@/utils/auth';
import type { PageData } from '@/api/types';

/** 酒店预订管理 API(实现方案-Merchant-M4 §7.2;后端 order_main snake_case 直出) */

export interface BookingStats {
  all: number;
  pending: number;
  confirmed: number;
  pendingCheckin: number;
  inhouse: number;
  checkedOut: number;
  cancelled: number;
  noShow: number;
  arrivalsToday: number;
  departuresToday: number;
}

/** 列表行(order_main 精选列) */
export interface BookingRow {
  id: number;
  order_no: string;
  contact_name: string;
  contact_phone: string;
  goods_id: number;
  goods_name: string;
  sku_id: number;
  sku_name: string;
  quantity: number;
  unit_price: string | number;
  pay_amount: string | number;
  use_date: string | null;
  end_date: string | null;
  booking_status: number;
  payment_status: number;
  booking_channel: string;
  channel_reference: string;
  assigned_room_no: string;
  payment_expires_at: string | null;
  created_at: string;
}

export interface BookingRefundRow {
  id: number;
  refund_no: string;
  refund_amount: string | number;
  reason: string;
  status: number;
  refund_time: string | null;
}

export interface BookingNote {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  edit_history: { at: string; prev: string }[];
}

export interface BookingDetail {
  order: BookingRow & Record<string, any>;
  nights: number;
  payment: {
    totalAmount: string | number;
    discountAmount: string | number;
    payAmount: string | number;
    payMethod: number;
    payTradeNo: string;
    payTime: string | null;
    paymentStatus: number;
    paymentExpiresAt: string | null;
    refunds: BookingRefundRow[];
  };
  stay: {
    useDate: string | null;
    endDate: string | null;
    nights: number;
    quantity: number;
    specialRequests: string;
    mealPlan: string;
    roomNo: string;
    cancellationPolicy: Record<string, any> | null;
    noShowPolicy: Record<string, any> | null;
    noShowDeadline: string | null;
  };
  notes: BookingNote[];
  sync: {
    pms: string;
    channel: string;
    logs: Record<string, any>[];
  };
  availableActions: string[];
}

export interface TimelineEvent {
  id: number;
  event_type: string;
  event_category: string;
  operator_type: number;
  operator_name: string;
  status: number;
  detail: string | null;
  created_at: string;
}

export interface RefundQuote {
  payAmount: number;
  refundable: number;
  cancellationFee: number;
  refundedAlready: number;
  remainingRefundable: number;
}

export interface BookingVoucher {
  orderNo: string;
  goodsName: string;
  skuName: string;
  quantity: number;
  useDate: string | null;
  endDate: string | null;
  guestName: string;
  guestPhone: string;
  payAmount: string | number;
  bookingStatus: number;
  roomNo: string;
  verifyCode: string;
  issuedAt: string;
}

export function apiBookingStats(): Promise<BookingStats> {
  return get('/merchant/order/booking-stats');
}

export function apiBookingList(params: Record<string, unknown>): Promise<PageData<BookingRow>> {
  return get('/merchant/order/list', params);
}

export function apiBookingDetail(id: number): Promise<BookingDetail> {
  return get('/merchant/order/detail', { id });
}

export function apiBookingTimeline(id: number, page = 1, pageSize = 20): Promise<PageData<TimelineEvent>> {
  return get('/merchant/order/timeline', { id, page, pageSize });
}

export function apiBookingConfirm(id: number): Promise<null> {
  return post('/merchant/order/confirm', { id });
}

export function apiBookingCheckIn(id: number, roomNo = ''): Promise<null> {
  return post('/merchant/order/check-in', { id, roomNo });
}

export function apiBookingCheckOut(id: number): Promise<null> {
  return post('/merchant/order/check-out', { id });
}

export function apiBookingCancel(id: number, reason: string): Promise<null> {
  return post('/merchant/order/cancel', { id, reason });
}

export function apiBookingNoShow(id: number, waiveFee: boolean, waiveReason: string): Promise<null> {
  return post('/merchant/order/no-show', { id, waiveFee: waiveFee ? 1 : 0, waiveReason });
}

export function apiRefundQuote(id: number): Promise<RefundQuote> {
  return get('/merchant/order/refund/quote', { id });
}

export function apiRefundApply(id: number, amount: number | null, reason: string): Promise<{ refundNo: string; refundAmount: number }> {
  return post('/merchant/order/refund/apply', { id, amount, reason });
}

export function apiNoteAdd(id: number, content: string): Promise<null> {
  return post('/merchant/order/note', { id, content });
}

export function apiBookingSync(id: number, target: 'pms' | 'channel' = 'pms'): Promise<{ taskId: number; status: string }> {
  return post('/merchant/order/sync', { id, target });
}

/** 明文联系方式(独立权限;后端写审计) */
export function apiGuestContact(id: number): Promise<{ phone: string; name: string }> {
  return get('/merchant/order/guest-contact', { id });
}

export function apiBookingVoucher(id: number): Promise<BookingVoucher> {
  return get('/merchant/order/voucher', { id });
}

// ---------- 住客消息(实现方案 M4 §9.2,权限键 mch:order:message) ----------

export interface GuestChatMessage {
  id: number;
  site_id: number;
  conversation_id: number;
  sender_type: number; // 1住客 2酒店(商户) 3机器人
  content: string;
  msg_type: number;
  created_at: string;
}

export interface GuestThread {
  conversationId: number;
  title: string;
  status: number; // 0进行中 1已结束
  guestName: string;
  messages: GuestChatMessage[];
}

export function apiGuestThread(id: number): Promise<GuestThread> {
  return get('/merchant/order/guest-thread', { id });
}

export function apiGuestMessage(id: number, content: string): Promise<{ messageId: number }> {
  return post('/merchant/order/guest-message', { id, content });
}

/** 导出 CSV(二进制流,不走统一 JSON 解包) */
export async function downloadBookingCsv(params: Record<string, unknown>): Promise<void> {
  const response = await axios.get(`${import.meta.env.VITE_API_BASE}/merchant/order/export`, {
    params,
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  const disposition = (response.headers['content-disposition'] ?? '') as string;
  const match = /filename=([^;]+)/.exec(disposition);
  const filename = match ? match[1].trim() : `bookings-${Date.now()}.csv`;
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
