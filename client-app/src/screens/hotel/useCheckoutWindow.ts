import { useCallback, useEffect, useRef, useState } from 'react';
import { apiTripCheckout, type TripQuoteItem, type CheckoutWindow } from '@/api/trip';
import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';

type SavedKey = { identity: string; key: string };
const keys = new Map<string, Promise<string>>();
async function savedKey(identity: string): Promise<string> {
  if (!keys.has(identity)) keys.set(identity, (async () => {
    const raw = await storage.getObject<SavedKey[]>(STORAGE_KEYS.CHECKOUT_SESSIONS);
    const saved = Array.isArray(raw) ? raw : [];
    const found = saved.find(v => v.identity === identity && /^[a-zA-Z0-9_-]{16,64}$/.test(v.key));
    if (found) return found.key;
    const key = `checkout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    await storage.setObject(STORAGE_KEYS.CHECKOUT_SESSIONS, [...saved.slice(-19), { identity, key }]);
    const verify = await storage.getObject<SavedKey[]>(STORAGE_KEYS.CHECKOUT_SESSIONS);
    if (!verify?.some(v => v.identity === identity && v.key === key)) throw new Error('Unable to save checkout session');
    return key;
  })().catch(error => { keys.delete(identity); throw error; }));
  return keys.get(identity)!;
}

/** A persisted key retrieves the same server deadline after re-entry/reload. */
export function useCheckoutWindow(options: {
  enabled: boolean; active: boolean; userId: number; siteId: number; items: TripQuoteItem[];
  couponId: number; payAtHotel: boolean; onExpired: () => void;
}) {
  const { enabled, active, userId, siteId, items, couponId, payAtHotel } = options;
  const identity = JSON.stringify([userId, siteId, items]);
  const [state, setState] = useState<{ identity: string; window: CheckoutWindow } | null>(null);
  const [seconds, setSeconds] = useState(600);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const anchor = useRef({ at: 0, remaining: 0 });
  const expire = useRef(options.onExpired); expire.current = options.onExpired;
  const serial = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; serial.current++; }; }, []);
  const begin = useCallback(async (review = false, onError?: (message: string) => void) => {
    const request = ++serial.current;
    setLoading(true); setError('');
    try {
      const checkoutKey = await savedKey(identity);
      const result = await apiTripCheckout({ checkoutKey, items, couponId: couponId || undefined, payAtHotel: payAtHotel ? 1 : 0, review: review ? 1 : 0 });
      if (!mounted.current || request !== serial.current) return null;
      const remaining = Math.max(0, result.expiresAtMs - result.serverNowMs);
      anchor.current = { at: performance.now(), remaining };
      setState({ identity, window: result }); setSeconds(Math.ceil(remaining / 1000)); setExpired(remaining <= 0);
      return result;
    } catch (e) {
      if (mounted.current && request === serial.current) {
        const message = e instanceof Error ? e.message : 'Checkout unavailable';
        setError(message);
        onError?.(message);
      }
      return null;
    } finally { if (mounted.current && request === serial.current) setLoading(false); }
  // identity serializes the items and owner scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, couponId, payAtHotel]);
  useEffect(() => { if (enabled && active) void begin(); }, [enabled, active, begin]);
  const window = state?.identity === identity ? state.window : null;
  useEffect(() => {
    if (!enabled || !window || window.tripId) return;
    let notified = false;
    const tick = () => {
      const remaining = Math.max(0, anchor.current.remaining - (performance.now() - anchor.current.at));
      setSeconds(Math.ceil(remaining / 1000));
      if (!remaining && !notified) { notified = true; setExpired(true); expire.current(); }
    };
    tick(); const interval = setInterval(tick, 250); return () => clearInterval(interval);
  }, [window, enabled]);
  async function complete(): Promise<void> {
    keys.delete(identity);
    const saved = await storage.getObject<SavedKey[]>(STORAGE_KEYS.CHECKOUT_SESSIONS);
    if (Array.isArray(saved)) await storage.setObject(STORAGE_KEYS.CHECKOUT_SESSIONS, saved.filter(v => v.identity !== identity));
  }
  return { window, seconds, loading, error, expired, begin, complete,
    ready: !enabled || Boolean(window && !window.tripId && !loading && !error && !expired && seconds > 0),
    time: `00:${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}` };
}
