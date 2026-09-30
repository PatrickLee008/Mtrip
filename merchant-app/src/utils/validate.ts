export function required(value: string): boolean {
  return value.trim().length > 0;
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function normalizeMyanmarMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('95')) return `+${digits}`;
  return `+95${digits.replace(/^0+/, '')}`;
}

export function isE164Mobile(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}
