/**
 * 酒店资料页三个页签(Long Stay Details / Hotel Policies / Nearby Attraction)实现校验。
 *
 * 设计源:Figma file `fsK2rrl2sadcowrxspvGV8` SECTION `696:6334`;规格落档 `.figma-cache/696-6334.md`。
 *
 * 与仓库既有的 `scripts/check-*-figma.mjs` 同范式:**真实 SSR 渲染**三个组件(视图 + 编辑两态,
 * 带稿面样例行),断言稿面硬值;再断言 i18n 两份语言键结构一致、弹窗字段键齐全、
 * 编译产物 CSS 带上本页令牌;最后做**跨层契约**断言(profile.vue 的读写字段名、
 * 后端 FIELDS / 迁移 / 快照三处列名对齐)。
 *
 * ⚠ Vue 只能在被打包的那一份实例里创建(i18n 的 provide/inject 依赖同一份 vue),
 * 所以 app 的创建与 renderToString 都写在生成的 entry 里,本脚本只读 HTML 字符串。
 *
 * 运行:`cd merchant-web && node scripts/check-property-profile-tabs-figma.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '..');
const workDir = path.join(webRoot, '.figma-cache', 'check-profile-tabs');
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
import zhCN from '../../src/locales/zh-CN.ts';
import HotelLongStay from '../../src/views/properties/components/HotelLongStay.vue';
import HotelPolicies from '../../src/views/properties/components/HotelPolicies.vue';
import HotelNearby from '../../src/views/properties/components/HotelNearby.vue';
import HotelAmenities from '../../src/views/properties/components/HotelAmenities.vue';

const noop = { mounted() {}, updated() {} };

async function render(component, props, locale = 'en-US') {
  const app = createSSRApp({ render: () => h(component, props) });
  app.use(createI18n({ legacy: false, locale, fallbackLocale: ['en-US'], messages: { 'en-US': enUS, 'zh-CN': zhCN } }));
  app.use(Antd);
  app.directive('perm', noop);
  return renderToString(app);
}

export const renderLongStay = (props) => render(HotelLongStay, props);
export const renderPolicies = (props) => render(HotelPolicies, props);
export const renderNearby = (props) => render(HotelNearby, props);
export const renderAmenities = (props) => render(HotelAmenities, props);
export const renderLongStayZh = (props) => render(HotelLongStay, props, 'zh-CN');
export const renderPoliciesZh = (props) => render(HotelPolicies, props, 'zh-CN');
export const renderNearbyZh = (props) => render(HotelNearby, props, 'zh-CN');
export const messages = { enUS, zhCN };

/** 稿面样例行(Figma 696:4375 / 696:4711 / 696:4914) */
export function fixtures() {
  return {
    longStay: {
      promotions: [
        { id: 'lsp-1', name: '7 Days', discount: 5, status: true },
        { id: 'lsp-2', name: '14 Days', discount: 10, status: true },
        { id: 'lsp-3', name: '30 Days', discount: 25, status: false },
        { id: 'lsp-4', name: '90 Days', discount: 40, status: true },
      ],
      benefits: [
        { id: 'lsb-1', name: 'Free Laundry', status: true, bold: true },
        { id: 'lsb-2', name: 'Free Utilities', status: true, bold: false },
        { id: 'lsb-3', name: 'Kitchen', status: true, bold: false },
        { id: 'lsb-4', name: 'Workspace', status: true, bold: true },
        { id: 'lsb-5', name: 'Pet Friendly', status: true, bold: false },
        { id: 'lsb-6', name: 'Monthly Contract', status: false, bold: false },
        { id: 'lsb-7', name: 'No Deposit', status: true, bold: false },
        { id: 'lsb-8', name: 'Flexible Cancellation', status: true, bold: false },
      ],
    },
    policies: {
      booking: {
        cancellation: "Free cancellation up to 48 hours before arrival. Cancellations made within 48 hours of check-in will incur a charge of the first night's stay.",
        prepayment: 'No deposit required. Your credit card will be used to guarantee the booking and full payment will be settled at the property.',
        taxesFees: 'Rates exclude 5% government tax and 10% service charge. These will be added to your final bill upon check-out.',
      },
      checkIn: {
        time: '14:00',
        description: 'Early check-in is subject to availability and may incur additional charges.',
        documents: ['Valid Passport / NRC', 'Booking Confirmation'],
      },
      checkOut: { time: '12:00', description: 'Late check-out up to 18:00 is charged at 50% of the daily rate. Full rate applies after 18:00.' },
      pet: { description: 'To maintain the comfort of all guests, pets are not allowed in the property.' },
      children: [
        { id: 'chd-1', name: 'Children aged 0-5', description: 'Stay for free when using existing bedding.', amount: 'Complimentary', unit: 'night', status: true },
        { id: 'chd-2', name: 'Children aged 6-12', description: 'Extra bed required (includes breakfast).', amount: 'MMK 35,000', unit: 'night', status: true },
        { id: 'chd-3', name: 'Adult ( 13+ )', description: 'Extra bed mandatory for additional guests.', amount: 'MMK 50,000', unit: 'night', status: false },
      ],
      rules: [
        { id: 'rule-1', name: 'Smoking', description: 'Designated smoking areas only. 200,000 MMK cleaning fee for room smoking.', icon: 'no-smoking', status: true },
        { id: 'rule-2', name: 'Quiet Hours', description: 'Please respect quiet hours from 22:00 to 07:00 daily.', icon: 'quiet', status: true },
        { id: 'rule-3', name: 'Infinity Pool Hours', description: 'Open from 07:00 to 20:00. Proper swimwear required.', icon: 'pool', status: true },
      ],
    },
    amenities: [
      { id: 'a1', category: 'essential', name: 'Free Wifi', icon: 'wifi', description: '', enabled: true, highlighted: true },
      { id: 'a2', category: 'essential', name: 'Air Conditioning', icon: 'air-conditioning', description: '', enabled: true, highlighted: false },
      { id: 'a3', category: 'dining', name: 'Sky Lounge Bar', icon: 'lounge', description: '', enabled: false, highlighted: false },
      { id: 'a4', category: 'tags', name: 'Best Location', icon: 'location', description: 'Minutes from the temples', enabled: true, highlighted: true },
    ],
    nearby: [
      { id: 'nby-1', image: '', status: true, stops: [
        { id: 'stop-1', icon: 'airport', name: 'Nyaung-U Airport', travelTime: '20 mins', travelMode: 'drive', distance: '12 km' },
        { id: 'stop-2', icon: 'temple', name: 'Bagan Temples', travelTime: '10 mins', travelMode: 'drive', distance: '5 km' },
      ] },
      { id: 'nby-2', image: '', status: true, stops: [
        { id: 'stop-3', icon: 'airport', name: 'Nyaung-U Airport', travelTime: '20 mins', travelMode: 'drive', distance: '12 km' },
        { id: 'stop-4', icon: 'landmark', name: 'Ananda Temple', travelTime: '8 mins', travelMode: 'drive', distance: '3.2 km' },
      ] },
      { id: 'nby-3', image: '', status: false, stops: [
        { id: 'stop-5', icon: 'airport', name: 'Nyaung-U Airport', travelTime: '20 mins', travelMode: 'drive', distance: '12 km' },
        { id: 'stop-6', icon: 'location', name: 'Dhammayangyi Temples', travelTime: '12 mins', travelMode: 'drive', distance: '4.5 km' },
      ] },
    ],
  };
}
`;

/** 去掉 SSR 作用域属性与注释,压缩空白,便于断言 */
function strip(html) {
  return html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/ data-v-[0-9a-z]+(="")?/g, '')
    .replace(/\s+/g, ' ');
}

/** Vue SSR 的文本转义(& < > " '),断言稿面文案时必须同口径 */
function esc(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 含指定类的元素上的完整 class 列表 */
function classesOf(html, base) {
  return [...html.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1].split(' '))
    .filter((list) => list.includes(base));
}

/** 元素文本(前后必须紧邻 '>'),用于 `>文案<` 形态的断言 */
function hasText(html, text) {
  return html.includes(`>${esc(text)}<`);
}

/** 指定类元素的文本(greedy 到第一个 '<') */
function textsOf(html, cls) {
  return [...html.matchAll(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([^<]*)<`, 'g'))].map((match) => match[1]);
}

/**
 * 取编译产物里某个选择器的声明块(可能有多条)。
 * SFC scoped 样式会编译成 `.cls[data-v-xxx]{…}`;同名类还可能出现在逗号分组规则
 * (`.panel-head, .hp-section-head, …{display:flex}`)与后代选择器(`.cls[data-v] svg{…}`)里,
 * 所以这里只收「选择器列表里**完整**含该选择器」的规则(`]` 后必须是 `,` 或结束),
 * 后代选择器与无关分组规则都会被排除;断言用 `some(...)` 命中其中一条即可。
 */
function cssRules(css, selector) {
  const flat = css.replace(/\s+/g, '');
  const parts = selector.trim().split(/\s+/);
  const first = parts[0];
  const rest = parts.slice(1).join('');
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // scoped 编译有两种形态:普通后代 `.a b[data-v]{`(属性在后一个复合选择器上)、
  // `:deep(b)` → `.a[data-v] b{`(属性在前一个上),两种都认;并且要求该选择器是列表里
  // 独立的一项(前一个字符是 `,` 或行首),把 `.panel-head, .hp-section-head, …{display:flex}`
  // 这类无关分组规则与 `.a-label` 这类前缀相同的类都挡在外面。
  const pattern = new RegExp(
    `(^|,)${escape(first)}\\[data-v-[a-z0-9]+\\]${escape(rest)}|(^|,)${escape(first + rest)}\\[data-v-[a-z0-9]+\\]`,
  );
  const bodies = [];
  let index = flat.indexOf(first);
  while (index >= 0) {
    const open = flat.indexOf('{', index);
    if (open < 0) break;
    if (pattern.test(flat.slice(index, open))) bodies.push(flat.slice(open + 1, flat.indexOf('}', open)));
    index = flat.indexOf(first, index + first.length);
  }
  return bodies;
}

/** 该选择器的某一条规则同时含全部声明(去空白比较) */
function hasDecl(css, selector, ...declarations) {
  return cssRules(css, selector).some((body) => declarations.every((declaration) => body.includes(declaration)));
}

/** 取源文件里某个类名的声明块(去空白);用于 index.less 这种不在 SSR 构建里的样式 */
function indexLessBlock(className) {
  const source = read('merchant-web/src/styles/index.less');
  const start = source.indexOf(`.${className} {`);
  if (start < 0) return '';
  return source.slice(start, source.indexOf('}', start)).replace(/\s+/g, '');
}

/** 收集对象里的全部点分键路径(用于两份语言包的结构比对) */
function keyPaths(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.keys(value).flatMap((key) => keyPaths(value[key], prefix ? `${prefix}.${key}` : key));
}

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

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
    // 必须把 vue / vue-i18n 一并打进产物:否则 Node 解析 ESM 的 `vue` 与 CJS 的 `vue`
    // 会得到两份实例,i18n 的 provide/inject 直接失效(NOT_INSTALLED)
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
  const fixtures = bundle.fixtures();
  const en = bundle.messages.enUS.properties.profile;
  const zh = bundle.messages.zhCN.properties.profile;
  const policiesSource = read('merchant-web/src/views/properties/components/HotelPolicies.vue');
  const service = read('backend/services/merchant-service/app/Service/PropertyProfileService.php');
  const guardSource = read('merchant-web/src/router/guard.ts');
  const profile = read('merchant-web/src/views/properties/profile.vue');
  const css = fs.readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.css'))
    .map((name) => fs.readFileSync(path.join(outDir, 'assets', name), 'utf8')).join('\n');

  // ---------- Long Stay Details:视图 ----------
  console.log('\nHotelLongStay 视图(Figma 696:4375)');
  const lsView = strip(await bundle.renderLongStay({ modelValue: fixtures.longStay, editing: false, disabled: false }));
  check('卡片标题 `Long Stay Details`', lsView.includes(`>${esc('Long Stay Details')}<`));
  check('分组标题 `Long Stay Promotion`', lsView.includes(`>${esc('Long Stay Promotion')}<`));
  check('分组标题 `Long Stay Benefits`', lsView.includes(`>${esc('Long Stay Benefits')}<`));
  check('卡片头带 Edit 按钮', hasText(lsView, 'Edit'));
  for (const [name, discount] of [['7 Days', '5 %'], ['14 Days', '10 %'], ['30 Days', '25 %'], ['90 Days', '40 %']]) {
    check(`促销行 \`${name}\``, textsOf(lsView, 'promo-name').includes(name));
    check(`促销行折扣 \`${discount}\``, textsOf(lsView, 'promo-value').includes(discount));
  }
  check('促销行数 4', classesOf(lsView, 'promo-row').length === 4);
  check('行尾是 12px 状态绿点(稿面 EL-f77b9d60,不是 chevron)', classesOf(lsView, 'promo-dot').length === 4 && !lsView.includes('promo-arrow'));
  check('促销行 = 名称(右对齐) + 固定 300px 分隔线 + 取值(左对齐)',
    hasDecl(css, '.promo-row', 'justify-content:center', 'gap:24px')
    && hasDecl(css, '.promo-name', 'text-align:right', 'flex:1')
    && hasDecl(css, '.promo-line', 'flex:01300px')
    && hasDecl(css, '.promo-value', 'text-align:left', 'flex:1'),
    cssRules(css, '.promo-row').join(' | '));
  check('稿面两张卡:促销卡有卡头、权益卡没有', classesOf(lsView, 'ls-panel').length === 2 && classesOf(lsView, 'panel-head').length === 1);
  check('卡片头 Edit 是共享的描边药丸(不是 antd 默认按钮)',
    classesOf(lsView, 'mtrip-edit-pill').length === 1 && hasText(lsView, 'Edit'));
  check('分组小标按稿 16/500 半透明黑', hasDecl(css, '.ls-section h3', 'font-size:16px', 'font-weight:500'), cssRules(css, '.ls-section h3').join(' | '));
  check('促销行间距 16、权益 2 列间距 16x24(稿面 EL-a3671375 / EL-c0b8ba13)',
    hasDecl(css, '.promo-list', 'gap:16px') && hasDecl(css, '.benefit-grid', 'gap:16px24px'));
  for (const benefit of ['Free Laundry', 'Free Utilities', 'Kitchen', 'Workspace', 'Pet Friendly', 'Monthly Contract', 'No Deposit', 'Flexible Cancellation']) {
    check(`权益标签 \`${benefit}\``, hasText(lsView, benefit));
  }
  check('权益 8 条', classesOf(lsView, 'benefit').length === 8);
  check('权益圆点 12px #00A63E(与促销行同款,实测渲染图两处都是 12x12)',
    hasDecl(css, '.benefit i', 'width:12px', 'height:12px', 'background:#00a63e'));
  check('加粗权益带 bold 类', classesOf(lsView, 'benefit').some((list) => list.includes('bold')));
  check('停用权益带 inactive 类', classesOf(lsView, 'benefit').some((list) => list.includes('inactive')));
  check('空态文案未出现(有数据时)', !lsView.includes('No long stay promotions added yet.'));

  const lsEmpty = strip(await bundle.renderLongStay({ modelValue: { promotions: [], benefits: [] }, editing: false, disabled: false }));
  check('空态:促销提示', lsEmpty.includes(esc('No long stay promotions added yet.')));
  check('空态:权益提示', lsEmpty.includes(esc('No long stay benefits added yet.')));

  // ---------- Long Stay Details:编辑态 ----------
  console.log('\nHotelLongStay 编辑态(Figma 747:5592)');
  const lsEdit = strip(await bundle.renderLongStay({ modelValue: fixtures.longStay, editing: true }));
  check('两张编辑卡标题(促销为复数、权益同视图)', lsEdit.includes(esc('Long Stay Promotions')) && lsEdit.includes(esc('Long Stay Benefits')));
  check('卡头 `Add New` 按钮', classesOf(lsEdit, 'ant-btn').length >= 2 && hasText(lsEdit, 'Add New'));
  check('计数口径 `(4/10)`', lsEdit.includes(esc('(4/10)')));
  check('计数口径 `(8/12)`', lsEdit.includes(esc('(8/12)')));
  // 稿面编辑态是「一屏 3 张并排卡」,壳与儿童加床卡一致:铅笔左/垃圾桶右 → 内容行 → 标签+开关
  check('12 张编辑卡(4 促销 + 8 权益)', classesOf(lsEdit, 'ls-edit-card').length === 12);
  check('每张卡都有工具栏/内容行', classesOf(lsEdit, 'ls-card-tools').length === 12 && classesOf(lsEdit, 'ls-card-body').length === 12);
  check('卡内名称 `7 Days` / 折扣 `25%`(无空格)', lsEdit.includes('>7 Days<') && lsEdit.includes('>25%<'));
  check('状态是「标签 + 开关」而不是文字徽标:促销 1 行、权益 2 行,共 20 行',
    classesOf(lsEdit, 'ls-card-status').length === 20, `count=${classesOf(lsEdit, 'ls-card-status').length}`);
  check('权益的 Bold 开关只在启用时可选(停用项不可能加粗)',
    (lsEdit.match(/ls-card-body(?: single)?"><strong class="light"/g) ?? []).length === 6);
  check('旧的「Active/Paused/Bold」文字徽标与堆叠行样式已清除',
    !lsEdit.includes('ls-badge') && !/ls-row(?!-)/.test(read('merchant-web/src/views/properties/components/HotelLongStay.vue')));
  check('稿面两张编辑卡(促销 / 权益)', classesOf(lsEdit, 'ls-panel').length === 2);
  check('编辑卡栅格 3 列 + 间距 16(实测卡宽 392 / 间距 16)',
    hasDecl(css, '.ls-card-grid', 'grid-template-columns:repeat(3,minmax(0,1fr))', 'gap:16px', 'margin-top:16px'),
    cssRules(css, '.ls-card-grid').join(' | '));
  check('编辑卡:主色 1.5px 描边 + 圆角 8 + padding 0 0 24px(与儿童卡同壳)',
    hasDecl(css, '.ls-edit-card', 'border:1.5pxsolid#4d6cf4', 'border-radius:8px', 'padding:0024px'),
    cssRules(css, '.ls-edit-card').join(' | '));
  check('编辑卡内容行:padding 16 16 24 + 底部 1px 分隔线',
    hasDecl(css, '.ls-card-body', 'padding:16px16px24px', 'border-bottom:1pxsolid#e2e8f0'));
  check('工具栏两端对齐 + 图标 24', hasDecl(css, '.ls-card-tools', 'justify-content:space-between') && hasDecl(css, '.ls-card-tools svg', 'font-size:24px'));
  check('名称/折扣 PJS 600/24 主色(稿面 style_9c59b094);未加粗权益 PJS 400',
    hasDecl(css, '.ls-card-body strong', 'font-size:24px', 'color:#4d6cf4', "'PlusJakartaSans'") && hasDecl(css, '.ls-card-body strong.light', 'font-weight:400'),
    cssRules(css, '.ls-card-body strong').join(' | '));
  check('状态行:padding 0 16 + 标签 16/600',
    hasDecl(css, '.ls-card-status', 'padding:016px') && hasDecl(css, '.ls-card-status > span', 'font-size:16px', 'font-weight:600'));

  // ---------- Hotel Policies:视图 ----------
  console.log('\nHotelPolicies 视图(Figma 696:4711)');
  const hpView = strip(await bundle.renderPolicies({ modelValue: fixtures.policies, editing: false, disabled: false }));
  check('卡片标题 `Hotel Policies`', hpView.includes(`>${esc('Hotel Policies')}<`));
  for (const title of ['Booking Policies', 'Check In & Out Policies', 'Children & Extra Beds Policies', 'Property Rules']) {
    check(`分组标题 \`${title}\``, hasText(hpView, title));
  }
  check('四组折叠头', classesOf(hpView, 'hp-section-head').length === 4);
  check('默认全部展开(无折叠)', !hpView.includes('display: none'));
  check('字段标签 `Cancellation`', textsOf(hpView, 'hp-label').includes('Cancellation'));
  check('字段标签 `Prepayment`', textsOf(hpView, 'hp-label').includes('Prepayment'));
  check('字段标签 `Taxes & Fees`', hasText(hpView, 'Taxes & Fees'));
  check('取消政策原文', hpView.includes(esc("Free cancellation up to 48 hours before arrival. Cancellations made within 48 hours of check-in will incur a charge of the first night's stay.")));
  check('税费政策原文', hpView.includes(esc('Rates exclude 5% government tax and 10% service charge. These will be added to your final bill upon check-out.')));
  check('入住时间 `14:00`', textsOf(hpView, 'hp-check-time').includes('14:00'));
  check('退房时间 `12:00`', textsOf(hpView, 'hp-check-time').includes('12:00'));
  check('`Require Documents` 抬头', textsOf(hpView, 'hp-check-documents-label').includes('Require Documents'));
  check('证件 `Valid Passport / NRC`', hpView.includes(esc('Valid Passport / NRC')));
  check('证件 `Booking Confirmation`', hpView.includes(esc('Booking Confirmation')));
  for (const name of ['Children aged 0-5', 'Children aged 6-12', 'Adult ( 13+ )']) {
    check(`儿童加床行 \`${name}\``, hpView.includes(esc(name)));
  }
  check('金额 `Complimentary`', hpView.includes(esc('Complimentary')));
  check('金额 `MMK 35,000`', hpView.includes(esc('MMK 35,000')));
  check('金额 `MMK 50,000`', hpView.includes(esc('MMK 50,000')));
  check('单位 `/ night` x3', (hpView.match(/\/ night/g) ?? []).length === 3);
  check('宠物政策抬头', textsOf(hpView, 'hp-label').includes('Pet Policy'));
  check('宠物政策原文', hpView.includes(esc('To maintain the comfort of all guests, pets are not allowed in the property.')));
  check('停用儿童卡带 inactive 类', classesOf(hpView, 'hp-view-card').some((list) => list.includes('inactive')));
  for (const rule of ['Smoking', 'Quiet Hours', 'Infinity Pool Hours']) {
    check(`物业规则 \`${rule}\``, hpView.includes(`>${esc(rule)}<`));
  }
  check('规则卡图标 3 个(36x36,与儿童卡同壳)', classesOf(hpView, 'hp-rule-view-icon').length === 3);
  check('规则说明原文', hpView.includes(esc('Please respect quiet hours from 22:00 to 07:00 daily.')));

  // ---------- Hotel Policies:编辑态 ----------
  console.log('\nHotelPolicies 编辑态(Figma 748:7074)');
  const hpEdit = strip(await bundle.renderPolicies({ modelValue: fixtures.policies, editing: true }));
  for (const title of ['Booking Policies', 'Pet Policy', 'Check In Policy', 'Check Out Policy', 'Children & Extra Beds Policies', 'Property Rules']) {
    check(`编辑卡标题 \`${title}\``, hpEdit.includes(esc(title)));
  }
  check('六张编辑卡', classesOf(hpEdit, 'hp-panel').length === 6);
  check('政策计数 `(3/10)`', hpEdit.includes(esc('(3/10)')));
  check('规则计数 `(3/12)`', hpEdit.includes(esc('(3/12)')));
  check('字段标签 `Description`', hasText(hpEdit, 'Description'));
  check('`Policy Status` 文案 x7(3 条儿童 + 3 条规则 + 宠物政策开关的 aria-label)',
    (hpEdit.match(/Policy Status/g) ?? []).length === 7, `count=${(hpEdit.match(/Policy Status/g) ?? []).length}`);
  check('编辑态也给出 `Add New`', hasText(hpEdit, 'Add New'));

  // 走查修复 ①:编辑卡顺序必须与视图分组顺序一致(此前 Pet 排在 Check In/Out 之前,两态对调)
  const orderOf = (html, labels) => labels.map((label) => html.indexOf(esc(label)));
  const editOrder = orderOf(hpEdit, ['Booking Policies', 'Check In Policy', 'Check Out Policy', 'Children & Extra Beds Policies', 'Pet Policy', 'Property Rules']);
  check('编辑卡顺序 Booking → Check In → Check Out → Children → Pet → Rules',
    editOrder.every((index, position) => index >= 0 && (position === 0 || index > editOrder[position - 1])), JSON.stringify(editOrder));
  const viewOrder = orderOf(hpView, ['Booking Policies', 'Check In & Out Policies', 'Children & Extra Beds Policies', 'Pet Policy', 'Property Rules']);
  check('视图分组顺序 Booking → Check In & Out → Children → Pet → Rules',
    viewOrder.every((index, position) => index >= 0 && (position === 0 || index > viewOrder[position - 1])), JSON.stringify(viewOrder));

  // 走查修复 ②:Check In/Out 各自只在「整块没填过」时给一处「未填写」,不再时间/说明各给一处
  const emptyPoliciesFixture = {
    booking: { cancellation: '', prepayment: '', taxesFees: '' },
    checkIn: { time: '', description: '', documents: [] },
    checkOut: { time: '', description: '' },
    pet: { description: '' }, children: [], rules: [],
  };
  const freeAmountChildren = {
    ...fixtures.policies,
    children: [
      { id: 'c1', name: 'Free A', description: 'd', amount: '', unit: 'night', status: true },
      { id: 'c2', name: 'Free B', description: 'd', amount: '0', unit: 'night', status: true },
      { id: 'c3', name: 'Free C', description: 'd', amount: '0.00', unit: 'night', status: true },
      { id: 'c4', name: 'Paid D', description: 'd', amount: '1,000', unit: 'night', status: true },
    ],
  };
  const hpFree = strip(await bundle.renderPolicies({ modelValue: freeAmountChildren, editing: false }));
  check('金额空/0/0.00 → 卡片显示 Complimentary(不再显示占位破折号)',
    (hpFree.match(/Complimentary/g) ?? []).length === 3 && hpFree.includes('>1,000<') && !hpFree.includes('>—<'),
    `Complimentary=${(hpFree.match(/Complimentary/g) ?? []).length}`);
  check('中文下同一规则显示「免费」',
    (strip(await bundle.renderPoliciesZh({ modelValue: freeAmountChildren, editing: false })).match(/免费/g) ?? []).length === 3);
  check('金额文案走 amountLabel(两张卡都换掉了 `row.amount || \'—\'` 写法)',
    (policiesSource.match(/amountLabel\(row\)/g) ?? []).length === 2 && !policiesSource.includes("row.amount ||"));

  const hpEmpty = strip(await bundle.renderPolicies({ modelValue: emptyPoliciesFixture, editing: false, disabled: false }));
  const checkSection = hpEmpty.slice(hpEmpty.indexOf(esc('Check In & Out Policies')), hpEmpty.indexOf(esc('Children & Extra Beds Policies')));
  check('空 Check In/Out:两块共 2 处「未填写」(每块一处,非时间+说明各一处)',
    (checkSection.match(/Not provided/g) ?? []).length === 2, `count=${(checkSection.match(/Not provided/g) ?? []).length}`);
  check('空 Check In/Out:不再渲染大号占位时间', classesOf(checkSection, 'hp-check-time').length === 0);
  const partial = { ...emptyPoliciesFixture, checkIn: { time: '14:00', description: '', documents: [] } };
  const hpPartial = strip(await bundle.renderPolicies({ modelValue: partial, editing: false, disabled: false }));
  const partialSection = hpPartial.slice(hpPartial.indexOf(esc('Check In & Out Policies')), hpPartial.indexOf(esc('Children & Extra Beds Policies')));
  check('只填时间时该块不再出现「未填写」(说明为空不占位)',
    (partialSection.match(/Not provided/g) ?? []).length === 1 && textsOf(partialSection, 'hp-check-time').includes('14:00'));

  // Figma `696:4811` 对齐:标签独占一行 → 值块整体居中(时间 48 / 说明 16 居中 / 证件行居中且以 `.` 分隔)
  check('Check In/Out 结构:标签与值块是两个同级块(标签不再与时间同排)',
    classesOf(hpView, 'hp-check').length === 2 && classesOf(hpView, 'hp-check-value').length === 2);
  check('值块整体居中', classesOf(hpView, 'hp-check-value').length === 2);
  check('证件行:两份证件之间以 `.` 分隔(Figma 696:4828 的独立文本节点)',
    (hpView.match(/class="[^"]*hp-check-dot[^"]*"[^>]*>\.</g) ?? []).length === 1);
  const hpCheckSlice = hpView.slice(hpView.indexOf(esc('Check In & Out Policies')), hpView.indexOf(esc('Children & Extra Beds Policies')));
  check('证件行:抬头 1 个 + 证件 2 份 + 分隔点 1 个', (hpCheckSlice.match(/hp-check-documents-label/g) ?? []).length === 1 && (hpCheckSlice.match(/<b>/g) ?? []).length === 2 && (hpCheckSlice.match(/hp-check-dot/g) ?? []).length === 1);
  check('无证件时整行不渲染', strip(await bundle.renderPolicies({ modelValue: { ...fixtures.policies, checkIn: { ...fixtures.policies.checkIn, documents: [] } }, editing: false })).includes('hp-check-documents') === false);
  check('规则卡不再行内编辑(改由铅笔开弹窗,与儿童政策同构)',
    !policiesSource.includes('hp-rule-fields') && policiesSource.includes('const ruleModal = ref(false)'));
  check('规则弹窗字段齐全(状态 / 规则名称 / 规则图标 / 简短说明,复用儿童弹窗的版式类)',
    ['editingRuleId ? \'properties.profile.policiesTab.editRule\'', 'ruleForm.icon', 'hp-form-span', 'saveRule'].every((key) => policiesSource.includes(key)));

  // 儿童与加床政策:Figma 696:4840(视图)/ 772:12395(编辑)都是「3 张并排卡」
  const childrenZh = bundle.messages.zhCN.properties.profile.policiesTab;
  check('改名:en `Children & Extra Beds Policies` / zh `儿童与加床政策`',
    en.policiesTab.children === 'Children & Extra Beds Policies' && childrenZh.children === '儿童与加床政策',
    `en=${en.policiesTab.children} zh=${childrenZh.children}`);
  check('儿童与加床政策 + 物业规则:视图各 3 张并排卡,共 2 个卡片网格(Figma 696:4846 / 696:4888)',
    classesOf(hpView, 'hp-view-card').length === 6 && classesOf(hpView, 'hp-card-grid').length === 2);
  check('视图卡:名称 + 说明齐全(6 张);金额行只有儿童卡有(3 张)',
    classesOf(hpView, 'hp-card-name').length === 6 && classesOf(hpView, 'hp-card-desc').length === 6 && classesOf(hpView, 'hp-card-amount').length === 3);
  check('儿童与加床政策 + 物业规则:编辑各 3 张并排卡(Figma 772:11929 / 772:12307)',
    classesOf(hpEdit, 'hp-edit-card').length === 6);
  check('编辑卡:顶部工具栏 + 内容块 + 底部状态行(6 张都是)',
    classesOf(hpEdit, 'hp-edit-card-tools').length === 6 && classesOf(hpEdit, 'hp-edit-card-body').length === 6 && classesOf(hpEdit, 'hp-edit-card-status').length === 6);
  check('编辑卡:Policy Status 出现在卡片底部(儿童/规则各 3 处 + 宠物 1 处)', (hpEdit.match(/Policy Status/g) ?? []).length === 7);
  check('规则编辑卡图标 3 个', classesOf(hpEdit, 'hp-rule-view-icon').length === 3);
  check('旧的堆叠行样式已清除(hp-rule-list / hp-rule-edit / hp-rule-fields / hp-card-tools / hp-status)',
    ['hp-rule-list', 'hp-rule-edit', 'hp-rule-fields', 'hp-card-tools', 'hp-status'].every((cls) => !policiesSource.includes(cls)));

  // ---------- Nearby Attraction ----------
  console.log('\nHotelNearby(Figma 696:4914 / 772:6252)');
  const nbView = strip(await bundle.renderNearby({ modelValue: fixtures.nearby, propertyId: 7, editing: false, disabled: false }));
  check('卡片标题 `Nearby Attraction`', nbView.includes(`>${esc('Nearby Attraction')}<`));
  check('卡头 `Add New` 按钮', hasText(nbView, 'Add New'));
  check('三张并排卡(Figma 696:4991 / 696:4992)', classesOf(nbView, 'nb-card').length === 3 && classesOf(nbView, 'nb-grid').length === 1);
  check('每张卡 2 个地点行(696:5000 / 696:5009)', classesOf(nbView, 'nb-stop').length === 6);
  for (const name of ['Nyaung-U Airport', 'Bagan Temples', 'Ananda Temple', 'Dhammayangyi Temples']) {
    check(`地点名 \`${name}\``, nbView.includes(`>${esc(name)}<`));
  }
  check('路程写法 `20 mins drive (12 km)`(每卡第一条都是机场)', (nbView.match(/20 mins drive \(12 km\)/g) ?? []).length === 3);
  check('路程写法 `10 mins drive (5 km)` / `8 mins drive (3.2 km)`',
    nbView.includes(esc('10 mins drive (5 km)')) && nbView.includes(esc('8 mins drive (3.2 km)')));
  check('地点之间只有 1 条竖直虚线/卡(首行不画):共 3 条', classesOf(nbView, 'nb-connector').length === 3);
  check('图片上:顶部渐变蒙层 + 绿色状态圆点', classesOf(nbView, 'nb-scrim').length === 3 && classesOf(nbView, 'nb-dot').length === 3);
  check('停用卡带 inactive 类', classesOf(nbView, 'nb-card').some((list) => list.includes('inactive')));
  check('每张卡都有 `Edit Details` 按钮(视图态也是)',
    classesOf(nbView, 'nb-edit-details').length === 3 && hasText(nbView, 'Edit Details'));
  check('有数据时头部是 `Add New`,且没有裸的 `Edit` 按钮', hasText(nbView, 'Add New') && !hasText(nbView, 'Edit'));

  // 走查修复:无数据时头部应是「编辑」(与其它页签同款),不是「新增」
  const nbEmptyView = strip(await bundle.renderNearby({ modelValue: [], propertyId: 7, editing: false }));
  check('无数据时头部是 `Edit` 而不是 `Add New`',
    hasText(nbEmptyView, 'Edit') && !hasText(nbEmptyView, 'Add New'), nbEmptyView.slice(0, 320));
  check('空态文案', nbEmptyView.includes(esc('No nearby attractions added yet.')));
  const nearbySource = read('merchant-web/src/views/properties/components/HotelNearby.vue');
  check('空态编辑按钮是共享的 .mtrip-edit-pill',
    /v-if="!editing && !modelValue\.length"[\s\S]{0,240}class="mtrip-edit-pill"[\s\S]{0,120}@click="emit\('editRequested'\)"><EditOutlined \/>\{\{ t\('common\.edit'\) \}\}<\/button>/.test(nearbySource));
  // 回归:空列表进编辑态后必须还有「Add New」(否则没有新增入口)
  check('空列表 + 编辑态:头部是 `Add New` 而不是 `Edit`',
    hasText(strip(await bundle.renderNearby({ modelValue: [], propertyId: 7, editing: true })), 'Add New')
    && !hasText(strip(await bundle.renderNearby({ modelValue: [], propertyId: 7, editing: true })), 'Edit'));

  const nbEdit = strip(await bundle.renderNearby({ modelValue: fixtures.nearby, propertyId: 7, editing: true }));
  check('编辑态仍是同 3 张卡 + 3 个 Edit Details', classesOf(nbEdit, 'nb-card').length === 3 && classesOf(nbEdit, 'nb-edit-details').length === 3);

  // ---------- Hotel Amenities(Figma 696:4238 / 743:4446 / 865:12004 等) ----------
  console.log('\nHotelAmenities(Figma 696:4238 / 743:4446 / 865:12004)');
  const amView = strip(await bundle.renderAmenities({ modelValue: fixtures.amenities, editing: false, disabled: false }));
  check('设施胶囊 4 枚(3 设施 + 1 标签)', classesOf(amView, 'view-amenity').length === 3 && classesOf(amView, 'tag-card').length === 1);
  check('每枚都有行尾「星 + 状态点」组', classesOf(amView, 'flags').length === 4);
  check('加亮项是实心星、未加亮是描边星(夹具 2 加亮 / 2 未加亮)',
    classesOf(amView, 'on').length === 2 && classesOf(amView, 'off').length === 2,
    `on=${classesOf(amView, 'on').length} off=${classesOf(amView, 'off').length}`);
  check('停用项的状态点带 inactive(红)', classesOf(amView, 'flags').some((list) => list.includes('inactive')) || amView.includes('inactive'));
  check('标签卡带描述 `Minutes from the temples`', hasText(amView, 'Minutes from the temples'));
  check('分组小标按稿 16/500 半透明黑', hasDecl(css, '.view-group h3', 'font-size:16px', 'font-weight:500'));
  check('胶囊按稿:padding 12x16 / gap 16 / 圆角 32 / 1px #E2E8F0 / 白底(EL-802870b8)',
    hasDecl(css, '.view-amenity', 'padding:12px16px', 'gap:16px', 'border-radius:32px', 'border:1pxsolid#e2e8f0', 'background:#fefefe'),
    cssRules(css, '.view-amenity').join(' | '));
  check('胶囊图标 24px / 名称 600/16 主色(字距 .0088em)',
    hasDecl(css, '.view-amenity > svg', 'font-size:24px') && hasDecl(css, '.view-amenity', 'font-size:16px', 'letter-spacing:0.0088em'),
    cssRules(css, '.view-amenity > svg').join(' | '));
  check('行尾组:gap 8;加亮星是主色实心、未加亮是描边灰;点 12px 绿 / 停用红',
    hasDecl(css, '.flags', 'gap:8px') && hasDecl(css, '.flags > .on', 'color:#4d6cf4') && hasDecl(css, '.flags > .off', 'color:#a5a8b1')
    && hasDecl(css, '.flags > i', 'width:12px', 'height:12px', 'background:#00a63e') && hasDecl(css, '.flags > i.inactive', 'background:#ec1317'));
  check('标签卡按稿:padding 16 / gap 16 / 高 84 / 圆角 32 / 阴影(EL-2deb2dc1)',
    hasDecl(css, '.tag-card', 'min-height:84px', 'border-radius:32px') && hasDecl(css, '.tag-card > svg', 'font-size:40px'));

  const amEdit = strip(await bundle.renderAmenities({ modelValue: fixtures.amenities, editing: true }));
  check('编辑态一屏 3 张并排卡(gap 16)', classesOf(amEdit, 'amenity-edit-grid').length === 3 && hasDecl(css, '.amenity-edit-grid', 'gap:16px'));
  check('编辑卡与其它页签同壳:主色 1.5px 描边 / 圆角 8 / padding 0 0 24px / gap 16',
    hasDecl(css, '.amenity-edit-card', 'border:1.5pxsolid#4d6cf4', 'border-radius:8px', 'padding:0024px', 'gap:16px'),
    cssRules(css, '.amenity-edit-card').join(' | '));
  check('编辑卡工具栏两端对齐 + 图标 24、内容行 padding 16 16 24 + 底部 1px 分隔线',
    hasDecl(css, '.card-tools', 'justify-content:space-between') && hasDecl(css, '.card-tools svg', 'font-size:24px')
    && hasDecl(css, '.card-identity', 'padding:016px24px', 'border-bottom:1pxsolid#e2e8f0'),
    cssRules(css, '.card-identity').join(' | '));
  check('编辑卡不再显示描述(稿面只有图标 + 名称)',
    !amEdit.includes('Minutes from the temples') && !/card-identity[^>]*>[\s\S]{0,200}<small/.test(amEdit));
  check('状态行标签 16/600', hasDecl(css, '.card-switch', 'padding:016px', 'font-size:16px', 'font-weight:600'),
    cssRules(css, '.card-switch').join(' | '));

  const amenitiesSource = read('merchant-web/src/views/properties/components/HotelAmenities.vue');
  check('弹窗标题用共享 .mtrip-modal-title(与其它页签同一号 18/600)',
    amenitiesSource.includes('class="mtrip-modal-title"') && indexLessBlock('mtrip-modal-title').includes('font-size:18px'));
  check('弹窗开关行标签 16/600(稿面 865:12004)', hasDecl(css, '.modal-switches label', 'font-size:16px', 'font-weight:600'));
  // 走查修复:两个开关必须同一行左右分列,中间 1px 竖分隔
  check('开关行横向排布:.modal-switches 自身是 flex,两个 label 各占一半、之间有竖分隔',
    hasDecl(css, '.modal-switches', 'display:flex', 'align-items:center')
    && hasDecl(css, '.modal-switches label', 'flex:1')
    && hasDecl(css, '.modal-switches label + label', 'border-left:1pxsolid#eceef3'),
    cssRules(css, '.modal-switches').join(' | '));
  // 走查修复:竖线两侧要等距(左边由 flex gap 提供,右边由 label2 的 padding-left 提供),
  // 否则线会紧贴左侧开关(用户截图)
  check('竖线两侧等距:gap 与 padding-left 都是 24,且窄屏竖排时 gap 归零',
    hasDecl(css, '.modal-switches', 'gap:24px')
    && hasDecl(css, '.modal-switches label + label', 'padding-left:24px')
    && /\.modal-switches\[data-v-[a-z0-9]+\]\{gap:0;align-items:stretch;flex-direction:column;\}/.test(css.replace(/\s+/g, '')),
    cssRules(css, '.modal-switches').join(' | ') + ' || ' + cssRules(css, '.modal-switches label + label').join(' | '));
  // 走查修复:图标下拉按稿「只显示图标」
  check('图标下拉:选中项只渲染图标(VNode label + #option 插槽),不再显示图标+文字',
    /:options="iconSelectOptions"/.test(amenitiesSource)
    && /iconSelectOptions = computed\(\(\) => iconOptions\.value\.map\(\(option\) => \(\{ value: option\.key, label: h\(iconFor\(option\.key\)\) \}\)\)\)/.test(amenitiesSource)
    && /<template #option="\{ value \}"><component :is="iconFor\(value\)" \/>/.test(amenitiesSource));
  check('图标下拉:框高 60、图标 32px 居中主色(renderer 图实测 60 / 32x34)',
    hasDecl(css, '.amenity-icon-select .ant-select-selector', 'height:60px!important', 'justify-content:center', 'border-radius:8px!important')
    && hasDecl(css, '.amenity-icon-select .ant-select-selection-item', 'font-size:32px!important', 'color:#4d6cf4!important'),
    cssRules(css, '.amenity-icon-select .ant-select-selector').join(' | '));
  check('弹窗输入框 44 高(与其它三个弹窗同号;稿面 renderer 实测 43)',
    hasDecl(css, '.amenity-form .ant-input', 'height:44px!important'));

  // ---------- i18n:两份语言键结构与弹窗字段 ----------
  console.log('\ni18n 键结构(en-US / zh-CN)');
  for (const block of ['longStayTab', 'policiesTab', 'nearbyTab']) {
    const enKeys = keyPaths(en[block], block).sort();
    const zhKeys = keyPaths(zh[block], block).sort();
    check(`${block} 两份键数一致(${enKeys.length})`, enKeys.length === zhKeys.length, `en=${enKeys.length} zh=${zhKeys.length}`);
    check(`${block} 键路径逐字一致`, JSON.stringify(enKeys) === JSON.stringify(zhKeys));
    check(`${block} 无空文案`, keyPaths(en[block], block).every((keyPath) => {
      const value = keyPath.split('.').reduce((node, key) => (node ? node[key] : undefined), en);
      return typeof value === 'string' && value.trim().length > 0;
    }));
  }
  check('弹窗字段:促销弹窗标题', en.longStayTab.editPromotion === 'Edit Long Stay Promotion' && en.longStayTab.createPromotion === 'Create New Long Stay Promotion');
  check('弹窗字段:编辑卡标题为复数', en.longStayTab.promotionsCardTitle === 'Long Stay Promotions');
  check('弹窗字段:权益 Bold 开关', en.longStayTab.boldBenefit === 'Bold Benefit');
  check('弹窗字段:儿童加床四字段', ['policyName', 'shortDescription', 'amount', 'perUnit'].every((key) => key in en.policiesTab));
  check('弹窗字段:景点五字段', ['locationIcon', 'locationName', 'travelTime', 'travelMode', 'distance'].every((key) => key in en.nearbyTab));
  check('弹窗:多地点(Mark N)+ Add More 按稿实现',
    ['editDetails', 'addMore', 'mark', 'stopLimitReached'].every((key) => key in en.nearbyTab)
    && policiesSource.length > 0
    && read('merchant-web/src/views/properties/components/HotelNearby.vue').includes('v-for="(stop, index) in form.stops"')
    && read('merchant-web/src/views/properties/components/HotelNearby.vue').includes('@click="addStop"'));
  // profile.vue 的 scoped 样式单独编译出来断言(它不在 SSR 构建的入口里)
  const { parse: parseSfc, compileStyle } = await import('@vue/compiler-sfc');
  const profileCss = compileStyle({
    source: parseSfc(profile).descriptor.styles[0].content,
    filename: 'profile.vue', id: 'data-v-scope', scoped: true,
  }).code;
  // 走查修复:「所有物业」列表点 Manage 应与左上角下拉切换物业同效(下拉 + 左侧物业专属菜单一起联动)
  check('进物业专属页时把路由里的物业 id 对齐到全局选中(Manage / 深链 / 刷新都算)',
    /const pathPropertyId = to\.name === 'PropertyProfile' \? Number\(to\.params\.id\) \|\| 0 : 0;/.test(guardSource)
    && /const routePropertyId = pathPropertyId \|\| queryPropertyId;[\s\S]{0,60}userStore\.selectProperty\(routePropertyId\)/.test(guardSource),
    'guard.ts 未把路由里的物业 id 对齐到 selectedPropertyId');
  check('⚠️ 只认 PropertyProfile 的 :id,不把 /rooms/:id 的**房型 id** 当物业 id(否则会选错物业)',
    /to\.name === 'PropertyProfile' \? Number\(to\.params\.id\)/.test(guardSource));
  // 侧边栏联动的依据:左侧菜单与下拉都挂在 selectedPropertyId 上
  check('跨层:左侧物业专属菜单确实挂在选中物业上(visibleMenus 按 business_type 过滤 + isMenuPathVisible 门槛)',
    /visibleMenus: \(state\): MenuNode\[\] => \{[\s\S]{0,220}selectedPropertyId/.test(read('merchant-web/src/stores/user.ts'))
    && read('merchant-web/src/config/menuSections.ts').includes('if (PROPERTY_SCOPED_PATHS.includes(path)) return selected !== null;')
    && read('merchant-web/src/config/menuSections.ts').includes("if (HOTEL_SCOPED_PATHS.includes(path)) return selected?.business_type === 'hotel';"));

  // 走查修复:侧边栏点「All Properties」要整机切到 All Properties 模式(用户报的缺陷)
  check('进入 All Properties 时清掉选中物业(左上角下拉切回 All Properties)',
    /to\.name === 'AllProperties'[\s\S]{0,120}userStore\.selectProperty\(null\)/.test(guardSource),
    'guard.ts 未在 AllProperties 上清选中物业');
  check('All Properties 列表页本身不带物业筛选(清掉 header 后即返回全部)',
    read('merchant-web/src/views/properties/index.vue').includes('apiPropertyList({ page: 1, pageSize: 200 })'));
  // 后端确实按 X-Mtrip-Property-Id 收窄列表 —— 这就是「必须清掉选中物业」的原因(已用真实 HTTP 复核:无 header total=2 / 带 7 只回 1 条)
  check('跨层:列表接口按选中物业收窄(scopePropertyIds),所以前端进列表页必须先清选中',
    read('backend/services/merchant-service/app/Service/PropertyKycService.php').includes('MerchantContext::scopePropertyIds()')
    && read('backend/shared/src/Context/MerchantContext.php').includes('$selected > 0 ? (in_array($selected, $authorized, true) ? [$selected] : []) : $authorized'));

  // 走查修复:左上角切换物业时,Hotel Profile 不跟着换(用户报的缺陷)
  const layoutSource = read('merchant-web/src/layouts/BasicLayout.vue');
  check('切换物业时 Hotel Profile 跟着换路由(否则停留旧物业)',
    /route\.name === 'PropertyProfile'[\s\S]{0,200}router\.push\(id === null \? '\/properties' : `\/properties\/\$\{id\}\/profile`\)/.test(layoutSource),
    'BasicLayout.selectProperty 缺少 PropertyProfile 分支');
  check('profile.vue 的 propertyId 改为跟随路由参数(computed,不再是 setup 时常量)',
    profile.includes('const propertyId = computed(() => Number(route.params.id));')
    && !profile.includes('const propertyId = Number(route.params.id);'));
  check('profile.vue 监听路由参数变化:重新拉数据 + 复位编辑态与页签',
    /watch\(propertyId, \(\) => \{[\s\S]{0,320}editing\.value = false;[\s\S]{0,160}void load\(\);[\s\S]{0,20}\}\);/ .test(profile)
    || /watch\(propertyId, \(\) => \{[\s\S]{0,300}void load\(\);[\s\S]{0,20\}\);/.test(profile));
  check('profile.vue 里取物业 id 的地方都走 .value(无残留旧写法)',
    !/apiPropertyProfile\(propertyId\)|apiPropertyPublish\(propertyId[,)]|apiPropertyProfileImageUpload\(propertyId[,)]/.test(profile));

  // 走查修复:profile.vue 里「给编辑按钮染蓝」的规则误伤了 Hotel Images 卡头的主按钮 Add New
  // (primary 的白字被染成主色,蓝底上几乎看不见 —— 用户截图)
  // 判据:凡是「.section-head 里的 .ant-btn」且设置了 color 的规则,都必须带 :not(.ant-btn-primary)
  const sectionHeadButtonRules = [...profileCss.matchAll(/[^{}]*\.section-head[^{}]*\.ant-btn[^{}]*\{([^}]*)\}/g)];
  check('卡头染蓝规则已排除主按钮(仅作用于描边按钮,primary 的白字不被覆盖)',
    sectionHeadButtonRules.length > 0
    && sectionHeadButtonRules.every((match) => !/color:/.test(match[1]) || match[0].includes(':not(.ant-btn-primary)')),
    sectionHeadButtonRules.map((match) => match[0].replace(/\s+/g, ' ').trim()).join(' || '));

  check('底部操作栏置底:页面 flex column + a-spin 两层包裹撑满 + 操作栏 margin-top:auto 且保留 sticky',
    hasDecl(profileCss, '.profile-page', 'display:flex', 'flex-direction:column')
    && hasDecl(profileCss, '.profile-page .ant-spin-nested-loading', 'display:flex', 'flex:1', 'flex-direction:column')
    && hasDecl(profileCss, '.profile-page .ant-spin-container', 'display:flex', 'flex:1', 'flex-direction:column')
    && hasDecl(profileCss, '.edit-actions', 'margin:auto-28px-48px', 'position:sticky'),
    cssRules(profileCss, '.edit-actions').join(' | '));

  // 四个页签的「编辑」按钮必须同款:五处引用同一个类,样式只在 index.less 定义一份
  const indexLess = read('merchant-web/src/styles/index.less');
  const pillRule = (() => {
    const start = indexLess.indexOf('.mtrip-edit-pill {');
    return start < 0 ? '' : indexLess.slice(start, indexLess.indexOf('}', start)).replace(/\s+/g, '');
  })();
  check('编辑按钮样式只在 index.less 定义一份(高度 34 / 圆角 8 / 1px 主色边 / 主色 600/12)',
    pillRule.includes('height:34px') && pillRule.includes('padding:016px') && pillRule.includes('border:1pxsolid#4d6cf4')
    && pillRule.includes('border-radius:8px') && pillRule.includes('font-size:12px') && pillRule.includes('font-weight:600')
    && pillRule.includes('color:#4d6cf4'),
    pillRule);
  const pillFiles = {
    'Hotel Details(profile.vue)': read('merchant-web/src/views/properties/profile.vue'),
    'Hotel Amenities': read('merchant-web/src/views/properties/components/HotelAmenities.vue'),
    'Long Stay Details': read('merchant-web/src/views/properties/components/HotelLongStay.vue'),
    'Hotel Policies': read('merchant-web/src/views/properties/components/HotelPolicies.vue'),
    'Nearby Attraction': read('merchant-web/src/views/properties/components/HotelNearby.vue'),
  };
  for (const [label, source] of Object.entries(pillFiles)) {
    check(`${label} 的编辑按钮用同一个 .mtrip-edit-pill(EditOutlined + common.edit + editRequested)`,
      /<button[^>]*class="mtrip-edit-pill"[^>]*><EditOutlined \/>\{\{ t\('common\.edit'\) \}\}<\/button>/.test(source));
  }
  check('没有组件再自带一份药丸样式(ls-edit-pill / panel-head :deep(.ant-btn) 都已清除)',
    !Object.values(pillFiles).some((source) => source.includes('ls-edit-pill {') || source.includes('.panel-head :deep(.ant-btn)')));
  check('渲染:五个页签的编辑按钮都是同一个类,且都没有混进 ant-btn',
    classesOf(lsView, 'mtrip-edit-pill').length === 1
    && classesOf(hpView, 'mtrip-edit-pill').length === 1
    && classesOf(hpView, 'ant-btn').length === 0
    && classesOf(nbEmptyView, 'mtrip-edit-pill').length === 1
    && classesOf(nbEmptyView, 'ant-btn').length === 0);

  check('跨层:nearby 卡片结构(image/status/stops)三处贯通',
    service.includes("'stops' => $stops") && service.includes('NEARBY_STOP_LIMIT')
    && read('merchant-web/src/api/properties.ts').includes('export interface NearbyStop')
    && profile.includes('rawStops.length ? rawStops.map(toStop)'));

  // ---------- i18n 译文体检(en / zh 对照) ----------
  console.log('\ni18n 译文(en-US / zh-CN)');
  check('通用键 addNew:en `Add New` / zh `新增`', en.addNew === 'Add New' && zh.addNew === '新增', `en=${en.addNew} zh=${zh.addNew}`);
  check('图片专用键 addNewImage:zh 保留 `新增图片`', zh.addNewImage === '新增图片' && en.addNewImage === 'Add New', `en=${en.addNewImage} zh=${zh.addNewImage}`);
  check('景点路程时间占位符不再混英文(例如：10 分钟)', zh.nearbyTab.travelTimeHint === '例如：10 分钟', zh.nearbyTab.travelTimeHint);
  check('三个页签的 Add New 文案键都不含图片语义', !/图片/.test(zh.addNew));
  check('弹窗按钮 `Create Now` 是 policies 自己的键(不跨场景复用)', en.policiesTab.createNow === 'Create Now' && zh.policiesTab.createNow === '立即创建');
  check('金额占位符 `000,000`(Figma 816:13581)', en.policiesTab.amountPlaceholder === '000,000' && zh.policiesTab.amountPlaceholder === '000,000');

  const policiesZh = strip(await bundle.renderPoliciesZh({ modelValue: fixtures.policies, editing: true }));
  check('中文编辑态:Documents / Children / Rules 的按钮是 `新增`', policiesZh.includes('>新增<') && !policiesZh.includes('新增图片'));
  const longStayZh = strip(await bundle.renderLongStayZh({ modelValue: fixtures.longStay, editing: true }));
  check('中文编辑态:促销 / 权益卡的按钮是 `新增`', longStayZh.includes('>新增<') && !longStayZh.includes('新增图片'));
  const nearbyZh = strip(await bundle.renderNearbyZh({ modelValue: fixtures.nearby, propertyId: 7, editing: true }));
  check('中文编辑态:景点卡片头按钮是 `新增`', nearbyZh.includes('>新增<') && !nearbyZh.includes('新增图片'));

  // ---------- 编译产物 CSS 令牌 ----------
  console.log('\n样式令牌');
  check('主色令牌 #4d6cf4(本页既有,非稿面 #4169ED)', css.includes('#4d6cf4') || css.includes('#4D6CF4'));
  check('权益绿点 #00a63e', css.toLowerCase().includes('#00a63e'));
  check('卡片圆角与边框', css.includes('border-radius: 10px') && css.includes('#e9ebf2'));
  check('促销分隔线样式存在', css.includes('.promo-line'));
  check('景点卡网格三列', css.includes('repeat(3, minmax(0, 1fr))'));
  check('响应式断点 600px', css.includes('600px'));
  check('时间 48 / Plus Jakarta Sans / -0.02em(Figma style_490f7a1c)',
    hasDecl(css, '.hp-check-time', 'font-size:48px', "'PlusJakartaSans'", 'letter-spacing:-0.02em'),
    cssRules(css, '.hp-check-time').join(' | '));
  check('值块整体居中(Figma 696:4820)',
    hasDecl(css, '.hp-check-value', 'justify-items:center'), cssRules(css, '.hp-check-value').join(' | '));
  check('说明 16/24 居中(Figma style_1e3051d3)',
    hasDecl(css, '.hp-check-text', 'font-size:16px', 'line-height:24px', 'text-align:center'),
    cssRules(css, '.hp-check-text').join(' | '));
  check('证件行居中 / gap 16 / 底对齐(Figma 696:4823)',
    hasDecl(css, '.hp-check-documents', 'justify-content:center', 'gap:16px', 'align-items:flex-end'),
    cssRules(css, '.hp-check-documents').join(' | '));
  check('`Require Documents` 红字 16/500(Figma 696:4825)',
    hasDecl(css, '.hp-check-documents-label', 'color:#ec1317', 'font-size:16px', 'font-weight:500'),
    cssRules(css, '.hp-check-documents-label').join(' | '));
  check('证件名 16/600(Figma style_84c2efae)',
    hasDecl(css, '.hp-check-documents b', 'font-size:16px', 'font-weight:600'),
    cssRules(css, '.hp-check-documents b').join(' | '));
  check('入住/退房两块之间是稿面的独立分隔线元素(Figma 696:4832)',
    (hpCheckSlice.match(/hp-form-line/g) ?? []).length === 1 && hasDecl(css, '.hp-form-line', 'background:#e2e8f0'));

  // 预订政策:标签在上、取值在下(Figma 696:4792 EL-56135fb6 column gap 16),组间 1px 分隔线
  const bookingSlice = hpView.slice(hpView.indexOf(esc('Booking Policies')), hpView.indexOf(esc('Check In & Out Policies')));
  check('预订政策:3 组都是「标签在上 + 取值在下」(不再是左右两列)',
    (bookingSlice.match(/hp-field hp-field-block/g) ?? []).length === 3
    && (bookingSlice.match(/hp-label/g) ?? []).length === 3);
  check('预订政策:组间 2 条 1px 分隔线(首组前没有)',
    (bookingSlice.match(/hp-form-line/g) ?? []).length === 2);
  check('分组体统一 24 间距 + 头部到首块合计 24(Figma 四个分组容器 gap 24)',
    hasDecl(css, '.hp-section-body', 'gap:24px', 'padding:14px0'), cssRules(css, '.hp-section-body').join(' | '));
  check('标签↔取值间距 16(Figma EL-56135fb6)', hasDecl(css, '.hp-field-block', 'gap:16px'), cssRules(css, '.hp-field-block').join(' | '));
  check('卡片网格与分组头之间留有上边距(编辑 16;视图由分组体 padding-top 14 + 头部 10 提供)',
    hasDecl(css, '.hp-card-grid', 'margin-top:16px') && hasDecl(css, '.hp-section-body', 'padding:14px0'),
    cssRules(css, '.hp-card-grid').join(' | '));
  check('规则卡图标 36x36 主色(Figma EL-77c9f1fc)',
    hasDecl(css, '.hp-rule-view-icon', 'font-size:36px', 'color:#4d6cf4'), cssRules(css, '.hp-rule-view-icon').join(' | '));
  check('并排卡网格:3 列 + gap 24(Figma 696:4846)',
    hasDecl(css, '.hp-card-grid', 'grid-template-columns:repeat(3,minmax(0,1fr))', 'gap:24px'), cssRules(css, '.hp-card-grid').join(' | '));
  check('视图卡:1px #E2E8F0 + 圆角 12 + padding 20(Figma EL-eff32cb8)',
    hasDecl(css, '.hp-view-card', 'border:1pxsolid#e2e8f0', 'border-radius:12px', 'padding:20px'), cssRules(css, '.hp-view-card').join(' | '));
  check('编辑卡:主色 1.5px 描边 + 圆角 8 + 底部 24(Figma EL-ee5d340c)',
    hasDecl(css, '.hp-edit-card', 'border:1.5pxsolid#4d6cf4', 'border-radius:8px', 'padding:0024px'), cssRules(css, '.hp-edit-card').join(' | '));
  check('编辑卡内容块:padding 16/16/24 + 底部 1px 分隔线(Figma EL-912d0b4c)',
    hasDecl(css, '.hp-edit-card-body', 'padding:16px16px24px', 'border-bottom:1pxsolid#e2e8f0'), cssRules(css, '.hp-edit-card-body').join(' | '));
  check('编辑卡工具栏:两端对齐 + 图标 24(Figma EL-c954cc8e / EL-6e813941)',
    hasDecl(css, '.hp-edit-card-tools', 'justify-content:space-between') && hasDecl(css, '.hp-edit-card-tools svg', 'font-size:24px'),
    cssRules(css, '.hp-edit-card-tools').join(' | '));
  check('编辑卡状态行:左右 16 内边距(Figma EL-74dbf13c)',
    hasDecl(css, '.hp-edit-card-status', 'padding:016px'), cssRules(css, '.hp-edit-card-status').join(' | '));
  check('金额用主色 600/16 + 单位 400/12 gap 4(Figma style_c535faf3 / EL-e487a1a2)',
    hasDecl(css, '.hp-card-amount', 'gap:4px') && hasDecl(css, '.hp-card-amount b', 'color:#4d6cf4', 'font-size:16px', 'font-weight:600') && hasDecl(css, '.hp-card-amount span', 'font-size:12px', 'font-weight:400'),
    cssRules(css, '.hp-card-amount b').join(' | '));
  check('卡片标题 700/16 #1B1D30 / 说明 500/14 半透明黑(Figma style_39b4920d / style_10a4efb0)',
    hasDecl(css, '.hp-card-name', 'font-size:16px', 'font-weight:700', 'color:#1b1d30') && hasDecl(css, '.hp-card-desc', 'font-size:14px', 'color:rgba(25,26,37,0.5)'),
    cssRules(css, '.hp-card-name').join(' | '));
  check('弹窗标题 PJS 600/18(Figma 816:13559)',
    hasDecl(css, '.hp-modal-title', 'font-size:18px', "'PlusJakartaSans'", 'font-weight:600'), cssRules(css, '.hp-modal-title').join(' | '));
  check('弹窗 body gap 24 + 状态行两端对齐(Figma Body / 816:13562)',
    hasDecl(css, '.hp-child-form', 'gap:24px') && hasDecl(css, '.hp-switch-row', 'justify-content:space-between', 'font-size:16px'),
    cssRules(css, '.hp-child-form').join(' | '));
  check('状态行下方 1px 分隔线(Figma Line 1808:14490)', hasDecl(css, '.hp-form-line', 'height:1px', 'background:#e2e8f0'));
  check('字段 2x2 网格 + 24 gap(Figma EL-60bc5d72)',
    hasDecl(css, '.hp-form-grid', 'grid-template-columns:repeat(2,minmax(0,1fr))', 'gap:24px'), cssRules(css, '.hp-form-grid').join(' | '));
  // 走查修复:全局 src/styles/index.less 用 !important 把 antd 控件钉在 34px,
  // 弹窗必须同样带 !important 才能让下拉框与另外三个 44px 输入框等高。
  check('弹窗控件等高:输入框 44 + 圆角 8 + 边 #E2E8F0(Figma EL-8c78ba87)',
    hasDecl(css, '.hp-child-form .ant-input', 'height:44px!important', 'min-height:44px!important', 'border-radius:8px!important', 'border-color:#e2e8f0!important'),
    cssRules(css, '.hp-child-form .ant-input').join(' | '));
  check('弹窗控件等高:下拉框同样 44 !important(不被全局 34px 覆盖)',
    hasDecl(css, '.hp-child-form .ant-select-single:not(.ant-select-customize-input):not(.hp-currency-select) .ant-select-selector', 'height:44px!important', 'min-height:44px!important'),
    cssRules(css, '.hp-child-form .ant-select-single:not(.ant-select-customize-input):not(.hp-currency-select) .ant-select-selector').join(' | '));
  check('弹窗控件等高:下拉选中文本行高 42 垂直居中(全局 32 !important 已覆盖)',
    hasDecl(css, '.hp-child-form .ant-select-single .ant-select-selector .ant-select-selection-item', 'line-height:42px!important'),
    cssRules(css, '.hp-child-form .ant-select-single .ant-select-selector .ant-select-selection-item').join(' | '));
  check('弹窗控件等高:金额框内层输入框不撑高(42 / 无边框 / 透底)',
    hasDecl(css, '.hp-amount-box .ant-input', 'height:42px!important', 'border:0!important', 'background:transparent!important'),
    cssRules(css, '.hp-amount-box .ant-input').join(' | '));
  check('金额输入框:外层 44 高 + 币种下拉靠右(Figma 816:13580)',
    hasDecl(css, '.hp-amount-box', 'height:44px', 'border-radius:8px') && hasDecl(css, '.hp-amount-box .hp-currency-select', 'flex:00auto', 'width:72px'),
    cssRules(css, '.hp-amount-box').join(' | '));
  check('币种下拉面板按内容自适应宽度(否则「MMK」会被截成「M...」)',
    policiesSource.includes(':dropdown-match-select-width="false"'));
  check('币种下拉是小胶囊:24 高 / 圆角 4 / 蓝底 rgba(65,105,237,0.08)(Figma 816:13582)',
    hasDecl(css, '.hp-amount-box .hp-currency-select .ant-select-selector', 'height:24px!important', 'border-radius:4px!important', 'background:rgba(65,105,237,0.08)!important'),
    cssRules(css, '.hp-amount-box .hp-currency-select .ant-select-selector').join(' | '));
  check('币种下拉文字 600/12 主色(Figma 816:13583)',
    hasDecl(css, '.hp-amount-box .hp-currency-select .ant-select-selection-item', 'color:#4d6cf4!important', 'font-size:12px!important', 'font-weight:600!important'),
    cssRules(css, '.hp-amount-box .hp-currency-select .ant-select-selection-item').join(' | '));
  check('币种下拉不被「四个控件等高 44」那条扫进去(否则胶囊会被撑到 44)',
    policiesSource.includes(':not(.hp-currency-select)') && hasDecl(css, '.hp-child-form .ant-select-single:not(.ant-select-customize-input):not(.hp-currency-select) .ant-select-selector', 'height:44px!important'));
  check('Cancel 白底描边 44/圆角 6、Create Now 主色 44/圆角 8(Figma 816:13596 / 816:13598)',
    hasDecl(css, '.hp-modal-cancel', 'border-radius:6px') && hasDecl(css, '.hp-modal-submit', 'border-radius:8px') && hasDecl(css, '.hp-modal-actions .ant-btn', 'height:44px'),
    cssRules(css, '.hp-modal-actions .ant-btn').join(' | '));
  check('段标题 16(Figma style_a0c83887)',
    hasDecl(css, '.hp-section-head', 'font-size:16px'), cssRules(css, '.hp-section-head').join(' | '));
  // 稿面控件是 lucide 24x24 方框(笔画仅 14x8),antd 字形填满方框 —— 用 16px 才与稿面视觉等大
  check('段标题 chevron 取 16px(与稿面 lucide 24 方框的笔画等大,不照抄 24)',
    hasDecl(css, '.hp-section-head svg', 'font-size:16px'), cssRules(css, '.hp-section-head svg').join(' | '));
  check('编辑卡右上角箭头同样是 16px + 与分组头同色(稿面实测同为 14x8)',
    hasDecl(css, '.collapse-mark', 'font-size:16px', 'color:#9aa0ae'), cssRules(css, '.collapse-mark').join(' | '));

  // ---------- 跨层契约 ----------
  console.log('\n跨层契约');
  const migration = read('database/migrations/V20260921140000__add-property-profile-hotel-tabs.sql');
  const snapshot = read('database/merchant/03-group-store.sql');

  check('profile.vue 读 snake_case 三字段', ['row.long_stay', 'row.hotel_policies', 'row.nearby_attractions'].every((key) => profile.includes(key)));
  check('profile.vue 写 camelCase 三字段', ['longStay:', 'hotelPolicies:', 'nearbyAttractions:'].every((key) => profile.includes(key)));
  check('profile.vue 三个页签不再 disabled', !profile.includes("!['details', 'amenities', 'rooms'].includes(tab.key)"));
  check('profile.vue 三个新组件挂在视图态', ['activeTab === \'long-stay\'', 'activeTab === \'policies\'', 'activeTab === \'nearby\''].every((key) => profile.includes(key)));
  check('profile.vue 三个新组件挂在编辑态', ['editingTab === \'long-stay\'', 'editingTab === \'policies\'', 'editingTab === \'nearby\''].every((key) => profile.includes(key)));
  check('profile.vue 复制/兜底三块数据', profile.includes('longStay: {') && profile.includes('hotelPolicies: {') && profile.includes('nearbyAttractions:'));
  check('后端 FIELDS 含三列', ['long_stay', 'hotel_policies', 'nearby_attractions'].every((key) => service.includes(`'${key}'`)));
  check('后端 JSON_FIELDS 含三列', service.includes("'long_stay', 'hotel_policies', 'nearby_attractions',"));
  check('后端三块归一化方法', ['normalizeLongStay', 'normalizePolicies', 'normalizeNearby'].every((name) => service.includes(`function ${name}`)));
  check('后端条数上限', service.includes('LONG_STAY_LIMITS') && service.includes('POLICY_LIMITS') && service.includes('NEARBY_LIMIT'));
  check('迁移为幂等守卫式 ALTER', (migration.match(/COLUMN_NAME=/g) ?? []).length === 3 && migration.includes('information_schema.COLUMNS'));
  check('迁移与快照列名一致', ['long_stay', 'hotel_policies', 'nearby_attractions'].every((key) => migration.includes(key) && snapshot.includes(key)));

  // 儿童与加床政策弹窗(Figma 816:13556 / 814:13469):结构 + 币种贯通
  const policies = policiesSource;
  check('弹窗:2x2 字段网格 + 金额框 + 币种下拉 + 底部两枚按钮',
    ['hp-child-form', 'hp-form-line', 'hp-form-grid', 'hp-amount-box', 'hp-currency-select', 'hp-modal-cancel', 'hp-modal-submit'].every((cls) => policies.includes(cls)));
  check('弹窗:金额框内是无边框输入 + 右侧币种下拉(不再是只读胶囊)',
    /:bordered="false"[\s\S]{0,240}hp-currency-select/.test(policies) && !policies.includes('hp-currency-chip'));
  // 编辑卡右上角箭头 + 宠物政策开关(Figma 772:11667)
  check('编辑卡右上角箭头是图标而非文字箭头(稿面两处都是同一枚 lucide chevron)',
    !policies.includes('collapse-mark">') && (policies.match(/<DownOutlined class="collapse-mark" \/>/g) ?? []).length === 5);
  check('宠物政策卡头是状态开关(Figma 772:11663 49.45x24)',
    policies.includes('<a-switch v-model:checked="modelValue.pet.status"'));
  check('宠物政策编辑卡不再有 chevron(稿面卡头只有开关)',
    !/<h2>\{\{ t\('properties\.profile\.policiesTab\.pet'\) \}\}<\/h2>.*collapse-mark/.test(policies));
  check('宠物政策停用时视图整块变淡(与儿童卡 inactive 同口径)',
    policies.includes("'hp-pet', { inactive: !modelValue.pet.status }") && hasDecl(css, '.hp-pet.inactive', 'opacity:0.6'));
  check('跨层:后端归一化 pet.status(缺省 true 兼容旧数据)',
    service.includes("'status' => filter_var($pet['status'] ?? true, FILTER_VALIDATE_BOOLEAN)"));
  check('跨层:api 类型与 profile.vue 同步 pet.status',
    read('merchant-web/src/api/properties.ts').includes('pet: { description: string; status: boolean }')
    && profile.includes("pet: { description: String(pet.description || ''), status: pet.status !== false }"));

  const petOff = strip(await bundle.renderPolicies({ modelValue: { ...fixtures.policies, pet: { description: 'Pets are not allowed.', status: false } }, editing: false }));
  check('渲染:宠物政策停用时带 inactive 类',
    /class="hp-field hp-field-block hp-pet inactive"/.test(petOff) || /hp-pet[^"]*inactive/.test(petOff));
  const petOn = strip(await bundle.renderPolicies({ modelValue: { ...fixtures.policies, pet: { description: 'Pets are not allowed.', status: true } }, editing: false }));
  check('渲染:宠物政策启用时不带 inactive 类', !/hp-pet[^"]*inactive/.test(petOn));

  // 走查修复:宠物政策的「未填写」要淡化(与预订政策那几行同口径);标签按用户口径做成蓝色标题
  const petEmpty = strip(await bundle.renderPolicies({ modelValue: { ...fixtures.policies, pet: { description: '', status: true } }, editing: false }));
  check('渲染:宠物政策未填时占位走 empty 类(不再是大字重深色)',
    /class="hp-text empty"[^>]*>Not provided</.test(petEmpty), petEmpty.slice(petEmpty.indexOf('hp-pet'), petEmpty.indexOf('hp-pet') + 320));
  check('样式:未填写淡化 #a5a8b1 / 400(与 .hp-value.empty 同一口径)',
    hasDecl(css, '.hp-value.empty', 'color:#a5a8b1', 'font-weight:400') || hasDecl(css, '.hp-text.empty', 'color:#a5a8b1', 'font-weight:400'),
    cssRules(css, '.hp-text.empty').join(' | '));
  check('样式:宠物政策标签按用户口径做成蓝色标题(#4d6cf4 / 600,与分组标题一致)',
    hasDecl(css, '.hp-pet .hp-label', 'color:#4d6cf4', 'font-weight:600'), cssRules(css, '.hp-pet .hp-label').join(' | '));

  check('弹窗:币种下拉绑定 childForm.currency 且选项来自共享字典',
    /<a-select v-model:value="childForm.currency" class="hp-currency-select"[^>]*:options="currencyOptions"/.test(policies));
  check('弹窗:按钮按编辑/新建切换 Save / Create Now',
    policies.includes("editingChildId ? 'common.save' : 'properties.profile.policiesTab.createNow'"));
  check('弹窗:旧的 modal-switches / modal-grid 结构已清除',
    !policies.includes('modal-switches') && !policies.includes('modal-grid') && !policies.includes('modal-form'));
  check('币种贯通:后端 metrics 下发 currency', service.includes("'currency' => $currency") && service.includes("->get(['room_name', 'base_stock', 'currency'])"));
  check('币种贯通:api 类型带 currency', read('merchant-web/src/api/properties.ts').includes('currency: string'));
  check('币种贯通:profile.vue 两个分支都传 :currency', (profile.match(/:currency="metrics.currency"/g) ?? []).length === 2);

  // 货币字典(未定稿):占位集合收敛在一处,且物业币种不在字典里也能显示
  const currencies = read('merchant-web/src/config/currencies.ts');
  check('货币字典是独立可替换的一处(含「定稿后只改这一个文件」说明)',
    currencies.includes('CURRENCY_OPTIONS') && currencies.includes('定稿后只改这一个文件'));
  check('字典覆盖平台已出现的币种(EUR/MMK)与仓库其它处(THB/PHP/USD)',
    ['EUR', 'MMK', 'THB', 'PHP', 'USD'].every((code) => currencies.includes(`'${code}'`)));
  check('下拉选项 = 字典 + 当前值(物业币种不在字典里也要能显示)',
    currencies.includes('currencySelectOptions') && currencies.includes('codes.add(code)'));
  check('新建政策默认取物业币种,取不到回落字典兜底',
    policies.includes('defaultCurrency') && policies.includes('FALLBACK_CURRENCY'));

  // 政策自带的币种:存储 + 卡片渲染
  check('跨层:后端归一化 children[].currency(大写、限长)',
    service.includes("'currency' => strtoupper(mb_substr(trim((string) ($row['currency'] ?? '')), 0, 8))"));
  check('跨层:api 类型 PolicyChild 带 currency', read('merchant-web/src/api/properties.ts').includes('/** 该条政策金额用的币种'));
  check('跨层:profile.vue 读取 children[].currency 并大写', profile.includes("currency: String(item.currency || '').toUpperCase()"));

  const currencyFixtures = {
    ...fixtures.policies,
    children: [
      { id: 'cc1', name: 'Numeric', description: 'd', amount: '35000', currency: 'MMK', unit: 'night', status: true },
      { id: 'cc2', name: 'Legacy', description: 'd', amount: 'MMK 35,000', currency: '', unit: 'night', status: true },
    ],
  };
  const hpCurrency = strip(await bundle.renderPolicies({ modelValue: currencyFixtures, editing: false }));
  check('卡片:纯数字金额按政策币种补前缀(`MMK 35000`)', hpCurrency.includes('>MMK 35000<'));
  check('卡片:金额里已写货币的照原样(不会出现 `MMK MMK 35,000`)',
    hpCurrency.includes('>MMK 35,000<') && !hpCurrency.includes('MMK MMK'));

  console.log(`\n${failures.length === 0 ? 'GREEN' : 'RED'} ${passed}/${passed + failures.length}`);
  if (failures.length) {
    console.log('\n失败项:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
