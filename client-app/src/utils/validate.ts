/**
 * 校验工具:手机号/邮箱/密码/非空
 */

/** 国际手机号:6-15位数字(可带+国家码,多国站点通用宽校验) */
export function isMobile(value: string): boolean {
  return /^\+?\d{6,15}$/.test(value.trim());
}

export function isEmail(value: string): boolean {
  return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(value.trim());
}

/** 密码:6-32位 */
export function isPassword(value: string): boolean {
  return value.length >= 6 && value.length <= 32;
}

export function isNotEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
