/**
 * 附加服务(Enhance Your Stay)的前端口径。
 *
 * 实付以后端 `trip/quote` / `order/create` 为准(规则唯一实现是 backend shared `HotelAddons`);
 * 这里只在试算还没回来(或未登录)时给一个**同公式**的预估:单价 × 人数(按人)× 晚数(按晚)× 间数(按间),
 * 都不选 = 按次收一次。附加服务不参与优惠券与长住折扣,取消时全额退。
 */

import type { HotelAddon } from '@/types/models';

export function addonAmount(addon: HotelAddon, guests: number, nights: number, rooms: number): number {
  let factor = 1;
  for (const unit of addon.units) {
    if (unit === 'person') factor *= Math.max(1, guests);
    if (unit === 'night') factor *= Math.max(1, nights);
    if (unit === 'room') factor *= Math.max(1, rooms);
  }
  return Math.round(addon.price * factor * 100) / 100;
}

export function addonsEstimate(
  options: HotelAddon[],
  keys: string[],
  guests: number,
  nights: number,
  rooms: number,
): number {
  const total = options
    .filter((addon) => keys.includes(addon.key))
    .reduce((sum, addon) => sum + addonAmount(addon, guests, nights, rooms), 0);
  return Math.round(total * 100) / 100;
}
