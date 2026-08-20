/**
 * 全局常量(存储键/请求头/业务枚举文案键)
 */

/** AsyncStorage 键统一前缀管理,禁止散落硬编码 */
export const STORAGE_KEYS = {
  TOKEN: 'mtrip:token',
  USER: 'mtrip:user',
  SITE: 'mtrip:site',
  LANG: 'mtrip:lang',
  GDPR: 'mtrip:gdpr-consent',
} as const;

/** 请求超时(ms) */
export const REQUEST_TIMEOUT = 15000;

/** 订单状态:0待支付 1已支付 2已入住/已核销 3已完成 4已取消 5退款中 6已退款 7已过期 */
export const ORDER_STATUS = {
  PENDING: 0,
  PAID: 1,
  USED: 2,
  FINISHED: 3,
  CANCELLED: 4,
  REFUNDING: 5,
  REFUNDED: 6,
  EXPIRED: 7,
} as const;

/** 订单状态 → i18n 文案键 */
export const ORDER_STATUS_I18N: Record<number, string> = {
  0: 'order.status.pending',
  1: 'order.status.paid',
  2: 'order.status.used',
  3: 'order.status.finished',
  4: 'order.status.cancelled',
  5: 'order.status.refunding',
  6: 'order.status.refunded',
  7: 'order.status.expired',
};

/** 商品类型:1酒店 2门票 */
export const GOODS_TYPE = { HOTEL: 1, TICKET: 2 } as const;

/** 支持语言 */
export const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

/** 货币符号(多币种展示,站点 currency 驱动) */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  THB: '฿',
  // MMK 不配符号:设计稿写作「MMK 185,000」,走 formatMoney 的「币种码 + 空格」兜底
};

/** 不带小数位的币种(设计稿 MMK 写作 185,000 而非 185,000.00) */
export const ZERO_DECIMAL_CURRENCIES = ['MMK', 'JPY', 'KRW', 'VND'];
