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
