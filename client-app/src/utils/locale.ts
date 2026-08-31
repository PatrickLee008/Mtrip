/**
 * 系统语言探测:把设备语言映射到 App 支持的语言,取不到一律回落英语
 *
 * expo-localization 的 getLocales() 按用户偏好顺序返回,取第一条能映射上的;
 * 中文不分简繁(zh-Hant 也落 zh-CN,项目只有简体一份译文)。
 */

import { getLocales } from 'expo-localization';

import { FALLBACK_LANG, SUPPORTED_LANGS, type Lang } from '@/config/global';

/** ISO 639-1 语言码 → App 语言 */
const LANGUAGE_CODE_MAP: Record<string, Lang> = {
  en: 'en-US',
  my: 'my-MM',
  zh: 'zh-CN',
};

/** 设备当前语言(取不到/不支持 → en-US) */
export function detectSystemLang(): Lang {
  try {
    for (const locale of getLocales()) {
      // languageTag 形如 en-US / my-MM / zh-Hans-CN,先按完整标签精确匹配
      const tag = locale.languageTag ?? '';
      const exact = SUPPORTED_LANGS.find((l) => l === tag);
      if (exact) return exact;

      const code = (locale.languageCode ?? tag.split('-')[0] ?? '').toLowerCase();
      const mapped = LANGUAGE_CODE_MAP[code];
      if (mapped) return mapped;
    }
  } catch {
    // 原生模块不可用(如未重建的 dev client)时静默回落
  }
  return FALLBACK_LANG;
}
