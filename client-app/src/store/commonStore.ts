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

  /** 关怀模式(Figma Splash 2485:7324 的 Lite Mode) */
  liteMode: boolean;
  /** 用户是否选过模式(false = 首次进入,选完语言后要弹模式选择) */
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

  liteMode: false,
  modeChosen: false,
  async setMode(mode) {
    await storage.setString(STORAGE_KEYS.MODE, mode);
    set({ liteMode: mode === 'lite', modeChosen: true });
  },

  gdprAccepted: false,
  setGdprAccepted: (accepted) => set({ gdprAccepted: accepted }),
}));
