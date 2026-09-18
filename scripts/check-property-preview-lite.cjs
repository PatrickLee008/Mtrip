#!/usr/bin/env node
/**
 * 设计契约校验:关怀模式「实景预览」页(Property Preview)
 *
 * 依据:Figma M-Trip / Hotel Details Lite · Property Preview `2352:7051`
 * 设计数据落档:.figma-cache/2352-7051.txt(2026-09-18 取;整帧渲染图 2352-7051.png)
 *
 * 为什么用源码级断言:client-app 没有测试框架(无 jest / 无 render harness),
 * 唯一可自动化的等价物是「稿面规格的源码契约」+ i18n 结构一致性 + tsc。
 * 断言的是设计稿的事实(尺寸/文案/结构),不是实现的自证。
 *
 * 用法:powershell -Command "node scripts/check-property-preview-lite.cjs"
 * 退出码:0 = 全部通过(GREEN),1 = 有失败项(RED)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCREEN = path.join(ROOT, 'client-app/src/screens/hotel/PropertyPreviewLiteScreen.tsx');
const THEME = path.join(ROOT, 'client-app/src/config/theme.ts');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: path.join(ROOT, `client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}

// ---------------------------------------------------------------- i18n ----
/** 本页需要的词条(设计稿可见文案) */
const REQUIRED_KEYS = [
  'hotels.lite.preview.overview',
  'hotels.lite.preview.back',
  'hotels.lite.preview.video360',
  'hotels.lite.preview.facilities',
  'hotels.lite.preview.tabs.video360',
  'hotels.lite.preview.tabs.facilities',
  'hotels.lite.preview.tabs.rooms',
  'hotels.lite.preview.tabs.dining',
  'hotels.lite.preview.facilityGroups.kids',
  'hotels.lite.preview.facilityGroups.pools',
];

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
  // 三语同结构:先只对本页命名空间做硬断言(全文件漂移另作报告,不判失败)
  const previewKeys = (tree) =>
    leafPaths((tree.hotels && tree.hotels.lite && tree.hotels.lite.preview) || {}, '')
      .filter((key) => key !== '')
      .sort();
  const reference = previewKeys(loaded[0].tree);
  for (const locale of loaded.slice(1)) {
    const keys = previewKeys(locale.tree);
    const missing = reference.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !reference.includes(key));
    check(
      `${locale.name} 的 hotels.lite.preview 结构与 ${loaded[0].name} 一致`,
      missing.length === 0 && extra.length === 0,
      missing.length === 0 && extra.length === 0 ? `${keys.length} keys` : `missing=${missing.join(',')} extra=${extra.join(',')}`,
    );
  }

  for (const key of REQUIRED_KEYS) {
    for (const locale of loaded) {
      const value = valueAt(locale.tree, key);
      check(
        `${locale.name} 有非空词条 ${key}`,
        typeof value === 'string' && value.trim() !== '',
        typeof value === 'string' ? JSON.stringify(value) : String(value),
      );
    }
  }

  // 稿面文案:en-US 必须与设计稿字面一致
  const enTree = loaded.find((locale) => locale.name === 'en-US').tree;
  check('en-US preview.video360 等于稿面 "Video/360"', valueAt(enTree, 'hotels.lite.preview.video360') === 'Video/360');
  check('en-US preview.overview 等于稿面 "Property overview"', valueAt(enTree, 'hotels.lite.preview.overview') === 'Property overview');
  check('en-US facilityGroups.kids 等于稿面 "Kids areas"', valueAt(enTree, 'hotels.lite.preview.facilityGroups.kids') === 'Kids areas');
  check('en-US facilityGroups.pools 等于稿面 "Pools & Gyms"', valueAt(enTree, 'hotels.lite.preview.facilityGroups.pools') === 'Pools & Gyms');

  // 信息项:整份文件的漂移只报告不判失败
  const allKeys = (tree) => leafPaths(tree).sort();
  const en = allKeys(enTree);
  for (const locale of loaded.filter((l) => l.name !== 'en-US')) {
    const missing = en.filter((key) => !allKeys(locale.tree).includes(key)).length;
    console.log(`INFO  ${locale.name} 相对 en-US 整份文件缺 ${missing} 个 key(报告项,不判失败)`);
  }
}

// --------------------------------------------------------------- theme ----
const themeSource = fs.readFileSync(THEME, 'utf8');
for (const token of ['previewBack', 'previewTabLabel', 'previewSubheading', 'previewTileBg']) {
  check(`theme.ts 新增令牌 ${token}`, new RegExp(`\\b${token}\\b`, 'u').test(themeSource));
}
for (const hex of ["'#204DDA'", "'#475569'", "'#8B8C91'", "'#F3F4F6'"]) {
  check(`theme.ts 含该帧色值 ${hex}`, themeSource.includes(hex));
}

// -------------------------------------------------------------- source ----
const source = fs.readFileSync(SCREEN, 'utf8');

/** 稿面结构标记:文案键 / 图标 / 尺寸 / 令牌 */
const MARKERS = [
  ['顶栏 Back 文案', 'hotels.lite.preview.back'],
  ['第一段标题 Property overview', 'hotels.lite.preview.overview'],
  ['360 区标题 Video/360', 'hotels.lite.preview.video360'],
  ['设施区标题 Facilities', 'hotels.lite.preview.facilities'],
  ['页签命名空间', 'hotels.lite.preview.tabs.'],
  ['页签 video360', "'video360'"],
  ['页签 facilities', "'facilities'"],
  ['页签 rooms', "'rooms'"],
  ['页签 dining', "'dining'"],
  ['设施分组 Kids areas', 'facilityGroups.kids'],
  ['设施分组 Pools & Gyms', 'facilityGroups.pools'],
  ['360 图标', 'view360'],
  ['360° 文案', '360°'],
  ['缩略图高度 83.5', '83.5'],
  ['360 图高度 268.5', '268.5'],
  ['设施英雄图高度 223.75', '223.75'],
  ['设施网格高度 171', '171'],
  ['顶栏色令牌', 'colors.previewBack'],
  ['页签标签色令牌', 'colors.previewTabLabel'],
  ['小标色令牌', 'colors.previewSubheading'],
  ['网格底色令牌', 'colors.previewTileBg'],
  ['图片不足兜底', 'tempCoverFor'],
];
for (const [label, marker] of MARKERS) {
  check(`源码含稿面结构:${label}`, source.includes(marker), marker);
}

/** 该帧没有白卡外壳(strict 版式):不应再引用 liteShared.card */
check('该帧无白卡:源码不再用 liteShared.card', !source.includes('liteShared.card'));
/** 旧文字药丸页签应已被缩略图卡取代 */
check('旧文字药丸页签已移除(不再用 tabs.all)', !source.includes('tabs.all'));
/** 取数口径不变 */
check('取数仍走 fetchHotelDetail', source.includes('fetchHotelDetail'));

// ------------------------------------------------ 版式细则(RN 渲染语义) ----
/**
 * 取出 StyleSheet.create 里的具名样式块,用来断言"同一块里不能混用某些属性"。
 * 用花括号配对扫描而不是正则配对:块既有单行(`tab: { gap: 8 },`)也有多行,
 * 正则配对着会跨块吞掉后面的内容(第一版就是这么误判的)。
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

const styleBlocks = readStyleBlocks(source);
const blockOf = (name) => styleBlocks.get(name);
check('解析到该页全部样式块', styleBlocks.size >= 12, `${styleBlocks.size} 块`);

/** 页签标签要居中在缩略图下方(稿面 EL-378b8db1 = column + alignItems center) */
check('styles.tab 让标签与缩略图居中对齐', /alignItems: 'center'/u.test(blockOf('tab') || ''), styleBlocks.has('tab') ? 'inspected' : '未找到 styles.tab');
/** 格内图的可见圆角是稿面的 20;格底 8 只是占位底,不能把图裁成 8 */
check('styles.facilityTile 不裁剪(否则可见圆角被格底的 8 覆盖)', styleBlocks.has('facilityTile') && !/overflow/u.test(blockOf('facilityTile')));
check('styles.facilityTileImage 圆角为稿面 20', /borderRadius: 20/u.test(blockOf('facilityTileImage') || ''));
/** 稿面 `2352:7089`:360° 在圆下方 8px */
check('styles.panoLabel 距圆 8px', /marginTop: 8/u.test(blockOf('panoLabel') || ''));
/**
 * iOS 上同一视图的 overflow:'hidden' 会把 shadow 一起裁掉 ——
 * 带 Effect/DS 阴影的层必须与负责裁剪圆角图的层分开(稿面 EL-2baeee92 用的是圆角 20 + Effect/DS)。
 */
const shadowBlocks = [...styleBlocks.entries()].filter(([, body]) => body.includes('shadows.subtle'));
check('存在带 shadows.subtle 的样式块', shadowBlocks.length > 0, shadowBlocks.map(([name]) => name).join(', '));
for (const [name, body] of shadowBlocks) {
  check(`styles.${name} 有阴影但不与 overflow 同块(iOS 会吃掉阴影)`, !/overflow/u.test(body));
}

// ------------------------------------------------------------- summary ----
const failed = results.filter((row) => !row.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((row) => row.label).join(' | ')}`);
  process.exit(1);
}
