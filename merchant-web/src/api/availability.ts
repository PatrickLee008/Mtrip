import { get, post } from '@/utils/http';

export interface AvailabilityDay {
  date: string;
  price: number;
  stockTotal: number;
  stockSold: number;
  stockLocked: number;
  stockLeft: number;
  isClosed: number;
  minStay: number;
  maxStay: number;
  closedToArrival: number;
  closedToDeparture: number;
  source: string;
  note: string;
  hasRecord: number;
}

export interface AvailabilityRoom {
  id: number;
  site_id: number;
  goods_id: number;
  name: string;
  bed_type: string;
  base_price: number;
  weekend_price: number;
  base_stock: number;
  status: number;
  days?: AvailabilityDay[];
}

export interface AvailabilityHotel {
  id: number;
  name: string;
  merchant_id: number;
  cover_image: string;
  address: string;
  rooms: AvailabilityRoom[];
}

export interface AvailabilityCalendar {
  startDate: string;
  endDate: string;
  dates: string[];
  hotels: AvailabilityHotel[];
  summary: {
    hotelCount: number;
    roomCount: number;
    lowInventoryCells: number;
    closedCells: number;
    pms: string;
    channelManager: string;
    lastSyncAt: string;
  };
}

export interface StockLogRow {
  id: number;
  stock_date: string;
  change_type: number;
  change_qty: number;
  operator_id: number;
  remark: string;
  created_at: string;
}

export function apiAvailabilityOptions(params?: Record<string, unknown>): Promise<AvailabilityHotel[]> {
  return get('/merchant/availability/options', params);
}

export function apiAvailabilityCalendar(params: Record<string, unknown>): Promise<AvailabilityCalendar> {
  return get('/merchant/availability/calendar', params);
}

export function apiAvailabilitySaveDay(data: Record<string, unknown>): Promise<null> {
  return post('/merchant/availability/save-day', data);
}

export function apiAvailabilityBatchSet(data: Record<string, unknown>): Promise<{ affectedCells: number }> {
  return post('/merchant/availability/batch-set', data);
}

export function apiAvailabilityLogs(params: Record<string, unknown>): Promise<StockLogRow[]> {
  return get('/merchant/availability/logs', params);
}

export function apiAvailabilitySyncNow(): Promise<{ pms: string; channelManager: string; lastSyncAt: string }> {
  return post('/merchant/availability/sync-now');
}
