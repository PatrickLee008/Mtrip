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
