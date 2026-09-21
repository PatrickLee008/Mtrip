/**
 * Dashboard & Earnings 页(Figma `1306:18423`)纯函数助手。
 *
 * 图表几何、金额/百分比/日期文案、徽标口径全部收在这里 —— 组件只做渲染,
 * 于是 `scripts/check-earnings-figma.mjs` 可以脱离 DOM 直接断言这些口径。
 * 日期文案刻意用手写月份表而非 `toLocaleDateString`,保证 zh-CN 环境也输出稿面的
 * 英文短月("Oct 01"),不会随运行环境漂移。
 */
import { currencySymbol, formatAmount } from '@/utils/format';
import type { DashboardStats, RoomTypePerformanceItem } from '@/api/stats';
import type { EarningsOverview } from '@/api/earnings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 页面空态 = 响应缺字段时的兜底基线 */
export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  updatedAt: '',
  startDate: '',
  endDate: '',
  kpi: {
    totalPropertyCount: 0,
    todayBookingCount: 0,
    todayCheckInCount: 0,
    todayCheckOutCount: 0,
    currentGuestCount: 0,
    occupancyRate: null,
    occupancyWeekDelta: null,
    todayArrivalGuestCount: 0,
    todayArrivalGroupCount: 0,
    todayArrivalRemainingCount: 0,
    todayDepartureGuestCount: 0,
    todayDepartureGroupCount: 0,
    todayDeparturePendingCount: 0,
    syncErrorCount: 0,
    revenueToday: 0,
    pendingConfirmationCount: 0,
    pendingSettleAmount: 0,
    activePromotionCount: 0,
  },
  trend: [],
  occupancyTrend: [],
  roomTypePerformance: [],
  propertyPerformance: [],
  todayOperations: [],
  recentBookings: [],
  alerts: [],
};

export const EMPTY_EARNINGS_OVERVIEW: EarningsOverview = {
  startDate: '',
  endDate: '',
  currency: 'THB',
  bookingVolume: 0,
  grossRevenue: 0,
  commission: 0,
  commissionRate: null,
  discountAmount: 0,
  mtripPays: 0,
  merchantPays: 0,
  netSettlement: 0,
  settlement: {
    pendingAmount: 0,
    processingAmount: 0,
    paidAmount: 0,
    disputedAmount: 0,
    pendingCount: 0,
    processingCount: 0,
    paidCount: 0,
    disputedCount: 0,
  },
};

/**
 * 把后端响应并回默认值再落到响应式状态。
 *
 * 后端是长驻 Swoole 进程:改了控制器但没重启服务时,worker 里仍是旧类,返回体里可能缺字段。
 * 直接 `stats.value = res` 会让 `occupancyTrend` 变成 undefined,渲染期 computed 抛
 * 「Cannot read properties of undefined (reading 'slice')」→ 整页白屏且 spinner 卡住。
 * 这里逐字段兜底,缺字段只降级为「该项无数据」,不影响其余区块。
 */
export function normalizeStats(raw: DashboardStats | null | undefined): DashboardStats {
  return {
    ...EMPTY_DASHBOARD_STATS,
    ...(raw ?? {}),
    kpi: { ...EMPTY_DASHBOARD_STATS.kpi, ...(raw?.kpi ?? {}) },
    trend: raw?.trend ?? [],
    occupancyTrend: raw?.occupancyTrend ?? [],
    roomTypePerformance: raw?.roomTypePerformance ?? [],
    propertyPerformance: raw?.propertyPerformance ?? [],
    todayOperations: raw?.todayOperations ?? [],
    recentBookings: raw?.recentBookings ?? [],
    alerts: raw?.alerts ?? [],
  };
}

export function normalizeOverview(raw: EarningsOverview | null | undefined): EarningsOverview {
  return {
    ...EMPTY_EARNINGS_OVERVIEW,
    ...(raw ?? {}),
    settlement: { ...EMPTY_EARNINGS_OVERVIEW.settlement, ...(raw?.settlement ?? {}) },
  };
}

/** 环形图半径/描边(稿面 156×156 画布内直径 140.4) */
export const DONUT_RADIUS = 70.2;
export const DONUT_STROKE = 18;
/** 环形图分段配色,按稿面图例顺序:主色 → 次色 → 芯片色 */
export const DONUT_COLORS = ['#4169ED', '#D9E1FB', '#EBF0FF', '#94A3B8', '#22C55E', '#BB4D00'];

/** 金额(稿面整数金额不带小数,币种取 merchant_store.currency) */
export function moneyText(value: number | string | null | undefined, currency: string, digits = 0): string {
  return currencySymbol(currency) + formatAmount(value ?? 0, digits);
}

/** 扣减金额:稿面写作 "- MMK 200,000"(减号后带空格) */
export function deductionMoneyText(value: number | null | undefined, currency: string, digits = 0): string {
  return `- ${currencySymbol(currency)}${formatAmount(Math.abs(Number(value) || 0), digits)}`;
}

/** 百分比:null 显示占位符 */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(digits)}%`;
}

/** 扣减百分比:稿面写作 "- 15%" */
export function deductionPercentText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const num = Number(value);
  return `- ${num.toFixed(Number.isInteger(num) ? 0 : 1)}%`;
}

/** 带符号的周环比:稿面 "+4% this week"(绿色,负数走红色) */
export function deltaText(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const num = Number(value);
  return `${num >= 0 ? '+' : '-'}${Math.abs(num).toFixed(digits)}%`;
}

export function isNegativeDelta(value: number | null | undefined): boolean {
  return Number(value) < 0;
}

/** 日期 → "Oct 01" */
export function monthDayLabel(date: string): string {
  const parts = String(date).split('-');
  const month = MONTHS[Number(parts[1]) - 1];
  if (!month || !parts[2]) {
    return String(date);
  }
  return `${month} ${parts[2]}`;
}

/** 日期 → "Oct 2026" */
export function monthLabel(date: string): string {
  const parts = String(date).split('-');
  const month = MONTHS[Number(parts[1]) - 1];
  if (!month) {
    return String(date);
  }
  return `${month} ${parts[0]}`;
}

/** 区间 → "Oct 01, 2026 – Oct 31, 2026"(稿面导出弹窗) */
export function isoRangeLabel(start: string, end: string): string {
  if (!start || !end) {
    return '';
  }
  return `${monthDayLabel(start)}, ${start.slice(0, 4)} – ${monthDayLabel(end)}, ${end.slice(0, 4)}`;
}

/** 单条预订的入住区间 → "Oct 12 - Oct 14"(稿面表格) */
export function stayRangeLabel(checkIn: string, checkOut: string): string {
  if (!checkIn && !checkOut) {
    return '—';
  }
  if (!checkOut) {
    return monthDayLabel(checkIn);
  }
  return `${monthDayLabel(checkIn)} - ${monthDayLabel(checkOut)}`;
}

/** 订单号显示:稿面写作 "#BK-1029" */
export function bookingRef(orderNo: string): string {
  const text = String(orderNo ?? '');
  if (text === '') {
    return '—';
  }
  return text.startsWith('#') ? text : `#${text}`;
}

/**
 * 从日期序列里等距取 count 个刻度(稿面 30 天区间取 8 个:Oct 01/04/08/12/16/20/24/28)
 */
export function sampleLabels(dates: readonly string[], count: number): string[] {
  if (dates.length === 0) {
    return [];
  }
  if (count <= 1 || dates.length === 1) {
    return [monthDayLabel(dates[0])];
  }
  const step = (dates.length - 1) / (count - 1);
  const picked: string[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(monthDayLabel(dates[Math.round(i * step)]));
  }
  return picked;
}

/** 峰值点:稿面 "Peak: Oct 20" */
export function peakOf(
  trend: readonly { date: string; salesAmount: number }[],
): { date: string; value: number } | null {
  if (trend.length === 0) {
    return null;
  }
  let best = trend[0];
  for (const item of trend) {
    if (item.salesAmount > best.salesAmount) {
      best = item;
    }
  }
  return { date: best.date, value: best.salesAmount };
}

/** 区间日均入住率(null 不参与平均);稿面 "Avg: 75%" */
export function averageOccupancy(items: readonly { occupancyRate: number | null }[]): number | null {
  const values: number[] = [];
  for (const item of items) {
    if (item.occupancyRate !== null && item.occupancyRate !== undefined) {
      values.push(Number(item.occupancyRate));
    }
  }
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/** ISO 星期序号:周一=0 … 周日=6;非法日期返回 -1 */
export function isoWeekdayIndex(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return -1;
  }
  return (parsed.getUTCDay() + 6) % 7;
}

/** 预订量按星期聚合(稿面 Booking Volume Trend 的 Mon–Sun 七柱) */
export function weekdayBuckets(
  trend: readonly { date: string; bookingCount: number }[],
): { label: string; value: number }[] {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  for (const item of trend) {
    const index = isoWeekdayIndex(item.date);
    if (index >= 0) {
      sums[index] += Number(item.bookingCount) || 0;
    }
  }
  return WEEKDAYS.map((label, index) => ({ label, value: sums[index] }));
}

/** 柱高(占容器高度的百分比),全 0 时给最小可见高度 */
export function barHeights(values: readonly number[], maxHeight = 100, minHeight = 5): number[] {
  let max = 0;
  for (const value of values) {
    max = Math.max(max, Number(value) || 0);
  }
  if (max <= 0) {
    return values.map(() => minHeight);
  }
  return values.map((value) => Math.max(minHeight, Math.round(((Number(value) || 0) / max) * maxHeight)));
}

/** 入住率迷你柱:归一化到稿面 20px 高条带(8–20px) */
export function sparklineHeights(values: readonly (number | null)[], min = 8, max = 20): number[] {
  const nums = values.map((value) => (value === null || value === undefined ? 0 : Number(value)));
  if (nums.length === 0) {
    return [];
  }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (hi <= lo) {
    return nums.map(() => min);
  }
  return nums.map((value) => Math.round(min + ((value - lo) / (hi - lo)) * (max - min)));
}

/** 折线/面积图的 SVG 顶点串("x,y x,y …",viewBox 由调用方给定) */
export function linePoints(
  values: readonly (number | null)[],
  width: number,
  height: number,
  padTop = 6,
  padBottom = 6,
): string {
  if (values.length === 0) {
    return '';
  }
  const nums = values.map((value) => (value === null || value === undefined ? 0 : Number(value)));
  const hi = Math.max(...nums, 1);
  const usable = Math.max(1, height - padTop - padBottom);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return nums
    .map((value, index) => {
      const x = Math.round(index * stepX * 100) / 100;
      const y = Math.round((padTop + usable - (value / hi) * usable) * 100) / 100;
      return `${x},${y}`;
    })
    .join(' ');
}

/** 面积图闭合路径:底边 → 折线 → 回到右下 */
export function areaPath(points: string, width: number, height: number): string {
  if (points === '') {
    return '';
  }
  return `M0,${height} L${points.replace(/ /g, ' L')} L${width},${height} Z`;
}

/** 折线最高点坐标,供稿面的红色峰值圆点(Marker)使用 */
export function peakPoint(
  values: readonly (number | null)[],
  width: number,
  height: number,
  padTop = 6,
  padBottom = 6,
): { x: number; y: number; index: number } {
  if (values.length === 0) {
    return { x: 0, y: 0, index: -1 };
  }
  const nums = values.map((value) => (value === null || value === undefined ? 0 : Number(value)));
  let index = 0;
  for (let i = 0; i < nums.length; i += 1) {
    if (nums[i] > nums[index]) {
      index = i;
    }
  }
  const hi = Math.max(...nums, 1);
  const usable = Math.max(1, height - padTop - padBottom);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return {
    x: Math.round(index * stepX * 100) / 100,
    y: Math.round((padTop + usable - (nums[index] / hi) * usable) * 100) / 100,
    index,
  };
}

export interface DonutSegment {
  key: string;
  name: string;
  percent: number;
  count: number;
  color: string;
  dash: string;
  offset: number;
}

/** 环形图分段:stroke-dasharray / dashoffset 几何 */
export function donutSegments(items: readonly RoomTypePerformanceItem[]): DonutSegment[] {
  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const round = (value: number): number => Math.round(value * 100) / 100;
  let accumulated = 0;
  return items.map((item, index) => {
    const percent = Math.max(0, Number(item.percent) || 0);
    const length = (percent / 100) * circumference;
    const segment: DonutSegment = {
      key: `${item.roomTypeId}-${index}`,
      name: item.roomName,
      percent,
      count: Number(item.bookingCount) || 0,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      dash: `${round(length)} ${round(circumference - length)}`,
      offset: round(-accumulated),
    };
    accumulated += length;
    return segment;
  });
}

/** 环形图圆心总数 */
export function donutTotal(items: readonly RoomTypePerformanceItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.bookingCount) || 0), 0);
}

export type EaBadgeTone = 'success' | 'neutral' | 'refund' | 'warn' | 'primary' | 'danger';

export interface EaBadge {
  key: string;
  tone: EaBadgeTone;
}

/**
 * Payment 徽标:到店付款优先于支付状态(稿面 Pay at Hotel 为独立橙色徽标),
 * 部分/全额退款归 Refund(红),已支付归 Paid(绿),其余(待支付/失败/旧数据)归 Unpaid(灰)。
 */
export function paymentBadge(row: { paymentStatus: number; payMethod: number }): EaBadge {
  if (Number(row.payMethod) === 4) {
    return { key: 'payAtHotel', tone: 'warn' };
  }
  if (Number(row.paymentStatus) === 3 || Number(row.paymentStatus) === 4) {
    return { key: 'refund', tone: 'refund' };
  }
  if (Number(row.paymentStatus) === 2) {
    return { key: 'paid', tone: 'success' };
  }
  return { key: 'unpaid', tone: 'neutral' };
}

/**
 * Booking Status 徽标:booking_status 1–6 直映;
 * 0(旧数据兼容)回退 order_status,避免历史单被一律显示成「待支付」。
 */
export function bookingBadge(row: { bookingStatus: number; orderStatus: number }): EaBadge {
  switch (Number(row.bookingStatus)) {
    case 1:
      return { key: 'pendingPayment', tone: 'warn' };
    case 2:
      return { key: 'confirmed', tone: 'primary' };
    case 3:
      return { key: 'checkedIn', tone: 'success' };
    case 4:
      return { key: 'checkedOut', tone: 'neutral' };
    case 5:
      return { key: 'cancelled', tone: 'danger' };
    case 6:
      return { key: 'noShow', tone: 'refund' };
    default:
      break;
  }
  switch (Number(row.orderStatus)) {
    case 0:
    case 1:
      return { key: 'pendingPayment', tone: 'warn' };
    case 2:
      return { key: 'checkedIn', tone: 'success' };
    case 3:
      return { key: 'checkedOut', tone: 'neutral' };
    default:
      return { key: 'cancelled', tone: 'danger' };
  }
}

/** 图表 Y 轴刻度(稿面三档),由数据最大值生成可读档位 */
export function axisScale(maxValue: number, steps = 2): string[] {
  const safeMax = Math.max(1, Number(maxValue) || 0);
  const labels: string[] = [];
  for (let i = steps; i >= 0; i -= 1) {
    labels.push(compactNumber((safeMax / steps) * i));
  }
  return labels;
}

/** 1000 万级缩写:稿面 "10M" / "5M" / "0" */
export function compactNumber(value: number): string {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1_000_000_000) {
    return `${Math.round(num / 1_000_000_000)}B`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${Math.round(num / 1_000_000)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${Math.round(num / 1_000)}K`;
  }
  return String(Math.round(num));
}

/** 入住率迷你柱取最近 count 天 */
export function lastValues<T>(items: readonly T[], count: number): T[] {
  return items.slice(Math.max(0, items.length - count));
}
