import { get, post } from '@/utils/http';
import type { MenuNode } from '@/api/types';

/** 角色列表行 */
export interface SupplierRole {
  id: number;
  roleName: string;
  roleCode: string;
  isBuiltin: boolean;
  status: number;
  remark: string;
  createdAt: string;
}

export function apiRoleList(): Promise<SupplierRole[]> {
  return get('/supplier/role/list');
}

/** 可分配菜单树(供应商端全部菜单) */
export function apiRoleMenuTree(): Promise<MenuNode[]> {
  return get('/supplier/role/menu-tree');
}

/** 某角色已分配的菜单ID集合 */
export function apiRoleMenus(id: number): Promise<{ menuIds: number[] }> {
  return get('/supplier/role/menus', { id });
}

export function apiRoleAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/supplier/role/add', data);
}

export function apiRoleUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/supplier/role/update', data);
}

export function apiRoleDelete(id: number): Promise<null> {
  return post('/supplier/role/delete', { id });
}

/** 给角色分配菜单 */
export function apiRoleAssign(id: number, menuIds: number[]): Promise<null> {
  return post('/supplier/role/assign', { id, menuIds });
}

/** 给子账号赋角色(覆盖式) */
export function apiRoleGrant(adminId: number, roleIds: number[]): Promise<null> {
  return post('/supplier/role/grant', { adminId, roleIds });
}

/** 某子账号已分配的角色ID集合 */
export function apiAccountRoles(adminId: number): Promise<{ roleIds: number[] }> {
  return get('/supplier/role/account-roles', { adminId });
}
