/**
 * 多房间 / 多住宿的只读试算(`trip/quote`),订房向导与购物车页共用。
 *
 * 后端 `trip/quote` 与 `trip/create` 是同一套计价(日历价 / 公民价 / 长住 / 券 / 分摊),
 * 所以页面上的金额以它为准,前端不自己算钱。
 *
 * 结果按「算的是哪份入参」打标签,只在入参仍一致时返回 —— 改了间数/日期/券之后,
 * 新结果回来之前不会拿旧金额冒充(余额校验等会读到它)。分两种口径返回:
 *   - `itemsQuote`:房型/日期一致即可(不管券)。原价与长住优惠与券无关,用它;
 *                   结账页拿它做券门槛基数时,换券不会让基数抖动,券列表 ↔ 试算不会来回触发。
 *   - `quote`:房型/日期/券全一致。券额与应付用它。
 */

import { useEffect, useState } from 'react';

import { apiTripQuote, type TripQuoteItem, type TripQuoteResult } from '@/api/trip';
import type { CartRoom } from '@/store/roomCartStore';

/**
 * 购物车房型 → Trip 行(不含联系人)。试算与 `trip/create` 都从这里取,保证试算的就是将要提交的内容。
 * 只收有真实 `sku` 的房型(演示房型没有 sku,进不了真实下单)。
 */
export function cartTripItems(
  propertyId: number,
  rooms: CartRoom[],
  checkIn: string,
  checkOut: string,
): TripQuoteItem[] {
  return rooms
    .filter((room) => room.sku)
    .map((room) => ({
      propertyId,
      roomTypeId: room.sku!.id,
      quantity: room.quantity,
      useDate: checkIn,
      endDate: checkOut,
    }));
}

interface QuoteState {
  itemsKey: string;
  couponId: number;
  quote: TripQuoteResult;
}

/**
 * @param items    `cartTripItems` 的结果(调用方用 useMemo 保持引用稳定即可,内部按内容比较)
 * @param couponId 领券记录 id,0 = 不用券
 * @param enabled  未登录 / 日期没选全 / 车里没有真实房型时传 false,两种口径都返回 null
 */
export function useTripQuote(items: TripQuoteItem[], couponId: number, enabled: boolean) {
  const itemsKey = enabled && items.length > 0 ? JSON.stringify(items) : '';
  const [state, setState] = useState<QuoteState | null>(null);

  useEffect(() => {
    if (!itemsKey) return;
    let alive = true;
    void apiTripQuote({ items, couponId: couponId || undefined })
      .then((quote) => {
        if (alive) setState({ itemsKey, couponId, quote });
      })
      .catch(() => {
        /* 静默失败:调用方退回预估值,真正的错误由提交时的 trip/create 报出 */
        if (alive) setState(null);
      });
    return () => {
      alive = false;
    };
    // itemsKey 已是 items 的内容序列化,不再单独依赖 items 的引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, couponId]);

  const itemsQuote = state && itemsKey && state.itemsKey === itemsKey ? state.quote : null;
  const quote = itemsQuote && state!.couponId === couponId ? itemsQuote : null;
  return { itemsQuote, quote };
}
