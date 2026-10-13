import { defineStore } from 'pinia';
import { getInitialLocale, LOCALE_KEY, type SupportedLocale } from '@/locales/preferences';

export type LocaleKey = SupportedLocale;

interface AppState {
  locale: LocaleKey;
}

/** 全局应用状态(暗色模式/侧边栏折叠已随原型改造移除,仅保留语言持久化) */
export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    locale: getInitialLocale(),
  }),
  actions: {
    setLocale(locale: LocaleKey): void {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
    },
  },
});
