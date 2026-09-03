/**
 * 用户状态:登录态持久化(token + 资料),退出清理
 */

import { create } from 'zustand';

import { apiLogin, apiLogout, apiRegister, fetchMe } from '@/api/user';
import { STORAGE_KEYS } from '@/config/global';
import type { AuthResult, UserProfile } from '@/types/models';
import { storage } from '@/utils/storage';

interface UserState {
  token: string;
  profile: UserProfile | null;
  isLogin: boolean;
  /** App 启动时从本地恢复登录态 */
  hydrate: () => Promise<void>;
  login: (mobile: string, password: string) => Promise<void>;
  register: (
    mobile: string,
    password: string,
    extra?: { nickname?: string; email?: string; referralCode?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** 仅清本地(401 时由请求层调用) */
  clearLocal: () => void;
  refreshProfile: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  token: '',
  profile: null,
  isLogin: false,

  async hydrate() {
    const [token, profile] = await Promise.all([
      storage.getString(STORAGE_KEYS.TOKEN),
      storage.getObject<UserProfile>(STORAGE_KEYS.USER),
    ]);
    if (token) {
      set({ token, profile, isLogin: true });
    }
  },

  async login(mobile, password) {
    const result = await apiLogin({ mobile, password });
    await applyAuth(result);
    set({ token: result.token, profile: result.user, isLogin: true });
  },

  async register(mobile, password, extra) {
    const result = await apiRegister({ mobile, password, ...extra });
    await applyAuth(result);
    set({ token: result.token, profile: result.user, isLogin: true });
  },

  async logout() {
    try {
      await apiLogout();
    } catch {
      // 后端登出失败不阻塞本地清理
    }
    get().clearLocal();
  },

  clearLocal() {
    void storage.remove(STORAGE_KEYS.TOKEN);
    void storage.remove(STORAGE_KEYS.USER);
    set({ token: '', profile: null, isLogin: false });
  },

  async refreshProfile() {
    if (!get().isLogin) return;
    const profile = await fetchMe();
    await storage.setObject(STORAGE_KEYS.USER, profile);
    set({ profile });
  },
}));

async function applyAuth(result: AuthResult): Promise<void> {
  await storage.setString(STORAGE_KEYS.TOKEN, result.token);
  await storage.setObject(STORAGE_KEYS.USER, result.user);
}
