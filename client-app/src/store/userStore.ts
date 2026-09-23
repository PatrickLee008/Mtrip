/**
 * 用户状态:登录态持久化(token + 资料),退出清理
 */

import { create } from 'zustand';

import { apiLogin, apiLoginBySms, apiLogout, apiRegister, fetchMe } from '@/api/user';
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
  /** 短信验证码登录(免密):verifyToken 来自 `apiSmsVerify`(scene=login) */
  loginBySms: (mobile: string, verifyToken: string) => Promise<void>;
  register: (
    mobile: string,
    password: string,
    /** realName = 注册页的姓名栏(取代原邮箱栏),后端落 `user_info.real_name` */
    extra?: { nickname?: string; realName?: string; referralCode?: string; verifyToken?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** 仅清本地(401 时由请求层调用) */
  clearLocal: () => void;
  refreshProfile: () => Promise<void>;
  /** 直接替换资料(资料向导提交后后端回了最新 profile,省一次 fetchMe) */
  setProfile: (profile: UserProfile) => Promise<void>;

  /** 「Set Up Profile Now?」弹窗(Figma 2516:14427),由 ProfileSetupPromptHost 消费 */
  profilePromptVisible: boolean;
  /**
   * 注册 / 登录成功后调用:资料未完善且本机没对这个号点过 Later 才弹。
   * `force` = 刚注册完,一律弹(新号不可能点过 Later)。
   */
  promptProfileSetup: (force?: boolean) => Promise<void>;
  /** 关掉弹窗;`later` = 点了 Later,记到本地,这个号以后登录不再弹 */
  dismissProfilePrompt: (later: boolean) => Promise<void>;
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
    // 资料没完善的老号登录后也提示一次(点过 Later 的不再弹)
    void get().promptProfileSetup();
  },

  async loginBySms(mobile, verifyToken) {
    const result = await apiLoginBySms({ mobile, verifyToken });
    await applyAuth(result);
    set({ token: result.token, profile: result.user, isLogin: true });
    // 资料没完善的老号登录后也提示一次(点过 Later 的不再弹)
    void get().promptProfileSetup();
  },

  async register(mobile, password, extra) {
    const result = await apiRegister({ mobile, password, ...extra });
    await applyAuth(result);
    set({ token: result.token, profile: result.user, isLogin: true });
    // 新号必弹「Set Up Profile Now?」(Figma Onboarding 2516:14427)
    void get().promptProfileSetup(true);
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
    set({ token: '', profile: null, isLogin: false, profilePromptVisible: false });
  },

  async refreshProfile() {
    if (!get().isLogin) return;
    const profile = await fetchMe();
    await storage.setObject(STORAGE_KEYS.USER, profile);
    set({ profile });
  },

  async setProfile(profile) {
    await storage.setObject(STORAGE_KEYS.USER, profile);
    set({ profile });
  },

  profilePromptVisible: false,

  async promptProfileSetup(force) {
    const { profile, isLogin } = get();
    // profileCompleted 缺省(老后端 / 老缓存)视为不知道,不打扰
    if (!isLogin || !profile || profile.profileCompleted !== false) return;
    if (!force) {
      const later = (await storage.getObject<number[]>(STORAGE_KEYS.PROFILE_PROMPT_LATER)) ?? [];
      if (later.includes(profile.id)) return;
    }
    set({ profilePromptVisible: true });
  },

  async dismissProfilePrompt(later) {
    set({ profilePromptVisible: false });
    const id = get().profile?.id;
    if (!later || !id) return;
    const list = (await storage.getObject<number[]>(STORAGE_KEYS.PROFILE_PROMPT_LATER)) ?? [];
    if (!list.includes(id)) await storage.setObject(STORAGE_KEYS.PROFILE_PROMPT_LATER, [...list, id]);
  },
}));

async function applyAuth(result: AuthResult): Promise<void> {
  await storage.setString(STORAGE_KEYS.TOKEN, result.token);
  await storage.setObject(STORAGE_KEYS.USER, result.user);
}
