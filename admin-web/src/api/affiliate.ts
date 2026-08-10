import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 带货达人与联盟(Super Admin Portal Phase 2,marketing-service /api/v1/admin/affiliate/*) */
type Row = Record<string, any>;

// ---------- 申请审核 ----------
export function apiAffiliateApplications(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/application/list', params);
}
export function apiAffiliateAppApprove(id: number, commissionRate?: number): Promise<{ partnerId: number }> {
  return post('/admin/affiliate/application/approve', { id, commissionRate });
}
export function apiAffiliateAppReject(id: number, reason: string): Promise<null> {
  return post('/admin/affiliate/application/reject', { id, reason });
}

// ---------- 合作方名录 ----------
export function apiAffiliatePartners(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/partner/list', params);
}
export function apiAffiliatePartnerToggle(id: number): Promise<{ status: number }> {
  return post('/admin/affiliate/partner/toggle-status', { id });
}

// ---------- 联盟计划 ----------
export function apiAffiliateProgram(): Promise<{ commissionRules: Row[]; rewardRules: Row[]; settings: Row[] }> {
  return get('/admin/affiliate/program');
}
export function apiAffiliateProgramSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/affiliate/program/save', data);
}

// ---------- 联盟折扣码 ----------
export function apiAffiliateCodes(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/code/list', params);
}
export function apiAffiliateCodeSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/affiliate/code/save', data);
}
export function apiAffiliateCodeDelete(id: number): Promise<null> {
  return post('/admin/affiliate/code/delete', { id });
}

// ---------- 奖励钱包 ----------
export function apiAffiliateCommissionLog(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/wallet/commission-log', params);
}
export function apiAffiliateWithdraws(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/wallet/withdraw-list', params);
}
export function apiAffiliateWithdrawPay(id: number): Promise<null> {
  return post('/admin/affiliate/wallet/withdraw-pay', { id });
}
export function apiAffiliateWalletAdjust(partnerId: number, amount: number): Promise<null> {
  return post('/admin/affiliate/wallet/adjust', { partnerId, amount });
}

// ---------- 反欺诈 ----------
export function apiAffiliateFraud(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/affiliate/fraud/list', params);
}
export function apiAffiliateFraudHandle(data: Record<string, unknown>): Promise<null> {
  return post('/admin/affiliate/fraud/handle', data);
}

// ---------- 推荐返利记录(C 端 Referral,user-service)----------
export function apiAffiliateReferral(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/referral-list', params);
}
