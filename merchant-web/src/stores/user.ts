import { defineStore } from 'pinia';
import { apiLogin, apiLogout, apiMenus, type MenusResult } from '@/api/auth';
import type { MerchantProfile, MenuNode } from '@/api/types';
import { clearAuth, getToken, setToken } from '@/utils/auth';

interface UserState {
  token: string;
  profile: MerchantProfile | null;
  /** 动态菜单树(目录+页面) */
  menus: MenuNode[];
  /** 按钮权限标识集合 */
  perms: string[];
  /** 动态路由是否已注入 */
  routesLoaded: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: getToken(),
    profile: null,
    menus: [],
    perms: [],
    routesLoaded: false,
  }),
  getters: {
    isLogin: (state) => state.token !== '',
    /** 主账号:拥有本 account_type 全部权限(替代平台端 isSuper 语义) */
    isOwner: (state) => state.profile?.isOwner === true,
    /** 账号类型:1集团 2商户 3门店 */
    accountType: (state) => state.profile?.accountType ?? 0,
  },
  actions: {
    async login(username: string, password: string): Promise<void> {
      const { token, admin } = await apiLogin(username, password);
      this.token = token;
      this.profile = admin;
      setToken(token);
    },
    async loadMenus(): Promise<MenusResult> {
      const result = await apiMenus();
      this.menus = result.menus;
      this.perms = result.perms;
      return result;
    },
    /** 按钮权限判断:主账号恒真 */
    hasPerm(perm: string): boolean {
      return this.isOwner || this.perms.includes(perm);
    },
    async logout(): Promise<void> {
      try {
        await apiLogout();
      } catch {
        // 登出失败不阻断本地清理
      }
      this.$reset();
      clearAuth();
    },
  },
});
