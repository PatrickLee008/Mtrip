import { get } from '@/utils/http';
import type { PageData } from '@/api/types';

/**
 * 对账结算账单列表行(supplier_settle snake_case 直出,只读)
 * 结算单由平台生成/审核/回款,供应商侧仅查看进度。
 * status:0待审核 1已审核 2已回款 3已驳回
 */
export interface SupplierSettle {
  id: number;
  settle_no: string;
  supplier_id: number;
  settle_month: string;
  order_count: number;
  supply_amount: string | number;
  share_amount: string | number;
  settle_amount: string | number;
  status: number;
  audit_time: string | null;
  pay_time: string | null;
  pay_voucher: string;
  remark: string;
  created_at: string;
}

export function apiSettleList(params: Record<string, unknown>): Promise<PageData<SupplierSettle>> {
  return get('/supplier/settle/list', params);
}

export function apiSettleDetail(id: number): Promise<{ settle: Record<string, unknown> }> {
  return get('/supplier/settle/detail', { id });
}
