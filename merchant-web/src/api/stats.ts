import { get } from '@/utils/http';

export interface DashboardKpi {
  totalPropertyCount: number;
  todayBookingCount: number;
  todayCheckInCount: number;
  todayCheckOutCount: number;
  currentGuestCount: number;
  occupancyRate: number | null;
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
  kpi: DashboardKpi;
  trend: DashboardTrendItem[];
  propertyPerformance: PropertyPerformanceItem[];
  todayOperations: TodayOperationItem[];
  alerts: DashboardAlertItem[];
}

export function apiDashboardStats(params?: Record<string, unknown>): Promise<DashboardStats> {
  return get('/merchant/stats/dashboard', params);
}
