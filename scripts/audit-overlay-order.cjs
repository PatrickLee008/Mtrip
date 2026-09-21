#!/usr/bin/env node
/**
 * 悬浮层绘制顺序审计(全仓库)。
 *
 * 缺陷形状:整宽(`left: 0` + `right: 0`)的绝对定位悬浮栏被**声明在滚动容器之前**。
 * RN / react-native-web 的同级兄弟按**声明顺序**绘制,后声明者在上 —— 于是滚动内容会盖住该栏,
 * 并吃掉它的点击。2026-09-21 评价整页的「返回点不动 / 上拉时内容挡住顶栏」就是这个成因。
 *
 * 只认整宽的绝对定位(悬浮栏);卡片里的角标/渐变遮罩虽然也是 absolute,但要么整宽不成立、
 * 要么在滚动容器内部,不属本类缺陷,不在此脚本的判定范围。
 *
 * 用法:node scripts/audit-overlay-order.cjs
 * 退出码:0 = 未发现同类缺陷,1 = 有(逐条列出文件与样式名)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client-app/src');

/** 与 check-hotel-reviews-page.cjs 同款:剥注释后再判,免得解释性注释里的词被误命中 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gmu, '$1 ');
}

/** 取 StyleSheet.create 里每个具名样式块的正文 */
function readStyleBlocks(text) {
  const blocks = new Map();
  const sheetIndex = text.indexOf('StyleSheet.create(');
  if (sheetIndex === -1) return blocks;
  const scope = text.slice(sheetIndex);
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

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** 滚动容器的 JSX 起始标记 */
const SCROLLERS = ['<ScrollView', '<FlatList', '<SectionList', '<VirtualizedList', '<Animated.ScrollView'];

const violations = [];
const audited = [];

for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = stripComments(raw);
  const blocks = readStyleBlocks(code);
  if (blocks.size === 0) continue;

  /** 该文件里出现过的「整宽绝对定位」样式名 */
  const fullWidthAbsolute = new Set();
  for (const [name, body] of blocks.entries()) {
    if (!/position:\s*'absolute'/u.test(body)) continue;
    if (!/left:\s*0\b/u.test(body)) continue;
    if (!/right:\s*0\b/u.test(body)) continue;
    fullWidthAbsolute.add(name);
  }
  if (fullWidthAbsolute.size === 0) continue;

  /** 第一个滚动容器的位置 */
  let scrollerAt = -1;
  for (const tag of SCROLLERS) {
    const at = code.indexOf(tag);
    if (at !== -1 && (scrollerAt === -1 || at < scrollerAt)) scrollerAt = at;
  }
  if (scrollerAt === -1) continue; // 不滚动就无所谓顺序(如纯静态页 / 开屏页)

  audited.push(path.relative(ROOT, file));

  for (const name of fullWidthAbsolute) {
    /** 首次被 JSX 引用的位置(`styles.<name>`;样式定义处是 `<name>: {`,不会误命中) */
    const at = code.indexOf(`styles.${name}`);
    if (at === -1) continue;
    if (at < scrollerAt) {
      violations.push({
        file: path.relative(ROOT, file),
        style: name,
        styleAt: at,
        scrollerAt,
      });
    }
  }
}

console.log(`滚动容器 + 整宽悬浮栏并存的文件:${audited.length} 个`);
for (const f of audited) console.log(`  · ${f}`);
console.log('');

if (violations.length === 0) {
  console.log('OK  未发现「整宽悬浮栏声明在滚动容器之前」的同类缺陷');
  process.exit(0);
}

console.log(`FOUND  ${violations.length} 处同类缺陷(悬浮栏声明在滚动容器之前,会被滚动内容盖住并吃掉点击):`);
for (const v of violations) {
  console.log(`  FAIL  ${v.file}  styles.${v.style}  (bar@${v.styleAt} < scroller@${v.scrollerAt})`);
}
process.exit(1);
