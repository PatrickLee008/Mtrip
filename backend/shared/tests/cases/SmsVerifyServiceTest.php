<?php

declare(strict_types=1);

/**
 * SmsVerifyService 单测:渠道解析 / 场景前置校验 / 限流 / 发码 / 验码 / 票据兑换
 *
 * 全程不联网:SmsPohClient 由子类覆写 `client()` 注入假实现,
 * Redis 与 Db 用 bootstrap.php 里的桩。
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\RedisLock;
use Mtrip\Shared\Support\SmsPohClient;

// 两个服务都在 user-service,不在 shared 自动加载前缀内,直接引入源文件
require_once __DIR__ . '/../../../services/user-service/app/Service/UserAuthService.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/SmsVerifyService.php';

const SMS_TEST_AES_KEY = 'test-aes-key';
const SMS_TEST_MOBILE = '09771234567';

final class SmsTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function get(string $key, mixed $default = null): mixed
    {
        return [
            'mtrip.aes_key' => SMS_TEST_AES_KEY,
            'mtrip.jwt_secret' => 'test-jwt-secret',
        ][$key] ?? $default;
    }
}

/** 通用查询构造器替身:where/whereIn/whereNull/orderBy 全部返回自身,first/insert 返回预置值 */
final class SmsTestQuery
{
    public array $inserted = [];

    public function __construct(private mixed $row = null)
    {
    }

    public function where(string $column, mixed $value = null): static
    {
        return $this;
    }

    public function whereIn(string $column, array $values): static
    {
        return $this;
    }

    public function whereNull(string $column): static
    {
        return $this;
    }

    public function orderByDesc(string $column): static
    {
        return $this;
    }

    public function first(array $columns = ['*']): mixed
    {
        return $this->row;
    }

    public function insert(array $row): bool
    {
        $this->inserted[] = $row;
        return true;
    }

    public function update(array $row): int
    {
        return 1;
    }
}

/** 可注入假服务商客户端的被测服务 */
final class TestableSmsVerifyService extends App\Service\SmsVerifyService
{
    public ?FakeSmsPohClient $fake = null;

    /** 记录传给客户端的渠道配置,便于断言国家码等字段确实透传下去了 */
    public array $lastChannel = [];

    protected function client(array $channel): SmsPohClient
    {
        $this->lastChannel = $channel;
        if ($this->fake === null) {
            return new FakeSmsPohClient([0, '']);
        }
        // 把渠道国家码灌进同一个假客户端(不新建,否则 calledUrls 会散在多个对象上)
        $this->fake->useCountryCode((string) $channel['countryCode']);
        return $this->fake;
    }
}

/** 用例工具:装配服务 + 绑定 Db 表路由 */
final class SmsTestKit
{
    /** 一条配置完整、启用中的 smspoh 渠道 */
    public static function channelRow(array $override = []): object
    {
        return (object) array_merge([
            'id' => 7,
            'site_id' => 1,
            'provider_code' => 'smspoh',
            'api_key' => CryptoHelper::encrypt('THE-KEY', SMS_TEST_AES_KEY),
            'api_secret' => CryptoHelper::encrypt('THE-SECRET', SMS_TEST_AES_KEY),
            'sign_name' => 'MTrip',
            'brand_name' => 'mTrip',
            'country_code' => '95',
            'code_expire_sec' => 300,
            'pin_length' => 6,
            'max_invalid_attempts' => 5,
            'status' => 1,
        ], $override);
    }

    /**
     * @param object|null $channelRow sys_sms_channel 命中的行(null = 未配置渠道)
     * @param object|null $userRow    user_info 命中的行(null = 该手机号未注册)
     */
    public static function service(
        Hyperf\Redis\Redis $redis,
        ?object $channelRow,
        ?object $userRow = null,
    ): TestableSmsVerifyService {
        $config = new SmsTestConfig();
        Hyperf\DbConnection\Db::$tableResolver = static fn (string $table): object => new SmsTestQuery($userRow);
        Hyperf\DbConnection\Db::$connectionResolver = static function (string $conn, string $table) use ($channelRow, $userRow): object {
            return match ($table) {
                'sys_sms_channel' => new SmsTestQuery($channelRow),
                'sys_sms_log' => new SmsTestQuery(),
                default => new SmsTestQuery($userRow),
            };
        };
        return new TestableSmsVerifyService(
            $config,
            $redis,
            new RedisLock($redis),
            new App\Service\UserAuthService($config, new RedisLock($redis)),
        );
    }

    /** 发码成功的假服务商响应 */
    public static function sendOk(): FakeSmsPohClient
    {
        return new FakeSmsPohClient([201, '{"requestId":123456789,"expireAt":"2025-01-22 12:03:07"}']);
    }
}

MiniTest::add('SmsVerify:场景白名单只认 register/login/reset', static function (): void {
    foreach (App\Service\SmsVerifyService::SCENES as $scene) {
        MiniTest::assertSame($scene, App\Service\SmsVerifyService::assertScene($scene));
    }
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => App\Service\SmsVerifyService::assertScene('changeMobile'),
        ErrorCode::PARAM_ERROR,
        '未知场景'
    );
});

MiniTest::add('SmsVerify:没有渠道时视为未开通(注册不被卡住)', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), null);
    MiniTest::assertSame(null, $service->channel(1), '查不到渠道应返回 null');
    MiniTest::assertSame(false, $service->enabled(1), 'enabled=false 时 register 照旧放行');
});

MiniTest::add('SmsVerify:半配的渠道等于没配', static function (): void {
    // 只填了 API Key、没填 Secret —— 拼不出 accessToken,发出去必然 401,不如当没配
    $noSecret = SmsTestKit::channelRow(['api_secret' => '']);
    MiniTest::assertSame(null, SmsTestKit::service(new Hyperf\Redis\Redis(), $noSecret)->channel(1), '缺 api_secret');

    $noSender = SmsTestKit::channelRow(['sign_name' => '']);
    MiniTest::assertSame(null, SmsTestKit::service(new Hyperf\Redis\Redis(), $noSender)->channel(1), '缺 Sender ID');
});

MiniTest::add('SmsVerify:渠道参数按服务商上下限夹取', static function (): void {
    $wild = SmsTestKit::channelRow(['code_expire_sec' => 99999, 'pin_length' => 99, 'max_invalid_attempts' => 0]);
    $channel = SmsTestKit::service(new Hyperf\Redis\Redis(), $wild)->channel(1);

    MiniTest::assertSame(SmsPohClient::TTL_MAX, $channel['ttl'], 'ttl 上限 3600');
    MiniTest::assertSame(SmsPohClient::PIN_LENGTH_MAX, $channel['pinLength'], 'pinLength 上限 8');
    MiniTest::assertSame(SmsPohClient::ATTEMPTS_MIN, $channel['maxInvalidAttempts'], 'maxInvalidAttempts 下限 1');
    MiniTest::assertSame('THE-SECRET', $channel['apiSecret'], '密钥应已解密');
});

MiniTest::add('SmsVerify:brand 留空时回退 Sender ID', static function (): void {
    // brand 是 SMSPoh 的必填项,后台漏填不该让整条链路发不出去
    $channel = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow(['brand_name' => '']))->channel(1);
    MiniTest::assertSame('MTrip', $channel['brand'], 'brand 应回退 sign_name');
});

MiniTest::add('SmsVerify:注册场景向已注册号码发码被拒', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow(), (object) ['id' => 3, 'user_status' => 1]);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9'),
        ErrorCode::DATA_CONFLICT,
        '已注册号码不该再发注册验证码'
    );
});

MiniTest::add('SmsVerify:登录/重置场景向未注册号码发码被拒', static function (): void {
    foreach (['login', 'reset'] as $scene) {
        $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow(), null);
        MiniTest::assertThrows(
            BusinessException::class,
            static fn () => $service->send(1, SMS_TEST_MOBILE, $scene, '203.0.113.9'),
            ErrorCode::NOT_FOUND,
            "{$scene} 场景未注册号码"
        );
    }
});

MiniTest::add('SmsVerify:冻结账号不能用验证码登录', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow(), (object) ['id' => 3, 'user_status' => 2]);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'login', '203.0.113.9'),
        ErrorCode::FORBIDDEN,
        '冻结账号'
    );
});

MiniTest::add('SmsVerify:手机号格式不合法直接拒,不打服务商', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, '09-abc', 'register', '203.0.113.9'),
        ErrorCode::PARAM_ERROR
    );
    MiniTest::assertSame([], $service->fake->calledUrls, '格式不对不该浪费一条短信');
});

MiniTest::add('SmsVerify:未配置渠道时发码报"短信服务不可用"', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), null);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9'),
        ErrorCode::SMS_CHANNEL_UNAVAILABLE
    );
});

MiniTest::add('SmsVerify:发码成功后存下 requestId 并落冷却', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();

    $result = $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');

    MiniTest::assertSame(300, $result['expiresIn'], 'expiresIn = 渠道 ttl');
    MiniTest::assertSame(60, $result['resendAfter'], '重发冷却 60 秒');
    MiniTest::assertSame(6, $result['pinLength']);

    $otpKeys = array_values(array_filter(array_keys($redis->store), static fn ($k) => str_starts_with($k, 'mtrip:otp:req:')));
    MiniTest::assertSame(1, count($otpKeys), '应存下 1 条 requestId');
    MiniTest::assertSame('123456789', $redis->store[$otpKeys[0]], '存的是服务商返回的 requestId');
    // TTL 比验证码多 60 秒:让"刚过期"的用户拿到"已过期"而不是"请重新获取"
    MiniTest::assertSame(360, $redis->ttl[$otpKeys[0]]);

    $cooldown = array_values(array_filter(array_keys($redis->store), static fn ($k) => str_starts_with($k, 'mtrip:otp:cd:')));
    MiniTest::assertSame(1, count($cooldown), '应落一条重发冷却');
});

MiniTest::add('SmsVerify:出网号码按渠道国家码补成 E.164(线上踩过的坑)', static function (): void {
    /*
     * 用户在 App 里按占位符 `9xxxxxxxx` 填 `9971183240`(页面上的 +95 只是静态标签,不会拼进请求),
     * 直接发给 SMSPoh 会被拒:它只认 09xxxxxxxx / 959xxxxxxx / +959xxxxxx 三种前缀。
     * 这里锁死「库里存原样、出网补 E.164」这条边界。
     */
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();

    $service->send(1, '9971183240', 'register', '203.0.113.9');

    parse_str((string) parse_url($service->fake->calledUrls[0], PHP_URL_QUERY), $q);
    MiniTest::assertSame('+959971183240', $q['to'] ?? '', '出网的 to 必须带国家码');
    // 而 Redis 的键仍按用户原样输入哈希 —— 换算法会让存量账号对不上
    $rawHash = (new App\Service\UserAuthService(new SmsTestConfig(), new RedisLock($redis)))->mobileHash('9971183240');
    MiniTest::assertTrue(
        isset($redis->store['mtrip:otp:req:1:register:' . $rawHash]),
        'OTP 键应按用户原样输入的号码哈希,不受 E.164 归一影响'
    );
});

MiniTest::add('SmsVerify:冷却期内重发被拒', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();

    $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9'),
        ErrorCode::SMS_SEND_TOO_FREQUENT,
        '60 秒内重发'
    );
    MiniTest::assertSame(1, count($service->fake->calledUrls), '被限流的那次不该打到服务商');
});

MiniTest::add('SmsVerify:同号当日超过 10 条被拒', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();

    // 每次发完清掉冷却键,单独验证"每日上限"这一道
    for ($i = 0; $i < 10; ++$i) {
        $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');
        foreach (array_keys($redis->store) as $key) {
            if (str_starts_with($key, 'mtrip:otp:cd:')) {
                $redis->del($key);
            }
        }
    }
    MiniTest::assertSame(10, count($service->fake->calledUrls), '前 10 条应正常发出');
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9'),
        ErrorCode::SMS_SEND_TOO_FREQUENT,
        '第 11 条'
    );
});

MiniTest::add('SmsVerify:服务商发码失败不写 requestId 也不落冷却', static function (): void {
    // 不清掉的话用户会被"发送过于频繁"锁住 60 秒,而实际上一条都没发出去
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = new FakeSmsPohClient([401, '{"message":"Your request was made with invalid credentials."}']);

    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9'),
        ErrorCode::SMS_CHANNEL_UNAVAILABLE
    );
    MiniTest::assertSame([], $redis->store, '失败后 Redis 应无残留(锁也已释放)');
});

MiniTest::add('SmsVerify:没发过码就验码报"已过期"', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow());
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->verify(1, SMS_TEST_MOBILE, 'register', '123456'),
        ErrorCode::SMS_CODE_EXPIRED,
        '无 requestId'
    );
});

MiniTest::add('SmsVerify:验码通过签发一次性票据并作废 requestId', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();
    $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');

    $service->fake = new FakeSmsPohClient([201, '{"request_id":123456789,"verifiedAt":"2025-01-22 12:23:54"}']);
    $verified = $service->verify(1, SMS_TEST_MOBILE, 'register', '123456');

    MiniTest::assertSame(600, $verified['expiresIn'], '票据有效 10 分钟');
    MiniTest::assertTrue($verified['verifyToken'] !== '', '应签发票据');
    MiniTest::assertSame([], array_filter(array_keys($redis->store), static fn ($k) => str_starts_with($k, 'mtrip:otp:req:')), 'requestId 应已作废,不可复用');

    // 票据能兑换,且兑换后一次性作废
    $service->assertTicket(1, 'register', SMS_TEST_MOBILE, $verified['verifyToken']);
    $service->discardTicket($verified['verifyToken']);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->assertTicket(1, 'register', SMS_TEST_MOBILE, $verified['verifyToken']),
        ErrorCode::SMS_VERIFY_REQUIRED,
        '票据不可重复使用'
    );
});

MiniTest::add('SmsVerify:验码失败按"码不对",凭证错按"服务不可用"', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();
    $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');

    // 400 = 用户填错了码,留在本页重填
    $service->fake = new FakeSmsPohClient([400, '{"message":"Invalid request!."}']);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->verify(1, SMS_TEST_MOBILE, 'register', '000000'),
        ErrorCode::SMS_CODE_INVALID,
        '码错'
    );

    // 401 = 我方凭证配错,用户重填多少次都不会好
    $service->fake = new FakeSmsPohClient([401, '{"message":"invalid credentials"}']);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->verify(1, SMS_TEST_MOBILE, 'register', '000000'),
        ErrorCode::SMS_CHANNEL_UNAVAILABLE,
        '凭证错'
    );
});

MiniTest::add('SmsVerify:码不是纯数字直接拒,不打服务商', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $service->fake = SmsTestKit::sendOk();
    $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');
    $service->fake = new FakeSmsPohClient([201, '{}']);

    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->verify(1, SMS_TEST_MOBILE, 'register', '12a4b6'),
        ErrorCode::SMS_CODE_INVALID
    );
    MiniTest::assertSame([], $service->fake->calledUrls, '明显非法的码不该打服务商');
});

MiniTest::add('SmsVerify:票据不能跨手机号/场景/站点使用', static function (): void {
    /*
     * 这是整条链路最要紧的一道:不绑手机号的话,
     * 攻击者用自己的号码验一次,就能拿票据去注册/重置任意手机号。
     */
    $makeTicket = static function (Hyperf\Redis\Redis $redis, TestableSmsVerifyService $service): string {
        $service->fake = SmsTestKit::sendOk();
        $service->send(1, SMS_TEST_MOBILE, 'register', '203.0.113.9');
        $service->fake = new FakeSmsPohClient([201, '{"verifiedAt":"2025-01-22 12:23:54"}']);
        return $service->verify(1, SMS_TEST_MOBILE, 'register', '123456')['verifyToken'];
    };

    // 换手机号
    $redis = new Hyperf\Redis\Redis();
    $service = SmsTestKit::service($redis, SmsTestKit::channelRow());
    $token = $makeTicket($redis, $service);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->assertTicket(1, 'register', '09779999999', $token),
        ErrorCode::SMS_VERIFY_REQUIRED,
        '换手机号'
    );
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->assertTicket(1, 'register', SMS_TEST_MOBILE, $token),
        ErrorCode::SMS_VERIFY_REQUIRED,
        '套错号码后原票据也应作废'
    );

    // 换场景(注册票据不能拿去重置密码)
    $redis2 = new Hyperf\Redis\Redis();
    $service2 = SmsTestKit::service($redis2, SmsTestKit::channelRow());
    $token2 = $makeTicket($redis2, $service2);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service2->assertTicket(1, 'reset', SMS_TEST_MOBILE, $token2),
        ErrorCode::SMS_VERIFY_REQUIRED,
        '换场景'
    );

    // 换站点
    $redis3 = new Hyperf\Redis\Redis();
    $service3 = SmsTestKit::service($redis3, SmsTestKit::channelRow());
    $token3 = $makeTicket($redis3, $service3);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service3->assertTicket(2, 'register', SMS_TEST_MOBILE, $token3),
        ErrorCode::SMS_VERIFY_REQUIRED,
        '换站点'
    );
});

MiniTest::add('SmsVerify:空票据按"未完成短信验证"拒绝', static function (): void {
    $service = SmsTestKit::service(new Hyperf\Redis\Redis(), SmsTestKit::channelRow());
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => $service->assertTicket(1, 'register', SMS_TEST_MOBILE, ''),
        ErrorCode::SMS_VERIFY_REQUIRED
    );
});
