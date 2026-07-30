<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * Redis 分布式锁:SET NX EX + 随机令牌,Lua 原子释放(仅持有者可释放)
 *
 * 用于提交类业务的并发控制:同一用户/客户端的重复请求先抢锁,
 * 抢不到直接拒绝,业务完成后 finally 释放;TTL 兜底防止进程异常导致死锁
 */
class RedisLock
{
    public function __construct(protected Redis $redis)
    {
    }

    /**
     * 尝试加锁,成功返回持有令牌,失败(锁被占用)返回 null
     */
    public function acquire(string $key, int $ttlSeconds = 10): ?string
    {
        $token = bin2hex(random_bytes(16));
        $ok = $this->redis->set($key, $token, ['nx', 'ex' => max(1, $ttlSeconds)]);
        return $ok ? $token : null;
    }

    /**
     * 释放锁:令牌比对一致才删除,避免误删他人持有的锁
     */
    public function release(string $key, string $token): bool
    {
        $lua = <<<'LUA'
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
LUA;
        return (bool) $this->redis->eval($lua, [$key, $token], 1);
    }

    /**
     * 锁内执行业务:抢锁 → 执行 → finally 释放;抢锁失败抛"请勿重复提交"
     *
     * @template T
     * @param callable():T $business
     * @return T
     */
    public function run(string $key, int $ttlSeconds, callable $business, string $failMessage = '')
    {
        $token = $this->acquire($key, $ttlSeconds);
        if ($token === null) {
            throw new BusinessException(ErrorCode::REPEAT_SUBMIT, $failMessage !== '' ? $failMessage : null);
        }
        try {
            return $business();
        } finally {
            $this->release($key, $token);
        }
    }
}
