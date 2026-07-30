import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

/**
 * 多语言策略:
 * 1) 默认显示英文:en-US 作为 fallbackLocale,即使某个 key 在当前 locale 缺失,也回退到英文
 * 2) 中文显示受控:zh-CN 只维护有中文翻译的部分;未翻译的 key 自动回退到 en-US
 * 3) 占位符:en-US 即多语言占位符源;新增文案时,只需在 en-US 添加英文,zh-CN 可选择留空使用英文
 */
export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('mtrip_merchant_locale') || 'en-US',
  fallbackLocale: ['en-US'],
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

/** 支持的语言列表(供语言切换器使用) */
export const SUPPORTED_LOCALES = [
  { key: 'en-US', label: 'English' },
  { key: 'zh-CN', label: '中文' },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['key'];
