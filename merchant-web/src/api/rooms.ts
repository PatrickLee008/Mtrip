import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface RoomHotelOption {
  id: number;
  merchant_id: number;
  merchant_name: string;
  goods_name: string;
  cover_image: string;
  address: string;
  status: number;
}

export interface MerchantRoom {
  id: number;
  site_id: number;
  goods_id: number;
  goods_name: string;
  merchant_id: number;
  room_name: string;
  room_code: string;
  description: string;
  bed_type: string;
  bed_count: number;
  area: string;
  max_adults: number;
  max_children: number;
  max_guests: number;
  floor_name: string;
  room_view: string;
  smoking: number;
  breakfast: number;
  meal_plan: string;
  cancellation_policy: string;
  checkin_notes: string;
  base_price: number;
  weekend_price: number;
  extra_bed_price: number;
  base_stock: number;
  launch_stock: number;
  images: string[];
  video_url: string;
  facilities: string[];
  status: number;
  publish_status: number;
  submitted_at: string | null;
  sort: number;
  today_stock_total?: number;
  today_stock_left?: number;
}

export function apiRoomHotels(): Promise<RoomHotelOption[]> {
  return get('/merchant/rooms/hotel-options');
}

export function apiRoomList(params: Record<string, unknown>): Promise<PageData<MerchantRoom>> {
  return get('/merchant/rooms/list', params);
}

export function apiRoomDetail(id: number): Promise<MerchantRoom> {
  return get('/merchant/rooms/detail', { id });
}

export function apiRoomSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/merchant/rooms/save', data);
}

export function apiRoomToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/rooms/toggle-status', { id });
}

export function apiRoomDelete(id: number): Promise<null> {
  return post('/merchant/rooms/delete', { id });
}
