#!/usr/bin/env node
/**
 * 契约校验:支付失败 → 结果页失败态 → 对**已有订单**重新发起支付
 *
 * 修的缺陷(2026-09-22 用户报):
 *   ① 支付失败后仍停在向导第 4 步,只弹一个失败弹窗;
 *   ② 点「Retry」会重新创建订单 —— 建单与支付原本包在同一个 try 里,
 *      建单成功、支付失败时 `orderId` 根本没被记下来,那张 `order_status=0` 的待支付单
 *      在 App 里再也走不到,用户只能重新建一单。
 *
 * 本脚本锁死修复后的不变量;其中**最关键的一条**是:
 *   结果页与订单详情页的重付路径里**不得出现任何 create 调用**。
 *
 * ⚠ 源码契约断言,不是执行结果 —— client-app 没有测试框架(无 jest / render harness)。
 * 真值仍需真机/Web 冒烟(需要一张真的待支付单)。
 *
 * 用法:powershell -Command "node scripts/check-payment-failure-flow.cjs"
 * 退出码:0 = GREEN,1 = RED
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...p) => path.join(ROOT, ...p);

const WIZARD = at('client-app/src/screens/hotel/useBookingWizard.ts');
const HOOK = at('client-app/src/screens/hotel/useBookingResult.ts');
const FULL = at('client-app/src/screens/hotel/BookingSuccessScreen.tsx');
const LITE = at('client-app/src/screens/hotel/BookingSuccessLiteScreen.tsx');
const DETAIL = at('client-app/src/screens/order/BookingDetailScreen.tsx');
const TYPES = at('client-app/src/navigation/types.ts');
const TRIP_API = at('client-app/src/api/trip.ts');
const TRIP_CTRL = at('backend/services/order-service/app/Controller/App/TripController.php');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: at(`client-app/assets/i18n/${name}.json`),
}));

const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
};
const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
/** 去注释再做否定断言 —— 否则会命中解释性注释里的那个词 */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const leaves = (v, p = '') =>
  v === null || typeof v !== 'object' || Array.isArray(v)
    ? [p]
    : Object.entries(v).flatMap(([k, c]) => leaves(c, p === '' ? k : `${p}.${k}`));

const wizard = strip(read(WIZARD));
const hook = strip(read(HOOK));
const full = strip(read(FULL));
const lite = strip(read(LITE));
const detail = strip(read(DETAIL));
check('五个源文件都在', [wizard, hook, full, lite, detail].every((x) => x !== ''));

// ============================================ 1 建单与支付必须分两段 catch ====
{
  /* Trip 链路:create 之后紧接着一个自己的 try,pay 在里面 */
  check(
    'Trip 链路 create 后另起 try 包住 pay',
    /apiTripCreate\([\s\S]{0,400}?try \{[\s\S]{0,400}?apiTripPay\(/u.test(wizard),
  );
  check(
    '单房型链路 create 后另起 try 包住 pay',
    /createOrder\([\s\S]{0,900}?try \{[\s\S]{0,300}?payOrder\(/u.test(wizard),
  );

  /* 支付失败分支必须带着已建好的单号去结果页 */
  check(
    'Trip 支付失败带 tripId 进失败态',
    /goResult\('failed', \{[\s\S]{0,260}?tripId: trip\.tripId/u.test(wizard),
  );
  check(
    '单房型支付失败带 orderId 进失败态',
    /goResult\('failed', \{[\s\S]{0,200}?orderId: order\.orderId/u.test(wizard),
  );
  check('失败态带上后端给的原因', (wizard.match(/failReason: e instanceof Error/gu) ?? []).length === 2);

  /* 外层 catch 只剩建单失败:留在第 4 步弹窗 */
  check('建单失败仍留在第 4 步弹窗', /setPayResult\('error'\)/u.test(wizard));

  /* 结果页是流程终点:必须 reset,否则返回能回到第 4 步再点一次 Pay Now 又建一单 */
  check(
    '进结果页用 navigation.reset 而不是 replace/navigate',
    /const goResult =[\s\S]{0,1200}?navigation\.reset\(\{/u.test(wizard) &&
      !/navigation\.replace\('BookingSuccess/u.test(wizard),
  );
  check(
    'goSuccess 复用 goResult(成功/失败同一套参数拼装)',
    /const goSuccess = \(\) => goResult\('confirmed'\)/u.test(wizard),
  );
  check('paid 里带 tripId(失败/成功都要能定位到单)', /tripId: number;/u.test(wizard));
  check('每次提交先清空上次的失败原因', /setFailReason\(''\)/u.test(wizard));
  /* 建单一成功就清空购物车,免得留在车里诱发重复下单 */
  check('建单成功即 checkoutCart', (wizard.match(/checkoutCart\(\)/gu) ?? []).length >= 2);
}

// ==================================== 2 重付只付已有的单,绝不新建 ====
{
  check('取数与重付抽在 useBookingResult(两种模式共用同一份口径)', hook !== '');
  check(
    '重付走 trip/pay 或 order/pay',
    /apiTripPay\(\{ tripId/u.test(hook) && /payOrder\(p\.orderId\)/u.test(hook),
  );
  /** 本条是整个修复的核心不变量 */
  check(
    '重付路径里没有任何 create 调用',
    !/apiTripCreate|createOrder/u.test(hook) && !/apiTripCreate|createOrder/u.test(detail),
  );
  check(
    '重付有在途护栏(防连点重复扣款)',
    /inFlight/u.test(hook) && /if \(inFlight\.current\) return false/u.test(hook),
  );
  check('重付成功后刷新钱包余额', /refreshProfile\(\)/u.test(hook));
  check(
    '重付成功就地切 confirmed 并重读订单',
    /setStatus\('confirmed'\)/u.test(hook) && /await load\(\)/u.test(hook),
  );

  /* 读订单:成功态也读(用户要求) */
  check('按 orderId 读订单详情', /fetchOrderDetail\(p\.orderId\)/u.test(hook));
  check('按 tripId 读整车明细', /fetchTripDetail\(p\.tripId\)/u.test(hook));
  check(
    '单号/金额以接口为准、路由参数兜底',
    /tripNo \|\| order\?\.order_no \|\| p\.orderNo/u.test(hook) &&
      /tripPayAmount \?\? \(order \? Number\(order\.pay_amount\)/u.test(hook),
  );
  check('演示模式(无 orderId/tripId)不发请求', /if \(!p\.orderId && !p\.tripId\) return;/u.test(hook));
}

// ============================================ 3 倒计时与超时 ====
{
  check('倒计时读 payment_expires_at', /payment_expires_at/u.test(hook));
  check('多房间取各预订里最早的截止时间', /Math\.min\(\.\.\.times\)/u.test(hook));
  check('服务端时间格式做了 ISO 兼容(iOS 不认带空格的)', /replace\(' ', 'T'\)/u.test(hook));
  check('只在待支付态起秒表', /const ticking = expiresAt !== null && status !== 'confirmed'/u.test(hook));
  /* 实测 order/pay 不判 payment_expires_at(过期靠每分钟的超时任务取消),
     按倒计时禁用会比后端更严、把只迟到几秒的用户挡住 —— 失效必须以服务端状态为准 */
  check('失效以服务端订单状态为准,不是倒计时归零',
    /const expired =\s*order !== null &&/u.test(hook)
    && /ORDER_STATUS\.CANCELLED/u.test(hook)
    && !/const expired = secondsLeft !== null && secondsLeft <= 0/u.test(hook));
  check('倒计时归零时重读一次订单(问后端要真状态)', /askedAfterTimeUp/u.test(hook));
  check('后端 trip/detail 下发了 payment_expires_at', /'payment_expires_at'/u.test(read(TRIP_CTRL)));
  check('TripBookingRow 类型补了该字段', /payment_expires_at\?: string \| null;/u.test(read(TRIP_API)));
}

// ============================================ 4 结果页三态 ====
{
  const modes = [
    ['完整模式', full, 'success'],
    ['关怀模式', lite, 'lite\\.success'],
  ];
  for (const [name, src, ns] of modes) {
    check(`${name} 有 failed 态`, /const failed = result\.status === 'failed'/u.test(src));
    check(`${name} 失败态图标 dismissCircle + hot 色`, /dismissCircle/u.test(src) && /colors\.hot/u.test(src));
    /* 以前 Payment 徽标写死 PAID —— 失败态下那是错的 */
    check(
      `${name} Payment 徽标不再写死已支付`,
      new RegExp(`failed[\\s\\S]{0,160}?${ns}\\.failedBadge`, 'u').test(src),
    );
    check(
      `${name} 失败态显示后端原因与剩余时间`,
      /result\.failReason/u.test(src) && /formatCountdown\(result\.secondsLeft\)/u.test(src),
    );
    check(`${name} 失败态吸底是「稍后再付 + 立即支付」`, /payLater/u.test(src) && /payNow/u.test(src));
    check(`${name} 支付中/已超时禁用主按钮`, /result\.paying \|\| result\.expired/u.test(src));
    check(`${name} 主按钮调 repay 而不是重新下单`, /result\.repay\(\)/u.test(src));
  }
  const types = read(TYPES);
  check(
    '两个结果路由都收 failed / tripId / failReason',
    (types.match(/'confirming' \| 'confirmed' \| 'failed'/gu) ?? []).length === 2 &&
      (types.match(/tripId\?: number;/gu) ?? []).length >= 2 &&
      (types.match(/failReason\?: string;/gu) ?? []).length >= 2,
  );
}

// ============================================ 5 待支付单的支付入口 ====
{
  check('订单详情页有待支付判定', /const pending = order\?\.order_status === ORDER_STATUS\.PENDING/u.test(detail));
  check(
    '待支付时左按钮换成 Pay(其余状态仍是禁用的 Modify)',
    /\{pending \?[\s\S]{0,700}?bookingDetail\.payNow[\s\S]{0,400}?bookingDetail\.modifyBooking/u.test(detail),
  );
  check(
    '详情页付的是这张已有的单',
    /apiTripPay\(\{ tripId, payMethod: 3 \}\)/u.test(detail) && /payOrder\(order\.id\)/u.test(detail),
  );
  check('详情页支付有防连点', /if \(paying \|\| !order\) return;/u.test(detail));
  check('付完重读订单', /await load\(\);/u.test(detail));
}

// ============================================ 6 建单失败的 Retry 真的重试 ====
{
  const screens = [
    ['完整模式', at('client-app/src/screens/hotel/HotelBookingScreen.tsx')],
    ['关怀模式', at('client-app/src/screens/hotel/HotelBookingLiteScreen.tsx')],
  ];
  for (const [name, file] of screens) {
    const src = strip(read(file));
    check(`${name} Retry 真的重新提交(不再只关弹窗)`, /if \(wasError\) \{[\s\S]{0,80}?goNext\(\);/u.test(src));
  }
}

// ================================================================ i18n ====
{
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(read(file)) }));
  const KEYS = [
    'failedTitle', 'failedDesc', 'failedBadge', 'pendingBadge', 'payWithin',
    'expiredTitle', 'expiredDesc', 'payNow', 'payLater', 'paidToast',
  ];
  for (const { name, tree } of trees) {
    const s = tree.hotels.booking.success;
    const l = tree.hotels.booking.lite.success;
    check(`${name} 完整模式失败态文案齐全`, KEYS.every((k) => typeof s[k] === 'string'));
    check(`${name} 关怀模式失败态文案齐全`, KEYS.every((k) => typeof l[k] === 'string'));
    check(`${name} 订单详情页有 payNow`, typeof tree.order.bookingDetail.payNow === 'string');
  }
  const sets = trees.map(({ tree }) => new Set(leaves(tree)));
  const extra = (a, b) => [...a].filter((k) => !b.has(k));
  check(
    '三份 i18n 键集零差异',
    extra(sets[0], sets[1]).length === 0 &&
      extra(sets[1], sets[0]).length === 0 &&
      extra(sets[0], sets[2]).length === 0 &&
      extra(sets[2], sets[0]).length === 0,
    `${sets[0].size} 键`,
  );
}

// ================================================================ summary ====
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((r) => r.label).join(' | ')}`);
  process.exit(1);
}
