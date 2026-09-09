/** 全局常量:移动商户端独立存储前缀,避免与 client-app 登录态串用。 */

export const STORAGE_KEYS = {
  TOKEN: 'mtrip:merchant:token',
  PROFILE: 'mtrip:merchant:profile',
  LANG: 'mtrip:merchant:lang',
  SITE: 'mtrip:merchant:site',
} as const;

export const APP_VERSION = '1.0.0';
export const REQUEST_TIMEOUT = 15000;

export const SUPPORTED_LANGS = ['en-US', 'my-MM', 'zh-CN'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: Lang = 'en-US';
