const TOKEN_KEY = 'mtrip_merchant_token';
const SUPPORT_KEY = 'mtrip_merchant_support_token';
export function getToken(): string { return sessionStorage.getItem(SUPPORT_KEY) ?? localStorage.getItem(TOKEN_KEY) ?? ''; }
export function isSupportSession(): boolean { return sessionStorage.getItem(SUPPORT_KEY) !== null; }
export function setToken(token: string): void { sessionStorage.removeItem(SUPPORT_KEY); localStorage.setItem(TOKEN_KEY, token); }
export function setSupportToken(token: string): void { sessionStorage.setItem(SUPPORT_KEY, token); }
export function clearAuth(): void {
  // Retain an empty tab-local marker so repeated cleanup never removes or falls back to the ordinary session.
  if (isSupportSession()) sessionStorage.setItem(SUPPORT_KEY, '');
  else localStorage.removeItem(TOKEN_KEY);
}
