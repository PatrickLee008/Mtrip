import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 平台规则与合规(Super Admin Portal 模块 08,merchant-service /api/v1/admin/compliance/*) */
type Row = Record<string, any>;

// 规则
export function apiRules(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/compliance/rule/list', params);
}
export function apiRuleSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/compliance/rule/save', data);
}
export function apiRulePublish(id: number, action: string): Promise<null> {
  return post('/admin/compliance/rule/publish', { id, action });
}
export function apiRuleDelete(id: number): Promise<null> {
  return post('/admin/compliance/rule/delete', { id });
}

// 违规
export function apiViolations(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/compliance/violation/list', params);
}
export function apiViolationHandle(data: Record<string, unknown>): Promise<null> {
  return post('/admin/compliance/violation/handle', data);
}

// 警告
export function apiWarnings(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/compliance/warning/list', params);
}
export function apiWarningIssue(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/compliance/warning/issue', data);
}
export function apiWarningRevoke(id: number): Promise<null> {
  return post('/admin/compliance/warning/revoke', { id });
}

// 合规历史
export function apiComplianceHistory(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/compliance/history/list', params);
}
