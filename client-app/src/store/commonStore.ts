/**
 * 通用状态:全局 Toast / 语言 / GDPR 授权标记
 */

import { create } from 'zustand';

import type { Lang } from '@/config/global';
import { STORAGE_KEYS, SUPPORTED_LANGS } from '@/config/global';
import { storage } from '@/utils/storage';

interface CommonState {
  /** 全局轻提示(空串=隐藏),由 ToastHost 消费 */
  toastMessage: string;
  toastVersion: number;
  showToast: (message: string) => void;
  clearToast: () => void;

  lang: Lang;
  hydrate: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;

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
  async hydrate() {
    const saved = (await storage.getString(STORAGE_KEYS.LANG)) as Lang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      set({ lang: saved });
    }
  },
  async setLang(lang) {
    await storage.setString(STORAGE_KEYS.LANG, lang);
    set({ lang });
  },

  gdprAccepted: false,
  setGdprAccepted: (accepted) => set({ gdprAccepted: accepted }),
}));
