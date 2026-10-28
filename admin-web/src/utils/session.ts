import axios from 'axios';
import { reactive } from 'vue';
import { getToken, setToken } from './auth';

const realm = 'admin';
const refreshClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api/v1', timeout: 15000, withCredentials: true });
export const sessionState = reactive({ expired: false, recoveryFailed: false, recoveryPath: '/' });
let refreshing: Promise<void> | null = null;

export function tokenClaims(token = getToken()): Record<string, unknown> {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}

export function sameAccount(a: string, b: string): boolean {
  const x = tokenClaims(a); const y = tokenClaims(b);
  return x.admin_id === y.admin_id && x.site_id === y.site_id && (x.aud ?? realm) === (y.aud ?? realm);
}

export function isProtectedRequest(url = ''): boolean {
  if (url.includes('/activation/')) return false;
  const auth = url.split('/auth/')[1]?.split('?')[0];
  return !auth || ['me', 'menus', 'logout', 'password', 'contacts', 'contacts/rebind/start', 'contacts/rebind/new', 'contacts/rebind/finish'].includes(auth);
}

export function expireSession(): void {
  sessionState.expired = true;
}

function needsRefresh(token: string): boolean {
  const claims = tokenClaims(token);
  const margin = Math.min(300, Math.max(10, (Number(claims.exp) - Number(claims.iat)) / 3));
  return !!claims.sid && Number(claims.exp) <= Date.now() / 1000 + margin;
}

async function refreshLocked(snapshot: string): Promise<void> {
  const current = getToken();
  if (current && current !== snapshot && !needsRefresh(current)) return;
  if (current !== snapshot) throw new Error('Session changed');
  const response = await refreshClient.post(`/${realm}/auth/refresh`, {}, { headers: { 'X-Mtrip-Refresh': '1' } });
  const result = response.data;
  if (result.code !== 0) throw Object.assign(new Error(result.message), { response: { data: result } });
  // Logout or another account's login while the request was in flight must win.
  if (getToken() !== snapshot) return;
  if (!sameAccount(snapshot, result.data.token)) { expireSession(); throw new Error('Account changed'); }
  setToken(result.data.token);
  window.dispatchEvent(new CustomEvent('mtrip:session-refreshed', { detail: result.data }));
}

export async function ensureSession(force = false): Promise<void> {
  if (sessionState.expired) throw new Error('Authentication required');
  const snapshot = getToken();
  if (!snapshot || (!force && !needsRefresh(snapshot))) return;
  if (!refreshing) {
    const run = () => refreshLocked(snapshot);
    // Web Locks serializes refreshes across tabs; Redis rotation tolerates concurrent tabs on HTTP/LAN browsers.
    refreshing = (navigator.locks ? navigator.locks.request(`mtrip-${realm}-refresh`, run) : run())
      .catch((error) => {
        const code = error?.response?.data?.code;
        if (getToken() !== snapshot) return;
        if ([40101, 40102, 40301, 40302].includes(code)) expireSession();
        throw error;
      }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export function setupBrowserSession(): void {
  if (window.parent !== window && new URLSearchParams(window.location.search).get('reauth') === '1') return;
  const resume = () => {
    if (!document.hidden && getToken() && !sessionState.expired) void ensureSession().catch(() => {});
  };
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', resume);
  window.setInterval(resume, 30000);
  window.addEventListener('storage', (event) => {
    if (event.key !== 'mtrip_admin_token') return;
    if (!event.newValue || (event.oldValue && !sameAccount(event.oldValue, event.newValue))) {
      window.location.replace('/login');
    }
  });
}
