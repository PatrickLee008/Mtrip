/**
 * Availability & Pricing(Figma `1163:16345`)实现校验。
 *
 * 与仓库既有的 `scripts/check-*.cjs`(纯文本断言)不同,这个脚本做的是**真实渲染**:
 * 用 Vite 以 SSR 方式打包并渲染三个展示组件(带样本数据),逐条断言稿面硬值
 * (状态样式类、徽标文案、价格写法、面板字段、图例),再检查编译产物 CSS 是否带上
 * 稿面令牌(主色 `#4169ED`、低库存 `#BB4D00`、售罄 `#EC1317` 等)。
 *
 * ⚠ Vue 只能在被打包的那一份实例里创建(i18n 的 provide/inject 依赖同一份 vue),
 * 所以 app 的创建与 renderToString 都写在生成的 entry 里,本脚本只读 HTML 字符串。
 *
 * 运行:`cd merchant-web && node scripts/check-availability-figma.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const workDir = path.join(webRoot, '.figma-cache', 'check');
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
import enUS from '../../src/locales/en-US.ts';
import CalendarGrid from '../../src/views/availability/components/CalendarGrid.vue';
import BulkGrid from '../../src/views/availability/components/BulkGrid.vue';
import EditPanel from '../../src/views/availability/components/EditPanel.vue';
import AvIcon from '../../src/views/availability/components/AvIcon.vue';

const noop = { mounted() {}, updated() {} };

async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) });
  app.use(createI18n({ legacy: false, locale: 'en-US', fallbackLocale: ['en-US'], messages: { 'en-US': enUS } }));
  app.directive('perm', noop);
  return renderToString(app);
}

export const renderCalendar = (props) => render(CalendarGrid, props);
export const renderBulk = (props) => render(BulkGrid, props);
export const renderPanel = (props) => render(EditPanel, props);
export const renderIcon = (props) => render(AvIcon, props);

/** 覆盖四种状态的样本数据(2026-09,与稿面样例同月) */
export function fixture() {
  const days = {};
  const put = (date, over) => {
    days[date] = {
      date, price: 85000, stockTotal: 5, stockSold: 0, stockLocked: 0, stockLeft: 5,
      isClosed: 0, minStay: 1, maxStay: 30, closedToArrival: 0, closedToDeparture: 0,
      source: 'manual', note: '', hasRecord: 1, ...over,
    };
  };
  for (let day = 1; day <= 30; day += 1) put('2026-09-' + String(day).padStart(2, '0'));
  put('2026-09-07', {});
  put('2026-09-08', { stockLeft: 1 });
  put('2026-09-11', { stockLeft: 0, stockSold: 5 });
  put('2026-09-16', { isClosed: 1, stockLeft: 0 });
  put('2026-08-30', {});
  return days;
}
`;

/** 去掉 SSR 作用域属性与注释,压缩空白,便于断言 */
function strip(html) {
  return html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/ data-v-[0-9a-z]+(="")?/g, '')
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

/**
 * 把「相对 moveto + 隐式相对 lineto」折线(`m x y x y x y…`)展开成绝对点序列。
 * 本页三个 chevron 都是这种写法,用来做几何自检。
 */
function relativePoints(d) {
  const tokens = d.match(/-?\d*\.?\d+|[a-zA-Z]/g) ?? [];
  const points = [];
  let x = 0;
  let y = 0;
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    x += Number(tokens[i]);
    y += Number(tokens[i + 1]);
    points.push([x, y]);
  }
  return points;
}

/** 稿面图标按 lucide 原始 path 逐字内联(与 AvIcon.vue 的 PATHS 同源) */
const ICONS = {
  bed: ['M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8', 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4', 'M12 4v6', 'M2 18h20'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  edit: [
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
  ],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  'alert-circle': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  check: ['M20 6 9 17l-5-5'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'check-circle': ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
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
    // 必须把 vue / vue-i18n 一并打进产物:否则 Node 解析 ESM 的 `vue` 与 CJS 的 `vue`
    // 会得到两份实例,i18n 的 provide/inject 直接失效(NOT_INSTALLED)
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: path.join(workDir, 'entry.js'),
      outDir,
      emptyOutDir: true,
      minify: false,
      cssMinify: false,
      // SSR 构建默认不落 CSS 资源,这里显式落盘以便校验稿面令牌
      ssrEmitAssets: true,
      write: true,
    },
  });

  const bundle = await import(pathToFileURL(path.join(outDir, 'entry.js')).href);
  const days = bundle.fixture();

  // ---------- 月历视图 ----------
  console.log('\nCalendarGrid(Figma 1153:15457 / 1225:14495)');
  const calendar = strip(
    await bundle.renderCalendar({ days, month: '2026-09', selectedDate: '2026-09-14', currency: 'MMK' }),
  );
  const cells = classesOf(calendar, 'cal-cell');

  for (const weekday of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
    check(`表头含星期 ${weekday}`, calendar.includes(`>${weekday}<`));
  }
  check('可售格:徽标 `Avail: 5`', calendar.includes('>Avail: 5<'));
  check('可售格:价格写法 `MMK 85K`', calendar.includes('>MMK 85K<'));
  check('低库存格:警告标签 `1 Left!`', calendar.includes('>1 Left!<'));
  check('低库存格:徽标 `Avail: 1`', calendar.includes('>Avail: 1<'));
  check('售罄格:左上 `Sold Out`', calendar.includes('>Sold Out<'));
  check('售罄格:徽标 `Avail: 0`', calendar.includes('>Avail: 0<'));
  check('已屏蔽格:徽标 `Blocked`', calendar.includes('>Blocked<'));
  check('已屏蔽格:价格 `-`', textsOf(calendar, 'cal-price').includes('-'));
  check('四态样式类齐全(Avail/low/sold/blocked)', ['available', 'low', 'sold', 'blocked'].every((state) => cells.some((list) => list.includes(state))));
  check('选中格带 selected 类', cells.some((list) => list.includes('selected')));
  check('选中格带勾选徽标', calendar.includes('cal-check'));
  check('非本月日期带 outside 类', classesOf(calendar, 'cal-date').some((list) => list.includes('outside')));
  check('本月外日期 8/30 也在网格内', calendar.includes('outside cal-date">30<'));
  check(
    '图例四项文案',
    ['Available', 'Low Inventory', 'Sold Out', 'Blocked'].every((label) => calendar.includes(`${label}<`)),
  );

  // ---------- 批量视图 ----------
  console.log('\nBulkGrid(Figma 1170:23485 / 1170:24672)');
  const bulk = strip(
    await bundle.renderBulk({
      rows: [{ room: { id: 5, property_id: 7, name: 'Deluxe Room', currency: 'MMK' }, days }],
      dates: ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'],
      currency: 'MMK',
      selected: ['5_2026-09-13', '5_2026-09-16'],
    }),
  );
  const bulkCells = classesOf(bulk, 'bulk-cell');
  check('首列标题 `Rooms`', bulk.includes('>Rooms<'));
  check('日期表头 `Sep 13`', bulk.includes('>Sep 13<'));
  check('日期表头星期 `Sun`', bulk.includes('>Sun<'));
  check('房型行标签 `Deluxe Room`', bulk.includes('Deluxe Room'));
  check('选中格带 selected 类', bulkCells.some((list) => list.includes('selected')));
  check('选中格带勾选徽标', bulk.includes('bulk-check'));
  check('已屏蔽格带 blocked 类', bulkCells.some((list) => list.includes('blocked')));
  check('已屏蔽格显示 `Blocked`', bulk.includes('>Blocked<'));

  // ---------- 编辑面板 ----------
  console.log('\nEditPanel(Figma 1145:10345 / 1163:17356)');
  const normalPanel = strip(
    await bundle.renderPanel({
      variant: 'normal',
      dateLabel: 'Sep 14, 2026',
      selectedCount: 1,
      currency: 'MMK',
      savePerm: 'mch:availability:edit',
      status: 'open',
      rooms: 5,
      price: 0,
    }),
  );
  check('常态面板标题 `Update Selected Dates`', normalPanel.includes('Update Selected Dates'));
  check('常态面板日期徽标 `Sep 14, 2026`', normalPanel.includes('Sep 14, 2026'));
  check('分段控件 `Open` / `Blocked`', normalPanel.includes('>Open<') && normalPanel.includes('>Blocked<'));
  check('步进器数值 5', textsOf(normalPanel, 'stepper-value').includes('5'));
  check(
    '字段 `Room Status` / `Available Rooms` / `Base Price per Night`',
    ['Room Status', 'Available Rooms', 'Base Price per Night'].every((label) => normalPanel.includes(label)),
  );
  check('币种胶囊 `MMK`', textsOf(normalPanel, 'currency-chip').includes('MMK'));
  // 稿面币种处是下拉;本次按决定做成只读,故价格输入块内不应再出现 chevron / svg
  const priceBlock = normalPanel.slice(normalPanel.indexOf('price-input'), normalPanel.indexOf('panel-footer'));
  check('币种为只读:价格块内无下拉图标', priceBlock.length > 0 && !priceBlock.includes('<svg'));
  check('页脚 `Cancel` / `Save Updates`', normalPanel.includes('>Cancel<') && normalPanel.includes('Save Updates'));

  const bulkPanel = strip(
    await bundle.renderPanel({
      variant: 'bulk',
      dateLabel: '',
      selectedCount: 6,
      currency: 'MMK',
      savePerm: 'mch:availability:bulk-update',
      status: 'blocked',
      rooms: 5,
      price: 0,
    }),
  );
  check('批量面板标题 `Apply Bulk Changes`', bulkPanel.includes('Apply Bulk Changes'));
  check('批量面板计数徽标 `6 room-dates selected`', bulkPanel.includes('6 room-dates selected'));
  check(
    '批量面板选中态 `Blocked`',
    classesOf(bulkPanel, 'segment').some((list) => list.includes('active')) &&
      /class="active segment"[^>]*>Blocked</.test(bulkPanel),
  );

  // ---------- 图标 ----------
  console.log('\nAvIcon(稿面 lucide 线性图标)');
  for (const [name, expected] of Object.entries(ICONS)) {
    const html = await bundle.renderIcon({ name, size: 16 });
    const actual = pathsOf(html);
    check(`图标 ${name} 与 lucide 路径逐字一致`, JSON.stringify(actual) === JSON.stringify(expected), actual.join(' | '));
  }
  // 回归:chevron 写成 `m9 18 6-6-6 6`(末段折回)会渲染成一条斜杠 ——
  // 下面的点序列含 moveto 起点,折回时首末点重合、distinct 会掉到 2,与写法无关
  for (const [name, expected] of [
    ['chevron-right', [[9, 18], [15, 12], [9, 6]]],
    ['chevron-left', [[15, 18], [9, 12], [15, 6]]],
    ['chevron-down', [[6, 9], [12, 15], [18, 9]]],
  ]) {
    const points = relativePoints(pathsOf(await bundle.renderIcon({ name }))[0]);
    const distinct = new Set(points.map((point) => point.join(','))).size;
    check(
      `${name} 三顶点互不重合(折线非斜杠)`,
      distinct === 3 && JSON.stringify(points) === JSON.stringify(expected),
      `points=${JSON.stringify(points)}`,
    );
  }

  // ---------- 编译产物 CSS 的稿面令牌 ----------
  console.log('\n编译产物 CSS 令牌(照稿硬值)');
  // SSR 构建不落 CSS 资源,单独跑一次普通构建只为拿到样式产物
  const cssDir = path.join(workDir, 'css');
  await build({
    root: webRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [vue()],
    resolve: { alias: { '@': path.join(webRoot, 'src') } },
    build: {
      outDir: cssDir,
      emptyOutDir: true,
      minify: false,
      cssMinify: false,
      rollupOptions: { input: path.join(workDir, 'entry.js') },
    },
  });
  const cssFile = fs.readdirSync(path.join(cssDir, 'assets')).find((name) => name.endsWith('.css'));
  check('构建产出 CSS', !!cssFile, cssFile || 'none');
  const css = cssFile ? fs.readFileSync(path.join(cssDir, 'assets', cssFile), 'utf8').toLowerCase().replace(/\s+/g, '') : '';
  const tokens = [
    ['主色 #4169ed', '#4169ed'],
    ['主色浅底 rgba(65,105,237,.08)', 'rgba(65,105,237,0.08)'],
    ['正文 #1b1d30', '#1b1d30'],
    ['分隔线 #e2e8f0', '#e2e8f0'],
    ['浅底 #f8fafc', '#f8fafc'],
    ['分段控件底 #ebf0ff', '#ebf0ff'],
    ['低库存 #bb4d00', '#bb4d00'],
    ['售罄 #ec1317', '#ec1317'],
    ['日历格高 110px', '110px'],
    ['面板宽 380px', '380px'],
  ];
  for (const [label, token] of tokens) check(`CSS 含 ${label}`, css.includes(token));

  // 批量网格列宽是运行时内联样式(房型列 200px + 每个日期一列),不在 CSS 里
  check('批量网格列宽 200px + 按日期数分列', bulk.includes('grid-template-columns:200px repeat(5, minmax(0, 1fr))'));

  // 页面级令牌(H1 色等)落在 tokens.less,三个组件不引用,单独校验变量文件
  const tokensLess = fs.readFileSync(path.join(webRoot, 'src', 'views', 'availability', 'tokens.less'), 'utf8').replace(/\s+/g, '');
  for (const [label, declaration] of [
    ['页面 H1 #0f172a', '@av-ink-page:#0f172a'],
    ['副标题 #64748b', '@av-ink-sub:#64748b'],
    ['表单 Label #334155', '@av-ink-label:#334155'],
    ['控件小标 rgba(25,26,37,.5)', '@av-ink-muted:rgba(25,26,37,0.5)'],
    ['面板阴影 0 3px 8px rgba(0,0,0,.14)', '@av-shadow-panel:03px8px0rgba(0,0,0,0.14)'],
  ]) {
    check(`tokens.less 含 ${label}`, tokensLess.includes(declaration));
  }

  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(`\n${failures.length === 0 ? 'GREEN' : 'RED'} ${passed}/${passed + failures.length}`);
  if (failures.length > 0) {
    console.log('失败项:');
    for (const item of failures) console.log(`  - ${item}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
});
