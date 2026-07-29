import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 商户/供应商管理接口(merchant-service /api/v1/admin/*) */
type Row = Record<string, any>;

// ---------- 商户(文档 6.4.2) ----------
export function apiMerchantList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/list', params);
}

export function apiMerchantDetail(id: number): Promise<{ merchant: Row; accounts: Row[]; admins: Row[] }> {
  return get('/admin/merchant/detail', { id });
}

export function apiMerchantAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/merchant/add', data);
}

export function apiMerchantUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/merchant/update', data);
}

/** auditStatus 1通过(返回生成的主账号,明文密码仅此一次) 2驳回(必填 auditRemark) */
export function apiMerchantAudit(data: {
  id: number;
  auditStatus: number;
  auditRemark?: string;
}): Promise<{ username: string; password: string } | null> {
  return post('/admin/merchant/audit', data);
}

export function apiMerchantToggleStatus(id: number): Promise<{ status: number; offGoods: number }> {
  return post('/admin/merchant/toggle-status', { id });
}

export function apiMerchantCommission(data: {
  id: number;
  commissionRate: number;
  settlementCycle: number;
}): Promise<null> {
  return post('/admin/merchant/commission', data);
}

export function apiMerchantAccounts(merchantId: number): Promise<Row[]> {
  return get('/admin/merchant/account', { merchantId });
}

/** 带 id 编辑(accountNo 留空保留原值),不带 id 新增 */
export function apiMerchantAccountSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/merchant/account-save', data);
}

export function apiMerchantClose(id: number, remark: string): Promise<{ offGoods: number }> {
  return post('/admin/merchant/close', { id, remark });
}

export function apiMerchantStatistics(params: Record<string, unknown>): Promise<Row> {
  return get('/admin/merchant/statistics', params);
}

export function apiMerchantStatement(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/statement', params);
}

// ---------- 供应商 ----------
export function apiSupplierList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/supplier/list', params);
}

export function apiSupplierDetail(id: number): Promise<Row> {
  return get('/admin/supplier/detail', { id });
}

export function apiSupplierAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/supplier/add', data);
}

export function apiSupplierUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/supplier/update', data);
}

export function apiSupplierAudit(data: { id: number; auditStatus: number; auditRemark?: string }): Promise<null> {
  return post('/admin/supplier/audit', data);
}

export function apiSupplierToggleStatus(id: number): Promise<{ status: number }> {
  return post('/admin/supplier/toggle-status', { id });
}

export function apiSupplierTerminate(id: number, remark: string): Promise<null> {
  return post('/admin/supplier/terminate', { id, remark });
}

export function apiSupplierGoodsList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/supplier/goods/list', params);
}

export function apiSupplierGoodsAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/supplier/goods/add', data);
}

export function apiSupplierGoodsUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/supplier/goods/update', data);
}

export function apiSupplierGoodsDelete(id: number): Promise<null> {
  return post('/admin/supplier/goods/delete', { id });
}

export function apiSupplierSettleList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/supplier/settle/list', params);
}

export function apiSupplierSettleAudit(data: { id: number; auditStatus: number; auditRemark?: string }): Promise<null> {
  return post('/admin/supplier/settle/audit', data);
}

export function apiSupplierSettleConfirmPay(data: Record<string, unknown>): Promise<null> {
  return post('/admin/supplier/settle/confirm-pay', data);
}
