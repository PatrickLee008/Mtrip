import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 订单/退款/核销管理接口(order-service /api/v1/admin/order/*) */
type Row = Record<string, any>;

// ---------- 订单(文档 6.4.1) ----------
export function apiOrderList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/list', params);
}

/** 详情含退款单与核销日志;超管可见明文手机号 */
export function apiOrderDetail(id: number): Promise<{ order: Row; refunds: Row[]; verifyLogs: Row[] }> {
  return get('/admin/order/detail', { id });
}

/** 按下单日期区间汇总(默认近30天),可选 merchantId */
export function apiOrderStatistics(params: Record<string, unknown>): Promise<Row> {
  return get('/admin/order/statistics', params);
}

/** 改价:仅待支付;payAmount ∈ [0, total_amount],差额记入优惠 */
export function apiOrderModifyPrice(data: { id: number; payAmount: number; reason: string }): Promise<{ payAmount: number }> {
  return post('/admin/order/modify-price', data);
}

/** 取消:仅待支付;释放锁定库存 */
export function apiOrderCancel(data: { id: number; reason: string }): Promise<null> {
  return post('/admin/order/cancel', data);
}

export function apiOrderRemark(data: { id: number; remark: string }): Promise<null> {
  return post('/admin/order/remark', data);
}

// ---------- 退款(双环节:0待商户审核→1待平台审核→2退款中→3已退款;驳回→4;5已撤销) ----------
export function apiRefundList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/refund/list', params);
}

export function apiRefundDetail(id: number): Promise<{ refund: Row; order: Row | null }> {
  return get('/admin/order/refund/detail', { id });
}

/** auditStatus 1通过 2驳回(必填 auditRemark);平台环节通过可核定 refundAmount(≤申请金额) */
export function apiRefundAudit(data: {
  id: number;
  auditStatus: number;
  auditRemark?: string;
  refundAmount?: number;
}): Promise<{ refundAmount: number } | null> {
  return post('/admin/order/refund/audit', data);
}

/** 到账确认:退款中→已退款;全额退款关闭订单并回补库存 */
export function apiRefundConfirm(data: { id: number; refundTradeNo?: string }): Promise<null> {
  return post('/admin/order/refund/confirm', data);
}

// ---------- 核销(verify_type 1设备 2商户 3后台手工;status 1成功 3已撤销) ----------
/** 手工核销:按订单ID或核销码;仅已支付且使用日期已到 */
export function apiVerify(data: { id?: number; verifyCode?: string }): Promise<{ orderId: number }> {
  return post('/admin/order/verify', data);
}

/** 撤销核销(必填 reason):订单回已支付,日志置已撤销留痕 */
export function apiVerifyCancel(data: { id?: number; verifyCode?: string; reason: string }): Promise<null> {
  return post('/admin/order/verify-cancel', data);
}

export function apiVerifyLogs(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/verify/logs', params);
}
