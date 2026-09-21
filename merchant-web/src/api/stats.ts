import { get } from '@/utils/http';

export interface DashboardKpi {
  totalPropertyCount: number;
  todayBookingCount: number;
  todayCheckInCount: number;
  todayCheckOutCount: number;
  currentGuestCount: number;
  occupancyRate: number | null;
  /** 近 7 日均值 − 前 7 日均值(百分点) */
  occupancyWeekDelta: number | null;
  todayArrivalGuestCount: number;
  todayArrivalGroupCount: number;
  /** 今日到达里尚未入住的单量 */
  todayArrivalRemainingCount: number;
  todayDepartureGuestCount: number;
  todayDepartureGroupCount: number;
  /** 今日离店里尚未退房的单量 */
  todayDeparturePendingCount: number;
  /** 区间内 PMS/渠道同步失败次数 */
  syncErrorCount: number;
  revenueToday: number;
  pendingConfirmationCount: number;
  pendingSettleAmount: number;
  activePromotionCount: number;
}

export interface DashboardTrendItem {
  date: string;
  bookingCount: number;
  salesAmount: number;
}

export interface OccupancyTrendItem {
  date: string;
  occupancyRate: number | null;
}

export interface RoomTypePerformanceItem {
  roomTypeId: number;
  roomName: string;
  bookingCount: number;
  percent: number;
}

/** 近期预订结算行(支付状态与预订状态原样下发,文案与配色由前端映射) */
export interface RecentBookingItem {
  orderId: number;
  orderNo: string;
  guest: string;
  propertyName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  paymentStatus: number;
  bookingStatus: number;
  orderStatus: number;
  /** 支付方式:4 为到店付款 */
  payMethod: number;
}

export interface PropertyPerformanceItem {
  propertyId: number;
  propertyName: string;
  todayBookings: number;
  occupancyRate: number | null;
  revenueToday: number;
  status: number;
}

export interface TodayOperationItem {
  orderId: number;
  orderNo: string;
  hotel: string;
  guest: string;
  guestPhone: string;
  room: string;
  checkIn: string;
  checkOut: string;
  status: number;
}

export interface DashboardAlertItem {
  type: string;
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
}

export interface DashboardStats {
  updatedAt: string;
  startDate: string;
  endDate: string;
  kpi: DashboardKpi;
  trend: DashboardTrendItem[];
  occupancyTrend: OccupancyTrendItem[];
  roomTypePerformance: RoomTypePerformanceItem[];
  propertyPerformance: PropertyPerformanceItem[];
  todayOperations: TodayOperationItem[];
  recentBookings: RecentBookingItem[];
  alerts: DashboardAlertItem[];
}

export function apiDashboardStats(params?: Record<string, unknown>): Promise<DashboardStats> {
  return get('/merchant/stats/dashboard', params);
}
