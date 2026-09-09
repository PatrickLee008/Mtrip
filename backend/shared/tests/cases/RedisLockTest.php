<?php

declare(strict_types=1);

/**
 * RedisLock 分布式锁单测:数组模拟 Redis(SETNX/令牌比对删除),覆盖抢锁/释放/锁内执行
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;

// Hyperf\Redis\Redis 桩在 tests/bootstrap.php 统一定义(多个用例共用,避免依赖文件加载顺序)

MiniTest::add('RedisLock:抢锁互斥,释放后可重新获取', static function (): void {
    $lock = new RedisLock(new Hyperf\Redis\Redis());
    $token = $lock->acquire('lock:a', 10);
    MiniTest::assertTrue($token !== null, '首次抢锁应成功');
    MiniTest::assertSame(null, $lock->acquire('lock:a', 10), '锁被占用时再次抢锁应失败');
    MiniTest::assertTrue($lock->release('lock:a', $token), '持有者释放应成功');
    MiniTest::assertTrue($lock->acquire('lock:a', 10) !== null, '释放后应可重新抢锁');
});

MiniTest::add('RedisLock:令牌不一致不可误删他人锁', static function (): void {
    $lock = new RedisLock(new Hyperf\Redis\Redis());
    $token = $lock->acquire('lock:b', 10);
    MiniTest::assertSame(false, $lock->release('lock:b', 'wrong-token'), '错误令牌释放应失败');
    MiniTest::assertSame(null, $lock->acquire('lock:b', 10), '锁应仍被原持有者占用');
    MiniTest::assertTrue($lock->release('lock:b', (string) $token));
});

MiniTest::add('RedisLock:run 锁内执行,期间并发抢锁抛重复提交', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $lock = new RedisLock($redis);
    $result = $lock->run('lock:c', 10, static function () use ($lock): string {
        // 业务执行中:同 key 并发请求应被拒绝
        MiniTest::assertThrows(
            BusinessException::class,
            static fn () => $lock->run('lock:c', 10, static fn () => null),
            ErrorCode::REPEAT_SUBMIT,
            '锁内并发抢锁'
        );
        return 'done';
    });
    MiniTest::assertSame('done', $result, 'run 应透传业务返回值');
    MiniTest::assertSame([], $redis->store, '业务完成后锁应已释放');
});

MiniTest::add('RedisLock:run 业务异常也释放锁', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $lock = new RedisLock($redis);
    MiniTest::assertThrows(RuntimeException::class, static fn () => $lock->run('lock:d', 10, static function (): void {
        throw new RuntimeException('业务失败');
    }));
    MiniTest::assertSame([], $redis->store, '异常后锁应已释放(finally)');
});
