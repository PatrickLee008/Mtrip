import React from 'react';
import { createRoot } from 'react-dom/client';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../client-app/assets/i18n/en-US.json';
import HotelBookingScreen from '../../client-app/src/screens/hotel/HotelBookingScreen';
import { useRoomCartStore } from '../../client-app/src/store/roomCartStore';

const host: any = window;
const fixture = host.fixture = { now: Date.now(), checkoutCalls: [], quoteCalls: 0, price: 100, server: {}, toast: [] };
Object.defineProperty(performance, 'now', { value: () => fixture.now });
fixture.advance = (ms: number) => { fixture.now += ms; };
const room = (id: number) => ({ id, room_name: 'Standard Room', base_price: 100, max_guests: 2, bed_type: 'Double' });
host.fixtureHTTP = async (_method: string, path: string, params: any = {}) => {
  if (path.includes('/hotels/detail')) return { id: params.propertyId, goods_name: 'Hotel '+params.propertyId, address: 'Yangon', skus: [room(91),room(92)], addons: [], refundRules: [] };
  if (path.includes('/traveler/list')) return [];
  if (path.includes('/match-list')) return { list: [], best: null };
  if (path.includes('/pay/methods')) return [{ payMethod: 3, enabled: true, autoApply: false, maxUse: { hotel: 0 }, currencies: [] },{ payMethod: 5, enabled: true, currencies: [] }];
  const quote = () => { fixture.quoteCalls++; return { original:params.items.length*fixture.price, longstayDiscount:0, couponId:0, couponDiscount:0, couponError:null,
    payAmount:params.items.length*fixture.price, addonAmount:0, payAtHotelAvailable:false,
    items:params.items.map((v:any)=>({...v,nights:1,original:fixture.price,longstayDiscount:0,couponDiscount:0,payAmount:fixture.price})) }; };
  if(path.endsWith('/trip/quote')) return quote();
  if(path.endsWith('/trip/checkout')) {
    fixture.checkoutCalls.push(params);
    let row=fixture.server[params.checkoutKey];
    if(!row)row=fixture.server[params.checkoutKey]={revision:1,expiresAtMs:fixture.now+600000};
    else if(params.review && row.expiresAtMs<=fixture.now){row.revision++;row.expiresAtMs=fixture.now+600000;}
    return {...row,checkoutKey:params.checkoutKey,serverNowMs:fixture.now,expired:row.expiresAtMs<=fixture.now,tripId:0,quote:quote()};
  }
  throw Error('Unexpected wizard API: '+path);
};
const item = (id: number) => ({ roomKey:'room-'+id,name:'Standard Room',price:100,quantity:1,attrs:[],sku:room(id) });
useRoomCartStore.setState({ propertyId:82,hotelName:'Hotel 82',checkIn:'2027-01-01',checkOut:'2027-01-02',items:[item(92)],
  tripStays:[{key:'qa-stay',propertyId:81,hotelName:'Hotel 81',checkIn:'2027-01-01',checkOut:'2027-01-02',items:[item(91)]}],tripDraft:null } as any);
void i18next.use(initReactI18next).init({ lng:'en-US', fallbackLng:'en-US', resources:{'en-US':{translation:en}},interpolation:{escapeValue:false} }).then(()=>{
  createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18next}><HotelBookingScreen /></I18nextProvider>);
});
