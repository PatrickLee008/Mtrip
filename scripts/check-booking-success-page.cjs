#!/usr/bin/env node
/**
 * 设计契约校验:正常模式「预订结果页」(Booking Success)
 *
 * 依据:Figma M-Trip `2659:13475`(多房间,状态卡两行 Booking Status)
 *      与 `224:3826`(单房间,只有一行)—— 两张稿是同一页,只差状态行数。
 * 设计数据落档:本轮经 Figma MCP `get_design_context` 取回(两帧渲染图已人工比对)。
 *
 * 为什么用源码级断言:client-app 没有测试框架(无 jest / 无 render harness),
 * 唯一可自动化的等价物是「稿面规格的源码契约」+ i18n 结构一致性 + tsc。
 * 断言的是设计稿的事实(尺寸/色值/结构/文案键)与本次拍板的取数口径,不是实现的自证。
 *
 * 用法:powershell -Command "node scripts/check-booking-success-page.cjs"
 * 退出码:0 = 全部通过(GREEN),1 = 有失败项(RED)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...segments) => path.join(ROOT, ...segments);

const SCREEN = at('client-app/src/screens/hotel/BookingSuccessScreen.tsx');
const ICONS = at('client-app/src/components/home/HomeIcon.tsx');
const NAV_TYPES = at('client-app/src/navigation/types.ts');
const STORE = at('client-app/src/store/roomCartStore.ts');
const LOGO = at('client-app/assets/images/logo-2026.png');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: at(`client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

/** 取出 StyleSheet.create 里的具名样式块(花括号配对扫描,正则配对会跨块吞内容) */
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

/** 去掉注释再做「不许出现某词」的否定断言 —— 否则会命中解释性注释里的那个词 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

const screen = readText(SCREEN);
check('BookingSuccessScreen.tsx 存在', screen !== null);

// ============================================================ 稿面规格 ====
if (screen) {
  const blocks = readStyleBlocks(screen);
  const blockOf = (name) => blocks.get(name) ?? '';
  const body = stripComments(screen);

  /* 页面壳 */
  check('页面底色 #F8FAFC(只有这一屏用)', /PAGE_BG = '#F8FAFC'/u.test(screen));
  check('Main px 走 PAGE_PADDING(16)', /paddingHorizontal: PAGE_PADDING/u.test(blockOf('main')));
  check('Main gap 32', /gap: 32/u.test(blockOf('main')));
  check('Main pt 96 − 54 状态栏', /paddingTop: 96 - 54/u.test(blockOf('main')));

  /* 结果头 2659:13477 */
  check('结果头 gap 16', /gap: 16/u.test(blockOf('header')));
  check('图标底 96x88 圆', /width: 96/u.test(blockOf('iconWrap')) && /height: 88/u.test(blockOf('iconWrap')));
  check('图标底圆角 999', /borderRadius: 999/u.test(blockOf('iconWrap')));
  check('图标底色 = 状态色 10%(1A)', /\$\{tone\}1A/u.test(screen));
  check('标题 Inter 700 24/32 tracking -0.96', /fontSize: 24/u.test(blockOf('title')) && /lineHeight: 32/u.test(blockOf('title')) && /letterSpacing: -0\.96/u.test(blockOf('title')));
  check('说明 16/24 居中', /fontSize: 16/u.test(blockOf('desc')) && /lineHeight: 24/u.test(blockOf('desc')) && /textAlign: 'center'/u.test(blockOf('desc')));

  /* 凭证卡 2659:13488 */
  check('凭证卡 p25 / 圆角 24 / 1px 白描边', /padding: 25/u.test(blockOf('voucherCard')) && /borderRadius: 24/u.test(blockOf('voucherCard')) && /borderColor: '#FFFFFF'/u.test(blockOf('voucherCard')));
  check('凭证卡投影 0 -4 20 #4E73FF 8%', /shadowColor: '#4E73FF'/u.test(blockOf('voucherCard')) && /height: -4/u.test(blockOf('voucherCard')) && /shadowRadius: 20/u.test(blockOf('voucherCard')));
  check('Logo 区 py24 居中', /paddingVertical: 24/u.test(blockOf('logoBlock')) && /alignItems: 'center'/u.test(blockOf('logoBlock')));
  check('Logo 展示框 100x74', /width: 100/u.test(blockOf('logo')) && /height: 74/u.test(blockOf('logo')));
  check('Logo 用 contain(稿面 object-contain)', /resizeMode="contain"/u.test(screen));
  check('Tagline Inter 600 20/24 主色 + 0 0 4 文字投影', /fontSize: 20/u.test(blockOf('tagline')) && /textShadowRadius: 4/u.test(blockOf('tagline')));

  /**
   * 状态行(`2661:16931`)已抽到 `components/hotel/booking/BookingStatusRows.tsx`,
   * 与订单详情页(`2659:16092`)共用同一份 —— 所以这几条断言读那个文件。
   */
  const rowsFile = readText(at('client-app/src/components/hotel/booking/BookingStatusRows.tsx')) ?? '';
  const rowsBlocks = readStyleBlocks(rowsFile);
  const rowBlockOf = (name) => rowsBlocks.get(name) ?? '';
  check('状态行已抽成共用组件', rowsFile !== '' && /BookingStatusRows/u.test(screen));
  check('状态区外层 py20', /paddingVertical: 20/u.test(blockOf('statusBlockWrap')));
  check('状态组 gap12', /gap: 12/u.test(rowBlockOf('block')));
  check('状态行 py4 两端对齐', /paddingVertical: 4/u.test(rowBlockOf('row')) && /justifyContent: 'space-between'/u.test(rowBlockOf('row')));
  check('行首图标 32 圆主色底', /width: 32/u.test(rowBlockOf('icon')) && /borderRadius: 999/u.test(rowBlockOf('icon')) && /colors\.primary/u.test(rowBlockOf('icon')));
  check('行文案 Inter 500 16/20 --text-2', /fontSize: 16/u.test(rowBlockOf('label')) && /lineHeight: 20/u.test(rowBlockOf('label')) && /colors\.textSoft/u.test(rowBlockOf('label')));
  check('药丸 px12 py4 圆角 999', /paddingHorizontal: 12/u.test(rowBlockOf('badge')) && /paddingVertical: 4/u.test(rowBlockOf('badge')) && /borderRadius: 999/u.test(rowBlockOf('badge')));
  check('药丸文字 12/16 tracking .24 大写白', /fontSize: 12/u.test(rowBlockOf('badgeText')) && /letterSpacing: 0\.24/u.test(rowBlockOf('badgeText')) && /textTransform: 'uppercase'/u.test(rowBlockOf('badgeText')));
  check('分隔线 1px softBlue', /height: 1/u.test(rowBlockOf('divider')) && /colors\.softBlue/u.test(rowBlockOf('divider')));
  /* 稿面只有 Payment 与第一条 Booking 之间那一条线,房间行之间没有 */
  const dividerUses = (stripComments(rowsFile).match(/styles\.divider/gu) ?? []).length;
  check('分隔线只画一条(房间行之间没有)', dividerUses === 1, `用了 ${dividerUses} 次`);

  /* 单号行 */
  check('单号 Inter 400 18/28 --text-2', /fontSize: 18/u.test(blockOf('idLabel')) && /lineHeight: 28/u.test(blockOf('idLabel')) && /colors\.textSoft/u.test(blockOf('idLabel')));
  check('单号值 Inter 600 --text', /interSemi/u.test(blockOf('idValue')) && /colors\.heading/u.test(blockOf('idValue')));
  /* copy 的字形是 14.1667x16.6667(非正方),只传 size 会被拉成正方 —— 必须给 width/height */
  check(
    '复制图标按原生比例给 width/height(非正方字形)',
    /name="copy"\s+width=\{17\}\s+height=\{20\}/u.test(screen.replace(/\s+/gu, ' ')),
  );
  check('单号可复制(expo-clipboard)', /expo-clipboard/u.test(screen) && /setStringAsync/u.test(screen));

  /* 详情区 2659:13580 */
  check('详情区 gap 8', /gap: 8/u.test(blockOf('detailGroup')));
  check('详情标题 Inter 600 20 / px4', /fontSize: 20/u.test(blockOf('detailHead')) && /paddingHorizontal: 4/u.test(blockOf('detailHead')));
  check('详情卡 p25 圆角 24 gap16 描边 #E5EEFF', /padding: 25/u.test(blockOf('detailCard')) && /borderRadius: 24/u.test(blockOf('detailCard')) && /gap: 16/u.test(blockOf('detailCard')) && /borderColor: '#E5EEFF'/u.test(blockOf('detailCard')));
  check('详情卡投影 0 10 15 #4E73FF 8%', /shadowColor: '#4E73FF'/u.test(blockOf('detailCard')) && /shadowRadius: 15/u.test(blockOf('detailCard')));
  check('缩略图 96 方 圆角 12.8', /width: 96/u.test(blockOf('thumb')) && /height: 96/u.test(blockOf('thumb')) && /borderRadius: 12\.8/u.test(blockOf('thumb')));
  check('酒店名 Inter 400 18/22.5', /fontSize: 18/u.test(blockOf('hotelName')) && /lineHeight: 22\.5/u.test(blockOf('hotelName')));
  check('日期图标 10.5x11.667(非正方,给 width/height)', /width=\{10\.5\}/u.test(screen) && /height=\{11\.667\}/u.test(screen));
  check('日期文案 Inter 500 14/20 tracking .14', /fontSize: 14/u.test(blockOf('dateText')) && /lineHeight: 20/u.test(blockOf('dateText')) && /letterSpacing: 0\.14/u.test(blockOf('dateText')));

  /* 引流卡 2659:13597 */
  check('引流卡 p25 圆角 24 gap7.5', /padding: 25/u.test(blockOf('upsell')) && /borderRadius: 24/u.test(blockOf('upsell')) && /gap: 7\.5/u.test(blockOf('upsell')));
  check('引流卡底色/描边按稿', /rgba\(221, 225, 255, 0\.3\)/u.test(blockOf('upsell')) && /#DDE1FF/u.test(blockOf('upsell')));
  check('引流文案 #0037B9', /#0037B9/u.test(blockOf('upsellText')));
  check('引流链接 #204DDA(DEEP_PRIMARY)+ 9.333 箭头', /DEEP_PRIMARY/u.test(blockOf('upsellLinkText')) && /size=\{9\.333\}/u.test(screen));

  /* 吸底 2659:13620:稿面只有一枚 View Booking */
  check('吸底 px16 pt16 --tab 底', /paddingHorizontal: PAGE_PADDING/u.test(blockOf('bottomBar')) && /paddingTop: 16/u.test(blockOf('bottomBar')) && /colors\.surface/u.test(blockOf('bottomBar')));
  check('主按钮 p16 圆角 12 主色', /padding: 16/u.test(blockOf('primaryBtn')) && /radius\.btn/u.test(blockOf('primaryBtn')) && /colors\.primary/u.test(blockOf('primaryBtn')));
  check('主按钮文字 Inter 400 16/24 白', /fontSize: 16/u.test(blockOf('primaryText')) && /lineHeight: 24/u.test(blockOf('primaryText')) && /#FFFFFF/u.test(blockOf('primaryText')));
  const pressableCount = (body.match(/<Pressable/gu) ?? []).length;
  /* 成功态吸底仍是稿面的一枚 View Booking(复制 / 引流 / View Booking = 3 处);
     2026-09-22 新增的支付失败态另有「稍后再付 + 立即支付」两枚,故整页 5 处 */
  check('成功态吸底仍只有一枚按钮(整页 5 处可点:3 处成功态 + 2 处失败态)', pressableCount === 5, `${pressableCount} 处`);
  check('失败态那两枚只在 failed 下渲染(吸底那一段,不是结果头的图标三元)',
    /\{failed \? \(\s*<View style=\{styles\.btnRow\}>[\s\S]{0,400}?payLater/u.test(screen));

  /* 本次拍板的口径 */
  check('新稿没有二维码:不再引 react-native-qrcode-svg', !/qrcode/iu.test(body));
  check('核销码改由订单详情页承载:View Booking 去 OrderDetail', /name: 'OrderDetail', params: \{ orderId: p\.orderId \}/u.test(screen));
  check('没有订单号(演示模式)退回订单列表', /name: 'OrderList'/u.test(screen));
  /* 本屏是流程终点且稿面没有返回入口:再 push 一层订单详情会卡成「成功页 ⇄ 订单详情」 */
  check('View Booking 用 reset 重置栈,不是 push/navigate', /navigation\.reset\(\{/u.test(screen) && !/navigation\.navigate\(/u.test(body));
  check('reset 后底下垫的是底部 Tab(我的预订)', /name: 'MainTabs', params: \{ screen: 'MyPickTab' \}/u.test(screen));
  check('状态行数据来自下单快照 booked(不是 items)', /useRoomCartStore\(\(s\) => s\.booked\)/u.test(screen));
  check('单房间只出一行且不带房号(224:3826)', /\[\{ key: 'single', roomLabel: '' \}\]/u.test(screen));
  check('多房间一行一个预订并标房号(2659:13475)', /statusRoomTimes/u.test(screen) && /statusRoom'/u.test(screen));
  /* 2026-09-22:状态改由 `useBookingResult` 统一给(缺省仍是 confirmed),
     因为成功页也要读订单、且重付成功后要就地切态 —— 不再直接读路由参数 */
  check('三态由 useBookingResult 决定', /const result = useBookingResult\(\{/u.test(screen)
    && /const confirmed = result\.status === 'confirmed'/u.test(screen)
    && /const failed = result\.status === 'failed'/u.test(screen));
  check('缺省仍是 confirmed(演示模式不带 status)', /status: p\.status/u.test(screen)
    && /useState<BookingResultStatus>\(p\.status \?\? 'confirmed'\)/u.test(
      readText(at('client-app/src/screens/hotel/useBookingResult.ts')) ?? ''));
  check('缩略图优先用本单第一间房的真实封面', /bookedRooms\[0\]\?\.cover \?\? tempCoverFor\(0\)/u.test(screen));
}

// ============================================================== 依赖项 ====
{
  const icons = readText(ICONS) ?? '';
  check('HomeIcon 有 walletCreditCard(fluent:wallet-credit-card-20-filled)', /walletCreditCard: \{/u.test(icons));
  check('HomeIcon 有 calendarClock(fluent:calendar-clock-20-filled)', /calendarClock: \{/u.test(icons));
  check('两枚新图标都是 20 原生画布', /walletCreditCard: \{\s*filled: true,\s*viewBox: '0 0 20 20'/u.test(icons) && /calendarClock: \{\s*filled: true,\s*viewBox: '0 0 20 20'/u.test(icons));
  check('logo-2026.png 已入库(稿面 MTrip Logo 2026 Profile Pic)', fs.existsSync(LOGO) && fs.statSync(LOGO).size > 1024);

  const navTypes = readText(NAV_TYPES) ?? '';
  check('BookingSuccess 路由收三态 status', /BookingSuccess:[\s\S]{0,1400}?status\?: 'confirming' \| 'confirmed' \| 'failed';/u.test(navTypes));

  const store = readText(STORE) ?? '';
  check('roomCartStore 有 booked 快照', /booked: CartRoom\[\];/u.test(store));
}

// ================================================================ i18n ====
{
  const KEYS = [
    'confirmedTitle', 'confirmedDesc', 'confirmingTitle', 'confirmingDesc',
    'travelWithUs', 'paymentStatus', 'bookingStatus', 'statusRoom', 'statusRoomTimes',
    'paid', 'confirmed', 'confirming', 'bookingId', 'idCopied', 'bookingDetails',
    'dateRange', 'viewBooking', 'upsell', 'upsellLink',
  ];
  const DROPPED = ['referencePrefix', 'voucher', 'summary', 'totalPaid', 'download', 'backHome', 'tags', 'bookedRooms'];
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(fs.readFileSync(file, 'utf8')) }));

  for (const { name, tree } of trees) {
    const block = tree.hotels.booking.success;
    check(`${name} success 段含全部新键`, KEYS.every((k) => typeof block[k] === 'string'), KEYS.filter((k) => typeof block[k] !== 'string').join(',') || 'ok');
    check(`${name} 旧凭证页的键已清掉`, DROPPED.every((k) => block[k] === undefined), DROPPED.filter((k) => block[k] !== undefined).join(',') || 'ok');
  }
  const sets = trees.map(({ tree }) => new Set(leafPaths(tree)));
  const extra = (a, b) => [...a].filter((k) => !b.has(k));
  check('三份 i18n 键集零差异', extra(sets[0], sets[1]).length === 0 && extra(sets[1], sets[0]).length === 0 && extra(sets[0], sets[2]).length === 0 && extra(sets[2], sets[0]).length === 0, `${sets[0].size} 键`);
  /* 本仓库约定:插值键避开 i18next 保留字 count(会触发复数查找) */
  check('房号插值不用保留字 count', trees.every(({ tree }) => !/\{\{count\}\}/u.test(tree.hotels.booking.success.statusRoomTimes)));
}

// =============================================================== summary ====
const failed = results.filter((row) => !row.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((row) => row.label).join(' | ')}`);
  process.exit(1);
}
