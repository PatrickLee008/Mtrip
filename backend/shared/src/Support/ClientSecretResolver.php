<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 客户端密钥解析器:按 ClientId 查 sys_client 并还原明文 ClientSecret
 * 供 ClientSignMiddleware(签名校验)与 PayloadDecryptMiddleware(传输解密)共用
 */
class ClientSecretResolver
{
    /** 明文密钥 Redis 缓存时长(秒) */
    private const SECRET_CACHE_TTL = 600;

    public function __construct(protected Redis $redis)
    {
    }

    /** 查询客户端记录(含软删过滤),不存在返回 null */
    public function findClient(string $clientId): ?array
    {
        $client = Db::connection('system')->table('sys_client')
            ->where('client_id', $clientId)
            ->whereNull('deleted_at')
            ->first();
        return $client ? (array) $client : null;
    }

    /** 还原明文 ClientSecret(Redis 缓存 + AES-GCM 解密存储列) */
    public function plainSecret(array $client): string
    {
        $cacheKey = 'mtrip:client:secret:' . $client['client_id'];
        $cached = $this->redis->get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }
        $aesKey = (string) \Hyperf\Support\env('MTRIP_AES_KEY', '');
        $secret = CryptoHelper::decrypt((string) $client['client_secret'], $aesKey);
        $this->redis->set($cacheKey, $secret, ['ex' => self::SECRET_CACHE_TTL]);
        return $secret;
    }

    /** 按 ClientId 直接取明文密钥(客户端不存在/禁用抛鉴权失败) */
    public function secretByClientId(string $clientId): string
    {
        $client = $this->findClient($clientId);
        if (! $client || (int) $client['status'] !== 1) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL);
        }
        return $this->plainSecret($client);
    }
}
