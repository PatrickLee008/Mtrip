import { defineStore } from 'pinia';

export type ThemeMode = 'light' | 'dark';
export type LocaleKey = 'zh-CN' | 'en-US';

const THEME_KEY = 'mtrip_merchant_theme';
const LOCALE_KEY = 'mtrip_merchant_locale';

interface AppState {
  theme: ThemeMode;
  locale: LocaleKey;
  /** 侧边栏折叠 */
  collapsed: boolean;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    theme: (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light',
    locale: (localStorage.getItem(LOCALE_KEY) as LocaleKey) || 'zh-CN',
    collapsed: false,
  }),
  actions: {
    toggleTheme(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, this.theme);
    },
    setLocale(locale: LocaleKey): void {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
    },
    toggleCollapsed(): void {
      this.collapsed = !this.collapsed;
    },
  },
});
