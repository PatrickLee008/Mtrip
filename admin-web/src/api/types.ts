/** 后端统一响应包(shared Result) */
export interface ApiResult<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 统一分页数据 */
export interface PageData<T = unknown> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 后端下发菜单节点(sys_menu,menu_type: 1目录 2页面 3按钮) */
export interface MenuNode {
  id: number;
  parent_id: number;
  menu_name: string;
  /** 英文名称:i18n_key 未命中词条时非中文环境的回退显示名 */
  menu_name_en: string;
  /** 多语言标记:前端词条 key(如 menu.systemAdmin),扩展语言仅需前端补词条 */
  i18n_key: string;
  perm_key: string;
  menu_type: number;
  route_path: string;
  component: string;
  icon: string;
  sort: number;
  status: number;
  /** 页面缓存:1缓存 2不缓存(多页签 keep-alive,仅页面菜单生效) */
  is_cache: number;
  children?: MenuNode[];
}

/** 登录返回的管理员概要 */
export interface AdminProfile {
  id: number;
  username: string;
  realName: string;
  avatar: string;
  email: string;
  siteId: number;
  isSuper: boolean;
  permissions: string[];
  lastLoginAt: string;
}

/** 站点树节点(sys_site) */
export interface SiteNode {
  id: number;
  parent_id: number;
  site_name: string;
  site_code: string;
  level: number;
  currency: string;
  timezone: string;
  status: number;
  children?: SiteNode[];
}
