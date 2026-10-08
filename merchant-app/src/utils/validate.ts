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
  const digits = value.replace(/\D/g, '');
  const national = value.trim().startsWith(`+${countryCode}`) ? digits.slice(countryCode.length) : digits.replace(/^0+/, '');
  return `+${countryCode}${national}`;
}

export function isE164Mobile(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}
