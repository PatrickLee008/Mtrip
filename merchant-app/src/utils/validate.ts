export function required(value: string): boolean {
  return value.trim().length > 0;
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}
