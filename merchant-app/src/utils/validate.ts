export function required(value: string): boolean {
  return value.trim().length > 0;
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export type PhoneCountryCode = '95' | '86';

export function phoneCountryCode(value: string): PhoneCountryCode {
  return value.startsWith('+86') ? '86' : '95';
}

export function localPhoneNumber(value: string, countryCode: PhoneCountryCode): string {
  return value.replace(new RegExp(`^\\+${countryCode}`), '');
}

export function normalizeMobile(value: string, countryCode: PhoneCountryCode): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  // Do not silently turn letters or misplaced plus signs into a valid number.
  if (!/^\+?\d+$/.test(compact)) return value.trim();
  if (compact.startsWith('+')) return compact;
  const national = countryCode === '95' ? compact.replace(/^0/, '') : compact;
  return `+${countryCode}${national}`;
}

export function isMobileNumber(value: string, countryCode?: PhoneCountryCode): boolean {
  if (countryCode && !value.startsWith(`+${countryCode}`)) return false;
  return /^\+861[3-9]\d{9}$/.test(value) || /^\+959\d{7,9}$/.test(value);
}

export function isEmail(value: string): boolean {
  const email = value.trim();
  if (email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
    && /^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/i.test(labels[labels.length - 1]);
}
