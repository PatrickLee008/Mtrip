import { get, post } from '@/utils/http';
import type { MenuNode, PageData } from '@/api/types';

/** 系统管理模块 API(管理员/角色/菜单/操作日志),行结构为后端直出 */
export type Row = Record<string, any>;
type Params = Record<string, unknown>;

// ---------- 管理员 ----------
export const apiAdminList = (params: Params) => get<PageData<Row>>('/admin/sys/admin/list', params);
export const apiAdminDetail = (id: number) => get<Row>('/admin/sys/admin/detail', { id });
export const apiAdminAdd = (data: Params) => post<{ id: number }>('/admin/sys/admin/add', data);
export const apiAdminUpdate = (data: Params) => post<null>('/admin/sys/admin/update', data);
export const apiAdminDelete = (id: number) => post<null>('/admin/sys/admin/delete', { id });
export const apiAdminResetPassword = (id: number, password: string) =>
  post<null>('/admin/sys/admin/reset-password', { id, password });
export const apiAdminToggleStatus = (id: number) => post<{ status: number }>('/admin/sys/admin/toggle-status', { id });
export const apiAdminLoginLogs = (params: Params) => get<PageData<Row>>('/admin/sys/admin/login-logs', params);

// ---------- 角色 ----------
export const apiRoleList = (params: Params) => get<PageData<Row>>('/admin/sys/role/list', params);
export const apiRoleAll = () => get<Row[]>('/admin/sys/role/all');
export const apiRoleAdd = (data: Params) => post<{ id: number }>('/admin/sys/role/add', data);
export const apiRoleUpdate = (data: Params) => post<null>('/admin/sys/role/update', data);
export const apiRoleDelete = (id: number) => post<null>('/admin/sys/role/delete', { id });
export const apiRoleToggleStatus = (id: number) => post<{ status: number }>('/admin/sys/role/toggle-status', { id });
export const apiRolePerms = (roleId: number) => get<{ roleId: number; menuIds: number[] }>('/admin/sys/role/perms', { roleId });
export const apiRoleAssignPerms = (roleId: number, menuIds: number[]) =>
  post<null>('/admin/sys/role/assign-perms', { roleId, menuIds });
export const apiRoleAdmins = (roleId: number) => get<Row[]>('/admin/sys/role/admins', { roleId });

// ---------- 菜单 ----------
export const apiMenuTree = () => get<MenuNode[]>('/admin/sys/menu/tree');
export const apiMenuAdd = (data: Params) => post<{ id: number }>('/admin/sys/menu/add', data);
export const apiMenuUpdate = (data: Params) => post<null>('/admin/sys/menu/update', data);
export const apiMenuDelete = (id: number) => post<null>('/admin/sys/menu/delete', { id });

// ---------- 操作日志(只读) ----------
export const apiOplogList = (params: Params) => get<PageData<Row>>('/admin/sys/oplog/list', params);
export const apiOplogDetail = (id: number) => get<Row>('/admin/sys/oplog/detail', { id });
