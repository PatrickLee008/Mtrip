/**
 * 系统货币字典（**占位，待产品定稿**）。
 *
 * ⚠️ 「系统支持哪些货币单位」目前尚未决定。这里先放平台**已经出现过**的几种，避免凭空造：
 *   - `sys_site.currency`：EUR（站点 1–4）/ MMK（站点 5–7）
 *   - `sys_config` 的 `base.default_currency`：EUR
 *   - 仓库其它处出现过：THB / PHP / USD
 * **定稿后只改这一个文件** —— 政策弹窗的币种下拉与后续价格类页面都从这里取。
 */
export const CURRENCY_OPTIONS: readonly string[] = ['EUR', 'MMK', 'THB', 'PHP', 'USD'];

/** 字典取不到时的兜底（与平台默认货币一致） */
export const FALLBACK_CURRENCY = 'EUR';

/**
 * 下拉选项 = 字典 + 传进来的当前值。
 * 物业币种（`hotel_room_type.currency`）未必在占位字典里，但必须能在下拉里显示出来，
 * 否则会出现「选不中当前值」的空壳。
 */
export function currencySelectOptions(...values: Array<string | undefined | null>): string[] {
  const codes = new Set<string>(CURRENCY_OPTIONS);
  for (const value of values) {
    const code = String(value ?? '').trim().toUpperCase();
    if (code) codes.add(code);
  }
  return [...codes];
}
