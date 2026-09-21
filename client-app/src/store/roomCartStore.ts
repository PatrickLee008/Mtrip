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
 */

import { create } from 'zustand';
import type { ImageSourcePropType } from 'react-native';

import type { HomeIconName } from '@/components/home/HomeIcon';
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
  /** 下单成功:车里的内容转存为 `booked` 快照后清空(单房型旧链路车本就是空的,快照也随之清掉) */
  checkout: () => void;
  clear: () => void;
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

  checkout: () => set((state) => ({ booked: state.items, items: [] })),

  clear: () => set({ items: [] }),
}));
