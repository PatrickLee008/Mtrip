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
