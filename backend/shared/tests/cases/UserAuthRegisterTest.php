<?php

declare(strict_types=1);

/**
 * UserAuthService::register 重复注册冲突单测:Db 静态门面/Config 桩,
 * 覆盖预检冲突、唯一索引兜底、非冲突异常透传、并发抢锁拒绝与锁释放恢复分支
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;

// ---------- Hyperf ConfigInterface 桩(无 vendor 环境) ----------
if (! interface_exists(Hyperf\Contract\ConfigInterface::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Contract;

    interface ConfigInterface
    {
    }
    PHP);
}

// ---------- Hyperf Db 静态门面桩(按表名路由到测试注入的查询构造器) ----------
if (! class_exists(Hyperf\DbConnection\Db::class)) {
    eval(<<<'PHP'
    namespace Hyperf\DbConnection;

    class Db
    {
        /** @var callable|null 测试注入:fn(string $table): object */
        public static $tableResolver = null;

        public static function table(string $table): object
        {
            return (self::$tableResolver)($table);
        }
    }
    PHP);
}

// UserAuthService 位于 user-service,不在 shared 自动加载前缀内,直接引入源文件
require_once __DIR__ . '/../../../services/user-service/app/Service/UserAuthService.php';

// ---------- 测试替身:配置 / user_info 查询构造器 / 行为日志表 ----------
final class RegisterTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function get(string $key, mixed $default = null): mixed
    {
        return [
            'mtrip.aes_key' => 'test-aes-key',
            'mtrip.jwt_secret' => 'test-jwt-secret',
        ][$key] ?? $default;
    }
}

final class RegisterTestUserTable
{
    public int $insertCalls = 0;

    public function __construct(
        public bool $exists = false,
        public ?Throwable $insertError = null,
        public int $nextId = 101,
    ) {
    }

    public function where(string $column, mixed $value): static
    {
        return $this;
    }

    public function whereNull(string $column): static
    {
        return $this;
    }

    public function exists(): bool
    {
        return $this->exists;
    }

    public function insertGetId(array $row): int
    {
        ++$this->insertCalls;
        if ($this->insertError !== null) {
            throw $this->insertError;
        }
        return $this->nextId;
    }
}

final class RegisterTestLogTable
{
    public function insert(array $row): bool
    {
        return true;
    }
}

/** 用例工具:装配服务实例并绑定 Db 表路由 */
final class RegisterTestKit
{
    public static function service(Hyperf\Redis\Redis $redis, RegisterTestUserTable $userTable): App\Service\UserAuthService
    {
        Hyperf\DbConnection\Db::$tableResolver = static function (string $table) use ($userTable): object {
            return $table === 'user_info' ? $userTable : new RegisterTestLogTable();
        };
        return new App\Service\UserAuthService(new RegisterTestConfig(), new RedisLock($redis));
    }

    public static function register(App\Service\UserAuthService $service): array
    {
        return $service->register(1, '13800001234', 'Passw0rd!', '', 1, '203.0.113.9');
    }
}

MiniTest::add('UserRegister:手机号已存在预检冲突拒绝', static function (): void {
    $userTable = new RegisterTestUserTable(exists: true);
    $service = RegisterTestKit::service(new Hyperf\Redis\Redis(), $userTable);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => RegisterTestKit::register($service),
        ErrorCode::DATA_CONFLICT,
        '预检冲突'
    );
    MiniTest::assertSame(0, $userTable->insertCalls, '预检命中后不应执行插入');
});

MiniTest::add('UserRegister:唯一索引 Duplicate entry 兜底为数据冲突', static function (): void {
    // 模拟锁失效/跨实例极端并发:预检通过但插入命中唯一索引
    $userTable = new RegisterTestUserTable(insertError: new RuntimeException(
        "SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry '1-abc' for key 'uk_site_mobile_hash'"
    ));
    $service = RegisterTestKit::service(new Hyperf\Redis\Redis(), $userTable);
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => RegisterTestKit::register($service),
        ErrorCode::DATA_CONFLICT,
        '唯一索引兜底'
    );
    MiniTest::assertSame(1, $userTable->insertCalls, '应已尝试插入一次');
});

MiniTest::add('UserRegister:非冲突数据库异常原样透传', static function (): void {
    $userTable = new RegisterTestUserTable(insertError: new RuntimeException('Connection refused'));
    $service = RegisterTestKit::service(new Hyperf\Redis\Redis(), $userTable);
    try {
        RegisterTestKit::register($service);
    } catch (Throwable $e) {
        MiniTest::assertTrue(! $e instanceof BusinessException, '非冲突异常不应被包装为业务异常');
        MiniTest::assertSame('Connection refused', $e->getMessage(), '异常信息应原样透传');
        return;
    }
    throw new AssertionError('期望抛出数据库异常,实际未抛');
});

MiniTest::add('UserRegister:同手机号并发抢锁失败抛重复提交', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $userTable = new RegisterTestUserTable();
    $service = RegisterTestKit::service($redis, $userTable);
    // 预占同站点同手机号的注册锁,模拟另一请求正在处理
    $lockKey = 'mtrip:lock:user:register:1:' . $service->mobileHash('13800001234');
    $redis->set($lockKey, 'other-holder');
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => RegisterTestKit::register($service),
        ErrorCode::REPEAT_SUBMIT,
        '并发抢锁'
    );
    MiniTest::assertSame(0, $userTable->insertCalls, '未获锁不应触达数据库写入');
});

MiniTest::add('UserRegister:冲突异常后锁已释放可重试', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $service = RegisterTestKit::service($redis, new RegisterTestUserTable(exists: true));
    try {
        RegisterTestKit::register($service);
    } catch (BusinessException) {
    }
    MiniTest::assertSame([], $redis->store, '业务异常后注册锁应已释放(finally)');
    // 锁未卡死:重试仍走业务预检(再次数据冲突),而非误报"请勿重复提交"
    MiniTest::assertThrows(
        BusinessException::class,
        static fn () => RegisterTestKit::register($service),
        ErrorCode::DATA_CONFLICT,
        '锁释放后重试'
    );
});
