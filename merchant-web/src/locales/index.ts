import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';
import { getInitialLocale } from './preferences';

export { SUPPORTED_LOCALES, type SupportedLocale } from './preferences';

/**
 * 多语言策略:
 * 1) 保存选择优先,无记录时按浏览器语言初始化;缺失翻译回退到英文
 * 2) 中文显示受控:zh-CN 只维护有中文翻译的部分;未翻译的 key 自动回退到 en-US
 * 3) 占位符:en-US 即多语言占位符源;新增文案时,只需在 en-US 添加英文,zh-CN 可选择留空使用英文
 */
export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: ['en-US'],
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});
