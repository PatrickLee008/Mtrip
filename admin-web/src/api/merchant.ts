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

// ---------- 集团(计划 11:管理/授权实体,商户授权绑定) ----------
export function apiGroupList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/group/list', params);
}

export function apiGroupDetail(id: number): Promise<{ group: Row; merchants: Row[]; accounts: Row[] }> {
  return get('/admin/merchant/group/detail', { id });
}

export function apiGroupAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/merchant/group/add', data);
}

export function apiGroupUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/merchant/group/update', data);
}

export function apiGroupToggleStatus(id: number): Promise<{ status: number }> {
  return post('/admin/merchant/group/toggle-status', { id });
}

export function apiGroupBind(id: number, merchantIds: number[]): Promise<{ bound: number }> {
  return post('/admin/merchant/group/bind', { id, merchantIds });
}

export function apiGroupUnbind(id: number, merchantId: number): Promise<null> {
  return post('/admin/merchant/group/unbind', { id, merchantId });
}

/** 生成/重置集团主账号(明文密码仅返回一次) */
export function apiGroupAccountReset(id: number): Promise<{ username: string; password: string; created: boolean }> {
  return post('/admin/merchant/group/account-reset', { id });
}

export function apiGroupDelete(id: number): Promise<null> {
  return post('/admin/merchant/group/delete', { id });
}

// ---------- 门店(计划 11:履约/核销单元,审核通过自动建主门店) ----------
export function apiStoreList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/store/list', params);
}

export function apiStoreDetail(id: number): Promise<Row> {
  return get('/admin/merchant/store/detail', { id });
}

export function apiStoreAdd(data: Record<string, unknown>): Promise<{ id: number; isMain: number }> {
  return post('/admin/merchant/store/add', data);
}

export function apiStoreUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/merchant/store/update', data);
}

export function apiStoreSetMain(id: number): Promise<null> {
  return post('/admin/merchant/store/set-main', { id });
}

export function apiStoreToggleStatus(id: number): Promise<{ status: number }> {
  return post('/admin/merchant/store/toggle-status', { id });
}

export function apiStoreAccountReset(id: number): Promise<{ username: string; password: string; created: boolean }> {
  return post('/admin/merchant/store/account-reset', { id });
}

export function apiStoreDelete(id: number): Promise<null> {
  return post('/admin/merchant/store/delete', { id });
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

// ---------- 商户验证工作流(Super Admin Portal Phase 1,VerifyController) ----------
/** 验证工单列表:tab=pending|approved|rejected|resubmission */
export function apiVerifyList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/verify/list', params);
}

export function apiVerifyDetail(id: number): Promise<{ merchant: Row; documents: Row[]; timeline: Row[] }> {
  return get('/admin/merchant/verify/detail', { id });
}

/** 通过验证:0/6→3,返回生成的商户主账号(明文密码仅此一次) */
export function apiVerifyApprove(id: number, remark?: string): Promise<{ username: string; password: string }> {
  return post('/admin/merchant/verify/approve', { id, remark });
}

export function apiVerifyReject(id: number, reason: string): Promise<null> {
  return post('/admin/merchant/verify/reject', { id, reason });
}

export function apiVerifyResubmit(id: number, comment: string): Promise<null> {
  return post('/admin/merchant/verify/resubmit', { id, comment });
}

/** 逐份文档核验:action=verify|reject(reject 必填 reason) */
export function apiVerifyDocReview(data: { docId: number; action: string; reason?: string }): Promise<null> {
  return post('/admin/merchant/verify/doc-review', data);
}

export function apiMerchantDocuments(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/documents', params);
}

export function apiMerchantBlacklist(id: number, reason: string, evidence?: string): Promise<null> {
  return post('/admin/merchant/blacklist', { id, reason, evidence });
}

export function apiMerchantUnblacklist(id: number): Promise<null> {
  return post('/admin/merchant/unblacklist', { id });
}

export function apiMerchantActivities(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/activities', params);
}

export function apiMerchantBlacklistList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/blacklist-list', params);
}
