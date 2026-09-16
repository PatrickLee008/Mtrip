import { useI18n } from 'vue-i18n';
import type { MerchantRoom } from '@/api/rooms';
export function useRoomText() { const { locale } = useI18n(); return (en: string, zh: string) => locale.value.startsWith('zh') ? zh : en; }
export function bedLabel(room: Partial<MerchantRoom>) {
  return room.bedding?.length ? room.bedding.map(b => b.quantity === 1 && /^\d/.test(b.type) ? b.type : `${b.quantity} × ${b.type}`).join(' + ') : room.bed_type || '-';
}
export function areaLabel(room: Partial<MerchantRoom>) {
  const value = Number(room.area);
  if (!Number.isFinite(value) || value <= 0) return room.area || '-';
  return `${Number((room.area_unit === 'sqft' ? value / 0.09290304 : value).toFixed(2))} ${room.area_unit === 'sqft' ? 'sqFt' : 'sqm'}`;
}
export const roomAmenities = ['wifi', 'air_conditioning', 'tv', 'mini_bar', 'safe', 'balcony', 'bathtub', 'kitchenette', 'pool_access', 'coffee_machine', 'hair_dryer', 'blackout_curtains'];
export const amenityLabels: Record<string, [string, string]> = {
  wifi: ['High Speed Wi-Fi', '高速 Wi-Fi'], air_conditioning: ['Air Conditioning', '空调'], tv: ['TV', '电视'], mini_bar: ['Mini Bar', '迷你吧'], safe: ['Safe', '保险箱'], balcony: ['Balcony', '阳台'], bathtub: ['Bathtub', '浴缸'], kitchenette: ['Kitchenette', '小厨房'], pool_access: ['Pool Access', '泳池使用权'], coffee_machine: ['Coffee Machine', '咖啡机'], hair_dryer: ['Hair Dryer', '吹风机'], blackout_curtains: ['Blackout Curtains', '遮光窗帘'],
};
