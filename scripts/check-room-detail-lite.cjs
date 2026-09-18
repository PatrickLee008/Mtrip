#!/usr/bin/env node
/**
 * 设计契约校验:关怀模式房型详情页(Figma `Hotel Details Lite` / Rooms Details `2352:6030`)
 *
 * 依据:`.figma-cache/2352-6030.txt`(2026-09-18 经 Figma MCP `get_figma_data` 取;整帧渲染图 `2352-6030.png`)
 * 本页此前已按同一节点改过两轮,本脚本针对**第三轮复核发现的 11 处数值/结构不符**做回归护栏。
 *
 * 用法:powershell -Command "node scripts/check-room-detail-lite.cjs"
 * 退出码:0 = GREEN,1 = RED
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCREEN = path.join(ROOT, 'client-app/src/screens/hotel/RoomDetailLiteScreen.tsx');
const HOTEL_CARD = path.join(ROOT, 'client-app/src/components/hotel/lite/LiteHotelCard.tsx');
const EDGE_GRADIENT = path.join(ROOT, 'client-app/src/components/common/EdgeGradient.tsx');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: path.join(ROOT, `client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}

/**
 * 花括号配对扫描 StyleSheet.create 里的具名样式块。
 * (不能用正则配对:块有单行也有多行,正则跨块吞内容 —— 预览页那个脚本踩过这个坑。)
 */
function readStyleBlocks(text) {
  const blocks = new Map();
  const sheetIndex = text.indexOf('StyleSheet.create(');
  const scope = sheetIndex === -1 ? text : text.slice(sheetIndex);
  const header = /\n {2}(\w+): \{/gu;
  let match;
  while ((match = header.exec(scope)) !== null) {
    const start = scope.indexOf('{', match.index);
    let depth = 0;
    let end = start;
    for (; end < scope.length; end += 1) {
      if (scope[end] === '{') depth += 1;
      else if (scope[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.set(match[1], scope.slice(start, end + 1));
  }
  return blocks;
}

const source = fs.readFileSync(SCREEN, 'utf8');
const blocks = readStyleBlocks(source);
const block = (name) => blocks.get(name);

check('解析到该页样式块', blocks.size >= 20, `${blocks.size} 块`);

// ---------------------------------------------- 11 处稿面值(逐条) ----
/** ① `2352:9557` 顶栏填充 = 主色渐变遮罩(0deg transparent → rgba(65,105,237,.5)),带高 80 */
check('① 顶栏渐变遮罩存在(EdgeGradient)', /<EdgeGradient[\s\S]*?\/>/u.test(source));
check('① 遮罩带高度 80', (() => {
  const scrim = block('heroScrim') || '';
  /* 允许多带一个具名常量(更可读),但常量值本身必须是 80 */
  if (/height: 80\b/u.test(scrim)) return true;
  return /height: SCRIM_HEIGHT/u.test(scrim) && /const SCRIM_HEIGHT = 80\b/u.test(source);
})());
check('① 遮罩用主色 50% 口径(reverse)', /<EdgeGradient[\s\S]{0,80}reverse/u.test(source));
/** ② `2352:9558` 返回胶囊底 rgba(0,0,0,0.25) */
check('② 返回胶囊底为 rgba(0,0,0,0.25)', /rgba\(0, 0, 0, 0\.25\)/u.test(block('backPill') || ''), block('backPill') ? 'inspected' : '未找到 backPill');
/** ③ `2352:9559` 箭头 32×32 */
check('③ 返回箭头 32', /name="arrowLeft"[\s\S]{0,40}size=\{32\}/u.test(source));
/** ④ `2352:6031` 大图 ↔ 内容 gap 10 */
check('④ 大图与内容块间距 gap 10', /gap: 10\b/u.test(block('heroBlock') || ''), block('heroBlock') ? 'inspected' : '未找到 heroBlock');
/** ⑤ `2352:9540` 覆盖层首行 alignItems flex-end */
check('⑤ 覆盖层首行 align flex-end', /alignItems: 'flex-end'/u.test(block('heroRowTop') || ''), block('heroRowTop') ? 'inspected' : '未找到 heroRowTop');
/** ⑥ `2352:6071` 设施卡 gap 24(信息卡仍是 16,靠本页覆盖) */
check('⑥ 设施卡覆盖 gap 24', /gap: 24/u.test(block('amenitiesCard') || ''));
check('⑥ 未去改共用 card 的 gap(信息卡仍需 16)', /gap: 16/u.test(block('card') || ''));
/** ⑦ `style_db23f563` 分组小标行高 16 */
check('⑦ 分组小标行高 16', /lineHeight: 16\b/u.test(block('groupTitle') || ''));
/** ⑧ `layout_24ff1e97` 属性行图标宽 20 */
check('⑧ 属性行图标 20', /function Meta[\s\S]*?size=\{20\}[\s\S]*?\n\}/u.test(source));
/** ⑨ `2352:6111` 早餐卡 padding 24 */
check('⑨ 早餐卡 padding 24', /padding: 24\b/u.test(block('breakfast') || ''));
/** ⑩ `2352:6121` 价格卡 padding 24 + `2352:6136` 合计行 paddingTop 12 */
check('⑩ 价格卡 padding 24', /padding: 24\b/u.test(block('priceCard') || ''));
check('⑩ 合计行 paddingTop 12', /paddingTop: 12\b/u.test(block('totalRow') || ''));
/** ⑪ `2352:6122` 价格卡阴影 = raised 规格;`2352:6142` CTA 阴影 = media 规格 */
check('⑪ 价格卡用 shadows.raised(稿面 0/4 blur6 -4 + 0/10 blur15 -3)', /shadows\.raised/u.test(block('priceCard') || ''));
check('⑪ 价格卡不再用 shadows.subtle', !/shadows\.subtle/u.test(block('priceCard') || ''));
check('⑪ CTA 用 shadows.media(稿面 0/2 blur4 -2 + 0/4 blur6 -1)', /shadows\.media/u.test(block('cta') || ''));

// ------------------------------------------------------- 税费展示位 ----
/** 用户选 C:画出展示位、值用占位常量 0,不编造 27,75,也不从不存在的数据字段推导 */
check('税费行用新词条渲染', source.includes('hotels.lite.room.taxAndFees'));
check('税额是占位常量 0(不是从数据推导)', /const TAX_AMOUNT = 0/u.test(source));
check('税费行的值取 TAX_AMOUNT', /formatMoney\(TAX_AMOUNT/u.test(source));
check('税费行注明待后端字段', /后端无税费字段|待后端/u.test(source));

// ------------------------------------------------- EdgeGradient 抽取 ----
check('EdgeGradient 已抽到 components/common', fs.existsSync(EDGE_GRADIENT));
if (fs.existsSync(EDGE_GRADIENT)) {
  const shared = fs.readFileSync(EDGE_GRADIENT, 'utf8');
  check('公共 EdgeGradient 用主色 + reverse 双档', /colors\.primary/u.test(shared) && /reverse/u.test(shared) && /stopOpacity/u.test(shared));
}
const hotelCard = fs.readFileSync(HOTEL_CARD, 'utf8');
check('LiteHotelCard 改为复用公共 EdgeGradient', /from '@\/components\/common\/EdgeGradient'/u.test(hotelCard));
check('LiteHotelCard 不再自带一份 EdgeGradient', !/function EdgeGradient/u.test(hotelCard));
check('页面从公共路径引入 EdgeGradient', /from '@\/components\/common\/EdgeGradient'/u.test(source));

// -------------------------------------------------------------- i18n ----
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}
function valueAt(tree, dotted) {
  return dotted.split('.').reduce((node, key) => (node === undefined ? undefined : node[key]), tree);
}

const loaded = LOCALES.map((locale) => {
  try {
    return { ...locale, tree: readJson(locale.file) };
  } catch (cause) {
    check(`${locale.name}.json 可解析`, false, cause.message);
    return { ...locale, tree: undefined };
  }
});
for (const locale of loaded) check(`${locale.name}.json 可解析`, locale.tree !== undefined);

if (loaded.every((locale) => locale.tree !== undefined)) {
  const roomKeys = (tree) =>
    leafPaths((tree.hotels && tree.hotels.lite && tree.hotels.lite.room) || {}, '')
      .filter((key) => key !== '')
      .sort();
  const reference = roomKeys(loaded[0].tree);
  for (const locale of loaded.slice(1)) {
    const keys = roomKeys(locale.tree);
    const missing = reference.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !reference.includes(key));
    check(
      `${locale.name} 的 hotels.lite.room 结构与 ${loaded[0].name} 一致`,
      missing.length === 0 && extra.length === 0,
      missing.length === 0 && extra.length === 0 ? `${keys.length} keys` : `missing=${missing.join(',')} extra=${extra.join(',')}`,
    );
  }
  for (const locale of loaded) {
    const value = valueAt(locale.tree, 'hotels.lite.room.taxAndFees');
    check(
      `${locale.name} 有非空词条 hotels.lite.room.taxAndFees`,
      typeof value === 'string' && value.trim() !== '',
      typeof value === 'string' ? JSON.stringify(value) : String(value),
    );
  }
}

// ------------------------------------------------------------- summary ----
const failed = results.filter((row) => !row.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((row) => row.label).join(' | ')}`);
  process.exit(1);
}
