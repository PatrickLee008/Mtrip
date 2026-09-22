#!/usr/bin/env node
/**
 * 设计契约校验:取消预订流程(退款摘要 → 取消原因 → 取消成功)
 *
 * 依据:Figma M-Trip `1205:2159`(Cancel Booking 退款摘要)/ `1205:2480`(Cancel Booking2 取消原因)
 *       / `572:4670`(Cancel Booking3 = Review Cancellation 最终确认)
 *       / `1205:2679`(Cancel Booking4 取消成功)/ `1685:3429`(Booking Cancelled by Merchant)。
 * 规则依据 PRD(`docs/reference/ConsumerApp_PRD_v1.0.1_提取文本.txt`):
 *   line 110/142/145 —— 取消粒度是**单个 booking**,只退那一单,同 Trip 其余不受影响
 *   line 708-712     —— 取消页须显示 Cancellation Fee / Refund Amount,且**提交前必须选一条原因**
 *   line 723 / 865   —— 只退 mTrip 钱包
 *   line 851-871     —— 结账不收平台费,**取消时**才从可退额里扣
 *
 * ⚠️ 源码契约断言,不是执行结果(client-app 无测试框架)。真值仍需真机/Web 冒烟。
 *
 * 用法:powershell -Command "node scripts/check-cancel-flow.cjs"
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...p) => path.join(ROOT, ...p);

const CANCEL = at('client-app/src/screens/order/CancelBookingScreen.tsx');
const DONE = at('client-app/src/screens/order/BookingCancelledScreen.tsx');
const CARD = at('client-app/src/components/order/BookingSummaryCard.tsx');
const API = at('client-app/src/api/order.ts');
const DETAIL = at('client-app/src/screens/order/BookingDetailScreen.tsx');
const NAV = at('client-app/src/navigation/index.tsx');
const NAV_TYPES = at('client-app/src/navigation/types.ts');
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
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

// ===================================================== PRD 规则(硬要求)====
{
  const cancel = read(CANCEL);
  const body = strip(cancel);
  check('CancelBookingScreen.tsx 存在', cancel !== '');
  /* PRD line 110/142/145:取消粒度是单个 booking */
  check('取消粒度 = 单个 booking(路由只收一个 orderId)', /CancelBooking: \{ orderId: number \};/u.test(read(NAV_TYPES)));
  check('页面不碰 Trip(不会把同 Trip 其他预订一起取消)', !/tripId|fetchTripDetail/u.test(body));
  /* PRD line 711-712:提交前必须选一条原因 */
  check('未选原因时提交按钮禁用', /disabled=\{!reason \|\| submitting\}/u.test(cancel));
  check('提交入口也再判一次(防止绕过)', /if \(!reason \|\| submitting\) return;/u.test(cancel));
  check('原因按稿面 5 条', (cancel.match(/\{ key: '\w+', value: '/gu) ?? []).length === 5);
  /* PRD line 708:取消页要显示取消费与退款额;金额一律服务端给 */
  check('取消费/退款额来自服务端试算(前端不自己算)', /fetchRefundQuote\(orderId\)/u.test(body) && !/payAmount \* /u.test(body));
  check('展示取消费与退款额两行', /order\.cancel\.cancellationFee/u.test(cancel) && /order\.cancel\.refundAmount/u.test(cancel));
  /* PRD line 851-871:平台费在取消时才扣,且要能看见 */
  check('平台费 > 0 时单列一行', /quote\.platformFee > 0 \?/u.test(cancel));
  /* PRD line 723/865:只退 mTrip 钱包 */
  check('退款去向写明 mTrip 钱包', /order\.cancel\.refundMethodDesc/u.test(cancel));
  check('提交走退款申请接口', /applyRefund\(\{ orderId, reason: text \}\)/u.test(cancel));
  /* PRD line 1385「confirmation modal」:真正扣款前必须有一次不可撤销确认(`572:4670`) */
  check('三步:摘要 → 原因 → 确认', /'summary' \| 'reason' \| 'review'/u.test(cancel));
  check('原因步的 Continue 只进确认页,不提交', /onPress=\{\(\) => setStep\('review'\)\}/u.test(cancel));
  check('只有确认页的红色按钮才提交', /styles\.dangerBtn/u.test(cancel) && /onPress=\{\(\) => void submit\(\)\}/u.test(cancel));
  check('Final Notice 黄卡 #FFF9E6 + 1px #FFD666 + #856404 文字', /#FFF9E6/u.test(cancel) && /#FFD666/u.test(cancel) && /#856404/u.test(cancel));
  check('确认按钮是 --tertiary 红底', /backgroundColor: colors\.hot/u.test(cancel));
  /* `1685:3312`:原因步带备注框,备注拼进 reason 一起提交(后端没有单独的备注字段) */
  check('原因步有 Additional Comments 输入框', /order\.cancel\.commentsLabel/u.test(cancel) && /<TextInput/u.test(cancel));
  check('备注拼进 reason 提交', /\$\{reason\} - \$\{comments\.trim\(\)\}/u.test(cancel));
  check('提交成功后 replace 到结果页(不留在取消流程里)', /navigation\.replace\('BookingCancelled'/u.test(cancel));
}

// ============================================================ 稿面规格 ====
{
  const cancel = read(CANCEL);
  const b = (n) => styleBlocks(cancel).get(n) ?? '';
  check('Main px16 gap32', /paddingHorizontal: PAGE_PADDING/u.test(b('main')) && /gap: 32/u.test(b('main')));
  check('截止卡:左 4px --tertiary + rgba(255,218,214,.2) + 圆角24 + pl28/pr24/py24',
    /borderLeftWidth: 4/u.test(b('deadline')) && /colors\.hot/u.test(b('deadline')) &&
    /rgba\(255, 218, 214, 0\.2\)/u.test(b('deadline')) && /paddingLeft: 28/u.test(b('deadline')));
  check('截止卡只在有取消费时出现', /quote\.cancellationFee > 0 \?/u.test(cancel));
  check('退款卡 p25 圆角24 1px --secondary', /padding: 25/u.test(b('refundCard')) && /borderRadius: 24/u.test(b('refundCard')) && /colors\.softBlue/u.test(b('refundCard')));
  check('退款卡标题大写 Inter 600/20', /textTransform: 'uppercase'/u.test(b('refundTitle')) && /fontSize: 20/u.test(b('refundTitle')));
  check('取消费为红字 #BA1A1A', /#BA1A1A/u.test(b('rowValueDanger')));
  check('分隔线 rgba(196,197,215,.3)', /rgba\(196, 197, 215, 0\.3\)/u.test(b('refundDivider')));
  check('合计行 18/27 + 金额 20/30 主色', /fontSize: 18/u.test(b('totalLabel')) && /fontSize: 20/u.test(b('totalValue')) && /colors\.primary/u.test(b('totalValue')));
  check('两张 #ECF5FE 圆角20 提示块', /#ECF5FE/u.test(b('note')) && /borderRadius: 20/u.test(b('note')));
  check('主按钮整宽主色 + 次按钮 1px 主色描边(字 #204DDA)', /colors\.primary/u.test(b('primaryBtn')) && /#204DDA/u.test(b('ghostBtnText')));
  check('Need help 尾巴带下划线主色链接', /textDecorationLine: 'underline'/u.test(b('helpLink')));
  /* 原因步 */
  check('原因卡 p16 圆角16 白底', /padding: 16/u.test(b('reasonRow')) && /borderRadius: 16/u.test(b('reasonRow')));
  check('20 方勾选框,选中主色', /width: 20/u.test(b('checkbox')) && /colors\.primary/u.test(b('checkboxDot')));
  check('政策提示卡 #DDE5FF + 左 4px 主色', /#DDE5FF/u.test(b('policyCard')) && /borderLeftWidth: 4/u.test(b('policyCard')));
  check('原因步吸底 Back / Continue', /styles\.backBtn/u.test(cancel) && /styles\.continueBtn/u.test(cancel));
  check('顶栏声明在 ScrollView 之后', strip(cancel).lastIndexOf('styles.topBar') > strip(cancel).lastIndexOf('</ScrollView>'));
}

// ============================================================ 结果页 ====
{
  const done = read(DONE);
  const b = (n) => styleBlocks(done).get(n) ?? '';
  check('BookingCancelledScreen.tsx 存在', done !== '');
  check('结果头 64 圆 + 主色 10% 底', /width: 64/u.test(b('iconWrap')) && /rgba\(65, 105, 237, 0\.1\)/u.test(b('iconWrap')));
  check('标题 Inter 700 24/32 居中', /interBold/u.test(b('title')) && /fontSize: 24/u.test(b('title')) && /textAlign: 'center'/u.test(b('title')));
  check('CONFIRMED REFUND 小标题 12 tracking .6 大写', /fontSize: 12/u.test(b('refundLabel')) && /letterSpacing: 0\.6/u.test(b('refundLabel')) && /textTransform: 'uppercase'/u.test(b('refundLabel')));
  check('退款额 20/30 主色', /fontSize: 20/u.test(b('amountValue')) && /colors\.primary/u.test(b('amountValue')));
  check('显示退款单号', /order\.cancelled\.transactionRef/u.test(done) && /refundNo/u.test(done));
  check('两枚按钮:回我的预订 / 重新预订', /order\.cancelled\.backToBookings/u.test(done) && /order\.cancelled\.startNew/u.test(done));
  /* 取消流程走完不该还能退回去(与预订成功页同一处理) */
  check('用 reset 收尾,不留取消流程在栈里', /navigation\.reset\(/u.test(done) && !/navigation\.goBack\(\)/u.test(strip(done)));
  /* 否定断言必须先剥注释 —— 否则会命中文件头里「为什么不渲染那张营销卡」的说明 */
  check('营销图卡未凭空造(稿面那张没有数据源)', !/VOYAGE|voyage/u.test(strip(done)));

  /* 商户取消(`1685:3429`)是同一页的另一态,不是第二个页面 */
  check('商户取消:标题/顶栏/说明三处按态切换', /order\.cancelled\.merchantTitle/u.test(done) && /order\.cancelled\.detailsTitle/u.test(done) && /order\.cancelled\.merchantDesc/u.test(done));
  check('商户取消判定来自 operatorType === 2(不是前端猜)', /cancelInfo\?\.operatorType === 2/u.test(done));
  check('商户取消才渲染黄色 Cancel Reason 卡,且原因为空不渲染', /byMerchant && cancelReason \?/u.test(done));
  check('只给 orderId 时自己拉详情', /fetchOrderDetail\(p\.orderId\)/u.test(done));
  check('后端在已取消单上附 cancelInfo', /'cancelInfo'\] = \[/u.test(read(ORDER_CTRL)) && /'operatorType' =>/u.test(read(ORDER_CTRL)));
  check('我的预订:已取消的单进取消详情', /b\.status === ORDER_STATUS\.CANCELLED/u.test(read(at('client-app/src/screens/mypick/MyPickScreen.tsx'))));
}

// ============================================================ 接线 ====
{
  const api = read(API);
  check('refund/quote 已上类型', /interface RefundQuote/u.test(api) && /fetchRefundQuote/u.test(api));
  check('后端 refundQuote 返回取消费/平台费/退款额', /'cancellationFee' =>/u.test(read(ORDER_CTRL)) && /'platformFee' =>/u.test(read(ORDER_CTRL)));
  check('详情页的 Cancel Booking 指向取消流程', /navigate\('CancelBooking', \{ orderId: order\.id \}\)/u.test(read(DETAIL)));
  check('两个路由都已注册且关掉 Stack 头', /name="CancelBooking"/u.test(read(NAV)) && /name="BookingCancelled"/u.test(read(NAV)));
  check('摘要卡两页共用', /BookingSummaryCard/u.test(read(CANCEL)) && /BookingSummaryCard/u.test(read(DONE)) && read(CARD) !== '');
}

// ================================================================ i18n ====
{
  const CANCEL_KEYS = ['title', 'deadlineTitle', 'deadlineDesc', 'bookingDetails', 'refundSummary',
    'originalAmount', 'cancellationFee', 'platformFee', 'refundAmount', 'refundMethod',
    'refundMethodDesc', 'refundTimeline', 'refundTimelineDesc', 'proceed', 'keep', 'needHelp',
    'contactSupport', 'reasonTitle', 'policyTitle', 'policyDesc', 'back', 'continue',
    'commentsLabel', 'commentsPlaceholder', 'reviewTitle', 'reviewDesc', 'refundNote',
    'finalNoticeTitle', 'finalNoticeDesc', 'confirm', 'terms'];
  const DONE_KEYS = ['title', 'desc', 'confirmedRefund', 'refundInitiated', 'transactionRef',
    'backToBookings', 'startNew', 'detailsTitle', 'merchantTitle', 'merchantDesc', 'cancelReason'];
  const REASONS = ['plans', 'dates', 'price', 'health', 'others'];
  const trees = LOCALES.map(({ name, file }) => ({ name, tree: JSON.parse(fs.readFileSync(file, 'utf8')) }));
  for (const { name, tree } of trees) {
    const c = tree.order.cancel ?? {};
    const d = tree.order.cancelled ?? {};
    check(`${name} order.cancel 齐全`, CANCEL_KEYS.every((k) => typeof c[k] === 'string'), CANCEL_KEYS.filter((k) => typeof c[k] !== 'string').join(',') || 'ok');
    check(`${name} 5 条取消原因齐全`, REASONS.every((k) => typeof (c.reasons ?? {})[k] === 'string'));
    check(`${name} order.cancelled 齐全`, DONE_KEYS.every((k) => typeof d[k] === 'string'), DONE_KEYS.filter((k) => typeof d[k] !== 'string').join(',') || 'ok');
  }
  const sets = trees.map(({ tree }) => new Set(leafPaths(tree)));
  const extra = (a, c) => [...a].filter((k) => !c.has(k));
  check('三份 i18n 键集零差异', extra(sets[0], sets[1]).length === 0 && extra(sets[1], sets[0]).length === 0 && extra(sets[0], sets[2]).length === 0 && extra(sets[2], sets[0]).length === 0, `${sets[0].size} 键`);
}

// =============================================================== summary ====
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((r) => r.label).join(' | ')}`);
  process.exit(1);
}
