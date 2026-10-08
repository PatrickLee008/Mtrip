import { getLocales } from 'expo-localization';

import { FALLBACK_LANG, type Lang } from '@/config/global';

export function detectSystemLang(): Lang {
  try {
    for (const locale of getLocales()) {
      const code = (locale.languageCode || locale.languageTag.split('-')[0]).toLowerCase();
      if (code === 'zh') return 'zh-CN';
      if (code === 'en') return 'en-US';
    }
  } catch {
    // The system locale may be unavailable in an older development client.
  }
  return FALLBACK_LANG;
}
