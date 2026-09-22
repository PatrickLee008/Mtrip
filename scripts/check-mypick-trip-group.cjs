#!/usr/bin/env node
/**
 * 设计契约校验:「我的预订」按 Trip 归并(多房间 / 多酒店一张卡)
 *
 * 依据:Figma M-Trip `3003:8863`(My Pick section)下的三种卡形态 ——
 *   `289:1362`  单间
 *   `2492:12049` 多房间(房型行 = 「3 Rooms」)
 *   `2291:5340`  多酒店(缩略图带 + 「Multi Booking (2 Stay)」+ 「2nd Stay」)
 *   `2438:7317`  待支付(PENDING PAYMENT + 整宽 Continue Payment,地图按钮 hidden)
 * 状态口径由用户 2026-09-22 拍板:**归并卡取组内最靠前的待办态**。
 *
 * ⚠️ 这里断言的是**源码契约**,不是执行结果 —— client-app 没有测试框架
 * (无 jest / 无 render harness,也没装 tsx/esbuild 能直接跑 TS),
 * 所以归并规则本身(优先级顺序、多房间/多酒店判定、日期跨度)靠断言「代码里确实是这么写的」,
 * 真值仍需真机/Web 冒烟。别把 GREEN 读成「跑通了」。
 *
 * 用法:powershell -Command "node scripts/check-mypick-trip-group.cjs"
 * 退出码:0 = 全部通过(GREEN),1 = 有失败项(RED)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...segments) => path.join(ROOT, ...segments);

const DATA = at('client-app/src/screens/mypick/useMyPickData.ts');
const CARD = at('client-app/src/components/mypick/BookingCard.tsx');
const FULL = at('client-app/src/screens/mypick/MyPickScreen.tsx');
const LITE = at('client-app/src/screens/mypick/MyPickLiteScreen.tsx');
const MODELS = at('client-app/src/types/models.ts');
const ORDER_CTRL = at('backend/services/order-service/app/Controller/App/OrderController.php');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: at(`client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}
const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix === '' ? k : `${prefix}.${k}`));
}
/** 取 StyleSheet.create 里的具名样式块(花括号配对,正则配对会跨块吞内容) */
function styleBlocks(text) {
  const blocks = new Map();
  const idx = text.indexOf('StyleSheet.create(');
  const scope = idx === -1 ? text : text.slice(idx);
  const header = /\n {2}(\w+): \{/gu;
  let m;
  while ((m = header.exec(scope)) !== null) {
    const start = scope.indexOf('{', m.index);
    let depth = 0;
    let end = start;
    for (; end < scope.length; end += 1) {
      if (scope[end] === '{') depth += 1;
      else if (scope[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.set(m[1], scope.slice(start, end + 1));
  }
  return blocks;
}

// ======================================================== 取数与归并规则 ====
{
  const data = read(DATA);
  check('useMyPickData.ts 存在', data !== '');

  /* 状态优先级:待支付 > 退款中 > 已支付 > 已核销 > 已完成 > 已退款 > 已取消 > 已过期 */
  const order = ['PENDING', 'REFUNDING', 'PAID', 'USED', 'FINISHED', 'REFUNDED', 'CANCELLED', 'EXPIRED'];
  const listed = [...data.matchAll(/ORDER_STATUS\.(\w+),/gu)].map((m) => m[1]);
  check(
    '状态优先级 = 最靠前的待办态(待支付→退款中→已支付→…→已过期)',
    order.every((k, i) => listed[i] === k),
    listed.slice(0, 8).join(' > ') || '未找到 STATUS_PRIORITY',
  );
  check('未登记的状态排最后(不抢整组状态)', /i === -1 \? STATUS_PRIORITY\.length : i/u.test(data));

  check('按 trip_id 分组,0 视作独立单', /o\.trip_id > 0 \? `trip-\$\{o\.trip_id\}` : `order-\$\{o\.id\}`/u.test(data));
  check('组内状态最靠前的那一单既是卡上状态也是详情入口', /const lead = byPriority\[0\]/u.test(data) && /orderId: lead\.id/u.test(data) && /status: lead\.order_status/u.test(data));
  check('展示用首段按 id 升序取(不受状态排序影响)', /ordered = \[\.\.\.rows\]\.sort\(\(a, b\) => a\.id - b\.id\)/u.test(data));
  check('stayCount 按 property_id 去重', /new Set\(ordered\.map\(\(o\) => o\.property_id\)\)/u.test(data));
  check('roomCount = Σquantity', /reduce\(\(sum, o\) => sum \+ \(Number\(o\.quantity\) \|\| 0\), 0\)/u.test(data));
  check('第二段封面取首个不同 property 的那一单', /ordered\.find\(\(o\) => o\.property_id !== first\.property_id\)/u.test(data));
  check('日期跨度 = 最早入住 → 最晚离店', /dates\.sort\(\)\[0\]/u.test(data) && /ends\.sort\(\)\[ends\.length - 1\]/u.test(data));
  /* 页签必须按**归并后**的状态过滤,否则一个 Trip 会同时出现在两个页签 */
  check('先归并再按归并状态过滤页签', /groupOrdersByTrip\(orders\)\.filter\(\(b\) => TAB_STATUS\[tab\]\.includes\(b\.status\)\)/u.test(data));
  check('对外只暴露 tabBookings(不再暴露按单的 tabOrders)', /tabBookings: MyPickBooking\[\]/u.test(data) && !/tabOrders/u.test(data));
}

// ============================================================ 卡片稿面 ====
{
  const card = read(CARD);
  const blocks = styleBlocks(card);
  const b = (name) => blocks.get(name) ?? '';

  check('卡圆角 24(现稿,非旧稿 32)', /borderRadius: 24/u.test(b('card')));
  check('卡 1px --secondary 描边 + DS_AG 投影', /borderColor: colors\.softBlue/u.test(b('card')) && /shadowColor: '#0F294D'/u.test(b('card')));
  check('封面 176 高', /height: 176/u.test(b('coverWrap')));
  check('状态胶囊右上 16/16、圆角 999', /top: 16/u.test(b('status')) && /right: 16/u.test(b('status')) && /borderRadius: 999/u.test(b('status')));
  check('状态文案 Inter 400/11 tracking .55 大写白', /fontSize: 11/u.test(b('statusText')) && /letterSpacing: 0\.55/u.test(b('statusText')) && /toUpperCase\(\)/u.test(card));

  check('Booking ID 行 Inter 400/16 --text-2 + 单号 600 --text', /fontSize: 16/u.test(b('bookingId')) && /colors\.textSoft/u.test(b('bookingId')) && /interSemi/u.test(b('bookingIdValue')) && /colors\.heading/u.test(b('bookingIdValue')));
  check('Multi Booking 行 Inter 600/16 主色', /interSemi/u.test(b('multiStay')) && /fontSize: 16/u.test(b('multiStay')) && /colors\.primary/u.test(b('multiStay')));

  /* 多酒店缩略图带 */
  check('缩略图带 2px --secondary 外框 + 2px 内边', /borderWidth: 2/u.test(b('stayStrip')) && /borderColor: colors\.softBlue/u.test(b('stayStrip')) && /padding: 2/u.test(b('stayStrip')));
  check('缩略图两格等宽、84 高、裁切', /flex: 1/u.test(b('stayCell')) && /height: 84/u.test(b('stayCell')) && /overflow: 'hidden'/u.test(b('stayCell')));
  check('首格 2px 主色描边', /borderWidth: 2/u.test(b('stayCellFirst')) && /colors\.primary/u.test(b('stayCellFirst')));
  check('第二格 60% 黑幕', /rgba\(0, 0, 0, 0\.6\)/u.test(b('stayScrim')));
  check('「2nd Stay」Inter 600/16 白字居中', /interSemi/u.test(b('stayText')) && /fontSize: 16/u.test(b('stayText')) && /textAlign: 'center'/u.test(b('stayText')));
  check('缩略图带只在多酒店卡出现(要同时有 label 与第二段图源)', /multiStayLabel && \(secondCoverUri \|\| secondCoverSource\)/u.test(card));
  check('地图按钮可省略(待支付卡稿面 hidden)→ 主按钮整宽', /onPressMap \? \(/u.test(card));
  check('主按钮文案可覆盖(Continue Payment)', /detailLabel \?\? t\('myPick\.booking\.viewDetails'\)/u.test(card));
}

// ======================================================== 两个模式的接线 ====
{
  const full = read(FULL);
  const lite = read(LITE);

  for (const [name, text] of [['完整模式', full], ['关怀模式', lite]]) {
    check(`${name}渲染 tabBookings(不是按单的 tabOrders)`, /tabBookings/u.test(text) && !/tabOrders/u.test(text));
    check(`${name} key 用归并 key`, /key=\{b\.key\}/u.test(text));
    check(`${name}多房间把房型行换成「N Rooms」`, /b\.roomCount > 1 \? t\('myPick\.booking\.roomsValue'/u.test(text));
    check(`${name}详情进的是归并后的代表单`, /orderId: b\.orderId/u.test(text));
  }
  check('多酒店的 Multi Booking 行只在完整模式(关怀稿面没画)', /myPick\.booking\.multiBooking/u.test(full) && !/myPick\.booking\.multiBooking/u.test(lite));
  check('完整模式传第二段封面与 2nd Stay 角标', /secondCoverUri=\{b\.secondCoverUri\}/u.test(full) && /myPick\.booking\.secondStay/u.test(full));
}

// ============================================================== 依赖项 ====
{
  const models = read(MODELS);
  check('OrderItemData 有 trip_id / property_id', /trip_id: number;/u.test(models) && /property_id: number;/u.test(models));

  const ctrl = read(ORDER_CTRL);
  /* 没有 trip_id 客户端根本无从分组 —— 列早已存在,本轮只是补进 select */
  check("order/list 的 select 返回 trip_id", /'order_type', 'trip_id', 'property_id'/u.test(ctrl));
}

// ================================================================ i18n ====
{
  const KEYS = ['bookingId', 'multiBooking', 'secondStay', 'rooms', 'roomsValue'];
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(fs.readFileSync(file, 'utf8')) }));
  for (const { name, tree } of trees) {
    const blk = tree.myPick.booking;
    check(`${name} myPick.booking 含归并卡新键`, KEYS.every((k) => typeof blk[k] === 'string'), KEYS.filter((k) => typeof blk[k] !== 'string').join(',') || 'ok');
  }
  const sets = trees.map(({ tree }) => new Set(leafPaths(tree)));
  const extra = (a, c) => [...a].filter((k) => !c.has(k));
  check('三份 i18n 键集零差异', extra(sets[0], sets[1]).length === 0 && extra(sets[1], sets[0]).length === 0 && extra(sets[0], sets[2]).length === 0 && extra(sets[2], sets[0]).length === 0, `${sets[0].size} 键`);
  /* 本仓库约定:插值键避开 i18next 保留字 count */
  check('插值不用保留字 count', trees.every(({ tree }) => !/\{\{count\}\}/u.test(JSON.stringify(tree.myPick.booking))));
}

// =============================================================== summary ====
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((r) => r.label).join(' | ')}`);
  process.exit(1);
}
