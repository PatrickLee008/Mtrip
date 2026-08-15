import { defineStore } from 'pinia';

export type LocaleKey = 'zh-CN' | 'en-US';

const LOCALE_KEY = 'mtrip_admin_locale';
const SITE_KEY = 'mtrip_admin_site';

interface AppState {
  locale: LocaleKey;
  /** 侧边栏折叠 */
  collapsed: boolean;
  /** 当前站点(0=全平台,仅超管可切换) */
  siteId: number;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    locale: (localStorage.getItem(LOCALE_KEY) as LocaleKey) || 'zh-CN',
    collapsed: false,
    siteId: Number(localStorage.getItem(SITE_KEY) ?? 0),
  }),
  actions: {
    setLocale(locale: LocaleKey): void {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
    },
    toggleCollapsed(): void {
      this.collapsed = !this.collapsed;
    },
    setSiteId(siteId: number): void {
      this.siteId = siteId;
      localStorage.setItem(SITE_KEY, String(siteId));
    },
  },
});
