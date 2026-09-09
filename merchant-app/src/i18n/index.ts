import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from '../../assets/i18n/en-US.json';
import myMM from '../../assets/i18n/my-MM.json';
import zhCN from '../../assets/i18n/zh-CN.json';
import type { Lang } from '@/config/global';

export function initI18n(lang: Lang): void {
  if (i18n.isInitialized) return;
  void i18n.use(initReactI18next).init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
      'my-MM': { translation: myMM },
    },
    lng: lang,
    fallbackLng: 'en-US',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
  });
}

export function changeLanguage(lang: Lang): void {
  void i18n.changeLanguage(lang);
}

export default i18n;
