export const LOCALE_KEY = 'mtrip_merchant_locale';

export const SUPPORTED_LOCALES = [
  { key: 'en-US', label: 'English' },
  { key: 'zh-CN', label: '中文' },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['key'];

export function getInitialLocale(): SupportedLocale {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === 'zh-CN' || saved === 'en-US') return saved;
  return /^zh(?:-|$)/i.test(navigator.language) ? 'zh-CN' : 'en-US';
}
