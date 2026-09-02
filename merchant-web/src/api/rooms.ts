import { get, post, request } from '@/utils/http';
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
  currency: string;
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
  approved_version: number;
  review_status: number;
  revision_id: number;
  revision_version: number;
  revision_action: string;
  reject_reason: string;
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

export interface RoomRevision {
  id: number;
  room_id: number;
  version: number;
  action: string;
  status: number;
  payload: Partial<MerchantRoom>;
  reject_reason: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_remark: string;
}

export interface RoomDetailResult {
  room: MerchantRoom;
  editable: Partial<MerchantRoom>;
  latestRevision: RoomRevision | null;
  history: RoomRevision[];
}

export function apiRoomDetail(id: number): Promise<RoomDetailResult> {
  return get('/merchant/rooms/detail', { id });
}

export function apiRoomSave(data: Record<string, unknown>): Promise<{ id: number; revisionId: number; version: number; reviewStatus: number }> {
  return post('/merchant/rooms/save', data);
}

export function apiRoomCopy(id: number): Promise<{ id: number; revisionId: number }> {
  return post('/merchant/rooms/copy', { id });
}

export function apiRoomWithdraw(revisionId: number): Promise<null> {
  return post('/merchant/rooms/withdraw', { revisionId });
}

export function apiRoomUpload(file: File, kind: 'image' | 'video'): Promise<{ url: string; name: string; kind: string }> {
  const data = new FormData();
  data.append('file', file);
  data.append('kind', kind);
  return request({ method: 'POST', url: '/merchant/rooms/media/upload', data });
}

export function apiRoomToggleStatus(id: number): Promise<{ status: number }> {
  return post('/merchant/rooms/toggle-status', { id });
}

export function apiRoomDelete(id: number): Promise<{ reviewRequired: boolean; revisionId?: number }> {
  return post('/merchant/rooms/delete', { id });
}
