import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 终端用户管理 / Customer 360(Super Admin Portal Phase 3,user-service /api/v1/admin/user/*) */
type Row = Record<string, any>;

export function apiEndUserList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/list', params);
}

/** Customer 360 聚合:资料+会员+钱包/积分流水+预订+优惠券+交易+推荐数 */
export function apiCustomer360(id: number): Promise<{
  user: Row; level: Row | null;
  balanceLogs: Row[]; pointsLogs: Row[]; bookings: Row[]; coupons: Row[]; transactions: Row[];
  referralCount: number;
  deletion: AccountDeletionSummary | null;
}> {
  return get('/admin/user/customer360', { id });
}

/** 冻结/解冻(必填原因) */
export function apiEndUserToggleStatus(id: number, reason: string): Promise<{ userStatus: number }> {
  return post('/admin/user/toggle-status', { id, reason });
}

export function apiEndUserBlacklist(id: number, reason: string, evidence?: string): Promise<null> {
  return post('/admin/user/blacklist', { id, reason, evidence });
}

export function apiEndUserUnblacklist(id: number): Promise<null> {
  return post('/admin/user/unblacklist', { id });
}

/** 账户注销(Consumer App PRD 模块 19):有效的没收批准 / 已注销记录 / 进行中预订数 */
export interface AccountDeletionSummary {
  approval: { approvedBalance: string; approvedName: string; approvedAt: string; expiresAt: string; reason: string } | null;
  closed: { closed_at: string; purge_after: string; purged_at: string | null; forfeited_amount: string } | null;
  ongoingBookings: number;
}

/** 批准「有余额时注销」:余额在用户确认注销时没收(user:list:approve-deletion) */
export function apiEndUserDeletionApprove(id: number, reason: string): Promise<{ id: number; approvedBalance: string; expiresAt: string }> {
  return post('/admin/user/deletion/approve', { id, reason });
}

/** 撤销尚未使用的注销批准 */
export function apiEndUserDeletionRevoke(id: number): Promise<{ revoked: number }> {
  return post('/admin/user/deletion/revoke', { id });
}
