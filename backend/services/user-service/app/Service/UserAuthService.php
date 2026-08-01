<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\RedisLock;

/**
 * C端认证服务:注册/登录/Token 签发
 * 手机号 AES 加密存储 + HMAC 哈希检索(mobile_hash),返回值统一脱敏
 */
class UserAuthService
{
    public function __construct(protected ConfigInterface $config, protected RedisLock $lock)
    {
    }

    public function register(int $siteId, string $mobile, string $password, string $nickname, int $source, string $ip, string $referralCode = ''): array
    {
        $mobileHash = $this->mobileHash($mobile);

        // 同手机号并发注册加 Redis 分布式锁串行,业务完成即释放;
        // 拦截不同设备/客户端同时提交同一手机号导致的"先查后插"竞态
        $lockKey = "mtrip:lock:user:register:{$siteId}:{$mobileHash}";
        return $this->lock->run($lockKey, 10, function () use ($siteId, $mobile, $mobileHash, $password, $nickname, $source, $ip, $referralCode): array {
            $exists = Db::table('user_info')
                ->where('site_id', $siteId)->where('mobile_hash', $mobileHash)
                ->whereNull('deleted_at')->exists();
            if ($exists) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已注册');
            }

            $now = date('Y-m-d H:i:s');
            try {
                $userId = Db::table('user_info')->insertGetId([
                    'site_id' => $siteId,
                    'nickname' => $nickname !== '' ? $nickname : 'User' . substr($mobile, -4),
                    'mobile' => CryptoHelper::encrypt($mobile, $this->aesKey()),
                    'mobile_hash' => $mobileHash,
                    'password' => password_hash($password, PASSWORD_BCRYPT),
                    'register_source' => $source,
                    'register_time' => $now,
                    'last_login_at' => $now,
                    'last_login_ip' => $ip,
                    'user_status' => 1,
                ]);
            } catch (\Throwable $e) {
                // 唯一索引 uk_site_mobile_hash 冲突兜底(锁失效/跨实例极端并发)
                if (str_contains($e->getMessage(), 'uk_site_mobile_hash') || str_contains($e->getMessage(), 'Duplicate entry')) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已注册');
                }
                throw $e;
            }
            // 生成本人推荐码 + (可选)绑定推荐关系;推荐码无效则拦截注册(PRD 模块14)
            $this->setupReferral($siteId, $userId, $referralCode);
            $this->actionLog($siteId, $userId, 1, '注册并登录', $ip);

            return $this->issueToken($userId, $siteId);
        }, '注册请求处理中,请勿重复提交');
    }

    /** 生成本人推荐码(基于 userId 唯一),并按传入推荐码绑定推荐人 */
    private function setupReferral(int $siteId, int $userId, string $referralCode): void
    {
        Db::table('user_info')->where('id', $userId)->update(['referral_code' => $this->genReferralCode($userId)]);
        if ($referralCode === '') {
            return;
        }
        $inviter = Db::table('user_info')
            ->where('site_id', $siteId)->where('referral_code', $referralCode)
            ->whereNull('deleted_at')->first(['id', 'user_status']);
        if (! $inviter || (int) $inviter->user_status !== 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '推荐码无效');
        }
        if ((int) $inviter->id === $userId) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '不能使用自己的推荐码');
        }
        Db::table('user_referral')->insert([
            'site_id' => $siteId,
            'inviter_user_id' => (int) $inviter->id,
            'invitee_user_id' => $userId,
            'reward_status' => 0,
            'bind_time' => date('Y-m-d H:i:s'),
        ]);
    }

    /** 推荐码:MT + userId 的 36 进制(唯一)+ 1 字节随机(增加不可猜性),全大写 */
    public function genReferralCode(int $userId): string
    {
        return 'MT' . strtoupper(base_convert((string) $userId, 10, 36)) . strtoupper(bin2hex(random_bytes(1)));
    }

    public function login(int $siteId, string $mobile, string $password, string $ip): array
    {
        $user = Db::table('user_info')
            ->where('site_id', $siteId)->where('mobile_hash', $this->mobileHash($mobile))
            ->whereNull('deleted_at')->first();
        $user = $user ? (array) $user : null;
        if (! $user || ! password_verify($password, (string) $user['password'])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号或密码错误');
        }
        if ((int) $user['user_status'] === 2) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已被冻结,请联系客服');
        }
        if ((int) $user['user_status'] === 3) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已注销');
        }

        Db::table('user_info')->where('id', $user['id'])->update([
            'last_login_at' => date('Y-m-d H:i:s'),
            'last_login_ip' => $ip,
        ]);
        $this->actionLog($siteId, (int) $user['id'], 1, '密码登录', $ip);

        return $this->issueToken((int) $user['id'], $siteId);
    }

    public function logout(int $userId, string $ip): void
    {
        $user = Db::table('user_info')->where('id', $userId)->first();
        if ($user) {
            $this->actionLog((int) ((array) $user)['site_id'], $userId, 1, '退出登录', $ip);
        }
    }

    public function refresh(int $userId): array
    {
        $user = Db::table('user_info')->where('id', $userId)->whereNull('deleted_at')->first();
        if (! $user) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        return $this->issueToken($userId, (int) ((array) $user)['site_id']);
    }

    /** 签发C端 Token 并组装脱敏用户信息 */
    private function issueToken(int $userId, int $siteId): array
    {
        $secret = (string) $this->config->get('mtrip.jwt_secret', '');
        if ($secret === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, 'JWT 密钥未配置');
        }
        $ttl = (int) $this->config->get('mtrip.app_jwt_ttl', 604800);
        $token = JwtHelper::issue(['aud' => 'app', 'user_id' => $userId, 'site_id' => $siteId], $secret, $ttl);

        return [
            'token' => $token,
            'expiresIn' => $ttl,
            'user' => $this->profile($userId),
        ];
    }

    /** 用户资料(脱敏,供 me/登录返回复用) */
    public function profile(int $userId): array
    {
        $user = Db::table('user_info')->where('id', $userId)->whereNull('deleted_at')->first();
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '用户不存在');
        }
        $user = (array) $user;
        $levelName = '';
        if ((int) $user['member_level_id'] > 0) {
            $level = Db::table('user_member_level')->where('id', $user['member_level_id'])->first();
            $levelName = $level ? (string) ((array) $level)['level_name'] : '';
        }
        return [
            'id' => (int) $user['id'],
            'siteId' => (int) $user['site_id'],
            'nickname' => (string) $user['nickname'],
            'avatar' => (string) $user['avatar'],
            'mobile' => MaskHelper::mobile($this->decryptSafe((string) $user['mobile'])),
            'email' => MaskHelper::email($this->decryptSafe((string) $user['email'])),
            'memberLevelId' => (int) $user['member_level_id'],
            'memberLevelName' => $levelName,
            'balance' => (string) $user['balance'],
            'points' => (int) $user['points'],
            'realNameStatus' => (int) $user['real_name_status'],
            'registerTime' => (string) $user['register_time'],
        ];
    }

    public function mobileHash(string $mobile): string
    {
        return hash_hmac('sha256', $mobile, $this->aesKey());
    }

    public function aesKey(): string
    {
        return (string) $this->config->get('mtrip.aes_key', '');
    }

    public function actionLog(int $siteId, int $userId, int $type, string $content, string $ip): void
    {
        Db::table('user_action_log')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'action_type' => $type,
            'content' => $content,
            'client_ip' => $ip,
        ]);
    }

    private function decryptSafe(string $ciphertext): string
    {
        if ($ciphertext === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return '';
        }
    }
}
