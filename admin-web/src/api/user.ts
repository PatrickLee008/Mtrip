import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** C端用户管理接口(user-service /api/v1/admin/user/*) */
type Row = Record<string, any>;

// ---------- 用户(文档 6.4.4;状态 1正常 2冻结 3注销) ----------
export function apiUserList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/list', params);
}

/** 详情含余额/积分流水摘要(各近10条);超管可见明文手机号 */
export function apiUserDetail(id: number): Promise<{ user: Row; balanceLogs: Row[]; pointsLogs: Row[] }> {
  return get('/admin/user/detail', { id });
}

/** 手动调账(经办):amount 正数增加、负数扣减,原因必填;只生成待复核申请,复核通过后才入账。 */
export function apiUserAdjustBalance(data: { id: number; amount: string; reason: string; relatedNo?: string }): Promise<{ id: number; requestNo: string; status: number }> {
  return post('/admin/user/adjust-balance', data);
}

/**
 * 钱包流水:筛选 userId / mobile / nickname / changeType / bookingNo / startDate / endDate / siteId;
 * 行带 nickname、脱敏 mobile、booking_no、property_name、txn_no、operator_name;
 * summary 为当前筛选下全部流水的入账 / 出账合计。
 */
export function apiUserBalanceLogs(
  params: Record<string, unknown>,
): Promise<PageData<Row> & { summary: { credit: string; debit: string } }> {
  return get('/admin/user/balance-logs', params);
}

/** 某用户的钱包额度批次(每笔入账一行,含剩余与到期;status 1有效 2已用完 3已过期) */
export function apiWalletLots(userId: number): Promise<{ balance: string; activeAmount: string; expiredAmount: string; lots: Row[] }> {
  return get('/admin/user/wallet-lots', { userId });
}

/** 钱包人工调账申请列表(经办 + 复核):status 0待复核 1已入账 2已驳回 3记账失败 */
export function apiWalletAdjustList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/wallet-adjust/list', params);
}

/** 复核:approve 1 通过并记账 / 0 驳回(必填 remark);经办人不能复核自己的申请 */
export function apiWalletAdjustReview(data: { id: number; approve: 0 | 1; remark?: string }): Promise<{ status: number; balance: string | null; message: string }> {
  return post('/admin/user/wallet-adjust/review', data);
}

/** 冲正已入账的申请:生成反向金额的新申请,同样需要复核 */
export function apiWalletAdjustReverse(data: { id: number; reason: string }): Promise<{ id: number; requestNo: string }> {
  return post('/admin/user/wallet-adjust/reverse', data);
}

/** 冻结/解冻:1正常 ⇄ 2冻结(必填原因,写入备注留痕) */
export function apiUserToggleStatus(data: { id: number; reason: string }): Promise<{ userStatus: number }> {
  return post('/admin/user/toggle-status', data);
}

// ---------- 实名审核(App 资料向导第 2 步;real_name_status 3审核中 → 1通过 / 2驳回) ----------
export type RealNameTab = 'pending' | 'approved' | 'rejected';

export function apiRealNameQueues(): Promise<Record<RealNameTab, number>> {
  return get('/admin/user/real-name/queues');
}

/** 列表:tab + keyword(昵称/用户ID)+ nationality;证件号脱敏 */
export function apiRealNameList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/real-name/list', params);
}

/** 详情:明文姓名/证件号(审核比对用)+ 证件照/自拍(/uploads 相对地址)+ 时间线 */
export function apiRealNameDetail(id: number): Promise<Row> {
  return get('/admin/user/real-name/detail', { id });
}

export function apiRealNameApprove(id: number): Promise<null> {
  return post('/admin/user/real-name/approve', { id });
}

/** 驳回:原因必填,会回显给用户,用户可重新提交 */
export function apiRealNameReject(data: { id: number; reason: string }): Promise<null> {
  return post('/admin/user/real-name/reject', data);
}

// ---------- 反馈投诉(状态机:0待处理→1处理中→2已处理;0/1→3已关闭) ----------
export function apiFeedbackList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/feedback/list', params);
}

/** targetStatus 1处理中 2已处理(必填 replyContent) 3关闭 */
export function apiFeedbackHandle(data: {
  id: number;
  targetStatus: number;
  replyContent?: string;
}): Promise<null> {
  return post('/admin/user/feedback/handle', data);
}
