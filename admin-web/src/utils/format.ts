/** 货币符号映射(随站点配置渲染) */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
  THB: '฿',
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
}

/** 千分位金额,默认保留2位小数 */
export function formatAmount(value: number | string, digits = 2): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return '-';
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 金额+货币符号 */
export function formatMoney(value: number | string, currency = 'USD', digits = 2): string {
  return currencySymbol(currency) + formatAmount(value, digits);
}

/**
 * 整改 D3 补充:统一金额展示入口(站点币种可配)。
 * 当前默认 MMK(缅甸站点);真实站点币种以 sys_site.currency 为准,接入多站点数据后由站点配置注入。
 */
export function formatCurrency(value: number | string | null | undefined, currency = 'MMK'): string {
  const num = Number(value ?? 0);
  if (!num) {
    return '';
  }
  return formatMoney(num, currency);
}
