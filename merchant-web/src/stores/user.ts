import { defineStore } from 'pinia';
import { apiLogin, apiLogout, apiMenus, type MenusResult, type LoginResult, type ChallengeResult } from '@/api/auth';
import type { MerchantProfile, MerchantProperty, MenuNode } from '@/api/types';
import { clearAuth, getToken, setToken, setSupportToken } from '@/utils/auth';
import { getSelectedPropertyId, setSelectedPropertyId } from '@/utils/propertyContext';

interface UserState {
  token: string;
  profile: MerchantProfile | null;
  /** 动态菜单树(目录+页面) */
  menus: MenuNode[];
  /** 按钮权限标识集合 */
  perms: string[];
  /** 当前账号可切换的真实酒店物业 */
  properties: MerchantProperty[];
  /** null=全部已授权物业视图 */
  selectedPropertyId: number | null;
  /** 动态路由是否已注入 */
  routesLoaded: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: getToken(),
    profile: null,
    menus: [],
    perms: [],
    properties: [],
    selectedPropertyId: getSelectedPropertyId(),
    routesLoaded: false,
  }),
  getters: {
    isLogin: (state) => state.token !== '',
    /** 主账号:拥有本 account_type 全部权限(替代平台端 isSuper 语义) */
    isOwner: (state) => state.profile?.isOwner === true,
    /** 账号类型:1集团 2商户 3门店 */
    accountType: (state) => state.profile?.accountType ?? 0,
    selectedProperty: (state) => state.properties.find((item) => item.id === state.selectedPropertyId) ?? null,
    visibleMenus: (state): MenuNode[] => {
      const selected = state.properties.find((item) => item.id === state.selectedPropertyId);
      const moduleKey = selected?.business_type ?? '';
      const filter = (nodes: MenuNode[]): MenuNode[] => nodes.flatMap((node) => {
        const children = filter(node.children ?? []);
        const ownModule = node.module_key ?? '';
        const visible = ownModule === '' || (moduleKey !== '' && ownModule === moduleKey);
        if (!visible || (node.menu_type === 1 && children.length === 0)) return [];
        return [{ ...node, children }];
      });
      return filter(state.menus);
    },
  },
  actions: {
    async login(username: string, password: string): Promise<ChallengeResult> { return apiLogin(username, password); },
    acceptSession(result: LoginResult, support = false): void {
      this.token = result.token;
      this.profile = result.admin;
      this.routesLoaded = false;
      this.menus = []; this.perms = []; this.properties = []; this.selectedPropertyId = null;
      setSelectedPropertyId(null);
      if (support) setSupportToken(result.token); else setToken(result.token);
    },
    async loadMenus(): Promise<MenusResult> {
      const result = await apiMenus();
      this.menus = result.menus;
      this.perms = result.perms;
      this.properties = result.businesses;
      if (!this.properties.some((item) => item.id === this.selectedPropertyId)) {
        this.selectedPropertyId = null;
        setSelectedPropertyId(null);
      }
      return result;
    },
    selectProperty(id: number | null): void {
      this.selectedPropertyId = id !== null && this.properties.some((item) => item.id === id) ? id : null;
      setSelectedPropertyId(this.selectedPropertyId);
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
      clearAuth();
      this.$reset();
      this.token = '';
    },
  },
});
