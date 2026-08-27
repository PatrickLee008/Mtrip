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

/** 后端下发菜单节点(merchant_menu,menu_type: 1目录 2页面 3按钮) */
export interface MenuNode {
  id: number;
  parent_id: number;
  menu_name: string;
  /** 英文名称:i18n_key 未命中词条时非中文环境的回退显示名 */
  menu_name_en: string;
  /** 多语言标记:前端词条 key(如 menu.dashboard) */
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
  /** 该菜单对哪些 account_type 可见(逗号分隔) */
  account_scope?: string;
  children?: MenuNode[];
}

/**
 * 登录返回的商户账号概要
 * account_type:1集团 2商户 3门店;isOwner:主账号(拥有本类型全部权限)
 */
export interface MerchantProfile {
  id: number;
  username: string;
  realName: string;
  accountType: number;
  groupId: number;
  merchantId: number;
  storeId: number;
  isOwner: boolean;
  /** 当前主体名称(集团/商户/门店) */
  subjectName: string;
  bookingRestricted?: boolean;
  permissions: string[];
  lastLoginAt: string;
}
