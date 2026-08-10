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
