/**
 * 房型购物车(Figma M-Trip / Room Cart `2659:11842`)
 *
 * 酒店详情 Rooms 页签加购、`RoomCart` 页管理数量与结算,两处必须是同一份数据,
 * 所以提到 store 里(与 `siteStore` / `userStore` 同为 zustand)。
 *
 * **换酒店即清空**:`order/create` 与 `trip/create` 都不接受跨物业的一单,
 * 车里混进两家酒店的房型在结算那一步必然失败,不如在进详情页时就清干净。
 * 判定以 `propertyId` 为准;演示模式(没有真实物业)统一用 `undefined`,同样只保留一份。
 *
 * 单价存的是**每晚单价**(`hotel_room_type.base_price`),合计 = Σ 单价 × 间数 × 晚数;
 * 晚数由入离日期算,没选日期时按 1 晚(与详情页起价口径一致)。
 *
 * **多酒店行程**(Figma `1675:9406` / `1675:9158`):订房向导第 2 步点「Add Hotel and Homestay」时,
 * 当前这家酒店的车连同入离日期整段转存进 `tripStays`,车清空后回搜索页挑下一家;
 * 车始终只装「正在挑的那一家」(详情页 / 购物车页只看它),向导把 `tripStays` + 车合成多段住宿,
 * 一次 `trip/create` 下单(后端本就支持跨物业、各自日期)。离开向导时已填的住客资料暂存在 `tripDraft`。
 */

import { create } from 'zustand';
import type { ImageSourcePropType } from 'react-native';

import type { HomeIconName } from '@/components/home/HomeIcon';
import type { BookingAddonKey, LeadGuestForm } from '@/screens/hotel/bookingDemo';
import type { GoodsSku } from '@/types/models';

export interface CartRoom {
  /** 真实房型 `room-<id>`,设计稿演示房型是其 key */
  roomKey: string;
  name: string;
  /** 每晚单价 */
  price: number;
  /** 划线原价(没有就不显示) */
  strike?: number | null;
  /** 促销小字的 i18n key(设计稿演示房型用;真实房型暂无此字段) */
  promoKey?: string | null;
  quantity: number;
  cover?: ImageSourcePropType;
  /** 卡片上那排属性(人数/床型/早餐/Wifi),已是可直接渲染的文案 */
  attrs: { key: string; icon: HomeIconName; label: string }[];
  /** 真实房型才有;演示房型为空,结算时进不了真实模式 */
  sku?: GoodsSku;
}

/** 已加入行程的一段住宿(一家酒店 + 一组入离日期 + 该酒店选的房型) */
export interface TripStay {
  key: string;
  propertyId: number;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  items: CartRoom[];
  /**
   * 这一段在向导第 1 步填好的内容(每家酒店各自一份):主要入住人、特殊要求、附加服务与人数。
   * 下单时这一段的预订用它自己的联系人与附加服务;车里正在挑的那一家(active)取向导当前表单。
   */
  lead?: LeadGuestForm;
  request?: string;
  addons?: BookingAddonKey[];
  guestCount?: number;
}

/** stashStay 时随这一段一起存下的第 1 步内容 */
export type TripStayExtras = Pick<TripStay, 'lead' | 'request' | 'addons' | 'guestCount'>;

/** 去挑下一家酒店前暂存的向导表单(向导页会被卸载,回来时据此恢复) */
export interface TripDraft {
  form: LeadGuestForm;
  request: string;
  addons: BookingAddonKey[];
}

interface RoomCartState {
  /** 车属于哪家酒店(演示模式为 undefined) */
  propertyId?: number;
  hotelName: string;
  checkIn?: string;
  checkOut?: string;
  items: CartRoom[];
  /**
   * 最近一单订下的房型快照。下单成功要把车清空(免得回到房型页还挂着已经订掉的房),
   * 但成功页还要按「本单订了哪几间」列明细 —— 读 `items` 必然读到清空后的空数组,
   * 所以清空时把内容转存到这里。
   */
  booked: CartRoom[];
  /** 已加入行程的住宿(不含正在挑的那一家) */
  tripStays: TripStay[];
  tripDraft: TripDraft | null;

  /** 进详情页时调用:换了酒店就清空,同一家则保留已选 */
  setContext: (ctx: {
    propertyId?: number;
    hotelName: string;
    checkIn?: string;
    checkOut?: string;
  }) => void;
  /** Choose / Remove:已在车里就整条移出,否则加 1 间 */
  toggle: (room: Omit<CartRoom, 'quantity'>) => void;
  /** 加减器;qty <= 0 表示移出(由调用方先弹确认框) */
  setQuantity: (roomKey: string, quantity: number) => void;
  remove: (roomKey: string) => void;
  /** 下单成功:车里与行程里的房型转存为 `booked` 快照后全部清空(单房型旧链路车本就是空的,快照也随之清掉) */
  checkout: () => void;
  clear: () => void;
  /**
   * 「Add Hotel and Homestay」:当前车(须有真实物业、日期与真实房型)整段转存进 `tripStays`,
   * 车清空,并暂存向导表单。日期取向导里实际用的那组(已按 normalizeDates 纠正过)。
   */
  /**
   * 把车(当前这家)连同第 1 步内容转存为一段住宿;`draft` 是下一家进向导时的初始表单
   * (主要入住人默认沿用,特殊要求与附加服务清空)。
   */
  stashStay: (draft: TripDraft, dates: { checkIn: string; checkOut: string }, extras?: TripStayExtras) => void;
  removeTripStay: (key: string) => void;
  /** 恢复表单后清掉暂存(再加下一家时会重新暂存) */
  clearTripDraft: () => void;
}

/**
 * 行程里的全部住宿:已加入的 + 车里正在挑的那一家(须有物业、日期与真实房型),key 为 `active`。
 * 订房向导自己按路由日期拼(会纠正过去的日期);Stay 明细页没有向导状态,用这份。
 * 注意返回新数组,组件里请先分别订阅各字段再 useMemo 调用,别直接当 zustand selector。
 */
export function combineTripStays(state: {
  tripStays: TripStay[];
  propertyId?: number;
  hotelName: string;
  checkIn?: string;
  checkOut?: string;
  items: CartRoom[];
}): TripStay[] {
  const real = state.items.filter((item) => item.sku);
  const active =
    state.propertyId && state.checkIn && state.checkOut && real.length > 0
      ? [
          {
            key: 'active',
            propertyId: state.propertyId,
            hotelName: state.hotelName,
            checkIn: state.checkIn,
            checkOut: state.checkOut,
            items: real,
          },
        ]
      : [];
  return [...state.tripStays, ...active];
}

/** 入离日期之间的晚数;缺日期或算不出来时按 1 晚 */
export function nightsBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 1;
  const from = new Date(`${checkIn}T00:00:00`).getTime();
  const to = new Date(`${checkOut}T00:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 1;
  const nights = Math.round((to - from) / 86400000);
  return nights > 0 ? nights : 1;
}

export const useRoomCartStore = create<RoomCartState>((set, get) => ({
  propertyId: undefined,
  hotelName: '',
  checkIn: undefined,
  checkOut: undefined,
  items: [],
  booked: [],
  tripStays: [],
  tripDraft: null,

  setContext: (ctx) => {
    const sameHotel = get().propertyId === ctx.propertyId;
    set({
      propertyId: ctx.propertyId,
      hotelName: ctx.hotelName,
      checkIn: ctx.checkIn,
      checkOut: ctx.checkOut,
      items: sameHotel ? get().items : [],
    });
  },

  toggle: (room) =>
    set((state) => {
      const exists = state.items.some((item) => item.roomKey === room.roomKey);
      return {
        items: exists
          ? state.items.filter((item) => item.roomKey !== room.roomKey)
          : [...state.items, { ...room, quantity: 1 }],
      };
    }),

  setQuantity: (roomKey, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((item) => item.roomKey !== roomKey)
          : state.items.map((item) =>
              item.roomKey === roomKey ? { ...item, quantity } : item,
            ),
    })),

  remove: (roomKey) =>
    set((state) => ({ items: state.items.filter((item) => item.roomKey !== roomKey) })),

  checkout: () =>
    set((state) => ({
      booked: [...state.tripStays.flatMap((stay) => stay.items), ...state.items],
      items: [],
      tripStays: [],
      tripDraft: null,
    })),

  clear: () => set({ items: [] }),

  stashStay: (draft, dates, extras = {}) =>
    set((state) => {
      const real = state.items.filter((item) => item.sku);
      if (!state.propertyId || !dates.checkIn || !dates.checkOut || real.length === 0) {
        return { tripDraft: draft };
      }
      return {
        tripStays: [
          ...state.tripStays,
          {
            key: `stay-${state.propertyId}-${dates.checkIn}-${Date.now()}`,
            propertyId: state.propertyId,
            hotelName: state.hotelName,
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            items: real,
            ...extras,
          },
        ],
        items: [],
        tripDraft: draft,
      };
    }),

  removeTripStay: (key) =>
    set((state) => ({ tripStays: state.tripStays.filter((stay) => stay.key !== key) })),

  clearTripDraft: () => set({ tripDraft: null }),
}));
