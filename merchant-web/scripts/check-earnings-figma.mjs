/**
 * Dashboard & Earnings(Figma `fsK2rrl2sadcowrxspvGV8` SECTION `1306:18423`
 * 「Business Dashboard & Settlement」)实现校验。
 *
 * 与仓库既有的 `scripts/check-*-figma.mjs` 同一套路:用 Vite 以 SSR 方式打包并**真实渲染**
 * 本页各组件(带稿面样例行),逐条断言稿面硬值 —— 页头文案、四张概览卡的标签与值、
 * Earnings Breakdown 四行与 Net 高亮、四张图的标题 + Peak/Avg 徽标、Mon–Sun 星期标签、
 * 环形图图例三行与圆心总数、结算表 7 列表头与四类 Payment / 六类 Booking Status 徽标、
 * 导出弹窗字段与三张格式卡、10 个图标 path;另断言编译产物 CSS 与 tokens.less 的稿面令牌。
 *
 * ⚠ Vue 只能在被打包的那一份实例里创建(vue-i18n 的 provide/inject 依赖同一份 vue),
 * 所以 app 的创建与 renderToString 都写在生成的 entry 里,本脚本只读 HTML 字符串。
 *
 * 运行:`cd merchant-web && node scripts/check-earnings-figma.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const workDir = path.join(webRoot, '.figma-cache', 'check-earnings');
const outDir = path.join(workDir, 'dist');

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const ENTRY = `
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createI18n } from 'vue-i18n';
import Antd from 'ant-design-vue';
import enUS from '../../src/locales/en-US.ts';
import SummaryCard from '../../src/views/earnings/components/SummaryCard.vue';
import SparklineBars from '../../src/views/earnings/components/SparklineBars.vue';
import DailyRevenueCard from '../../src/views/earnings/components/DailyRevenueCard.vue';
import EarningsBreakdownCard from '../../src/views/earnings/components/EarningsBreakdownCard.vue';
import TrendLineCard from '../../src/views/earnings/components/TrendLineCard.vue';
import OccupancyAreaCard from '../../src/views/earnings/components/OccupancyAreaCard.vue';
import BookingVolumeCard from '../../src/views/earnings/components/BookingVolumeCard.vue';
import RoomTypeDonutCard from '../../src/views/earnings/components/RoomTypeDonutCard.vue';
import SettlementsTable from '../../src/views/earnings/components/SettlementsTable.vue';
import ExportReportModal from '../../src/views/earnings/components/ExportReportModal.vue';
import EaIcon from '../../src/views/earnings/components/EaIcon.vue';
import EarningsPage from '../../src/views/earnings/index.vue';
import * as eaHelpers from '../../src/views/earnings/helpers.ts';

const noop = { mounted() {}, updated() {} };

function makeApp(component, props) {
  const app = createSSRApp({ render: () => h(component, props) });
  app.use(createI18n({ legacy: false, locale: 'en-US', fallbackLocale: ['en-US'], messages: { 'en-US': enUS } }));
  app.use(Antd);
  app.directive('perm', noop);
  return app;
}

async function render(component, props) {
  return renderToString(makeApp(component, props));
}

/** Teleport 到 body 的内容要单独取(ctx.teleports.body) */
async function renderTeleported(component, props) {
  const ctx = {};
  const html = await renderToString(makeApp(component, props), ctx);
  return html + (ctx.teleports?.body ?? '');
}

export const renderSummaryCard = (props) => render(SummaryCard, props);
export const renderSparkline = (props) => render(SparklineBars, props);
export const renderDailyRevenue = (props) => render(DailyRevenueCard, props);
export const renderBreakdown = (props) => render(EarningsBreakdownCard, props);
export const renderTrendLine = (props) => render(TrendLineCard, props);
export const renderOccupancyArea = (props) => render(OccupancyAreaCard, props);
export const renderBookingVolume = (props) => render(BookingVolumeCard, props);
export const renderRoomTypeDonut = (props) => render(RoomTypeDonutCard, props);
export const renderSettlements = (props) => render(SettlementsTable, props);
export const renderExportModal = (props) => renderTeleported(ExportReportModal, props);
export const renderIcon = (props) => render(EaIcon, props);
export const renderPage = () => render(EarningsPage, {});
export const helpers = eaHelpers;

/** 稿面样例数据(Figma 1306:18423 逐字取自画板) */
export function fixture() {
  // 28 天:Oct 01 – Oct 28,峰值落在 Oct 20(稿面 "Peak: Oct 20" 且 Y 轴 10M/5M/0)
  const trend = [];
  for (let i = 0; i < 28; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    trend.push({
      date: '2026-10-' + day,
      bookingCount: 3 + (i % 7),
      salesAmount: i === 19 ? 10000000 : 2000000 + i * 100000,
    });
  }
  // 70 / 80 交替 → 均值正好 75(稿面 "Avg: 75%")
  const occupancyTrend = trend.map((item, i) => ({
    date: item.date,
    occupancyRate: i % 2 === 0 ? 70 : 80,
  }));

  // 环形图:圆心 128 Bookings,图例 50% / 35% / 15%
  const roomTypePerformance = [
    { roomTypeId: 1, roomName: 'Deluxe King', bookingCount: 64, percent: 50 },
    { roomTypeId: 2, roomName: 'Standard Room', bookingCount: 45, percent: 35 },
    { roomTypeId: 3, roomName: 'Executive Suite', bookingCount: 19, percent: 15 },
  ];

  const kpi = {
    totalPropertyCount: 1,
    todayBookingCount: 12,
    todayCheckInCount: 12,
    todayCheckOutCount: 5,
    currentGuestCount: 20,
    occupancyRate: 78,
    occupancyWeekDelta: 4,
    todayArrivalGuestCount: 12,
    todayArrivalGroupCount: 5,
    todayArrivalRemainingCount: 3,
    todayDepartureGuestCount: 5,
    todayDepartureGroupCount: 5,
    todayDeparturePendingCount: 0,
    syncErrorCount: 3,
    revenueToday: 170000,
    pendingConfirmationCount: 2,
    pendingSettleAmount: 4080000,
    activePromotionCount: 3,
  };

  // 稿面结算表 9 行(TEXT 节点逐字)
  const booking = (over) => ({
    orderId: 0, orderNo: '', guest: '', propertyName: 'The Royal Palms Resort', roomType: '',
    checkIn: '', checkOut: '', totalAmount: 0, paymentStatus: 2, bookingStatus: 2,
    orderStatus: 3, payMethod: 1, ...over,
  });
  const recentBookings = [
    booking({ orderId: 1, orderNo: 'BK-1029', guest: 'Aung Aung', roomType: 'Deluxe Room', checkIn: '2026-10-12', checkOut: '2026-10-14', totalAmount: 170000, paymentStatus: 2, bookingStatus: 2 }),
    booking({ orderId: 2, orderNo: 'BK-1030', guest: 'Su Su', roomType: 'Standard Room', checkIn: '2026-10-12', checkOut: '2026-10-13', totalAmount: 85000, paymentStatus: 1, bookingStatus: 1 }),
    booking({ orderId: 3, orderNo: 'BK-1031', guest: 'Min Min', roomType: 'Family Suite', checkIn: '2026-10-13', checkOut: '2026-10-15', totalAmount: 140000, paymentStatus: 2, bookingStatus: 3 }),
    booking({ orderId: 4, orderNo: 'BK-1032', guest: 'Thida Htun', roomType: 'Family Suite', checkIn: '2026-10-10', checkOut: '2026-10-12', totalAmount: 320000, paymentStatus: 2, bookingStatus: 4 }),
    booking({ orderId: 5, orderNo: 'BK-1033', guest: 'Kyaw Zin', roomType: 'Standard Room', checkIn: '2026-10-11', checkOut: '2026-10-12', totalAmount: 85000, paymentStatus: 4, bookingStatus: 5 }),
    booking({ orderId: 6, orderNo: 'BK-1034', guest: 'Hla Hla Win', roomType: 'Deluxe Room', checkIn: '2026-10-12', checkOut: '2026-10-14', totalAmount: 190000, paymentStatus: 2, bookingStatus: 6 }),
    booking({ orderId: 7, orderNo: 'BK-1035', guest: 'Nandar Lwin', roomType: 'Family Suite', checkIn: '2026-10-14', checkOut: '2026-10-17', totalAmount: 540000, paymentStatus: 1, payMethod: 4, bookingStatus: 2 }),
    booking({ orderId: 8, orderNo: 'BK-1036', guest: 'Zayar Oo', roomType: 'Deluxe Room', checkIn: '2026-10-15', checkOut: '2026-10-16', totalAmount: 170000, paymentStatus: 1, bookingStatus: 1 }),
    booking({ orderId: 9, orderNo: 'BK-1037', guest: 'Khin Myo Thu', roomType: 'Standard Room', checkIn: '2026-10-15', checkOut: '2026-10-18', totalAmount: 210000, paymentStatus: 2, bookingStatus: 2 }),
  ];

  const overview = {
    startDate: '2026-10-01', endDate: '2026-10-31', currency: 'MMK',
    bookingVolume: 128, grossRevenue: 5000000, commission: 750000, commissionRate: 15,
    discountAmount: 200000, mtripPays: 60000, merchantPays: 200000, netSettlement: 4080000,
    settlement: {
      pendingAmount: 0, processingAmount: 0, paidAmount: 0, disputedAmount: 0,
      pendingCount: 0, processingCount: 0, paidCount: 0, disputedCount: 0,
    },
  };

  return { trend, occupancyTrend, roomTypePerformance, kpi, recentBookings, overview };
}
`;

/** 去掉 SSR 作用域属性与注释,压缩空白,便于断言 */
function strip(html) {
  return html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/ data-v-[0-9a-z]+(="")?/g, '')
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .replace(/\s+/g, ' ');
}

/** 含指定类的元素上的完整 class 列表 */
function classesOf(html, base) {
  return [...html.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1].split(' '))
    .filter((list) => list.includes(base));
}

/** 指定类元素的文本(greedy 到第一个 '<') */
function textsOf(html, cls) {
  return [...html.matchAll(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([^<]*)<`, 'g'))].map((match) => match[1]);
}

/** 取 SVG 里所有 path 的 d */
function pathsOf(html) {
  return [...html.matchAll(/<path[^>]*\sd="([^"]*)"/g)].map((match) => match[1]);
}

/** 稿面图标按 lucide 原始 path 逐字内联(与 EaIcon.vue 的 PATHS 同源) */
const ICONS = {
  'log-in': ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  percent: ['M19 5 5 19', 'M4 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z', 'M15 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z'],
  'alert-triangle': ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
};

async function main() {
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, 'entry.js'), ENTRY);

  await build({
    root: webRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [vue()],
    resolve: { alias: { '@': path.join(webRoot, 'src') } },
    // 必须把 vue / vue-i18n 一并打进产物,否则 Node 侧会拿到两份实例,i18n provide/inject 直接失效
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: path.join(workDir, 'entry.js'),
      outDir,
      emptyOutDir: true,
      minify: false,
      cssMinify: false,
      ssrEmitAssets: true,
      write: true,
    },
  });

  const bundle = await import(pathToFileURL(path.join(outDir, 'entry.js')).href);
  const fx = bundle.fixture();
  const helpers = bundle.helpers;

  // ---------- 纯函数口径 ----------
  console.log('\nhelpers(日期 / 金额 / 百分比口径)');
  check('月日文案 Oct 01', helpers.monthDayLabel('2026-10-01') === 'Oct 01');
  check('月份文案 Oct 2026', helpers.monthLabel('2026-10-01') === 'Oct 2026');
  check('区间文案 Oct 01, 2026 – Oct 31, 2026', helpers.isoRangeLabel('2026-10-01', '2026-10-31') === 'Oct 01, 2026 – Oct 31, 2026');
  check('入住区间 Oct 12 - Oct 14', helpers.stayRangeLabel('2026-10-12', '2026-10-14') === 'Oct 12 - Oct 14');
  check('订单号补 # 前缀', helpers.bookingRef('BK-1029') === '#BK-1029');
  check('已带 # 不重复补', helpers.bookingRef('#BK-1029') === '#BK-1029');
  check('金额 MMK 5,000,000(整数不带小数)', helpers.moneyText(5000000, 'MMK') === 'MMK 5,000,000');
  check('扣减金额 - MMK 200,000', helpers.deductionMoneyText(200000, 'MMK') === '- MMK 200,000');
  check('扣减百分比 - 15%', helpers.deductionPercentText(15) === '- 15%');
  check('周环比 +4%', helpers.deltaText(4) === '+4%');
  check('负周环比 -3%(走红色分支)', helpers.deltaText(-3) === '-3%' && helpers.isNegativeDelta(-3) === true);
  check('百分比 78%', helpers.formatPercent(78) === '78%');
  check('百分比 null 显示占位 —', helpers.formatPercent(null) === '—');
  check('峰值点落在 Oct 20', helpers.peakOf(fx.trend).date === '2026-10-20');
  check('峰值金额 10,000,000', helpers.peakOf(fx.trend).value === 10000000);
  check('入住率均值 75', helpers.averageOccupancy(fx.occupancyTrend) === 75);
  check('Y 轴三档 10M / 5M / 0', JSON.stringify(helpers.axisScale(10000000, 2)) === JSON.stringify(['10M', '5M', '0']));
  check('千分位缩写 1K / 1M', helpers.compactNumber(1000) === '1K' && helpers.compactNumber(1000000) === '1M');
  check(
    '星期聚合为 Mon–Sun 七档',
    JSON.stringify(helpers.weekdayBuckets(fx.trend).map((item) => item.label)) ===
      JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  );
  check('星期聚合总量 = 区间预订总量', helpers.weekdayBuckets(fx.trend).reduce((sum, item) => sum + item.value, 0) === fx.trend.reduce((sum, item) => sum + item.bookingCount, 0));
  check('刻度等距取 8 个且首尾为 Oct 01 / Oct 28', (() => {
    const labels = helpers.sampleLabels(fx.trend.map((item) => item.date), 8);
    return labels.length === 8 && labels[0] === 'Oct 01' && labels[7] === 'Oct 28';
  })());

  console.log('\n徽标口径(Payment / Booking Status)');
  const badgeOf = (row) => helpers.paymentBadge(row).key;
  const bookBadgeOf = (row) => helpers.bookingBadge(row).key;
  check('已支付 → Paid', badgeOf({ paymentStatus: 2, payMethod: 1 }) === 'paid');
  check('待支付 → Unpaid', badgeOf({ paymentStatus: 1, payMethod: 1 }) === 'unpaid');
  check('已退款 → Refund', badgeOf({ paymentStatus: 4, payMethod: 1 }) === 'refund');
  check('到店付款优先于支付状态 → Pay at Hotel', badgeOf({ paymentStatus: 1, payMethod: 4 }) === 'payAtHotel');
  check('booking_status 1..6 直映', [
    bookBadgeOf({ bookingStatus: 1, orderStatus: 0 }),
    bookBadgeOf({ bookingStatus: 2, orderStatus: 0 }),
    bookBadgeOf({ bookingStatus: 3, orderStatus: 0 }),
    bookBadgeOf({ bookingStatus: 4, orderStatus: 0 }),
    bookBadgeOf({ bookingStatus: 5, orderStatus: 0 }),
    bookBadgeOf({ bookingStatus: 6, orderStatus: 0 }),
  ].join(',') === 'pendingPayment,confirmed,checkedIn,checkedOut,cancelled,noShow');
  check('booking_status=0 旧数据回退 order_status=3 → Checked-out', bookBadgeOf({ bookingStatus: 0, orderStatus: 3 }) === 'checkedOut');

  console.log('\n环形图几何');
  const segments = helpers.donutSegments(fx.roomTypePerformance);
  check('分段数 = 3', segments.length === 3);
  check('配色按稿面顺序 #4169ED / #D9E1FB / #EBF0FF', segments.map((s) => s.color).join(',') === '#4169ED,#D9E1FB,#EBF0FF');
  check('圆心总数 128', helpers.donutTotal(fx.roomTypePerformance) === 128);
  check('dashoffset 依次累加(第二段为负的第一段弧长)', segments[1].offset < 0 && segments[2].offset < segments[1].offset);

  // ---------- 响应兜底(2026-09-21 白屏事故回归) ----------
  // 后端是长驻 Swoole 进程,改了控制器不重启就仍返回旧结构;前端若直接赋值会让
  // occupancyTrend 变成 undefined,渲染期 computed 抛 reading 'slice' → 白屏 + spinner 卡死。
  console.log('\n响应兜底(normalizeStats / normalizeOverview)');
  const legacyStats = helpers.normalizeStats({
    updatedAt: '2026-09-21 10:00:00',
    kpi: { todayBookingCount: 7, revenueToday: 1234 },
    trend: [{ date: '2026-09-01', bookingCount: 2, salesAmount: 100 }],
  });
  check('旧响应缺 occupancyTrend 时兜底为空数组(不再 undefined)', Array.isArray(legacyStats.occupancyTrend) && legacyStats.occupancyTrend.length === 0);
  check('旧响应缺 roomTypePerformance / recentBookings 时兜底为空数组',
    Array.isArray(legacyStats.roomTypePerformance) && Array.isArray(legacyStats.recentBookings));
  check('旧响应缺的其余数组一并兜底',
    ['trend', 'propertyPerformance', 'todayOperations', 'alerts'].every((k) => Array.isArray(legacyStats[k])));
  check('旧响应已有的字段被保留', legacyStats.kpi.todayBookingCount === 7 && legacyStats.kpi.revenueToday === 1234);
  check('旧响应缺的 kpi 字段回落到 0/null 而非 undefined',
    legacyStats.kpi.syncErrorCount === 0 && legacyStats.kpi.occupancyRate === null && legacyStats.kpi.occupancyWeekDelta === null);
  check('兜底后 lastValues 不再抛错', (() => {
    try {
      return helpers.lastValues(legacyStats.occupancyTrend, 6).length === 0;
    } catch {
      return false;
    }
  })());
  check('null / undefined 响应也能兜底', (() => {
    const a = helpers.normalizeStats(null);
    const b = helpers.normalizeStats(undefined);
    return Array.isArray(a.occupancyTrend) && Array.isArray(b.recentBookings) && a.kpi.syncErrorCount === 0;
  })());
  const legacyOverview = helpers.normalizeOverview({ grossRevenue: 500, currency: 'MMK' });
  check('旧 overview 缺 settlement 时兜底为全 0 结构', legacyOverview.settlement.pendingAmount === 0 && legacyOverview.settlement.paidCount === 0);
  check('旧 overview 已有的币种与金额被保留', legacyOverview.currency === 'MMK' && legacyOverview.grossRevenue === 500);
  check('旧 overview 缺 commissionRate 时为 null(显示占位而非 NaN)', legacyOverview.commissionRate === null);
  check('空态常量与后端契约字段齐备', helpers.EMPTY_DASHBOARD_STATS.kpi.syncErrorCount === 0 && helpers.EMPTY_EARNINGS_OVERVIEW.currency === 'THB');

  // ---------- 概览卡 ----------
  console.log('\nSummaryCard(Figma 1306:18423 summary-row)');
  const arrival = strip(await bundle.renderSummaryCard({ label: "Today's Arrivals", value: '12 Guests', sub: '3 groups remaining', tone: 'default' }));
  check('标签 Today’s Arrivals', arrival.includes('Today&#39;s Arrivals') || arrival.includes("Today's Arrivals"));
  check('数值 12 Guests', arrival.includes('>12 Guests<'));
  check('副文案 3 groups remaining', arrival.includes('>3 groups remaining<'));
  check('卡片承载 card-label / card-value / card-sub 三层', ['card-label', 'card-value', 'card-sub'].every((cls) => classesOf(arrival, cls).length === 1));

  const pending = strip(await bundle.renderSummaryCard({ label: 'Pending Actions', value: '3 Sync Errors', sub: 'Needs urgent mapping', tone: 'danger' }));
  check('Pending Actions 走危险态 tone-danger', classesOf(pending, 'tone-danger').length === 1);
  check('Pending Actions 值 3 Sync Errors', pending.includes('>3 Sync Errors<'));
  check('Pending Actions 副文案 Needs urgent mapping', pending.includes('>Needs urgent mapping<'));

  const spark = strip(await bundle.renderSparkline({ values: [70, 80, 72, 78, 74, 82], count: 6 }));
  check('迷你柱 6 根 spark-bar', classesOf(spark, 'spark-bar').length === 6);
  check('迷你柱高在 8–20px 区间', [...spark.matchAll(/height:\s*(\d+)px/g)].every((m) => Number(m[1]) >= 8 && Number(m[1]) <= 20));

  // ---------- 每日营收柱 ----------
  console.log('\nDailyRevenueCard(Figma 1306:15290 chart-card)');
  const daily = strip(await bundle.renderDailyRevenue({ trend: fx.trend }));
  check('标题 Revenue Trend (Last 30 Days)', daily.includes('>Revenue Trend (Last 30 Days)<'));
  check('图例 Daily Revenue', daily.includes('>Daily Revenue<'));
  check('图例带主色圆点 legend-dot', classesOf(daily, 'legend-dot').length === 1);
  check('28 根柱(数据驱动)', classesOf(daily, 'bar').length === 28);
  const axisBlock = (daily.match(/class="x-axis"[^>]*>(.*?)<\/div>/) || ['', ''])[1];
  check('X 轴等距 8 个刻度', (axisBlock.match(/<span/g) || []).length === 8);
  check('含网格线 grid-lines', classesOf(daily, 'grid-lines').length === 1);

  // ---------- 收益拆解 ----------
  console.log('\nEarningsBreakdownCard(Figma 1306:15382 earnings-card)');
  const breakdown = strip(await bundle.renderBreakdown({ overview: fx.overview, currency: 'MMK' }));
  check('标题 Earnings Breakdown', breakdown.includes('>Earnings Breakdown<'));
  for (const label of ['Gross Revenue', 'Promotions/Discounts', 'Platform Commission', 'Net Settlement Payout']) {
    check(`拆解行「${label}」`, breakdown.includes(`>${label}<`));
  }
  check('毛收入 MMK 5,000,000', breakdown.includes('>MMK 5,000,000<'));
  check('促销折扣 - MMK 200,000', breakdown.includes('>- MMK 200,000<'));
  check('平台佣金按稿面显示百分比 - 15%', breakdown.includes('>- 15%<'));
  check('净结算 MMK 4,080,000', breakdown.includes('>MMK 4,080,000<'));
  check('净结算走高亮块 net-box', classesOf(breakdown, 'net-box').length === 1);
  check('扣减两行带 deduction 类', classesOf(breakdown, 'deduction').length === 2);
  check('含一条分隔线 divider', classesOf(breakdown, 'divider').length === 1);

  // ---------- 折线 / 面积 ----------
  console.log('\nTrendLineCard + OccupancyAreaCard(Figma 1306:15400 / 1306:15484)');
  const line = strip(await bundle.renderTrendLine({ trend: fx.trend }));
  check('折线卡标题 Revenue Trend (Last 30 Days)', line.includes('>Revenue Trend (Last 30 Days)<'));
  check('折线卡峰值徽标 Peak: Oct 20', line.includes('>Peak: Oct 20<'));
  check('折线卡峰值徽标走成功色 peak-badge', classesOf(line, 'peak-badge').length === 1);
  check('折线渲染 polyline', line.includes('<polyline'));
  check('折线卡无面积填充路径(仅折线)', !line.includes('ea-area-gradient'));
  check('峰值圆点 peak-dot', classesOf(line, 'peak-dot').length === 1);
  check('Y 轴三档 10M / 5M / 0', ['>10M<', '>5M<', '>0<'].every((text) => line.includes(text)));

  const area = strip(await bundle.renderOccupancyArea({ items: fx.occupancyTrend }));
  check('面积卡标题 Occupancy Rate Trend', area.includes('>Occupancy Rate Trend<'));
  check('面积卡均值徽标 Avg: 75%', area.includes('>Avg: 75%<'));
  check('面积卡走主色徽标 avg-badge', classesOf(area, 'avg-badge').length === 1);
  check('面积填充引用渐变 ea-area-gradient', area.includes('ea-area-gradient'));
  check('面积图带渐变定义 linearGradient', area.includes('<linearGradient'));
  check('Y 轴三档 100% / 50% / 0%', ['>100%<', '>50%<', '>0%<'].every((text) => area.includes(text)));
  check('面积卡无峰值圆点', classesOf(area, 'peak-dot').length === 0);

  // ---------- 星期预订量 ----------
  console.log('\nBookingVolumeCard(Figma 1306:15541 booking-volume-card)');
  const volume = strip(await bundle.renderBookingVolume({ trend: fx.trend }));
  check('标题 Booking Volume Trend', volume.includes('>Booking Volume Trend<'));
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    check(`星期标签 ${day}`, volume.includes(`>${day}<`));
  }
  check('七根柱 bar', classesOf(volume, 'bar').length === 7);
  check('交替配色:奇数索引带 alt 类', classesOf(volume, 'bar').filter((list) => list.includes('alt')).length === 3);

  // ---------- 房型环形 ----------
  console.log('\nRoomTypeDonutCard(Figma 1306:15617 room-type-card)');
  const donut = strip(await bundle.renderRoomTypeDonut({ items: fx.roomTypePerformance }));
  check('标题 Room Type Performance', donut.includes('>Room Type Performance<'));
  check('圆心总数 128', donut.includes('>128<'));
  check('圆心说明 Bookings', donut.includes('>Bookings<'));
  for (const row of ['Deluxe King', 'Standard Room', 'Executive Suite']) {
    check(`图例房型「${row}」`, donut.includes(`>${row}<`));
  }
  for (const percent of ['50%', '35%', '15%']) {
    check(`图例占比 ${percent}`, donut.includes(`>${percent}<`));
  }
  check('底环 + 3 段 = 4 个 circle', (donut.match(/<circle/g) || []).length === 4);
  check('分段带 dasharray / dashoffset', donut.includes('stroke-dasharray') && donut.includes('stroke-dashoffset'));
  check('图例色块 legend-swatch 三枚', classesOf(donut, 'legend-swatch').length === 3);

  // ---------- 结算表 ----------
  console.log('\nSettlementsTable(Figma 1476:16066 Bookings-Table-Card)');
  const table = strip(await bundle.renderSettlements({ rows: fx.recentBookings, currency: 'MMK' }));
  check('标题 Recent Booking Settlements', table.includes('>Recent Booking Settlements<'));
  for (const head of ['Booking ID', 'Guest Name', 'Room Type', 'Check-in/out', 'Total Amount', 'Payment', 'Booking Status']) {
    check(`表头列「${head}」`, table.includes(`>${head}<`));
  }
  check('表头行 table-head 用 #F8FAFC 底', classesOf(table, 'table-head').length === 1);
  for (const ref of ['#BK-1029', '#BK-1030', '#BK-1031', '#BK-1032', '#BK-1033', '#BK-1034', '#BK-1035', '#BK-1036', '#BK-1037']) {
    check(`预订号 ${ref}`, table.includes(`>${ref}<`));
  }
  for (const guest of ['Aung Aung', 'Su Su', 'Min Min', 'Thida Htun', 'Kyaw Zin', 'Hla Hla Win', 'Nandar Lwin', 'Zayar Oo', 'Khin Myo Thu']) {
    check(`住客「${guest}」`, table.includes(`>${guest}<`));
  }
  check('入住区间逐行渲染(Oct 12 - Oct 14)', table.includes('>Oct 12 - Oct 14<'));
  check('金额 MMK 540,000', table.includes('>MMK 540,000<'));
  for (const badge of ['Paid', 'Unpaid', 'Refund', 'Pay at Hotel', 'Confirmed', 'Pending Payment', 'Cancelled', 'Checked-in', 'Checked-out', 'No-show']) {
    check(`徽标「${badge}」`, table.includes(`>${badge}<`));
  }
  check('六类徽标配色类齐全', ['tone-success', 'tone-neutral', 'tone-refund', 'tone-warn', 'tone-primary', 'tone-danger'].every((cls) => classesOf(table, cls).length > 0));
  const emptyTable = strip(await bundle.renderSettlements({ rows: [], currency: 'MMK' }));
  check('空列表显示占位文案', emptyTable.includes('>No bookings in this period<'));
  check('SSR 渲染无未解析插值(不出现 undefined)', !emptyTable.includes('undefined'));

  // ---------- 导出弹窗 ----------
  console.log('\nExportReportModal(Figma 1493:16429 Export Report Dialog)');
  const modal = strip(await bundle.renderExportModal({ open: true, rangeLabel: 'Oct 01, 2026 – Oct 31, 2026', loading: false }));
  check('弹窗标题 Export Financial Report', modal.includes('>Export Financial Report<'));
  for (const field of ['Report Type', 'Date Range', 'Export Format']) {
    check(`字段「${field}」`, modal.includes(`>${field}<`));
  }
  check('报告类型下拉含结算报表', modal.includes('>Settlement &amp; Earnings Report<') || modal.includes('>Settlement & Earnings Report<'));
  check('日期范围 Oct 01, 2026 – Oct 31, 2026', modal.includes('>Oct 01, 2026 – Oct 31, 2026<'));
  for (const format of ['Excel', 'CSV', 'PDF']) {
    check(`格式卡「${format}」`, modal.includes(`>${format}<`));
  }
  check('扩展名 .xlsx / .csv / .pdf', ['.xlsx', '.csv', '.pdf'].every((ext) => modal.includes(`>${ext}<`)));
  check('CSV 卡为选中态 active', classesOf(modal, 'active').length === 1);
  check('Excel / PDF 两张卡置灰 disabled', classesOf(modal, 'disabled').length === 2);
  check('置灰卡带 disabled 属性(不可点)', (modal.match(/disabled/g) || []).length >= 2);
  check('提示仅 CSV 可用', modal.includes('coming soon'));
  check('底部 Cancel', modal.includes('>Cancel<'));
  check('底部 Download Report', modal.includes('>Download Report<'));
  const closedModal = strip(await bundle.renderExportModal({ open: false, rangeLabel: 'Oct 01, 2026 – Oct 31, 2026', loading: false }));
  check('open=false 不渲染弹窗 DOM', !closedModal.includes('Export Financial Report'));

  // ---------- 图标 ----------
  console.log('\nEaIcon(lucide 原始 path)');
  for (const [name, paths] of Object.entries(ICONS)) {
    const html = await bundle.renderIcon({ name, size: 18 });
    const rendered = pathsOf(html);
    check(`图标 ${name} path 逐字一致`, JSON.stringify(rendered) === JSON.stringify(paths));
  }

  // ---------- 页面壳 ----------
  console.log('\nEarningsPage(Figma 1306:14653)');
  const page = strip(await bundle.renderPage());
  check('H1 Business Dashboard & Earnings', page.includes('>Business Dashboard &amp; Earnings<') || page.includes('>Business Dashboard & Earnings<'));
  check('副标题含 sales performance', page.includes('sales performance'));
  check('副标题已修正为 property’s(不再是稿面误抄的 restaurant’s)', page.includes('property’s') && !page.includes('restaurant'));
  check('周期选择器 This Month: ', page.includes('This Month: '));
  check('周期选择器带日历图标', page.includes('class="ea-icon"'));
  check('导出按钮 Export Report', page.includes('>Export Report<'));
  check('导出按钮带 mch:earnings:export 权限指令容器', classesOf(page, 'export-btn').length === 1);
  for (const label of ['Today’s Arrivals', 'Today’s Departures', 'Occupancy Rate', 'Pending Actions']) {
    const escaped = label.replace(/'/g, '&#39;');
    check(`概览卡「${label}」`, page.includes(`>${label}<`) || page.includes(`>${escaped}<`));
  }
  check('四张概览卡 summary-card', classesOf(page, 'summary-card').length === 4);
  check('入住率卡挂迷你柱容器 sparkline', classesOf(page, 'sparkline').length === 1);
  check('入住率卡挂周环比文案 this week', page.includes('this week'));
  check('financial-row 同时含每日柱与收益拆解', classesOf(page, 'financial-row').length === 1);
  check('charts-grid 两行 grid-row', classesOf(page, 'grid-row').length === 2);
  check('结算表挂在页面上', page.includes('>Recent Booking Settlements<'));
  check('导出弹窗默认关闭(SSR 不渲染)', !page.includes('Export Financial Report'));
  check('旧筛选表单已移除', !page.includes('Settlement &amp; Payout Records') && !page.includes('Settlement No.'));

  // ---------- 稿面令牌(CSS 产物) ----------
  console.log('\n设计令牌(Figma GLOBAL_VARS)');
  const cssDir = path.join(outDir, 'assets');
  const cssFiles = fs.readdirSync(cssDir).filter((name) => name.endsWith('.css'));
  const css = cssFiles.map((name) => fs.readFileSync(path.join(cssDir, name), 'utf8')).join('\n').toLowerCase();
  const tokenSource = fs.readFileSync(path.join(webRoot, 'src', 'views', 'earnings', 'tokens.less'), 'utf8').toLowerCase();
  for (const token of [
    '#4169ed', '#ebf0ff', '#d9e1fb', '#1b1d30', '#0f172a', '#64748b', '#334155', '#94a3b8',
    '#e2e8f0', '#f8fafc', '#f4f6fb', '#22c55e', '#bb4d00', '#ec1317', '#a50101',
    'rgba(65, 105, 237, 0.08)', 'rgba(34, 197, 94, 0.16)', 'rgba(187, 77, 0, 0.08)',
    'rgba(236, 19, 23, 0.08)', 'rgba(165, 1, 1, 0.08)', '0 3px 8px 0 rgba(0, 0, 0, 0.14)',
  ]) {
    check(`tokens.less 含稿面色 ${token}`, tokenSource.includes(token));
  }
  for (const size of ['440px', '20px', '12px', '16px']) {
    check(`tokens.less 含稿面尺寸 ${size}`, tokenSource.includes(size));
  }
  check('tokens.less 三族字体变量与稿面一致', ['plus jakarta sans', 'inter'].every((f) => tokenSource.includes(f)));
  check('编译产物含主色 #4169ed', css.includes('#4169ed'));
  check('编译产物含次色 #d9e1fb', css.includes('#d9e1fb'));
  check('编译产物含芯片色 #ebf0ff', css.includes('#ebf0ff'));
  check('编译产物含成功色 #22c55e', css.includes('#22c55e'));
  check('编译产物含危险色 #ec1317', css.includes('#ec1317'));
  check('编译产物含 Refund 深红 #a50101', css.includes('#a50101'));
  check('编译产物含警示色 #bb4d00', css.includes('#bb4d00'));
  check('编译产物含卡片阴影 0 3px 8px', css.includes('3px 8px 0') && /rgba\(0,\s*0,\s*0,\s*0?\.14\)/.test(css));
  check('编译产物含收益卡固定宽 440px(取自 tokens.less 变量)', css.includes('440px'));
  check('编译产物含环形图画布 156px', css.includes('156px'));
  check('编译产物含导出弹窗宽 520px', css.includes('520px'));
  check('编译产物含控件高 44px', css.includes('44px'));

  // ---------- 同排控件等高(2026-09-21 走查:导出按钮比日期选择框高/矮一截) ----------
  // 稿面 export-btn 标了 44px 固定高,而同排 date-picker 是 hug(内容 21 + 上下 10 = 41px),
  // 两边都按稿面写就会差 3px。统一钉到 @ea-control-height,并断言编译产物里确实同高。
  console.log('\n同排控件等高(@ea-control-height)');
  check('tokens.less 定义控件统一高 44px', /@ea-control-height:\s*44px/.test(tokenSource));
  /** 取指定类的第一条 CSS 规则体(负向先行断言避免 .select 命中 .select-icon) */
  const ruleBody = (cls) => (css.match(new RegExp(`\\.${cls}(?![\\w-])[^{]*\\{([^}]*)\\}`)) || ['', ''])[1];
  for (const cls of ['range-btn', 'export-btn']) {
    check(`页头 .${cls} 高度锁定为 44px`, /height:\s*44px/.test(ruleBody(cls)), ruleBody(cls).slice(0, 80));
  }
  check('页头两个控件都不再用纵向 padding 撑高(只留横向内边距)',
    /padding:\s*0(px)?\s+16px/.test(ruleBody('range-btn')) && /padding:\s*0(px)?\s+16px/.test(ruleBody('export-btn')));
  check('两控件等高(同为 44px)', /height:\s*44px/.test(ruleBody('range-btn')) && /height:\s*44px/.test(ruleBody('export-btn')));
  // 弹窗底部两个按钮的高度由 .btn 基底统一提供(ghost / primary 不再各自覆盖)
  check('弹窗底部 .btn 基底高度 44px', /height:\s*44px/.test(ruleBody('btn')), ruleBody('btn').slice(0, 60));
  for (const cls of ['ghost', 'primary']) {
    check(`弹窗底部 .btn.${cls} 不覆盖高度(继承 44px)`, !/height:/.test(ruleBody(cls)), ruleBody(cls).slice(0, 60));
  }
  check('弹窗下拉框高度同为 44px', /height:\s*44px/.test(ruleBody('select')), ruleBody('select').slice(0, 80));
  check('弹窗下拉框不再用纵向 padding 撑高', /padding:\s*0(px)?\s+36px\s+0(px)?\s+12px/.test(ruleBody('select')));

  console.log(`\n${passed}/${passed + failures.length} GREEN`);
  if (failures.length) {
    console.log('\n失败项:');
    failures.forEach((item) => console.log(` - ${item}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
