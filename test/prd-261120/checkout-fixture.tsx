import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCheckoutWindow } from '../../client-app/src/screens/hotel/useCheckoutWindow';

declare global { interface Window { fixture: any; actions: any; subject: any; fixtureOpen: any; } }
const fixture = window.fixture = {
  now: Number(localStorage.getItem('fixture-now') || Date.now()),
  calls: [], expires: 0, fail: false, failWrites: false,
};
Object.defineProperty(performance, 'now', { value: () => fixture.now });
window.fixtureOpen = async (params: any) => {
  fixture.calls.push(params);
  if (fixture.fail) throw new Error('Quote unavailable');
  const all = JSON.parse(localStorage.getItem('fixture-server') || '{}');
  let row = all[params.checkoutKey];
  if (!row) row = { revision: 1, expiresAtMs: fixture.now + 600000 };
  else if (params.review && row.expiresAtMs <= fixture.now) row = { revision: row.revision + 1, expiresAtMs: fixture.now + 600000 };
  all[params.checkoutKey] = row;
  localStorage.setItem('fixture-server', JSON.stringify(all));
  return { ...row, checkoutKey: params.checkoutKey, serverNowMs: fixture.now, expired: row.expiresAtMs <= fixture.now, tripId: 0,
    quote: { items: [], payAmount: 200 } };
};
function App() {
  const [active, setActive] = useState(true);
  const [userId, setUser] = useState(910010);
  const checkout = useCheckoutWindow({ enabled: true, active, userId, siteId: 7, items: [
    { propertyId: 81, roomTypeId: 91, quantity: 1, useDate: '2027-01-01', endDate: '2027-01-02' },
    { propertyId: 82, roomTypeId: 92, quantity: 1, useDate: '2027-01-01', endDate: '2027-01-02' },
  ], couponId: 0, payAtHotel: false, onExpired: () => { fixture.expires++; setActive(false); } });
  window.subject = checkout;
  window.actions = { setActive, setUser, active,
    advance: (ms: number) => { fixture.now += ms; localStorage.setItem('fixture-now', String(fixture.now)); },
    review: async () => { const r = await checkout.begin(true); if (r && !r.expired) setActive(true); },
  };
  return <main><h1>{active ? 'Payment' : 'Price Review'}</h1><output id="time">{checkout.time}</output>
    <p id="status">{checkout.loading ? 'Loading' : checkout.expired ? 'Expired' : checkout.error || 'Ready'}</p>
    <button id="pay" disabled={!checkout.ready}>Pay</button>
    <button id="review" onClick={() => void window.actions.review()}>Review Price and Availability</button></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
