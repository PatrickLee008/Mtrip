import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 财务管理接口(finance-service /api/v1/admin/finance/*) */
type Row = Record<string, any>;

// ---------- 资金总览与流水(文档 6.4.5) ----------
export interface FinanceOverview {
  today: { income: number; expense: number };
  month: { income: number; expense: number };
  total: { income: number; expense: number };
  pendingWithdrawCount: number;
  pendingSettleCount: number;
}

export function apiFinanceOverview(): Promise<FinanceOverview> {
  return get<FinanceOverview>('/admin/finance/overview');
}

/** 资金流水:flow_type 1收入 2支出 3转账 4冻结 5解冻;biz_type 1订单支付 2订单退款 3商户提现 4供应商回款 5手动调账;flow_status 1成功 2处理中 3失败 */
export function apiFlowList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/finance/flow/list', params);
}

/** 手动调账:flowType 1收入/2支出,amount>0,必填 remark */
export function apiFlowAdjust(data: {
  flowType: number;
  amount: number;
  remark: string;
  merchantId?: number;
  siteId?: number;
}): Promise<{ flowNo: string }> {
  return post('/admin/finance/flow/adjust', data);
}

// ---------- 商户提现(状态机:0待审核→1打款中→2已打款;0→3驳回;1→4打款失败) ----------
export function apiWithdrawList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/finance/withdraw/list', params);
}

/** 详情含收款账户解密信息 */
export function apiWithdrawDetail(id: number): Promise<Row> {
  return get('/admin/finance/withdraw/detail', { id });
}

/** auditStatus 1通过(进入打款中) 2驳回(必填 auditRemark) */
export function apiWithdrawAudit(data: {
  id: number;
  auditStatus: number;
  auditRemark?: string;
}): Promise<null> {
  return post('/admin/finance/withdraw/audit', data);
}

/** payStatus 1成功(可传 tradeNo,落支出流水) 2失败(必填 failReason) */
export function apiWithdrawConfirmPay(data: {
  id: number;
  payStatus: number;
  tradeNo?: string;
  failReason?: string;
}): Promise<null> {
  return post('/admin/finance/withdraw/confirm-pay', data);
}

// ---------- 商户结算单(状态机:0待确认→1已确认→2已打款;0⇄3有争议) ----------
export function apiMerchantSettleList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/finance/settle/list', params);
}

export function apiMerchantSettleDetail(id: number): Promise<Row> {
  return get('/admin/finance/settle/detail', { id });
}

/** 确认结算单:0 → 1 */
export function apiMerchantSettleConfirm(data: { id: number }): Promise<null> {
  return post('/admin/finance/settle/confirm', data);
}

/** 标记打款:1 → 2(payVoucher 选填) */
export function apiMerchantSettleMarkPaid(data: { id: number; payVoucher?: string }): Promise<null> {
  return post('/admin/finance/settle/mark-paid', data);
}

/** 争议:0→3 标记争议(必填 remark);3→0 解除争议 */
export function apiMerchantSettleDispute(data: { id: number; remark?: string }): Promise<null> {
  return post('/admin/finance/settle/dispute', data);
}
