import { request } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface RoomHotelOption {
  id: number;
  merchant_id: number;
  merchant_name: string;
  property_name: string;
  cover_image: string;
  address: string;
  status: number;
  currency: string;
}

export interface Bedding { id: string; type: string; quantity: number }
export interface RoomImage { url: string; category: 'bedroom' | 'bathroom' | 'view' | 'other' }
export interface Hotspot { id: string; x: number; y: number; title: string; description: string; image: string }
export interface RefundPolicy { ruleType: number; rules: { hours_before: number; refund_rate: number }[]; remark: string }
export type MediaKind = 'image' | 'video' | 'panorama' | 'vr_cover' | 'floorplan' | 'closeup';
export interface RoomMetrics { totalRooms: number; roomTypes: { id: number; room_name: string; base_stock: number; property_id: number }[] }
const headers = (propertyId = 0) => propertyId > 0 ? { 'X-Mtrip-Property-Id': String(propertyId) } : {};

export interface MerchantRoom {
  id: number;
  site_id: number;
  property_id: number;
  property_name: string;
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
  bedding?: Bedding[];
  area_unit?: 'sqm' | 'sqft';
  image_gallery?: RoomImage[];
  panorama?: { enabled: boolean; url: string };
  vr_tour?: { enabled: boolean; url: string; cover: string };
  floor_plan?: { enabled: boolean; image: string; hotspots: Hotspot[] };
  refund_policy?: RefundPolicy;
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
  /** 未来窗口天数(后端固定 7):今天之后 N 天内最低可售 */
  upcoming_days?: number;
  upcoming_stock_left?: number;
  /** 最低可售所在日期(YYYY-MM-DD);窗口内全关房时为空串 */
  upcoming_stock_date?: string;
  /** 明天起窗口内已售+锁定合计(间夜):非今日订单的信号,> 0 时卡片高亮 */
  upcoming_sold?: number;
}

export function apiRoomHotels(): Promise<RoomHotelOption[]> {
  return request({ url: '/merchant/rooms/hotel-options', headers: headers() });
}

export function apiRoomList(params: Record<string, unknown>): Promise<PageData<MerchantRoom> & { metrics: RoomMetrics }> {
  return request({ url: '/merchant/rooms/list', params, headers: headers(Number(params.propertyId || 0)) });
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
  currentRefundPolicy: RefundPolicy;
  room: MerchantRoom;
  editable: Partial<MerchantRoom>;
  latestRevision: RoomRevision | null;
  history: RoomRevision[];
}

export function apiRoomDetail(id: number, propertyId = 0): Promise<RoomDetailResult> {
  return request({ url: '/merchant/rooms/detail', params: { id }, headers: headers(propertyId) });
}

export function apiRoomSave(data: Record<string, unknown>): Promise<{ id: number; revisionId: number; version: number; reviewStatus: number }> {
  return request({ method: 'POST', url: '/merchant/rooms/save', data, headers: headers(Number(data.propertyId)) });
}

export function apiRoomCopy(id: number, propertyId: number): Promise<{ id: number; revisionId: number }> {
  return request({ method: 'POST', url: '/merchant/rooms/copy', data: { id }, headers: headers(propertyId) });
}

export function apiRoomWithdraw(revisionId: number, propertyId: number): Promise<null> {
  return request({ method: 'POST', url: '/merchant/rooms/withdraw', data: { revisionId }, headers: headers(propertyId) });
}

export function apiRoomUpload(file: File, kind: MediaKind, propertyId: number, roomId = 0): Promise<{ url: string; name: string; kind: string }> {
  const data = new FormData();
  data.append('file', file);
  data.append('kind', kind);
  data.append('propertyId', String(propertyId));
  data.append('roomId', String(roomId));
  return request({ method: 'POST', url: '/merchant/rooms/media/upload', data, headers: headers(propertyId), timeout: 600000 });
}

export function apiRoomToggleStatus(id: number, propertyId: number): Promise<{ status: number }> {
  return request({ method: 'POST', url: '/merchant/rooms/toggle-status', data: { id }, headers: headers(propertyId) });
}

export function apiRoomDelete(id: number, propertyId: number): Promise<{ reviewRequired: boolean; revisionId?: number }> {
  return request({ method: 'POST', url: '/merchant/rooms/delete', data: { id }, headers: headers(propertyId) });
}
