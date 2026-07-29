import { get } from '@/utils/http';
import type { PageData } from '@/api/types';

type Row = Record<string, any>;

/** 数据大屏聚合返回结构 */
export interface DashboardData {
  startDate: string;
  endDate: string;
  kpi: {
    salesAmount: number;
    commission: number;
    todayOrderCount: number;
    todaySalesAmount: number;
    pendingSettleCount: number;
    pendingSettleAmount: number;
  };
  trend: { date: string; hotelCount: number; ticketCount: number; salesAmount: number }[];
  siteRank: Row[];
  merchantRank: Row[];
  latestOrders: Row[];
}

/** 数据大屏:KPI + 每日趋势 + 站点/商户排行 + 最新订单(startDate/endDate 默认近30天) */
export function apiStatsDashboard(params: Record<string, unknown>): Promise<DashboardData> {
  return get<DashboardData>('/admin/order/stats/dashboard', params);
}

/** 维度报表:dim=site|merchant|goods,行含 dim_id/dim_name/order_count/paid_count/sales_amount/commission/refund_amount */
export function apiStatsReport(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/stats/report', params);
}

/** 财务月度报表返回结构(12 个月定长) */
export interface FinanceReportData {
  year: number;
  list: Row[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

/** 财务月度报表:按年汇总收入/支出/净额 + 业务类型拆分(orderPay/orderRefund/withdraw/supplierPay/adjust) */
export function apiFinanceReport(params: Record<string, unknown>): Promise<FinanceReportData> {
  return get<FinanceReportData>('/admin/finance/report', params);
}
