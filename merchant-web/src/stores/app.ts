import { defineStore } from 'pinia';

export type LocaleKey = 'zh-CN' | 'en-US';

const LOCALE_KEY = 'mtrip_merchant_locale';

interface AppState {
  locale: LocaleKey;
}

/** 全局应用状态(暗色模式/侧边栏折叠已随原型改造移除,仅保留语言持久化) */
export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    locale: (localStorage.getItem(LOCALE_KEY) as LocaleKey) || 'zh-CN',
  }),
  actions: {
    setLocale(locale: LocaleKey): void {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
    },
  },
});
