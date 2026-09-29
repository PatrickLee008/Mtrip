/**
 * 校验工具:手机号/邮箱/密码/非空
 */

/** 国际手机号:6-15位数字(可带+国家码,多国站点通用宽校验) */
export function isMobile(value: string): boolean {
  return /^\+?\d{6,15}$/.test(value.trim());
}

/** 表单里的手机号:先去掉用户习惯输入的空格与横线(占位符就是「9 123 4567」),再按 isMobile 校验 */
export function isContactMobile(value: string): boolean {
  return isMobile(value.replace(/[\s-]/g, ''));
}

/**
 * 常旅客证件号(与 user-service TravelerController::validIdNo 同一套规则,改一处须同改):
 *   1 NRC   州号 1~14 / 镇区代码 3~12 个字母 (N|E|P|T|Y|S) 6 位数字,如 12/OoKaMa(N)123456
 *           (与实名认证页拼出的格式一致;大小写不敏感,空格忽略)
 *   2 护照  6~9 位字母数字,至少含 1 位数字
 *   3 其他  4~30 位字母数字及 - /
 */
export function isTravelerIdNo(idType: number, value: string): boolean {
  const v = value.replace(/\s/g, '');
  if (idType === 1) return /^(1[0-4]|[1-9])\/[A-Za-z]{3,12}\((N|E|P|T|Y|S)\)\d{6}$/i.test(v);
  if (idType === 2) return /^(?=.*\d)[A-Za-z0-9]{6,9}$/.test(v);
  return /^[A-Za-z0-9\-/]{4,30}$/.test(v);
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
