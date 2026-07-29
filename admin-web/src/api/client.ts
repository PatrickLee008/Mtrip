import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 客户端鉴权模块 API(客户端密钥/接口权限模板/接口调用日志) */
export type Row = Record<string, any>;
type Params = Record<string, unknown>;

/** 创建/重置密钥返回:明文 Secret 仅此一次 */
export interface ClientSecretResult {
  id?: number;
  clientId: string;
  clientSecret: string;
}

// ---------- 客户端密钥 ----------
export const apiClientList = (params: Params) => get<PageData<Row>>('/admin/client/list', params);
export const apiClientDetail = (id: number) => get<Row>('/admin/client/detail', { id });
export const apiClientAdd = (data: Params) => post<ClientSecretResult>('/admin/client/add', data);
export const apiClientUpdate = (data: Params) => post<null>('/admin/client/update', data);
export const apiClientDelete = (id: number) => post<null>('/admin/client/delete', { id });
export const apiClientToggleStatus = (id: number) => post<{ status: number }>('/admin/client/toggle-status', { id });
/** remark 随请求体提交,由操作日志中间件留痕(高危操作必填备注) */
export const apiClientResetSecret = (id: number, remark: string) =>
  post<ClientSecretResult>('/admin/client/reset-secret', { id, remark });
export const apiClientStats = (id: number) =>
  get<{ total: number; successCount: number; failCount: number; avgCostMs: number; daily: Row[] }>('/admin/client/stats', { id });

// ---------- 接口权限模板 ----------
export const apiPermTplList = (params: Params) => get<PageData<Row>>('/admin/client/perm-template/list', params);
export const apiPermTplAll = () => get<Row[]>('/admin/client/perm-template/all');
export const apiPermTplAdd = (data: Params) => post<{ id: number }>('/admin/client/perm-template/add', data);
export const apiPermTplUpdate = (data: Params) => post<null>('/admin/client/perm-template/update', data);
export const apiPermTplDelete = (id: number) => post<null>('/admin/client/perm-template/delete', { id });
export const apiPermTplToggleStatus = (id: number) =>
  post<{ status: number }>('/admin/client/perm-template/toggle-status', { id });
export const apiPermTplClients = (templateId: number) => get<Row[]>('/admin/client/perm-template/clients', { templateId });

// ---------- 接口调用日志(只读) ----------
export const apiApiLogList = (params: Params) => get<PageData<Row>>('/admin/client/api-log/list', params);
export const apiApiLogDetail = (id: number) => get<Row>('/admin/client/api-log/detail', { id });
export const apiApiLogStats = (params?: Params) =>
  get<{ total: number; failCount: number; avgCostMs: number; daily: Row[]; topApis: Row[] }>('/admin/client/api-log/stats', params);
