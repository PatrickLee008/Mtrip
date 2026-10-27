<?php

declare(strict_types=1);

/**
 * 业务方落账纯规则单测(方案 22 阶段 5):支付窗口解析、onPaid 分支判定、超时前置查单判定、
 * 迟到退款金额拆分、KBZ 退款合并提交 / 次数配额 / 阻塞判定,以及 PaymentCenterClient::availableChannels /
 * refundQuota 的请求与解包。
 */

use Mtrip\Shared\Payment\PaymentCenterClient;
use Mtrip\Shared\Payment\SettleRules;

/** 预订状态构造:默认待支付 */
function settleBooking(array $over = []): array
{
    return $over + [
        'orderStatus' => 0,
        'bookingStatus' => SettleRules::BOOKING_PENDING_PAYMENT,
        'paymentStatus' => SettleRules::PAY_PENDING,
        'payMethod' => 5,
        'payTradeNo' => 'P261027080910123456',
        'expiryCancelled' => false,
    ];
}

const SETTLE_PAY_NO = 'P261027080910123456';

MiniTest::add('落账规则:支付窗口 站点 → 全局 → 默认 30,范围 1–1440', static function (): void {
    MiniTest::assertSame(45, SettleRules::windowMinutes('45', '20'));
    MiniTest::assertSame(20, SettleRules::windowMinutes('', '20'), '站点空串视为未覆盖');
    MiniTest::assertSame(20, SettleRules::windowMinutes(null, '20'));
    MiniTest::assertSame(20, SettleRules::windowMinutes('0', '20'), '0 非正整数');
    MiniTest::assertSame(20, SettleRules::windowMinutes('-5', '20'));
    MiniTest::assertSame(20, SettleRules::windowMinutes('12.5', '20'), '小数不认');
    MiniTest::assertSame(20, SettleRules::windowMinutes('abc', ' 20 '), '全局值允许首尾空白');
    MiniTest::assertSame(30, SettleRules::windowMinutes(null, null));
    MiniTest::assertSame(30, SettleRules::windowMinutes('', 'x'));
    MiniTest::assertSame(1440, SettleRules::windowMinutes('99999', '20'), '超上限按上限');
    MiniTest::assertSame(1, SettleRules::windowMinutes('1', null));
    MiniTest::assertSame(15, SettleRules::windowMinutes(15, null), '整型同样接受');
    MiniTest::assertSame(null, SettleRules::parseWindowMinutes(''));
    MiniTest::assertSame(null, SettleRules::parseWindowMinutes(true));
});

MiniTest::add('落账规则:onPaid 正常确认 / 已处理', static function (): void {
    $d = SettleRules::decidePaid([settleBooking()], SETTLE_PAY_NO, true);
    MiniTest::assertSame(SettleRules::ACTION_CONFIRM, $d['action']);
    // 支付失败标记过的待支付单仍可确认
    $d = SettleRules::decidePaid([settleBooking(['paymentStatus' => SettleRules::PAY_FAILED])], SETTLE_PAY_NO, true);
    MiniTest::assertSame(SettleRules::ACTION_CONFIRM, $d['action']);
    // Trip:全部待支付且主单待付
    $d = SettleRules::decidePaid([settleBooking(), settleBooking()], SETTLE_PAY_NO, true, 0);
    MiniTest::assertSame(SettleRules::ACTION_CONFIRM, $d['action']);
    // 已由本 payNo 落账(含之后部分退 / 全退)→ 幂等
    $paid = settleBooking(['orderStatus' => 1, 'bookingStatus' => 2, 'paymentStatus' => SettleRules::PAY_PAID]);
    MiniTest::assertSame(SettleRules::ACTION_ALREADY, SettleRules::decidePaid([$paid], SETTLE_PAY_NO, true)['action']);
    $refunded = settleBooking(['orderStatus' => 6, 'bookingStatus' => 5, 'paymentStatus' => SettleRules::PAY_REFUNDED]);
    MiniTest::assertSame(SettleRules::ACTION_ALREADY, SettleRules::decidePaid([$refunded], SETTLE_PAY_NO, false)['action'], '已处理优先于金额判定');
});

MiniTest::add('落账规则:onPaid 超时取消 → 恢复', static function (): void {
    $expired = settleBooking(['orderStatus' => 4, 'bookingStatus' => SettleRules::BOOKING_CANCELLED, 'expiryCancelled' => true]);
    MiniTest::assertSame(SettleRules::ACTION_RECOVER, SettleRules::decidePaid([$expired], SETTLE_PAY_NO, true)['action']);
    MiniTest::assertSame(SettleRules::ACTION_RECOVER, SettleRules::decidePaid([$expired, $expired], SETTLE_PAY_NO, true, 2)['action'], 'Trip 整单超时关闭');
    // Trip 主单不是已取消(数据不一致)→ 不恢复
    MiniTest::assertSame(SettleRules::ACTION_REFUND, SettleRules::decidePaid([$expired], SETTLE_PAY_NO, true, 1)['action']);
});

MiniTest::add('落账规则:onPaid 不可入账 → 退款(含原因)', static function (): void {
    $userCancelled = settleBooking(['orderStatus' => 4, 'bookingStatus' => SettleRules::BOOKING_CANCELLED]);
    $d = SettleRules::decidePaid([$userCancelled], SETTLE_PAY_NO, true);
    MiniTest::assertSame(SettleRules::ACTION_REFUND, $d['action']);
    MiniTest::assertSame('cancelled', $d['reason']);
    // Trip 一部分超时取消、一部分用户取消 → 不能只恢复一部分
    $expired = settleBooking(['orderStatus' => 4, 'bookingStatus' => SettleRules::BOOKING_CANCELLED, 'expiryCancelled' => true]);
    MiniTest::assertSame(SettleRules::ACTION_REFUND, SettleRules::decidePaid([$expired, $userCancelled], SETTLE_PAY_NO, true, 2)['action']);
    // 已被余额支付(另一交易号)→ 重复支付退款
    $wallet = settleBooking(['orderStatus' => 1, 'bookingStatus' => 2, 'paymentStatus' => SettleRules::PAY_PAID, 'payMethod' => 3, 'payTradeNo' => 'WALLETF1']);
    $d = SettleRules::decidePaid([$wallet], SETTLE_PAY_NO, true);
    MiniTest::assertSame(SettleRules::ACTION_REFUND, $d['action']);
    MiniTest::assertSame('other_state', $d['reason']);
    // 另一个 payNo 已落账 → 本笔退款
    $other = settleBooking(['orderStatus' => 1, 'bookingStatus' => 2, 'paymentStatus' => SettleRules::PAY_PAID, 'payTradeNo' => 'P261027080910999999']);
    MiniTest::assertSame(SettleRules::ACTION_REFUND, SettleRules::decidePaid([$other], SETTLE_PAY_NO, true)['action']);
    // 金额不符(如改价后付了旧码)
    $d = SettleRules::decidePaid([settleBooking()], SETTLE_PAY_NO, false);
    MiniTest::assertSame('amount_mismatch', $d['reason']);
    // 业务单不存在
    MiniTest::assertSame('target_missing', SettleRules::decidePaid([], SETTLE_PAY_NO, true)['reason']);
    // 混合:一笔待支付一笔已取消
    MiniTest::assertSame(SettleRules::ACTION_REFUND, SettleRules::decidePaid([settleBooking(), $userCancelled], SETTLE_PAY_NO, true, 0)['action']);
});

MiniTest::add('落账规则:超时前置查单判定', static function (): void {
    $exp = 1_800_000_000;
    MiniTest::assertSame(SettleRules::EXPIRY_SETTLE, SettleRules::expiryAction('paid', false, $exp, $exp + 60));
    MiniTest::assertSame(SettleRules::EXPIRY_SETTLE, SettleRules::expiryAction('late', false, $exp, $exp + 99999));
    MiniTest::assertSame(SettleRules::EXPIRY_DEFER, SettleRules::expiryAction('pending', false, $exp, $exp + 60));
    MiniTest::assertSame(SettleRules::EXPIRY_CANCEL, SettleRules::expiryAction('pending', false, $exp, $exp + SettleRules::EXPIRY_GRACE_SECONDS));
    MiniTest::assertSame(SettleRules::EXPIRY_DEFER, SettleRules::expiryAction(null, true, $exp, $exp + 60), '支付中心不可用:宽限内不取消');
    MiniTest::assertSame(SettleRules::EXPIRY_CANCEL, SettleRules::expiryAction(null, true, $exp, $exp + 1801), '超过宽限照常取消');
    MiniTest::assertSame(SettleRules::EXPIRY_CANCEL, SettleRules::expiryAction('closed', false, $exp, $exp + 60));
    MiniTest::assertSame(SettleRules::EXPIRY_CANCEL, SettleRules::expiryAction('failed', false, $exp, $exp + 60));
    MiniTest::assertSame(SettleRules::EXPIRY_CANCEL, SettleRules::expiryAction(null, false, $exp, $exp + 60), '无流水');
});

MiniTest::add('落账规则:迟到退款金额拆分', static function (): void {
    MiniTest::assertSame([1000, 2001], SettleRules::splitCents(3001, [1000, 2000]), '末条吸收差额');
    MiniTest::assertSame([1000, 500], SettleRules::splitCents(1500, [1000, 2000]));
    MiniTest::assertSame([800, 0], SettleRules::splitCents(800, [1000, 2000]), '实收不足时不出现负数');
    MiniTest::assertSame([5000], SettleRules::splitCents(5000, [4999]));
    MiniTest::assertSame([], SettleRules::splitCents(5000, []));
});

MiniTest::add('KBZ 退款:立即提交 / 排队合并判定', static function (): void {
    MiniTest::assertSame(true, SettleRules::submitImmediately(false, false), '独立单支付立即提交');
    MiniTest::assertSame(false, SettleRules::submitImmediately(false, true), '行程支付排队合并');
    MiniTest::assertSame(true, SettleRules::submitImmediately(true, true), '迟到支付退款始终立即提交');
    MiniTest::assertSame(true, SettleRules::submitImmediately(true, false));
});

MiniTest::add('KBZ 退款:到期批次按 pay_no 分组,最早排队行到期才整组提交', static function (): void {
    $now = 1_800_000_000;
    $p1 = 'P261027080910000001';
    $p2 = 'P261027080910000002';
    $p3 = 'P261027080910000003';
    $rows = [
        ['id' => 5, 'payNo' => $p1, 'queuedAt' => $now - 30],      // 新加入的行跟随同组旧行一起提交
        ['id' => 3, 'payNo' => $p1, 'queuedAt' => $now - 300],     // 恰好满窗口
        ['id' => 4, 'payNo' => $p2, 'queuedAt' => $now - 299],     // 未到期
        ['id' => 6, 'payNo' => $p3, 'queuedAt' => $now - 10, 'latePay' => true], // 迟到退款不等窗口
        ['id' => 7, 'payNo' => 'bad', 'queuedAt' => null],         // 非法单号忽略
    ];
    $batches = SettleRules::dueRefundBatches($rows, $now, 300);
    MiniTest::assertSame([$p1 => [3, 5], $p3 => [6]], $batches);
    MiniTest::assertSame([$p2 => [4]], SettleRules::dueRefundBatches([['id' => 4, 'payNo' => $p2, 'queuedAt' => null]], $now, 300), '排队时间缺失视为到期');
    MiniTest::assertSame([$p2 => [4]], SettleRules::dueRefundBatches([$rows[2]], $now, 0), '窗口 0 = 立即');
    MiniTest::assertSame([], SettleRules::dueRefundBatches([], $now));
});

MiniTest::add('KBZ 退款:次数配额 → 渠道 / 钱包;KBZ 退款识别;阻塞判定', static function (): void {
    MiniTest::assertSame(3, \Mtrip\Shared\Payment\PaymentRules::MAX_REFUND_TIMES);
    MiniTest::assertSame(SettleRules::ROUTE_CHANNEL, SettleRules::refundRoute(0));
    MiniTest::assertSame(SettleRules::ROUTE_CHANNEL, SettleRules::refundRoute(2));
    MiniTest::assertSame(SettleRules::ROUTE_WALLET, SettleRules::refundRoute(3), '已用 3 次(成功 + 处理中)改退钱包');
    MiniTest::assertSame(SettleRules::ROUTE_WALLET, SettleRules::refundRoute(4));

    MiniTest::assertSame(true, SettleRules::isChannelRefund(true, 1, 3), '迟到退款单一律走渠道');
    MiniTest::assertSame(true, SettleRules::isChannelRefund(false, 2, 5));
    MiniTest::assertSame(false, SettleRules::isChannelRefund(false, 1, 5), 'KBZ 订单但退钱包');
    MiniTest::assertSame(false, SettleRules::isChannelRefund(false, 2, 1), '非 KBZ 订单的人工原路退回');

    MiniTest::assertSame(false, SettleRules::hasBlockingRefund([]));
    MiniTest::assertSame(false, SettleRules::hasBlockingRefund([['status' => 2, 'late_pay' => 1]]), '迟到退款处理中不阻塞');
    MiniTest::assertSame(false, SettleRules::hasBlockingRefund([['status' => 3, 'late_pay' => 0], ['status' => 4, 'late_pay' => 0]]));
    MiniTest::assertSame(true, SettleRules::hasBlockingRefund([['status' => 2, 'late_pay' => 1], ['status' => '1', 'late_pay' => '0']]));
    MiniTest::assertSame(true, SettleRules::hasBlockingRefund([['status' => 0]]), '缺 late_pay 视为普通退款单');
});

MiniTest::add('支付中心客户端:refundQuota 透传 refundCount / refundedAmount,缺字段按 0', static function (): void {
    $make = static fn (array $data) => new class(['status' => 200, 'body' => (string) json_encode(['code' => 0, 'message' => 'success', 'data' => $data])]) extends PaymentCenterClient {
        public array $requests = [];

        public function __construct(private array $response)
        {
            parent::__construct('http://pay.test:9508', 'tok');
        }

        protected function httpPost(string $url, string $json, array $headers): array
        {
            $this->requests[] = ['url' => $url, 'json' => $json];
            return $this->response;
        }
    };
    $client = $make(['payNo' => SETTLE_PAY_NO, 'status' => 'paid', 'amount' => '30000.00', 'refundCount' => 2, 'refundedAmount' => '12000.50']);
    $q = $client->refundQuota(SETTLE_PAY_NO);
    MiniTest::assertSame('http://pay.test:9508/internal/v1/payment/query', $client->requests[0]['url']);
    MiniTest::assertSame('{"payNo":"' . SETTLE_PAY_NO . '"}', $client->requests[0]['json'], '不带 refresh,不触发渠道查单');
    MiniTest::assertSame(['refundCount' => 2, 'refundedCents' => 1200050, 'paidCents' => 3000000, 'status' => 'paid'], $q);

    $legacy = $make(['payNo' => SETTLE_PAY_NO, 'status' => 'paid', 'amount' => '100']);
    MiniTest::assertSame(['refundCount' => 0, 'refundedCents' => 0, 'paidCents' => 10000, 'status' => 'paid'], $legacy->refundQuota(SETTLE_PAY_NO));
});

MiniTest::add('支付中心客户端:availableChannels 路径 / 入参 / 列表解包', static function (): void {
    $body = json_encode(['code' => 0, 'message' => 'success', 'data' => [
        ['channel' => 'kbz_mmqr', 'currencies' => ['MMK'], 'minAmount' => '0.00', 'maxAmount' => '0.00'],
    ]]);
    $client = new class(['status' => 200, 'body' => (string) $body]) extends PaymentCenterClient {
        public array $requests = [];

        public function __construct(private array $response)
        {
            parent::__construct('http://pay.test:9508', 'tok');
        }

        protected function httpPost(string $url, string $json, array $headers): array
        {
            $this->requests[] = ['url' => $url, 'json' => $json];
            return $this->response;
        }
    };
    $list = $client->availableChannels(12);
    MiniTest::assertSame('http://pay.test:9508/internal/v1/channel/available', $client->requests[0]['url']);
    MiniTest::assertSame('{"siteId":12}', $client->requests[0]['json']);
    MiniTest::assertSame('kbz_mmqr', $list[0]['channel']);
    MiniTest::assertSame(['MMK'], $list[0]['currencies']);

    $empty = new class(['status' => 200, 'body' => '{"code":0,"message":"success","data":[]}']) extends PaymentCenterClient {
        public function __construct(private array $response)
        {
            parent::__construct('http://pay.test:9508', 'tok');
        }

        protected function httpPost(string $url, string $json, array $headers): array
        {
            return $this->response;
        }
    };
    MiniTest::assertSame([], $empty->availableChannels(1));
});
