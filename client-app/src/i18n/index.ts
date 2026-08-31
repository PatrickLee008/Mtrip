/**
 * i18next 初始化:en-US / my-MM / zh-CN,语言优先级:用户手选 > 系统语言 > 站点默认 > en-US
 *
 * my-MM(缅甸语)由 assets/i18n/my-MM.json 提供,键集与 en-US 逐键对齐。
 * ⚠ 缅甸语译文是机器生成的,上线前需母语者复核。
 */

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
