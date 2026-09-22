#!/usr/bin/env node
/**
 * 设计契约校验:正常模式订房向导第 3 / 4 步
 *
 * 依据:Figma M-Trip `759:9777`(Booking Flow 整段)下的
 *       `228:5118` Booking step 3(Review & Confirm)与 `276:876` Booking step 4(Payment)。
 * 本轮经 Figma MCP `get_design_context` 取回并人工比对渲染图,关键事实:
 *   - step3 吸底 `718:3351` 是 **Continue + 右箭头**(不是 Add To Trip);
 *   - step3 价格明细 `371:1887` 只有 原价/房费/服务费与税费/合计 —— **没有券行**;
 *   - step3 Add More Stay `2438:7390` 里只有**一枚** plus(10.5)+ 文案 " Add More Stay";
 *   - step4 券区 `516:2381` COUPONS 卡在支付方式之后;
 *   - step4 吸底 `718:3364` 是 **Pay Now + 右箭头**。
 * 另有一处**有意偏离稿面**(用户 2026-09-22 拍板):稿面把 7 个渠道全摊开,
 * 实现里只有 mTrip 钱包能真扣款,其余 6 个收进默认折叠区。
 *
 * ⚠ 源码契约断言,不是执行结果 —— client-app 没有测试框架(无 jest / render harness)。
 * 取数与渲染的真值仍需真机/Web 冒烟。
 *
 * 用法:powershell -Command "node scripts/check-booking-steps-34.cjs"
 * 退出码:0 = GREEN,1 = RED
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...p) => path.join(ROOT, ...p);

const SCREEN = at('client-app/src/screens/hotel/HotelBookingScreen.tsx');
const WIZARD = at('client-app/src/screens/hotel/useBookingWizard.ts');
const REVIEW = at('client-app/src/components/hotel/booking/ReviewBody.tsx');
const PAYMENT = at('client-app/src/components/hotel/booking/BookingStepPayment.tsx');
const CARDS = at('client-app/src/components/hotel/booking/ReviewCards.tsx');
const BAR = at('client-app/src/components/hotel/booking/BookingBottomBar.tsx');
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
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
};
/** 去注释再做否定断言 —— 否则会命中解释性注释里的那个词 */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const leaves = (v, p = '') =>
  v === null || typeof v !== 'object' || Array.isArray(v)
    ? [p]
    : Object.entries(v).flatMap(([k, c]) => leaves(c, p === '' ? k : `${p}.${k}`));

const screen = read(SCREEN);
const wizard = read(WIZARD);
const review = read(REVIEW);
const payment = read(PAYMENT);
const cards = read(CARDS);
const bar = read(BAR);
check('四个源文件都在', [screen, wizard, review, payment].every((x) => x !== ''));

// ===================================================== 第 3 步:Add More Stay ====
{
  const body = strip(cards);
  /* 稿面每个变体只有一枚 plus:compact 一枚、整卡一枚,合计 2 处 */
  const plusIcons = (body.match(/name="plus"/gu) ?? []).length;
  check('AddMoreStayCard 两个变体各一枚 plus 图标', plusIcons === 2, `${plusIcons} 处`);
}

// ====================================================== 第 3 步:不再有券行 ====
{
  const body = strip(review);
  check('ReviewBody 不再接收 coupon prop', !/coupon\?:/u.test(body));
  check('ReviewBody 不再引用任何券文案', !/hotels\.booking\.coupon/u.test(body));
  check('ReviewBody 合计就是明细合计(不再扣券)', /const payable = stayTotal;/u.test(body));
  check('ReviewCouponState 已删除(无人引用的死类型)', !/ReviewCouponState/u.test(review));

  const s = strip(screen);
  const reviewBlock = s.slice(s.indexOf("case 'review'"), s.indexOf("case 'trip'"));
  check('复核步不再往 ReviewBody 传 coupon', !/coupon=\{/u.test(reviewBlock));
}

// ======================================================== 第 4 步:券挪过来 ====
{
  const s = strip(screen);
  const payBlock = s.slice(s.indexOf("case 'payment'"));
  check('支付步把 coupon 传给 BookingStepPayment', /coupon=\{[\s\S]{0,200}couponEnabled/u.test(payBlock));

  const body = strip(payment);
  check('BookingStepPayment 声明 coupon prop', /coupon\?: PaymentCouponState;/u.test(body));
  check('COUPONS 卡点按打开选券弹窗(不再是 comingSoon 占位)', /coupon\?\.onOpen \?\? onComingSoon/u.test(body));
  check('券卡副标题三态(已用券/加载中/有券/无券)', /couponDesc = \(\(\) => \{/u.test(body) && /coupon\.applied\) return coupon\.applied\.name/u.test(body));
  check('没有可用券时整卡不可点', /const couponDisabled = /u.test(body) && /disabled=\{couponDisabled\}/u.test(body));
  check('已用券时右侧显示抵扣额', /coupon\?\.applied \?[\s\S]{0,200}couponSaved/u.test(body));
  /* 不传 coupon 的调用方(演示/关怀/未登录)必须维持原行为 */
  check('不传 coupon 时维持占位行为', /if \(!coupon\) return t\('hotels\.booking\.payment\.couponsDesc'\)/u.test(body));
}

// ================================================ 第 4 步:未开放渠道折叠起来 ====
{
  const body = strip(payment);
  check('折叠区默认收起', /useState\(false\)/u.test(body));
  check('折叠头有标题 + 说明 + 可翻转的箭头', /payment\.moreMethods'/u.test(body) && /payment\.moreMethodsDesc'/u.test(body) && /chevronUp/u.test(body));

  /* 钱包是唯一能真扣款的渠道:必须在折叠区**之外**常驻 */
  const walletAt = body.indexOf("methods.wallet.title");
  const foldAt = body.indexOf('{moreOpen ? (');
  check('钱包行在折叠区之外(常驻可选)', walletAt > 0 && foldAt > 0 && walletAt < foldAt);
  check('Popular 三个渠道在折叠区之内', body.indexOf('PAYMENT_POPULAR.map') > foldAt);
  check('到店付/银行卡/手机银行也在折叠区之内',
    body.indexOf("PAYMENT_OTHER.filter") > foldAt
    && body.indexOf("methods.card.title") > foldAt
    && body.indexOf('methods.mobileBanking.title') > foldAt);
  check('折叠区里排除了钱包(免得重复渲染)', /PAYMENT_OTHER\.filter\(\(key\) => key !== 'wallet'\)/u.test(body));
}

// ====================================================== 吸底两枚按钮等大 ====
/**
 * 稿面 step4 footer `718:3358`:Back `718:3360` 与 Pay Now `718:3364` **都是 167x52**。
 * 之前右按钮偏大是因为照搬了稿面的 px40 —— 167 宽减去 40x2 只剩 87,
 * 而内容(Pay Now 60 + gap 8 + 箭头 20)就有 88,390/360 的真机上必然换行、把右按钮顶高。
 */
{
  const body = strip(bar);
  /** 取具名样式块(花括号配对扫描,正则配对会跨块吞内容) */
  const blockOf = (name) => {
    const i = body.indexOf(`\n  ${name}: {`);
    if (i === -1) return '';
    const start = body.indexOf('{', i + 3);
    let depth = 0;
    for (let end = start; end < body.length; end += 1) {
      if (body[end] === '{') depth += 1;
      else if (body[end] === '}') {
        depth -= 1;
        if (depth === 0) return body.slice(start, end + 1);
      }
    }
    return '';
  };

  check('两枚按钮都定高 52(稿面 167x52)', /height: 52/u.test(blockOf('backBtn')) && /height: 52/u.test(blockOf('primaryBtn')));
  check('两枚按钮走同一个 stretch(flex:1 均分)', /flex: 1/u.test(blockOf('stretch')) && (body.match(/styles\.stretch/gu) ?? []).length === 2);
  check('拉伸态内边距收到 16(不照搬稿面 px40,否则窄屏换行)', /paddingHorizontal: 16/u.test(blockOf('stretch')));
  check('price 变体仍用稿面 px40(内容宽按钮,宽度靠它)', /paddingHorizontal: 40/u.test(blockOf('primaryBtn')));
  check('两枚按钮文案都不换行', (body.match(/numberOfLines=\{1\}/gu) ?? []).length === 2);
  check('文案可收缩(挤不下走省略号,不顶高按钮)', /flexShrink: 1/u.test(blockOf('backText')) && /flexShrink: 1/u.test(blockOf('primaryText')));
  /* 稿面 718:3365 可见、Back 的 718:3361 是 hidden —— 投影只给主按钮 */
  check('投影只给主按钮', /shadows\.raised/u.test(blockOf('primaryBtn')) && !/shadows\./u.test(blockOf('backBtn')));
}

// ============================================================== 吸底按钮 ====
{
  const body = strip(wizard);
  check('复核步按钮叫 Continue(addToTrip 分支已删)', !/addToTrip/u.test(body));
  check('支付步按钮叫 Pay Now', /if \(step === 'payment'\) return t\('hotels\.booking\.payNow'\)/u.test(body));
  check('结算步仍叫 Check Out', /if \(step === 'trip'\) return t\('hotels\.booking\.checkOut'\)/u.test(body));
  /* 稿面 Continue(718:3354)与 Pay Now(718:3367)都带右箭头,只有 Check Out 没有 */
  check('只有 Check Out 不带右箭头', /primaryArrow=\{step !== 'trip'\}/u.test(strip(screen)));
}

// ================================================================== i18n ====
{
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(read(file)) }));
  for (const { name, tree } of trees) {
    const b = tree.hotels.booking;
    /* 按钮本身画了 plus 图标,文案里不能再带一个「+」,否则就是两个加号 */
    check(`${name} addHotel 文案不含字面加号`, !b.review.addHotel.includes('+'), JSON.stringify(b.review.addHotel));
    check(`${name} 有 payNow`, typeof b.payNow === 'string' && b.payNow.length > 0);
    check(`${name} 有折叠区两条文案`, typeof b.payment.moreMethods === 'string' && typeof b.payment.moreMethodsDesc === 'string');
    check(`${name} addToTrip 已清掉`, b.addToTrip === undefined);
  }
  const sets = trees.map(({ tree }) => new Set(leaves(tree)));
  const extra = (a, b) => [...a].filter((k) => !b.has(k));
  check('三份 i18n 键集零差异',
    extra(sets[0], sets[1]).length === 0 && extra(sets[1], sets[0]).length === 0
    && extra(sets[0], sets[2]).length === 0 && extra(sets[2], sets[0]).length === 0,
    `${sets[0].size} 键`);
}

// ================================================================ summary ====
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((r) => r.label).join(' | ')}`);
  process.exit(1);
}
