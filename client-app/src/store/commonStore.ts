/**
 * 通用状态:全局 Toast / 语言 / 关怀模式 / GDPR 授权标记
 */

import { create } from 'zustand';

import type { AppMode, Lang } from '@/config/global';
import { APP_MODES, STORAGE_KEYS, SUPPORTED_LANGS } from '@/config/global';
import { storage } from '@/utils/storage';

interface CommonState {
  /** 全局轻提示(空串=隐藏),由 ToastHost 消费 */
  toastMessage: string;
  toastVersion: number;
  showToast: (message: string) => void;
  clearToast: () => void;

  lang: Lang;
  /** 用户是否手选过语言(false = 首次进入,开屏后要弹语言选择) */
  langChosen: boolean;
  hydrate: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;

  /** 关怀模式(Figma Splash 2485:7324 的 Lite Mode),**默认开启** */
  liteMode: boolean;
  /** 用户是否显式选过模式(本地存过 mtrip:app-mode);当前启动不再弹模式选择,只有「更多」页的开关会置 true */
  modeChosen: boolean;
  setMode: (mode: AppMode) => Promise<void>;

  gdprAccepted: boolean;
  setGdprAccepted: (accepted: boolean) => void;
}

export const useCommonStore = create<CommonState>((set) => ({
  toastMessage: '',
  toastVersion: 0,
  showToast: (message) =>
    set((state) => ({ toastMessage: message, toastVersion: state.toastVersion + 1 })),
  clearToast: () => set({ toastMessage: '' }),

  lang: 'en-US',
  langChosen: false,
  async hydrate() {
    const saved = (await storage.getString(STORAGE_KEYS.LANG)) as Lang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      set({ lang: saved, langChosen: true });
    }
    const mode = (await storage.getString(STORAGE_KEYS.MODE)) as AppMode | null;
    if (mode && APP_MODES.includes(mode)) {
      set({ liteMode: mode === 'lite', modeChosen: true });
    }
  },
  async setLang(lang) {
    await storage.setString(STORAGE_KEYS.LANG, lang);
    set({ lang, langChosen: true });
  },

  /* 关怀模式是默认模式:没选过、也没存过的账号一律按 lite 起步。
     老用户本地存过 full 的,hydrate 会把它读回来 —— 显式选择优先于默认值。 */
  liteMode: true,
  modeChosen: false,
  async setMode(mode) {
    await storage.setString(STORAGE_KEYS.MODE, mode);
    set({ liteMode: mode === 'lite', modeChosen: true });
  },

  gdprAccepted: false,
  setGdprAccepted: (accepted) => set({ gdprAccepted: accepted }),
}));
