import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface EarningsSettlementSummary {
  pendingAmount: number;
  processingAmount: number;
  paidAmount: number;
  disputedAmount: number;
  pendingCount: number;
  processingCount: number;
  paidCount: number;
  disputedCount: number;
}

export interface EarningsOverview {
  startDate: string;
  endDate: string;
  bookingVolume: number;
  grossRevenue: number;
  commission: number;
  discountAmount: number;
  mtripPays: number;
  merchantPays: number;
  netSettlement: number;
  settlement: EarningsSettlementSummary;
}

export interface MerchantSettle {
  id: number;
  settle_no: string;
  site_id: number;
  merchant_id: number;
  settle_cycle: string;
  order_count: number;
  order_amount: number;
  refund_amount: number;
  commission: number;
  tax_amount: number;
  settle_amount: number;
  status: number;
  confirm_by: number | null;
  confirm_time: string | null;
  pay_time: string | null;
  pay_voucher: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface SettlementEntry {
  id: number;
  order_id: number;
  order_no: string;
  order_amount: number;
  commission: number;
  discount_amount: number;
  mtrip_pays: number;
  merchant_pays: number;
  partner_pays: number;
  merchant_settlement: number;
  platform_revenue: number;
  created_at: string;
}

export interface SettleDetail {
  settle: MerchantSettle;
  entries: SettlementEntry[];
}

export function apiEarningsOverview(params?: Record<string, unknown>): Promise<EarningsOverview> {
  return get('/merchant/earnings/overview', params);
}

export function apiSettleList(params: Record<string, unknown>): Promise<PageData<MerchantSettle>> {
  return get('/merchant/earnings/settle/list', params);
}

export function apiSettleDetail(id: number): Promise<SettleDetail> {
  return get('/merchant/earnings/settle/detail', { id });
}

export function apiSettleDispute(data: { id: number; remark: string }): Promise<null> {
  return post('/merchant/earnings/settle/dispute', data);
}
