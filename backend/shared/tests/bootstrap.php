<?php

declare(strict_types=1);

/**
 * shared 包单测引导:PSR-4 自动加载 + Hyperf 注解基类桩(本机无 vendor 时可独立运行)
 * 运行方式:php tests/run.php(PHP >= 8.1,依赖 openssl/mbstring 扩展)
 */

// ---------- PSR-4 自动加载 Mtrip\Shared\ → src/ ----------
spl_autoload_register(static function (string $class): void {
    $prefix = 'Mtrip\\Shared\\';
    if (str_starts_with($class, $prefix)) {
        $file = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

// ---------- Hyperf 注解基类桩(无 vendor 环境下让 Permission 可实例化) ----------
if (! class_exists(Hyperf\Di\Annotation\AbstractAnnotation::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Di\Annotation;

    abstract class AbstractAnnotation
    {
    }
    PHP);
}

// ---------- Hyperf Context 桩(非协程环境用静态数组模拟,供 AdminContext 测试) ----------
if (! class_exists(Hyperf\Context\Context::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Context;

    class Context
    {
        private static array $store = [];

        public static function set(string $id, mixed $value): mixed
        {
            self::$store[$id] = $value;
            return $value;
        }

        public static function get(string $id, mixed $default = null): mixed
        {
            return self::$store[$id] ?? $default;
        }

        public static function destroy(string $id): void
        {
            unset(self::$store[$id]);
        }
    }
    PHP);
}

// ---------- Hyperf ConfigInterface 桩 ----------
if (! interface_exists(Hyperf\Contract\ConfigInterface::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Contract;

    interface ConfigInterface
    {
    }
    PHP);
}

// ---------- Hyperf Redis 桩(数组模拟:set nx / get / del / eval / setex / incr / expire / exists) ----------
/*
 * 放在 bootstrap 而不是某个用例文件里:多个用例都要用它,
 * 而 run.php 是按文件名 glob 加载的 —— 谁先定义取决于字母序,
 * 一旦某个用例需要新方法就得去猜加载顺序。集中在这里就没有这个坑。
 * TTL 只记不判(单测不等待真实过期),需要"已过期"场景时直接 del。
 */
if (! class_exists(Hyperf\Redis\Redis::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Redis;

    class Redis
    {
        public array $store = [];

        /** @var array<string, int> 记录各键设置过的 TTL,供断言"是否按预期时长过期" */
        public array $ttl = [];

        public function set(string $key, string $value, array $options = []): bool
        {
            if (in_array('nx', $options, true) && array_key_exists($key, $this->store)) {
                return false;
            }
            $this->store[$key] = $value;
            return true;
        }

        public function setex(string $key, int $seconds, string $value): bool
        {
            $this->store[$key] = $value;
            $this->ttl[$key] = $seconds;
            return true;
        }

        public function get(string $key): string|false
        {
            return $this->store[$key] ?? false;
        }

        public function exists(string $key): int
        {
            return array_key_exists($key, $this->store) ? 1 : 0;
        }

        public function incr(string $key): int
        {
            $next = (int) ($this->store[$key] ?? 0) + 1;
            $this->store[$key] = (string) $next;
            return $next;
        }

        public function expire(string $key, int $seconds): bool
        {
            $this->ttl[$key] = $seconds;
            return true;
        }

        public function del(string $key): int
        {
            if (array_key_exists($key, $this->store)) {
                unset($this->store[$key], $this->ttl[$key]);
                return 1;
            }
            return 0;
        }

        /** 模拟"令牌一致才删除"的 Lua 原子释放脚本 */
        public function eval(string $script, array $args = [], int $numKeys = 0): int
        {
            [$key, $token] = [$args[0], $args[1]];
            if (($this->store[$key] ?? null) === $token) {
                unset($this->store[$key]);
                return 1;
            }
            return 0;
        }
    }
    PHP);
}

// ---------- Hyperf Db 静态门面桩(按连接名+表名路由到测试注入的查询构造器) ----------
/*
 * `transaction()` 直接执行闭包、不模拟回滚:被测代码关心的是"异常会不会往外抛"
 * 与"抛了之后后续步骤不再执行",这两点直执行就能覆盖;真正的回滚语义属集成测试范畴。
 */
if (! class_exists(Hyperf\DbConnection\Db::class)) {
    eval(<<<'PHP'
    namespace Hyperf\DbConnection;

    class Db
    {
        /** @var callable|null 测试注入:fn(string $table): object */
        public static $tableResolver = null;

        /** @var callable|null 测试注入:fn(string $connection, string $table): object;未设置时回落 $tableResolver */
        public static $connectionResolver = null;

        public static function table(string $table): object
        {
            return (self::$tableResolver)($table);
        }

        public static function connection(string $name): object
        {
            return new DbConnectionStub($name);
        }

        public static function transaction(callable $callback): mixed
        {
            return $callback();
        }
    }

    class DbConnectionStub
    {
        public function __construct(private string $name)
        {
        }

        public function table(string $table): object
        {
            if (Db::$connectionResolver !== null) {
                return (Db::$connectionResolver)($this->name, $table);
            }
            return (Db::$tableResolver)($table);
        }
    }
    PHP);
}

// ---------- 迷你断言框架 ----------
final class MiniTest
{
    /** @var array<string, \Closure> */
    private static array $tests = [];

    private static int $assertions = 0;

    public static function add(string $name, Closure $fn): void
    {
        self::$tests[$name] = $fn;
    }

    public static function assertSame(mixed $expected, mixed $actual, string $hint = ''): void
    {
        ++self::$assertions;
        if ($expected !== $actual) {
            throw new AssertionError(sprintf(
                '%s期望 %s,实际 %s',
                $hint === '' ? '' : $hint . ':',
                var_export($expected, true),
                var_export($actual, true)
            ));
        }
    }

    public static function assertTrue(bool $cond, string $hint = ''): void
    {
        ++self::$assertions;
        if (! $cond) {
            throw new AssertionError($hint === '' ? '断言失败' : $hint);
        }
    }

    /** 断言抛出指定异常,并可校验异常 code */
    public static function assertThrows(string $exceptionClass, Closure $fn, ?int $code = null, string $hint = ''): void
    {
        ++self::$assertions;
        try {
            $fn();
        } catch (Throwable $e) {
            if (! $e instanceof $exceptionClass) {
                throw new AssertionError(($hint ? $hint . ':' : '') . '期望异常 ' . $exceptionClass . ',实际 ' . $e::class);
            }
            if ($code !== null && $e->getCode() !== $code) {
                throw new AssertionError(($hint ? $hint . ':' : '') . '期望异常码 ' . $code . ',实际 ' . $e->getCode());
            }
            return;
        }
        throw new AssertionError(($hint ? $hint . ':' : '') . '期望抛出 ' . $exceptionClass . ',实际未抛异常');
    }

    /** 执行全部用例,返回失败数 */
    public static function run(): int
    {
        $pass = 0;
        $failures = [];
        foreach (self::$tests as $name => $fn) {
            try {
                $fn();
                ++$pass;
                echo "  [PASS] {$name}\n";
            } catch (Throwable $e) {
                $failures[$name] = $e->getMessage();
                echo "  [FAIL] {$name}\n         {$e->getMessage()}\n";
            }
        }
        echo "\n";
        printf(
            "用例 %d 个,断言 %d 次,通过 %d,失败 %d\n",
            count(self::$tests),
            self::$assertions,
            $pass,
            count($failures)
        );
        return count($failures);
    }
}
