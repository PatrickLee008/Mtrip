import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 商户/供应商管理接口(merchant-service /api/v1/admin/*) */
type Row = Record<string, any>;

export type MerchantStatusAction = 'suspend' | 'activate' | 'reactivate' | 'blacklist' | 'unblacklist';
export function apiMerchantStatusChange(action: MerchantStatusAction, data: {
  id: number; note: string; expectedVersion: number; requestId: string; suspendedUntil?: string; evidence?: string;
}): Promise<Row> {
  return post(`/admin/merchant/${action}`, data);
}
export function apiMerchantStatusHistory(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get('/admin/merchant/status-history', params);
}

// ---------- 商户(文档 6.4.2) ----------
export function apiMerchantList(params: Record<string, unknown>): Promise<PageData<Row> & { stats: Record<string, number> }> {
  return get('/admin/merchant/list', params);
}

export function apiMerchantPropertyHistory(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get('/admin/merchant/property/history', params);
}

export function apiMerchantPropertyBind(data: { merchantId: number; businessId: number; storeId: number; expectedVersion: number; countryCode: string; cityKey: string; note: string }): Promise<Row> {
  return post('/admin/merchant/property/bind', data);
}

export function apiMerchantDetail(id: number): Promise<{ merchant: Row; accounts: Row[]; admins: Row[]; applications: Row[]; businesses: Row[]; properties: Row[]; group: Row | null }> {
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

/** 暂停商户(整改 A4):阻止新预订,不影响已确认订单,必填原因 */
export function apiMerchantSuspend(id: number, reason: string): Promise<null> {
  return post('/admin/merchant/suspend', { id, reason });
}

/** 恢复商户(整改 A4):Suspended → Active */
export function apiMerchantActivate(id: number): Promise<null> {
  return post('/admin/merchant/activate', { id });
}

/** 重置商户 2FA(整改 B3):商户下次登录需重新绑定 */
export interface SecurityAccount { id: number; username: string; real_name: string; account_type: number; status: number; two_fa_status: number; two_fa_method: string; two_fa_enrolled_at: string | null; two_fa_last_reset_at: string | null; auth_version: number }
export function apiMerchantSecurityAccounts(merchantId: number): Promise<SecurityAccount[]> { return get('/admin/merchant/security/accounts', { merchantId }); }
export function apiMerchantReset2Fa(data: { merchantId: number; accountId: number; expectedVersion: number; reason: string }): Promise<null> {
  return post('/admin/merchant/reset-2fa', data);
}

/** 发送商户通知(整改 B1):分类/标题/正文/深链/渠道/定时 */
export function apiMerchantNotifySend(data: {
  merchantId: number;
  category: string;
  title: string;
  message: string;
  deepLinkType?: string;
  deepLinkValue?: string;
  channels: string[];
  sendType?: number;
  sendAt?: string;
  requestId: string;
  templateId?: number;
}): Promise<{ id: number; deliveries: Row[] }> {
  return post('/admin/merchant/notification/send', data);
}

/** 通知模板(Use Template 自动填充) */
export function apiMerchantNotifyTemplates(merchantId?: number): Promise<Row[]> {
  return get('/admin/merchant/notification/templates', { merchantId });
}

/** 开始代入会话(整改 B2):原因必选,全程审计 */
export function apiMerchantImpersonateStart(merchantId: number, accountId: number, reason: string): Promise<{ session_id: number; session_key: string; exchangeCode: string; expiresAt: string }> {
  return post('/admin/merchant/impersonate/start', { merchantId, accountId, reason });
}

/** 结束代入会话(整改 B2) */
export function apiMerchantImpersonateEnd(sessionId: number): Promise<null> {
  return post('/admin/merchant/impersonate/end', { sessionId });
}

/** KYC 提交确认(整改 B4,接口契约;merchant-web 接入另行排期) */
export function apiOnboardingConfirm(id: number): Promise<null> {
  return post('/admin/merchant/onboarding/confirm', { id });
}

/** 当前业务单元正式提交核验；上传文件本身只保存草稿，不触发 KYC 状态流转。 */
export function apiOnboardingSubmitVerification(id: number, businessId: number): Promise<null> {
  return post('/admin/merchant/onboarding/submit-verification', { id, businessId });
}

/** 协助商户上传 KYC 文件(multipart:file + id + docType + bizUnit[可选业务单元 id];返回落库的文档记录) */
export function apiOnboardingKycUpload(file: File, id: number, docType: string, bizUnit?: string): Promise<Row> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('id', String(id));
  fd.append('docType', docType);
  if (bizUnit !== undefined && bizUnit !== '') {
    fd.append('bizUnit', bizUnit);
  }
  return post<Row>('/admin/merchant/onboarding/kyc-upload', fd);
}

// ---------- Marketplace Ranking(整改 Phase C) ----------


export function apiMerchantCommission(data: {
  id: number;
  commissionPlan?: string;
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

// ---------- 商户验证工作流(VerifyController,Merchant Verification 状态页共用) ----------
/** 验证工单列表:tab=pending|approved|rejected|resubmission */
export function apiVerifyList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/verify/list', params);
}

/** 五状态汇总数量(入驻/待核实/重新提交/得到正式认可/已拒绝) */
export function apiVerifyQueues(): Promise<Record<string, number>> {
  return get('/admin/merchant/verify/queues');
}

export function apiVerifyDetail(id: number): Promise<{
  merchant: Row;
  documents: Row[];
  businesses: Row[];
  timeline: Row[];
  resubmission?: { requested_by: string; requested_at: string; note: string; total: number; resubmitted: number } | null;
  kyc_submission?: { method: string; submitted_by: string; confirmation: string; confirmed_at?: string | null } | null;
  access_grant?: { access_code: string; generated_at?: string | null; generated_by: string; delivery_status: string; channels: string[] } | null;
}> {
  return get('/admin/merchant/verify/detail', { id });
}

export interface VerifyApprovalCredentials {
  access_code: string;
  one_time_password: string;
}

/** 为批准弹窗预生成访问码与仅显示一次的初始密码 */
export function apiVerifyApprovalCredentials(id: number): Promise<VerifyApprovalCredentials> {
  return post('/admin/merchant/verify/approval-credentials', { id });
}

/** 通过验证:待审核/待重新提交 → 已启用 */
export function apiVerifyApprove(data: {
  id: number;
  remark?: string;
  channels: string[];
  accessCode: string;
  oneTimePassword: string;
}): Promise<{ username: string; password: string; one_time_password: string; access_code: string }> {
  return post('/admin/merchant/verify/approve', data);
}

export function apiVerifyRegenerateCode(id: number): Promise<{ access_code: string }> {
  return post('/admin/merchant/verify/regenerate-code', { id });
}

/** 驳回验证:预置原因码(1-9)必填 + 可选补充说明 */
export function apiVerifyReject(id: number, reasonCode: number, note?: string): Promise<null> {
  return post('/admin/merchant/verify/reject', { id, reasonCode, note });
}

export function apiVerifyResubmit(id: number, comment: string): Promise<null> {
  return post('/admin/merchant/verify/resubmit', { id, comment });
}

/** 确认商户已重新提交文件:回到待验证队列 */
export function apiVerifyResubmitReceived(id: number): Promise<null> {
  return post('/admin/merchant/verify/resubmit-received', { id });
}

/** 逐份文档核验:action=verify|reject(reject 必填 reason) */
export function apiVerifyDocReview(data: { docId: number; action: string; reason?: string; expectedVersion: number }): Promise<null> {
  return post('/admin/merchant/verify/doc-review', data);
}

// ---------- 商户入驻流水线(Onboarding,OnboardingController) ----------
export function apiOnboardingList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/onboarding/list', params);
}

/** 四队列计数(原型顶部统计卡:待审核/已通过/已驳回/重新提交) */
export function apiOnboardingQueues(): Promise<Record<string, number>> {
  return get('/admin/merchant/onboarding/queues');
}

export function apiOnboardingDetail(id: number): Promise<{
  application: Row;
  businesses: Row[];
  documents: Row[];
  timeline: Row[];
  notes: Row[];
  template: Row | null;
}> {
  return get('/admin/merchant/onboarding/detail', { id });
}

export function apiOnboardingKycTemplates(businessType?: string): Promise<Row[]> {
  return get('/admin/merchant/onboarding/kyc-templates', businessType ? { businessType } : {});
}

/** 编辑 KYC 验证模板(名称/业态/所需文档清单) */
export function apiOnboardingKycTemplateUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/merchant/onboarding/kyc-template-update', data);
}

export function apiOnboardingAdd(data: Record<string, unknown>): Promise<Row> {
  return post('/admin/merchant/onboarding/add', data);
}

export function apiOnboardingUpdateStage(id: number, stage: number): Promise<null> {
  return post('/admin/merchant/onboarding/update-stage', { id, stage });
}

export function apiOnboardingAssignOps(id: number, opsId: number, opsName: string): Promise<null> {
  return post('/admin/merchant/onboarding/assign-ops', { id, opsId, opsName });
}

export function apiOnboardingSaveAssessment(data: Record<string, unknown>): Promise<null> {
  return post('/admin/merchant/onboarding/save-assessment', data);
}

export function apiOnboardingSendKyc(data: { id: number; templateId: number; kycScope: number; submissionMethod: number; businessId?: number }): Promise<null> {
  return post('/admin/merchant/onboarding/send-kyc', data);
}

export function apiOnboardingSendReminder(id: number, note?: string): Promise<null> {
  return post('/admin/merchant/onboarding/send-reminder', { id, note });
}

export function apiOnboardingAddNote(id: number, note: string): Promise<null> {
  return post('/admin/merchant/onboarding/note-add', { id, note });
}

/** 入驻通过:转正式商户进入 Pending Verification */
export function apiOnboardingApprove(id: number): Promise<{ merchant_id: number; merchant_code: string }> {
  return post('/admin/merchant/onboarding/approve', { id });
}

/** 入驻驳回:预置原因码(1-9) + 可选补充说明 */
export function apiOnboardingReject(id: number, reasonCode: number, note?: string): Promise<null> {
  return post('/admin/merchant/onboarding/reject', { id, reasonCode, note });
}

export function apiMerchantDocuments(
  params: Record<string, unknown>,
): Promise<PageData<Row> & { stats?: Record<string, number> }> {
  return get<PageData<Row> & { stats?: Record<string, number> }>('/admin/merchant/documents', params);
}

/** 文档详情(含核验历史时间线) */
export function apiMerchantDocumentDetail(docId: number): Promise<{ document: Row; history: Row[]; revisions: Row[] }> {
  return get('/admin/merchant/document/detail', { docId });
}

/** 文档级要求重交(6 项预置原因之一) */
export function apiMerchantDocumentResubmit(docId: number, reason: string, expectedVersion: number): Promise<null> {
  return post('/admin/merchant/document/resubmit', { docId, reason, expectedVersion });
}

export function apiMerchantBlacklist(id: number, reason: string, evidence?: string): Promise<null> {
  return post('/admin/merchant/blacklist', { id, reason, evidence });
}

export function apiMerchantUnblacklist(id: number): Promise<null> {
  return post('/admin/merchant/unblacklist', { id });
}

export function apiMerchantActivities(
  params: Record<string, unknown>,
): Promise<PageData<Row> & { stats?: Record<string, number> }> {
  return get<PageData<Row> & { stats?: Record<string, number> }>('/admin/merchant/activities', params);
}

export function apiMerchantBlacklistList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/merchant/blacklist-list', params);
}
