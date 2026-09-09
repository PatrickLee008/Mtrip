import { create } from 'zustand';

import type { Lang } from '@/config/global';
import { STORAGE_KEYS, SUPPORTED_LANGS } from '@/config/global';
import { storage } from '@/utils/storage';

interface CommonState {
  toastMessage: string;
  toastVersion: number;
  showToast: (message: string) => void;
  clearToast: () => void;
  lang: Lang;
  langChosen: boolean;
  siteId: number;
  hydrate: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;
  setSiteId: (siteId: number) => Promise<void>;
}

export const useCommonStore = create<CommonState>((set) => ({
  toastMessage: '',
  toastVersion: 0,
  showToast: (message) => set((state) => ({ toastMessage: message, toastVersion: state.toastVersion + 1 })),
  clearToast: () => set({ toastMessage: '' }),
  lang: 'en-US',
  langChosen: false,
  siteId: 1,
  async hydrate() {
    const [savedLang, savedSite] = await Promise.all([
      storage.getString(STORAGE_KEYS.LANG),
      storage.getString(STORAGE_KEYS.SITE),
    ]);
    if (savedLang && SUPPORTED_LANGS.includes(savedLang as Lang)) {
      set({ lang: savedLang as Lang, langChosen: true });
    }
    if (savedSite) set({ siteId: Number(savedSite) || 1 });
  },
  async setLang(lang) {
    await storage.setString(STORAGE_KEYS.LANG, lang);
    set({ lang, langChosen: true });
  },
  async setSiteId(siteId) {
    await storage.setString(STORAGE_KEYS.SITE, String(siteId));
    set({ siteId });
  },
}));
