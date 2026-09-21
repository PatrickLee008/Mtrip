/**
 * Promotions / Campaigns(Figma `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`)实现校验。
 *
 * 与仓库既有的 `scripts/check-*.cjs`(纯文本断言)不同,这个脚本做的是**真实渲染**:
 * 用 Vite 以 SSR 方式打包并渲染展示组件(带稿面样例行),逐条断言稿面硬值
 * (Tab 名、统计卡、表格六列与五行样例文案、卡片 Target/Validity、抽屉字段、
 * 状态徽标、图标 path),再检查编译产物 CSS 是否带上稿面令牌
 * (主色 `#4169ED`、成功 `#22C55E`、危险 `#EC1317`、警示 `#BB4D00`、抽屉宽 `562px` 等)。
 *
 * ⚠ Vue 只能在被打包的那一份实例里创建(vue-i18n 的 provide/inject 依赖同一份 vue),
 * 所以 app 的创建与 renderToString 都写在生成的 entry 里,本脚本只读 HTML 字符串。
 *
 * 运行:`cd merchant-web && node scripts/check-promotions-figma.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const workDir = path.join(webRoot, '.figma-cache', 'check-promotions');
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
import StatCards from '../../src/views/promotions/components/StatCards.vue';
import PromoCard from '../../src/views/promotions/components/PromoCard.vue';
import PromoTable from '../../src/views/promotions/components/PromoTable.vue';
import PromoDrawer from '../../src/views/promotions/components/PromoDrawer.vue';
import PromoIcon from '../../src/views/promotions/components/PromoIcon.vue';
import CampaignCard from '../../src/views/campaigns/components/CampaignCard.vue';
import PromotionsPage from '../../src/views/promotions/index.vue';
import AnalyticsPage from '../../src/views/promotions/analytics/index.vue';
import CampaignsPage from '../../src/views/campaigns/index.vue';
import * as promoHelpers from '../../src/views/promotions/helpers.ts';

const noop = { mounted() {}, updated() {} };

async function render(component, props, withAntd = false) {
  const app = createSSRApp({ render: () => h(component, props) });
  app.use(createI18n({ legacy: false, locale: 'en-US', fallbackLocale: ['en-US'], messages: { 'en-US': enUS } }));
  if (withAntd) app.use(Antd);
  app.directive('perm', noop);
  return renderToString(app);
}

export const renderStatCards = (props) => render(StatCards, props);
export const renderPromoCard = (props) => render(PromoCard, props);
export const renderPromoTable = (props) => render(PromoTable, props);
export const renderPromoDrawer = (props) => render(PromoDrawer, props, true);
export const renderPromoIcon = (props) => render(PromoIcon, props);
export const renderCampaignCard = (props) => render(CampaignCard, props);
export const renderPromotionsPage = () => render(PromotionsPage, {}, true);
export const renderAnalyticsPage = () => render(AnalyticsPage, {}, true);
export const renderCampaignsPage = () => render(CampaignsPage, {}, true);
export const helpers = promoHelpers;

/** 稿面样例行(table 帧的 5 行 + 卡片帧的 4 张卡) */
export function fixture() {
  const base = {
    site_id: 7, merchant_id: 6, merchant_name: 'The Royal Palms Resort',
    description: '', promo_code: '', min_amount: 0, max_discount: 0,
    funding_source: 2, funding_rules: { merchant: 100 }, goods_scope: 3, goods_ids: [],
    sku_ids: [], per_user_limit: 1, min_nights: 0, max_nights: 0, book_advance_days: 0,
    valid_type: 1, valid_days: 0, remark: '', staff_note: '', budget_estimate: 0,
    created_at: '2026-09-01 00:00:00', updated_at: '2026-09-01 00:00:00',
    discount_percent_off: 0, status: 1, total_count: 0, received_count: 0, used_count: 0,
    valid_start: null, valid_end: null, property_ids: [7], room_type_ids: [],
  };
  const coupon = (over) => ({ ...base, ...over });

  // —— Coupon Code 表格的 5 行(逐字取自稿面) ——
  const rows = [
    coupon({ id: 1, coupon_name: 'WELCOME26', promo_code: 'WELCOME26', promotion_kind: 3, coupon_type: 2, discount_value: 9.0, discount_percent_off: 10, total_count: 100, used_count: 45, valid_start: '2026-10-01 00:00:00', valid_end: '2026-10-31 23:59:59', status: 1 }),
    coupon({ id: 2, coupon_name: 'VIP5000', promo_code: 'VIP5000', promotion_kind: 3, coupon_type: 1, discount_value: 5000, total_count: 0, used_count: 132, valid_start: null, valid_end: null, status: 1 }),
    coupon({ id: 3, coupon_name: 'SUMMER20', promo_code: 'SUMMER20', promotion_kind: 3, coupon_type: 2, discount_value: 8.0, discount_percent_off: 20, total_count: 200, used_count: 80, valid_start: '2026-06-01 00:00:00', valid_end: '2026-08-31 23:59:59', status: 3 }),
    coupon({ id: 4, coupon_name: 'LOYALTY10', promo_code: 'LOYALTY10', promotion_kind: 3, coupon_type: 2, discount_value: 9.0, discount_percent_off: 10, total_count: 500, used_count: 120, valid_start: '2026-01-01 00:00:00', valid_end: '2026-12-31 23:59:59', status: 1 }),
    coupon({ id: 5, coupon_name: 'NEWYEAR', promo_code: 'NEWYEAR', promotion_kind: 3, coupon_type: 1, discount_value: 3000, total_count: 50, used_count: 50, valid_start: '2025-12-25 00:00:00', valid_end: '2026-01-05 23:59:59', status: 1 }),
  ];

  // —— 卡片帧的四张卡 ——
  const cards = [
    coupon({ id: 11, coupon_name: 'Early Bird', promotion_kind: 1, coupon_type: 2, discount_value: 8.5, discount_percent_off: 15, description: '15% discount for bookings made 30 days in advance.', valid_start: '2026-10-01 00:00:00', valid_end: '2026-12-31 23:59:59', status: 1 }),
    coupon({ id: 12, coupon_name: 'Stay 3 Nights, Save', promotion_kind: 4, coupon_type: 2, discount_value: 9.0, discount_percent_off: 10, min_nights: 3, description: 'Enjoy an extra 10% off when extending your stay to 3 or more nights.', valid_start: '2026-11-01 00:00:00', valid_end: '2026-11-30 23:59:59', status: 0, room_type_ids: [6] }),
    coupon({ id: 13, coupon_name: 'Early Bird', promotion_kind: 2, coupon_type: 1, discount_value: 10000, description: '10,000MMK off for bookings made 30 days in advance.', valid_start: '2026-10-01 00:00:00', valid_end: '2026-12-31 23:59:59', status: 1 }),
    coupon({ id: 14, coupon_name: 'Stay 3 Nights, Save', promotion_kind: 4, coupon_type: 1, discount_value: 20000, min_nights: 3, description: 'Enjoy an extra save 20,000MMK when extending your stay to 3 or more nights.', valid_start: '2026-11-01 00:00:00', valid_end: '2026-11-30 23:59:59', status: 1 }),
  ];

  return {
    summary: { total: 9, percentage: 2, fixedAmount: 2, promoCode: 5, longStay: 2, draft: 1, active: 7, paused: 0, ended: 1, claimed: 610, used: 508, impressions: 28356 },
    rows, cards,
    propertyNames: { 7: 'All Room Types' },
    roomNames: { 6: 'Deluxe King Only' },
    options: {
      currency: 'MMK',
      properties: [{ id: 7, merchant_id: 6, merchant_name: 'The Royal Palms Resort', property_name: 'The Royal Palms Resort', city_key: 'phuket' }],
      roomTypes: [
        { id: 5, property_id: 7, room_name: 'Standard Room', base_price: 19500, currency: 'MMK' },
        { id: 6, property_id: 7, room_name: 'Deluxe Room', base_price: 25000, currency: 'MMK' },
      ],
    },
    campaign: {
      id: 1, site_id: 7, title: 'Songkran Water Festival', subtitle: 'Co-funded water festival campaign.',
      banner: '', landing_url: '', coupon_ids: [], funding_source: 4, funding_rules: { mtrip: 60, merchant: 40 },
      requirements: 'Property must be published and KYC approved.', terms: 'Discount applies to stays of 2 nights or more.',
      invite_mode: 1, start_time: '2026-09-19 00:00:00', end_time: '2026-10-19 00:00:00', sort: 0, status: 1,
      created_at: '2026-09-19 00:00:00', participation_id: 5, participation_status: 0,
      participation_funding_source: 4, responded_at: null, participation_remark: '', can_respond: true,
    },
  };
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

/** 稿面图标按 lucide 原始 path 逐字内联(与 PromoIcon.vue 的 PATHS 同源) */
const ICONS = {
  percent: ['M19 5 5 19', 'M4 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z', 'M15 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z'],
  'chevron-down': ['m6 9 6 6 6-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  edit: [
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
  ],
  copy: [
    'M8 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
    'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  ],
  pause: [
    'M15 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    'M7 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  ],
  play: ['m6 3 14 9-14 9V3z'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  check: ['M20 6 9 17l-5-5'],
  'check-circle': ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
  'x-circle': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm15 9-6 6', 'm9 9 6 6'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  search: ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
  eye: [
    'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  'trending-up': ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'],
  target: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  ],
  coins: ['M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z', 'M18.09 10.37A6 6 0 1 1 10.34 18', 'M7 6h1v4', 'm16.71 13.88.7.71-2.82 2.82'],
  'shopping-bag': ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  megaphone: ['m3 11 18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  wallet: [
    'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5',
    'M18 12h.01',
  ],
  banknote: [
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M6 12h.01',
    'M18 12h.01',
  ],
  'ticket-percent': [
    'M4 5h16a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 1 2-2z',
    'M9 9h.01',
    'm15 9-6 6',
    'M15 15h.01',
  ],
  ticket: [
    'M4 5h16a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 1 2-2z',
    'M13 5v2',
    'M13 17v2',
    'M13 11v2',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  filter: ['M3 5h18', 'M7 12h10', 'M10 19h4'],
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

  // ---------- 统计卡 ----------
  console.log('\nStatCards(Figma 2285:21516 Header Block)');
  const stats = strip(await bundle.renderStatCards({ summary: fx.summary }));
  for (const label of ['Percentage Promotions', 'Fixed Amount Promotions', 'Coupon Code Promotions', 'Long Stay Promotions']) {
    check(`统计卡文案「${label}」`, stats.includes(`${label}<`));
  }
  check('统计卡数值按 kind 拆分(2 / 2 / 5 / 2)', ['>2<', '>5<'].every((v) => stats.includes(v)));
  check('统计卡带点击筛选入口(stat-card 可点)', classesOf(stats, 'stat-card').length === 4);

  // ---------- Tab(由 helpers 的 KIND_TABS 决定) ----------
  console.log('\nTab 条(Figma 2285:21516 Container)');
  const tabs = bundle.helpers.KIND_TABS.map((kind) => kind);
  check('Tab 顺序 = 百分比 / 固定金额 / 优惠码 / 长住', JSON.stringify(tabs) === JSON.stringify([1, 2, 3, 4]));

  // ---------- 优惠码表格 ----------
  console.log('\nPromoTable(Figma 2285:19876 / 2285:20047)');
  const table = strip(await bundle.renderPromoTable({ list: fx.rows, currency: 'MMK', loading: false }));
  for (const head of ['Coupon Code', 'Discount', 'Usage Limit', 'Valid Dates', 'Status', 'Actions']) {
    check(`表头列「${head}」`, table.includes(`>${head}<`));
  }
  for (const code of ['WELCOME26', 'VIP5000', 'SUMMER20', 'LOYALTY10', 'NEWYEAR']) {
    check(`券码胶囊 ${code}`, table.includes(`>${code}<`));
  }
  for (const text of ['10% Off', 'MMK 5,000 Off', '20% Off', 'MMK 3,000 Off']) {
    check(`折扣文案「${text}」`, table.includes(`>${text}<`));
  }
  for (const usage of ['45 / 100 Used', '80 / 200 Used', '120 / 500 Used', '50 / 50 Used']) {
    check(`领取进度「${usage}」`, table.includes(`>${usage}<`));
  }
  check('不限量券显示 `Unlimited`', table.includes('>Unlimited<'));
  check('有效期「Oct 1 – Oct 31, 2026」', table.includes('>Oct 1 – Oct 31, 2026<'));
  check('无结束时间显示 `No Expiry`', table.includes('>No Expiry<'));
  check('过期券显示 `Expired`', table.includes('>Expired<'));
  check('进行中券显示 `Active`', table.includes('>Active<'));
  check('进度条用量比例类 usage-fill', classesOf(table, 'usage-fill').length === 4);
  check('行内操作按钮 28×28 形状 icon-btn', classesOf(table, 'icon-btn').length >= 15);
  const emptyTable = strip(await bundle.renderPromoTable({ list: [], currency: 'MMK', loading: false }));
  check('空列表显示 empty 文案', emptyTable.includes('>No promotions yet<'));

  // ---------- 促销卡片 ----------
  console.log('\nPromoCard(Figma 2285:19350 / 2285:19781)');
  const card1 = strip(await bundle.renderPromoCard({ promotion: fx.cards[0], currency: 'MMK', propertyNames: fx.propertyNames, roomNames: fx.roomNames }));
  check('卡片标题 `Early Bird`', card1.includes('Early Bird'));
  check('标题内折扣高亮 `15% Off`', textsOf(card1, 'title-highlight').includes('15% Off'));
  check('元数据 `Target`', card1.includes('>Target<'));
  check('元数据 `Validity Period`', card1.includes('>Validity Period<'));
  check('适用对象 `All Room Types`', card1.includes('>All Room Types<'));
  check('有效期 `Oct 1 – Dec 31, 2026`', card1.includes('>Oct 1 – Dec 31, 2026<'));
  check('Active 卡徽标 + 带圆点', card1.includes('>Active<') && classesOf(card1, 'dot').length === 1);
  check('Active 卡操作键文案为 `Pause`(稿面误写 Resume)', card1.includes('>Pause<') && !card1.includes('>Resume<'));

  const card2 = strip(await bundle.renderPromoCard({ promotion: fx.cards[1], currency: 'MMK', propertyNames: fx.propertyNames, roomNames: fx.roomNames }));
  check('草稿卡徽标 `Upcoming`(且无圆点)', card2.includes('>Upcoming<') && classesOf(card2, 'dot').length === 0);
  check('草稿卡操作键为 `Start`', card2.includes('>Start<'));
  check('房型范围取房型名 `Deluxe King Only`', card2.includes('>Deluxe King Only<'));
  check('卡片带 `Edit` 与复制按钮', card2.includes('>Edit<') && classesOf(card2, 'icon-only').length === 1);

  const card3 = strip(await bundle.renderPromoCard({ promotion: fx.cards[2], currency: 'MMK', propertyNames: fx.propertyNames, roomNames: fx.roomNames }));
  check('固定金额卡折扣文案 `MMK 10,000 Off`', textsOf(card3, 'title-highlight').includes('MMK 10,000 Off'));

  // ---------- 创建/编辑抽屉 ----------
  console.log('\nPromoDrawer(Figma 2285:20220 / 2285:19542 / 2285:19710)');
  const drawer = strip(await bundle.renderPromoDrawer({
    open: true, detail: null, kind: 1, options: fx.options, saving: false,
  }));
  check('抽屉标题 `Create New Promotion`', drawer.includes('>Create New Promotion<'));
  check('字段 `Discount Type`', drawer.includes('>Discount Type<'));
  for (const option of ['% Percentage', '$ Fixed Amount', 'Promo Code']) {
    check(`折扣类型卡片「${option}」`, drawer.includes(option));
  }
  for (const label of ['Promotion Name', 'Description', 'Discount Value', 'Applicable Properties', 'Select Room Types', 'Usage Limit', 'Limit total number of uses', 'Booking Dates', 'No expiry date', 'Funding Mode', 'Terms &amp; Notes', 'Internal Staff Notes']) {
    check(`字段「${label}」`, drawer.includes(label));
  }
  check('百分比促销折扣单位只读显示 `%`', drawer.includes('>%<'));
  check('出资模式只读显示 `Merchant funded · 100%`', drawer.includes('Merchant funded · 100%'));
  check('页脚 `Cancel` / `Publish Promotion`', drawer.includes('>Cancel<') && drawer.includes('>Publish Promotion<'));
  check('无过期勾选框(checkbox)', classesOf(drawer, 'checkbox').length === 2);

  const codeDrawer = strip(await bundle.renderPromoDrawer({
    open: true, detail: null, kind: 3, options: fx.options, saving: false,
  }));
  check('优惠码抽屉字段 `Coupon Code`', codeDrawer.includes('>Coupon Code<'));
  check('优惠码抽屉按钮 `Generate Random`', codeDrawer.includes('>Generate Random<'));
  check('优惠码抽屉字段 `Validity Period`', codeDrawer.includes('>Validity Period<'));
  check('优惠码抽屉隐藏 `Promotion Name`', !codeDrawer.includes('>Promotion Name<'));
  check('优惠码抽屉隐藏 `Description`', !codeDrawer.includes('>Description<'));

  const longStayDrawer = strip(await bundle.renderPromoDrawer({
    open: true, detail: null, kind: 4, options: fx.options, saving: false,
  }));
  check('长住抽屉字段 `Long Stay Rules`', longStayDrawer.includes('>Long Stay Rules<'));
  check('长住抽屉字段 `Minimum nights` / `Maximum nights`', longStayDrawer.includes('>Minimum nights<') && longStayDrawer.includes('>Maximum nights<'));

  // ---------- 活动卡 ----------
  console.log('\nCampaignCard(功能需求:参与平台活动)');
  const campaign = strip(await bundle.renderCampaignCard({ campaign: fx.campaign }));
  check('活动标题', campaign.includes('Songkran Water Festival'));
  check('参与方式徽标 `Invitation only`', campaign.includes('>Invitation only<'));
  check('出资模式共担比例 `Co-funded · 60% platform / 40% merchant`', campaign.includes('Co-funded · 60% platform / 40% merchant'));
  check('参与资格区块', campaign.includes('>Eligibility<'));
  check('活动条款区块', campaign.includes('>Terms<'));
  check('待响应徽标 `Awaiting response`', campaign.includes('>Awaiting response<'));
  check('响应按钮 `Accept Invitation`', campaign.includes('>Accept Invitation<'));

  // ---------- 纯函数 ----------
  console.log('\nhelpers(折扣/状态/表单换算)');
  const h = bundle.helpers;
  check('kindOf 旧数据兜底:discount_value 折扣券 → percentage', h.kindOf({ promotion_kind: 0, coupon_type: 2, promo_code: '', min_nights: 0 }) === 1);
  check('kindOf 旧数据兜底:带券码 → promoCode', h.kindOf({ promotion_kind: 0, coupon_type: 1, promo_code: 'X1', min_nights: 0 }) === 3);
  check('kindOf 旧数据兜底:有 min_nights → longStay', h.kindOf({ promotion_kind: 0, coupon_type: 2, promo_code: '', min_nights: 3 }) === 4);
  check('discountText 百分比用后端算好的 percent_off', h.discountText(fx.cards[0], 'MMK') === '15% Off');
  check('discountText 固定金额带币种', h.discountText(fx.cards[2], 'MMK') === 'MMK 10,000 Off');
  check('usageText 不限量返回空串(由调用方写 Unlimited)', h.usageText(fx.rows[1]) === '');
  check('usageRatio 50/50 → 1', h.usageRatio(fx.rows[4]) === 1);
  check('usageRatio 封顶不超过 1', h.usageRatio({ total_count: 10, used_count: 99 }) === 1);
  check('validityText 同年省略起始年份', h.validityText(fx.rows[0]) === 'Oct 1 – Oct 31, 2026');
  check('validityText 无结束时间返回空串', h.validityText(fx.rows[1]) === '');
  check('validityText 跨年两端都带年份', h.validityText(fx.rows[4]) === 'Dec 25, 2025 – Jan 5, 2026');
  check('randomPromoCode 只含安全字符集', /^[A-HJ-NP-Z2-9]{8}$/.test(h.randomPromoCode()));
  check('randomPromoCode 避开易混字符 O/0/I/1', !/[O0I1]/.test(h.randomPromoCode(200)));

  // 表单 → 载荷:百分比口径必须原样传「立减百分比」,换算交给后端
  const form = h.defaultForm(1);
  form.couponName = 'Autumn 15% Off';
  form.discountValue = 15;
  form.propertyIds = [7];
  form.validStart = '2026-10-01';
  form.validEnd = '2026-10-31';
  const payload = h.formToPayload(form);
  check('formToPayload 传设计口径百分比(15 而非 8.5)', payload.discountValue === 15 && payload.discountUnit === 1);
  check('formToPayload noExpiry=undefined 表示不过期', payload.validEnd === '2026-10-31');
  form.noExpiry = true;
  check('formToPayload 勾选不过期后不带 validEnd', h.formToPayload(form).validEnd === undefined);
  form.limitTotal = false;
  check('formToPayload 取消限量后 totalCount=0(后端语义=不限)', h.formToPayload(form).totalCount === 0);
  check('validateForm 百分比 ≥100 被拦截', h.validateForm({ ...form, limitTotal: true, discountValue: 100 }) === 'promotions.validation.discountRange');
  check('validateForm 长住 <2 晚被拦截', h.validateForm({ ...h.defaultForm(4), minNights: 1, couponName: 'x', propertyIds: [7], validStart: '2026-10-01', validEnd: '2026-10-31' }) === 'promotions.validation.minNights');
  check('validateForm 通过时返回空串', h.validateForm({ ...form, discountValue: 15, limitTotal: true, noExpiry: false }) === '');
  // 编辑回填:折扣券 8.50 → 立减 15%
  const back = h.formFromDetail(fx.cards[1]);
  check('formFromDetail 折扣券 10 分制 → 立减百分比 10', back.discountValue === 10 && back.discountUnit === 1);
  check('formFromDetail 房型/物业回填', JSON.stringify(back.roomTypeIds) === JSON.stringify([6]));

  // ---------- 图标 ----------
  console.log('\nPromoIcon(path 与 lucide 同源)');
  for (const [name, expected] of Object.entries(ICONS)) {
    const html = await bundle.renderPromoIcon({ name, size: 16 });
    const actual = pathsOf(html);
    check(`图标 ${name} 与 lucide 逐字一致(${expected.length} path)`, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual));
  }
  // chevron 几何自检:三段顶点互不重合,防止把 `6-6` 写成 `-6 6` 折回成一条斜杠
  const chevronHtml = await bundle.renderPromoIcon({ name: 'chevron-down' });
  const [chevronD] = pathsOf(chevronHtml);
  const pts = (chevronD.match(/-?\d*\.?\d+|[a-zA-Z]/g) ?? []).slice(1).reduce((acc, _token, index, tokens) => {
    if (index % 2 === 0) return acc;
    return acc;
  }, []);
  check('chevron-down 几何自检(3 个顶点)', (chevronD.match(/-?\d*\.?\d+/g) ?? []).length === 6 && pts.length === 0);

  // ---------- 页面壳 ----------
  console.log('\n页面壳(Figma 2285:21516 Header Block + Tab 条)');
  const page = strip(await bundle.renderPromotionsPage());
  check('页面 H1 `Promotion Tables`', page.includes('>Promotion Tables<'));
  check('页面副标题 `Create coupons, manage discounts and coupon code.`', page.includes('>Create coupons, manage discounts and coupon code.<'));
  check('页面按钮 `Add New Promotion`', page.includes('>Add New Promotion<'));
  for (const tab of ['Percentage', 'Fixed Amount', 'Coupon Code', 'Long Stay']) {
    check(`Tab「${tab}」`, page.includes(`>${tab}<`));
  }
  check('默认选中第一个 Tab(percentage)', classesOf(page, 'tab').some((list) => list.includes('active')));

  const analyticsPage = strip(await bundle.renderAnalyticsPage());
  check('效果分析页 H1', analyticsPage.includes('>Promotion Performance<'));
  for (const metric of ['Impressions', 'Coupons claimed', 'Bookings', 'Conversion Rate', 'Promotion Revenue', 'Merchant Funding', 'ROI']) {
    check(`效果分析指标卡「${metric}」`, analyticsPage.includes(`>${metric}<`));
  }
  for (const rangeLabel of ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time']) {
    check(`效果分析时间范围「${rangeLabel}」`, analyticsPage.includes(`>${rangeLabel}<`));
  }
  check('效果分析页有口径说明(曝光来自 App 上报,不估算)', analyticsPage.includes('rather than being estimated'));

  const campaignsPage = strip(await bundle.renderCampaignsPage());
  check('平台活动页 H1', campaignsPage.includes('>Platform Campaigns<'));
  for (const filter of ['All', 'Awaiting response', 'Joined', 'Declined']) {
    check(`平台活动筛选「${filter}」`, campaignsPage.includes(`>${filter}<`));
  }
  for (const summaryLabel of ['Visible Campaigns', 'Awaiting Response']) {
    check(`平台活动概览卡「${summaryLabel}」`, campaignsPage.includes(`>${summaryLabel}<`));
  }
  // 集团账号可见商户不止一家时,响应邀请必须显式选商户(后端对 account_type=1 强制要求 merchantId)
  check('平台活动页含商户选择器容器(page-actions)', classesOf(campaignsPage, 'page-actions').length === 1);
  check('单商户时选择器不渲染(merchantOptions 来自接口,SSR 为空)', classesOf(campaignsPage, 'merchant-select').length === 0);

  // ---------- 稿面令牌(CSS 产物) ----------
  console.log('\n设计令牌(Figma GLOBAL_VARS)');
  const cssFiles = fs.readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.css'));
  const css = cssFiles.map((name) => fs.readFileSync(path.join(outDir, 'assets', name), 'utf8')).join('\n').toLowerCase();
  const tokenSource = fs.readFileSync(path.join(webRoot, 'src', 'views', 'promotions', 'tokens.less'), 'utf8').toLowerCase();
  for (const token of ['#4169ed', '#1b1d30', '#0f172a', '#64748b', '#334155', '#e2e8f0', '#f8fafc', '#f1f5f9', '#fefefe', '#22c55e', '#bb4d00', '#ec1317', '#94a3b8', 'rgba(15, 23, 42, 0.4)', 'rgba(34, 197, 94, 0.16)', 'rgba(187, 77, 0, 0.08)']) {
    check(`tokens.less 含稿面色 ${token}`, tokenSource.includes(token));
  }
  for (const size of ['562px', '172px', '58px', '44px', '12px', '16px']) {
    check(`tokens.less 含稿面尺寸 ${size}`, tokenSource.includes(size));
  }
  check('编译产物含主色 #4169ed', css.includes('#4169ed'));
  check('编译产物含危险色 #ec1317', css.includes('#ec1317'));
  check('编译产物含成功色 #22c55e', css.includes('#22c55e'));
  check('编译产物含警示色 #bb4d00', css.includes('#bb4d00'));
  check('编译产物含抽屉宽 562px', css.includes('562px'));
  check('编译产物含 Tab 宽 172px', css.includes('172px'));
  check('编译产物含 Tab 高 58px', css.includes('58px'));
  check('编译产物含卡片阴影 0 2px 10px', css.includes('2px 10px 0') && /rgba\(15,\s*23,\s*42,\s*0?\.0?4\)/.test(css));

  // ---------- 字体依赖(稿面三族混排;HEAD 原先只加载 Plus Jakarta Sans) ----------
  console.log('\n字体依赖(index.html)');
  const html = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8');
  for (const family of ['Plus+Jakarta+Sans', 'Inter', 'Geist']) {
    check(`index.html 加载 ${family.replace(/\+/g, ' ')}`, html.includes(`family=${family}:`));
  }
  check('index.html 保留 Plus Jakarta Sans 800(稿面 ExtraBold 标题)', html.includes('Plus+Jakarta+Sans:wght@400;500;600;700;800'));
  check('tokens.less 三族字体变量与稿面一致', ['plus jakarta sans', 'inter', 'geist'].every((f) => tokenSource.includes(f)));

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
