/**
 * 最近浏览的酒店(Consumer App PRD v1.0.6 模块 13「最近浏览的酒店」):
 * 酒店详情页(完整 / 关怀模式)加载成功即记一笔,按设备存在本地,最多 10 家、新的在前;
 * 平台客服聊天顶部横排展示,点一下把酒店名带进输入框,方便向客服说明在看哪家。
 */

import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';

export interface RecentHotel {
  propertyId: number;
  name: string;
  image: string;
  address: string;
  viewedAt: number;
}

const MAX = 10;

export async function getRecentHotels(): Promise<RecentHotel[]> {
  const list = await storage.getObject<RecentHotel[]>(STORAGE_KEYS.RECENT_HOTELS);
  return Array.isArray(list) ? list.filter((h) => h && h.propertyId > 0 && !!h.name) : [];
}

export async function recordRecentHotel(hotel: Omit<RecentHotel, 'viewedAt'>): Promise<void> {
  if (!hotel.propertyId || !hotel.name) return;
  const list = await getRecentHotels();
  const next = [{ ...hotel, viewedAt: Date.now() }, ...list.filter((h) => h.propertyId !== hotel.propertyId)].slice(0, MAX);
  await storage.setObject(STORAGE_KEYS.RECENT_HOTELS, next);
}
