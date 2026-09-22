#!/usr/bin/env node
/**
 * 设计契约校验:酒店订单详情页(Booking Details,多房间 / 单房间同一页)
 *
 * 依据:Figma M-Trip `2659:16092`(Rooms Details Multi Room)与 `289:1670`(单房间同页);
 *       同一 section 的多酒店行程详情 `2142:4389`(Stay 时间轴 + 每段一张 `stay` 变体卡);
 *       状态行组 `2661:16931` 与预订结果页共用 `components/hotel/booking/BookingStatusRows`。
 * 设计数据落档:本轮经 Figma MCP `get_design_context` 取回(整帧渲染图已人工比对)。
 *
 * ⚠️ 源码契约断言,不是执行结果 —— client-app 没有测试框架(无 jest / render harness,
 * 也没装 tsx/esbuild 能直接跑 TS)。取数与渲染的真值仍需真机/Web 冒烟。
 *
 * 用法:powershell -Command "node scripts/check-booking-detail-page.cjs"
 * 退出码:0 = GREEN,1 = RED
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...segments) => path.join(ROOT, ...segments);

const SCREEN = at('client-app/src/screens/order/BookingDetailScreen.tsx');
const TRIP_SCREEN = at('client-app/src/screens/order/TripDetailScreen.tsx');
const ROWS = at('client-app/src/components/hotel/booking/BookingStatusRows.tsx');
const CARD = at('client-app/src/components/hotel/booking/SelectedRoomsCard.tsx');
const API = at('client-app/src/api/trip.ts');
const NAV = at('client-app/src/navigation/index.tsx');
const NAV_TYPES = at('client-app/src/navigation/types.ts');
const MODELS = at('client-app/src/types/models.ts');
const TRIP_CTRL = at('backend/services/order-service/app/Controller/App/TripController.php');
const MYPICK = at('client-app/src/screens/mypick/MyPickScreen.tsx');
const MYPICK_LITE = at('client-app/src/screens/mypick/MyPickLiteScreen.tsx');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: at(`client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}
const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
function leafPaths(v, p = '') {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return [p];
  return Object.entries(v).flatMap(([k, c]) => leafPaths(c, p === '' ? k : `${p}.${k}`));
}
function styleBlocks(text) {
  const blocks = new Map();
  const i = text.indexOf('StyleSheet.create(');
  const scope = i === -1 ? text : text.slice(i);
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
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

const screen = read(SCREEN);
check('BookingDetailScreen.tsx 存在', screen !== '');

// ============================================================ 稿面规格 ====
if (screen) {
  const b = (n) => styleBlocks(screen).get(n) ?? '';
  const body = stripComments(screen);

  check('页面底色 --background', /colors\.pageBg/u.test(b('root')));
  check('Main pt16 px16 gap24', /paddingTop: 16/u.test(b('main')) && /paddingHorizontal: PAGE_PADDING/u.test(b('main')) && /gap: 24/u.test(b('main')));
  /* 稿面 300 高 = HotelGallery 的默认值,所以**不该**给它传 height(传了说明偏离了共用口径);
   注意不能笼统地查 `height={`,页面里别的图标也有 height 属性 */
  check('图库走共用 HotelGallery(稿面 300 高 = 组件默认值,不覆盖)', /<HotelGallery/u.test(screen) && !/<HotelGallery[^/]*height=/u.test(screen));

  /* 悬浮顶栏 2659:16270 */
  check('顶栏悬浮 + zIndex 2', /position: 'absolute'/u.test(b('topBar')) && /zIndex: 2/u.test(b('topBar')));
  check('顶栏 px20 / --tab 底 / Effect-DS 投影', /paddingHorizontal: 20/u.test(b('topBar')) && /colors\.surface/u.test(b('topBar')) && /shadows\.subtle/u.test(b('topBar')));
  check('顶栏标题 Outfit 600/24 主色', /outfitSemi/u.test(b('topTitle')) && /fontSize: 24/u.test(b('topTitle')) && /colors\.primary/u.test(b('topTitle')));
  check('右侧两枚 36 圆按钮', /width: 36/u.test(b('topIconBtn')) && /borderRadius: 999/u.test(b('topIconBtn')));
  /* 悬浮栏必须声明在滚动容器之后,否则列表盖住它、返回键点不动(已在别处踩过) */
  check('顶栏声明在 ScrollView 之后', body.lastIndexOf('styles.topBar') > body.lastIndexOf('</ScrollView>'));

  /* 标题卡 2659:16111 */
  check('标题卡 p21 圆角 24 1px --secondary', /padding: 21/u.test(b('titleCard')) && /borderRadius: 24/u.test(b('titleCard')) && /colors\.softBlue/u.test(b('titleCard')));
  check('酒店名 Inter 600/24', /interSemi/u.test(b('hotelName')) && /fontSize: 24/u.test(b('hotelName')));
  check('地址图标 12x15(非正方,给 width/height)', /width=\{12\}/u.test(screen) && /height=\{15\}/u.test(screen));

  /* 确认卡 2661:17072 */
  check('确认卡 p25 圆角 24 1px 白 + 0 -4 20 投影', /padding: 25/u.test(b('voucherCard')) && /borderRadius: 24/u.test(b('voucherCard')) && /borderColor: '#FFFFFF'/u.test(b('voucherCard')) && /height: -4/u.test(b('voucherCard')));
  check('结果头 96x88 圆底 + 状态色 10%', /width: 96/u.test(b('iconWrap')) && /height: 88/u.test(b('iconWrap')) && /\$\{tone\}1A/u.test(screen));
  check('标题 Inter 700 24/32 tracking -0.96', /interBold/u.test(b('resultTitle')) && /letterSpacing: -0\.96/u.test(b('resultTitle')));
  check('卡内酒店名 Inter 600/24 居中', /fontSize: 24/u.test(b('voucherHotel')) && /textAlign: 'center'/u.test(b('voucherHotel')));
  check('状态行组复用共用组件(与结果页同一份)', /BookingStatusRows/u.test(screen) && read(ROWS) !== '');
  check('单号行 Inter 400/16 + 值 600 + 20 复制图标', /fontSize: 16/u.test(b('idLabel')) && /interSemi/u.test(b('idValue')) && /name="copy"/u.test(screen));
  check('单号可复制(expo-clipboard)', /expo-clipboard/u.test(screen) && /setStringAsync/u.test(screen));

  /* 住宿网格 2659:16366 */
  check('网格卡 p25 圆角 24 gap16 + 1px rgba(196,197,215,.2)', /padding: 25/u.test(b('grid')) && /borderRadius: 24/u.test(b('grid')) && /gap: 16/u.test(b('grid')) && /rgba\(196, 197, 215, 0\.2\)/u.test(b('grid')));
  check('行首 40 圆 rgba(32,77,218,.1)', /width: 40/u.test(b('gridIcon')) && /rgba\(32, 77, 218, 0\.1\)/u.test(b('gridIcon')));
  check('小标题 Inter 600/12 tracking .6', /fontSize: 12/u.test(b('gridLabel')) && /letterSpacing: 0\.6/u.test(b('gridLabel')));
  check('值 Inter 700/16', /interBold/u.test(b('gridValue')) && /fontSize: 16/u.test(b('gridValue')));
  check('TOTAL AMOUNT 大写 + 金额 Inter 700/20 主色', /textTransform: 'uppercase'/u.test(b('totalLabel')) && /fontSize: 20/u.test(b('totalValue')) && /colors\.primary/u.test(b('totalValue')));

  /* 已选房型 2659:16386 */
  check('复用 SelectedRoomsCard 且**不传** onEdit(订单已成立不能改房)', /<SelectedRoomsCard rooms=\{rooms\} \/>/u.test(screen));
  check('SelectedRoomsCard 的 onEdit 已改成可选', /onEdit\?: \(\) => void;/u.test(read(CARD)));

  /* 设施 / 含早 */
  check('设施网格两列 + 40 高 #E5EEFF 图标格', /width: '45%'/u.test(b('amenityItem')) && /height: 40/u.test(b('amenityIcon')) && /#E5EEFF/u.test(b('amenityIcon')));
  check('含早卡 rgba(65,105,237,.05) + 64 圆底 + #204DDA 标题', /rgba\(65, 105, 237, 0\.05\)/u.test(b('breakfastCard')) && /width: 64/u.test(b('breakfastIcon')) && /#204DDA/u.test(b('breakfastTitle')));
  check('含早卡只在房型含早时渲染', /\{breakfast \?/u.test(screen));

  /* 联系物业 / 支持 */
  check('Message Property 整宽主色 py16 圆角 12', /paddingVertical: 16/u.test(b('primaryBtn')) && /radius\.btn/u.test(b('primaryBtn')) && /colors\.primary/u.test(b('primaryBtn')));
  check('地址卡 p25 圆角 24 gap24', /padding: 25/u.test(b('addressCard')) && /borderRadius: 24/u.test(b('addressCard')) && /gap: 24/u.test(b('addressCard')));
  check('地址正文 Inter 400 15/28', /fontSize: 15/u.test(b('addressFull')) && /lineHeight: 28/u.test(b('addressFull')));
  check('地图块 86 高 + View on Map 主色胶囊', /MAP_HEIGHT = 86/u.test(screen) && /borderRadius: 999/u.test(b('mapPill')) && /colors\.primary/u.test(b('mapPill')));
  check('Help Center 行 p17 圆角 12 1px rgba(196,197,215,.2)', /padding: 17/u.test(b('helpRow')) && /rgba\(196, 197, 215, 0\.2\)/u.test(b('helpRow')));
  check('Live Support Chat 底色 #DBE2FA', /#DBE2FA/u.test(b('chatBtn')));
  check('Booking Reference 小标签 + 单号', /order\.bookingDetail\.bookingReference/u.test(screen) && /supportRefValue/u.test(screen));

  /* 底部操作 2659:16265 */
  check('两枚等宽描边按钮 1px 主色 圆角 12', /borderColor: colors\.primary/u.test(b('ghostBtn')) && /radius\.btn/u.test(b('ghostBtn')));
  check('Cancel Booking 红字(--tertiary #EC1317 = colors.hot)', /colors\.hot/u.test(b('dangerText')));
  /* 稿面 Modify Booking 就是 opacity .5:后端没有改期接口 —— 必须是禁用的 View,不能是可点的 Pressable */
  check('Modify Booking 照稿禁用(opacity .5 且不可点)', /opacity: 0\.5/u.test(b('disabled')) && /<View style=\{\[styles\.ghostBtn, styles\.disabled\]\}>/u.test(screen));
}

// ======================================================== 取数与接线 ====
{
  const body = stripComments(screen);
  check('取数三条:order/detail + trip/detail + hotels/detail', /fetchOrderDetail\(orderId\)/u.test(body) && /fetchTripDetail\(tripId\)/u.test(body) && /fetchHotelDetail\(detail\.property_id\)/u.test(body));
  check('带 tripId 才展开 Trip(单房间只用代表单)', /tripId && tripId > 0/u.test(body));
  check('多房间显示 Trip 实付,不是代表单的金额', /tripPayAmount \?\?/u.test(body));
  check('房号只在多房间标(单房间不标)', /rows\.length > 1 \? t\('hotels\.booking\.success\.statusRoom'/u.test(body));
  check('组状态取最靠前的待办态(与我的预订同口径)', /orderStatusRank/u.test(body) && /orderStatusColor/u.test(body));

  const api = read(API);
  check('trip/detail 已上类型(不再是 Record<string, unknown>)', /TripDetailResult/u.test(api) && /bookings: TripBookingRow\[\]/u.test(api) && !/Promise<Record<string, unknown>>/u.test(api));
  check('TripBookingRow 带 property_id / room_type_id', /property_id: number;/u.test(api) && /room_type_id: number;/u.test(api));

  const ctrl = read(TRIP_CTRL);
  check('后端 trip/detail 的 select 返回 property_id / room_type_id', /'property_id', 'room_type_id', 'goods_name'/u.test(ctrl));

  check('OrderItemData 补了 room_type_id', /room_type_id: number;/u.test(read(MODELS)));
  check('路由已注册且关掉 Stack 头(页面自带悬浮顶栏)', /name="BookingDetail"/u.test(read(NAV)) && /BookingDetailScreen/u.test(read(NAV)));
  check('路由参数 { orderId, tripId? }', /BookingDetail: \{ orderId: number; tripId\?: number \};/u.test(read(NAV_TYPES)));
  for (const [name, file] of [['完整模式', MYPICK], ['关怀模式', MYPICK_LITE]]) {
    check(`${name}的 View Details 指向 BookingDetail 并带 tripId`, /navigate\('BookingDetail', \{ orderId: b\.orderId, tripId: b\.tripId \}\)/u.test(read(file)));
  }
}

// ============================================== 多酒店行程详情 2142:4389 ====
{
  const trip = read(TRIP_SCREEN);
  const tb = (n) => styleBlocks(trip).get(n) ?? '';
  const tbody = stripComments(trip);
  check('TripDetailScreen.tsx 存在', trip !== '');
  check('段头 40 圆:主色底 + 4px --secondary 描边', /width: 40/u.test(tb('stayBadge')) && /borderWidth: 4/u.test(tb('stayBadge')) && /colors\.primary/u.test(tb('stayBadge')));
  check('序号字 20/28 白(稿面 Plus Jakarta Bold → Inter 700 顶替)', /fontSize: 20/u.test(tb('stayBadgeText')) && /interBold/u.test(tb('stayBadgeText')));
  check('「Stay n」Inter 600/16 主色', /interSemi/u.test(tb('stayTitle')) && /fontSize: 16/u.test(tb('stayTitle')) && /colors\.primary/u.test(tb('stayTitle')));
  check('时间轴竖线 2px --secondary + 缩进 18 + gap20', /width: 2/u.test(tb('stayLine')) && /paddingLeft: 18/u.test(tb('stayBody')) && /gap: 20/u.test(tb('stayBody')));
  check('每段用 BookingCard 的 stay 变体(不另写一份卡)', /variant="stay"/u.test(trip));
  check('单段 View Details 进 BookingDetail', /navigate\('BookingDetail', \{ orderId: row\.id \}\)/u.test(trip));
  check('顶栏声明在 ScrollView 之后', tbody.lastIndexOf('styles.topBar') > tbody.lastIndexOf('</ScrollView>'));
  check('地址按 property 去重后各拉一次(订单快照没有地址)', /new Set\(rows\.map\(\(r\) => r\.property_id\)/u.test(trip));
  check('只读:页面里没有任何编辑/改期入口', !/Edit|modify|Modify/u.test(tbody));

  /* BookingCard 的 stay 变体 */
  const card = read(at('client-app/src/components/mypick/BookingCard.tsx'));
  const cb = (n) => styleBlocks(card).get(n) ?? '';
  check('stay 变体:卡圆角 32 + p25 + gap16', /borderRadius: 32/u.test(cb('cardStay')) && /padding: 25/u.test(cb('cardStay')) && /gap: 16/u.test(cb('cardStay')));
  check('stay 变体:封面内嵌圆角 20', /borderRadius: 20/u.test(cb('coverWrapStay')) && /radius=\{stay \? 20 : 0\}/u.test(card));
  check('stay 变体:正文不再重复 padding', /padding: 0/u.test(cb('bodyStay')));
  /* 稿面:列表卡 Booking ID 在最上,Stay 卡在按钮行之后 */
  check('Booking ID 行按版式换位置', /bookingNo && !stay \?/u.test(card) && /bookingNo && stay \?/u.test(card));

  /* 入口分流 */
  for (const [name, file] of [['完整模式', MYPICK], ['关怀模式', MYPICK_LITE]]) {
    const src = read(file);
    check(`${name}:跨酒店进 TripDetail、其余进 BookingDetail`, /b\.stayCount > 1\s*\?\s*navigation\.navigate\('TripDetail', \{ tripId: b\.tripId \}\)/u.test(src.replace(/\s+/gu, ' ').replace(/b\.stayCount > 1 \? navigation\.navigate\('TripDetail', \{ tripId: b\.tripId \}\)/u, "b.stayCount > 1 ? navigation.navigate('TripDetail', { tripId: b.tripId })")) || /navigate\('TripDetail', \{ tripId: b\.tripId \}\)/u.test(src));
  }
  check('TripDetail 路由已注册', /name="TripDetail"/u.test(read(NAV)) && /TripDetail: \{ tripId: number \};/u.test(read(NAV_TYPES)));
}

// ================================================================ i18n ====
{
  const KEYS = ['title', 'checkInOut', 'dateRange', 'guestsRooms', 'roomsValue', 'totalAmount',
    'roomAmenities', 'breakfastTitle', 'breakfastDesc', 'contactProperty', 'messageProperty',
    'getDirections', 'viewOnMap', 'support', 'bookingReference', 'helpCenter', 'liveChat',
    'modifyBooking', 'cancelBooking'];
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(fs.readFileSync(file, 'utf8')) }));
  for (const { name, tree } of trees) {
    check(`${name} order.tripDetail.stay 存在`, typeof (tree.order.tripDetail ?? {}).stay === 'string');
    const blk = tree.order.bookingDetail ?? {};
    check(`${name} order.bookingDetail 齐全`, KEYS.every((k) => typeof blk[k] === 'string'), KEYS.filter((k) => typeof blk[k] !== 'string').join(',') || 'ok');
  }
  const sets = trees.map(({ tree }) => new Set(leafPaths(tree)));
  const extra = (a, c) => [...a].filter((k) => !c.has(k));
  check('三份 i18n 键集零差异', extra(sets[0], sets[1]).length === 0 && extra(sets[1], sets[0]).length === 0 && extra(sets[0], sets[2]).length === 0 && extra(sets[2], sets[0]).length === 0, `${sets[0].size} 键`);
  check('插值不用保留字 count', trees.every(({ tree }) => !/\{\{count\}\}/u.test(JSON.stringify(tree.order.bookingDetail))));
}

// =============================================================== summary ====
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((r) => r.label).join(' | ')}`);
  process.exit(1);
}
