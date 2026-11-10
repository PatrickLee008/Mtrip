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
    /** 设密码规则(注册 / 重置 / 修改共用,与 client-app utils/validate.ts isPassword 同步):6-32 位,至少 1 个大写字母和 1 个数字 */
    public const PASSWORD_PATTERN = '/^(?=.*[A-Z])(?=.*\d).{6,32}$/s';

    public static function assertPassword(string $password): void
    {
        if (! preg_match(self::PASSWORD_PATTERN, $password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码须为6-32位,且至少包含1个大写字母和1个数字');
        }
    }

    public function __construct(protected ConfigInterface $config, protected RedisLock $lock)
    {
    }

    public function register(int $siteId, string $mobile, string $password, string $nickname, int $source, string $ip, string $referralCode = '', string $realName = ''): array
    {
        $mobileHash = $this->mobileHash($mobile);
        $this->assertSiteEnabled($siteId);

        // 同手机号并发注册加 Redis 分布式锁串行,业务完成即释放;
        // 拦截不同设备/客户端同时提交同一手机号导致的"先查后插"竞态
        $lockKey = "mtrip:lock:user:register:{$siteId}:{$mobileHash}";
        return $this->lock->run($lockKey, 10, function () use ($siteId, $mobile, $mobileHash, $password, $nickname, $source, $ip, $referralCode, $realName): array {
            if ($this->isRegistered($siteId, $mobileHash)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已注册');
            }

            $now = date('Y-m-d H:i:s');
            /**
             * 建号 + 绑推荐人必须在**同一事务**里:
             * `setupReferral` 会在推荐码无效时抛异常,而它跑在 insert 之后 ——
             * 不包事务的话「推荐码填错」会留下一个已建好的账号,用户改完码重试
             * 反而被告知「该手机号已注册」,等于一次输入错误把号码废掉。
             * (接入短信验证后更要紧:重试还得再发一条短信。)
             */
            $userId = Db::transaction(function () use ($siteId, $mobile, $mobileHash, $password, $nickname, $source, $ip, $now, $referralCode, $realName): int {
                try {
                    $userId = Db::table('user_info')->insertGetId([
                        'site_id' => $siteId,
                        'nickname' => $nickname !== '' ? $nickname : 'User' . substr($mobile, -4),
                        // 注册页收的姓名(取代原邮箱栏):与手机号同级的加密列;
                        // **不动 real_name_status** —— 自己填的名字不等于通过实名认证
                        'real_name' => $realName !== '' ? CryptoHelper::encrypt($realName, $this->aesKey()) : '',
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
                return $userId;
            });
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
        $user = $this->findAccount($siteId, $this->mobileHash($mobile));
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
        // Token 用账号自己的站点(回退命中时与请求站点不同);App 登录后按 user.siteId 跟随切站
        $this->actionLog((int) $user['site_id'], (int) $user['id'], 1, '密码登录', $ip);

        return $this->issueToken((int) $user['id'], (int) $user['site_id']);
    }

    /**
     * 短信验证码登录(免密)
     *
     * **不校验密码**:调用方必须先用 `SmsVerifyService::assertTicket()` 确认该手机号
     * 刚刚通过了 scene=login 的短信验证,否则等于给任意手机号开后门。
     */
    public function loginBySms(int $siteId, string $mobile, string $ip): array
    {
        $user = $this->findActiveUser($siteId, $mobile);

        Db::table('user_info')->where('id', $user['id'])->update([
            'last_login_at' => date('Y-m-d H:i:s'),
            'last_login_ip' => $ip,
        ]);
        $this->actionLog((int) $user['site_id'], (int) $user['id'], 1, '短信验证码登录', $ip);

        return $this->issueToken((int) $user['id'], (int) $user['site_id']);
    }

    /**
     * 忘记密码:按手机号重置为新密码
     *
     * 同样依赖调用方先兑 scene=reset 的短信票据。重置后**不自动登录** ——
     * 让用户用新密码走一次正常登录,才能确认新密码确实记住了。
     */
    public function resetPassword(int $siteId, string $mobile, string $password, string $ip): void
    {
        $user = $this->findActiveUser($siteId, $mobile);

        Db::table('user_info')->where('id', $user['id'])->update([
            'password' => password_hash($password, PASSWORD_BCRYPT),
        ]);
        $this->actionLog((int) $user['site_id'], (int) $user['id'], 1, '短信验证码重置密码', $ip);
    }

    /**
     * 按手机号取可用账号(冻结/注销一律拒绝)
     *
     * @return array<string, mixed>
     */
    private function findActiveUser(int $siteId, string $mobile): array
    {
        $user = $this->findAccount($siteId, $this->mobileHash($mobile));
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '该手机号尚未注册');
        }
        if ((int) $user['user_status'] === 2) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已被冻结,请联系客服');
        }
        if ((int) $user['user_status'] === 3) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已注销');
        }
        return $user;
    }

    /**
     * 按手机号定位账号:先查请求站点;没有时回退到其它**已启用**站点里唯一的同号账号。
     *
     * 账号按「站点 + 手机号」唯一,而 App 的站点来自客户端(默认站点 / 本地缓存)。默认站点一改
     * (生产 2026-11 从 1 改为 7),老账号就在新站点查不到、提示「手机号或密码错误」。
     * 回退只认已启用站点,且必须唯一命中(同号多站点时不猜);密码 / 短信票据照常校验,不放宽认证。
     *
     * @return array<string, mixed>|null
     */
    public function findAccount(int $siteId, string $mobileHash): ?array
    {
        $user = Db::table('user_info')
            ->where('site_id', $siteId)->where('mobile_hash', $mobileHash)
            ->whereNull('deleted_at')->first();
        if ($user) {
            return (array) $user;
        }
        $others = array_values(array_diff($this->enabledSiteIds(), [$siteId]));
        if ($others === []) {
            return null;
        }
        $rows = Db::table('user_info')
            ->where('mobile_hash', $mobileHash)->whereIn('site_id', $others)
            ->whereNull('deleted_at')->limit(2)->get();
        return count($rows) === 1 ? (array) $rows[0] : null;
    }

    /**
     * 手机号是否已注册:本站点,或其它已启用站点已有同号账号(登录会回退找到它,见 findAccount)。
     * 再注册一个只会让同一个人有两套余额 / 订单 —— 生产 2026-11 默认站点 1 → 7 后就出现过。
     */
    public function isRegistered(int $siteId, string $mobileHash): bool
    {
        return Db::table('user_info')
            ->where('mobile_hash', $mobileHash)
            ->whereIn('site_id', array_values(array_unique([$siteId, ...$this->enabledSiteIds()])))
            ->whereNull('deleted_at')->exists();
    }

    /** @return list<int> 已启用站点 */
    private function enabledSiteIds(): array
    {
        return array_map('intval', Db::connection('system')->table('sys_site')
            ->where('status', 1)->whereNull('deleted_at')->pluck('id')->all());
    }

    /** 注册只允许落在已启用站点(停用站点的老缓存客户端曾把新账号注册进生产已停用的站点 1) */
    private function assertSiteEnabled(int $siteId): void
    {
        if (! in_array($siteId, $this->enabledSiteIds(), true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '当前站点已停用,请重新打开 App 后再注册');
        }
    }

    public function logout(int $userId, string $ip): void
    {
        $user = Db::table('user_info')->where('id', $userId)->first();
        if ($user) {
            $this->actionLog((int) ((array) $user)['site_id'], $userId, 1, '退出登录', $ip);
        }
    }

    /** Only provider-client-validated identities may enter here; email/name never select an account. */
    public function facebookAccount(int $siteId, string $appId, string $subject, string $name, string $consentVersion, string $consentAt): array
    {
        return $this->socialAccount('facebook', $siteId, $appId, $subject, $name, $consentVersion, $consentAt);
    }

    public function tiktokAccount(int $siteId, string $appId, string $subject, string $name, string $consentVersion, string $consentAt): array
    {
        return $this->socialAccount('tiktok', $siteId, $appId, $subject, $name, $consentVersion, $consentAt);
    }

    public function appleAccount(int $siteId, string $appId, string $subject, string $name, string $consentVersion, string $consentAt, string $email, string $refreshToken): array
    {
        return $this->socialAccount('apple', $siteId, $appId, $subject, $name, $consentVersion, $consentAt, $email, $refreshToken);
    }

    private function socialAccount(string $provider, int $siteId, string $appId, string $subject, string $name, string $consentVersion, string $consentAt, string $email = '', string $refreshToken = ''): array
    {
        $identityQuery = static fn () => Db::table('user_social_identity')
            ->where('site_id', $siteId)->where('provider', $provider)
            ->where('provider_app_id', $appId)->where('provider_user_id', $subject);
        $identity = $identityQuery()->first();
        if ($identity) {
            $this->activeSocialUser((int) $identity->user_id, $siteId);
            if ($refreshToken !== '') {
                $identityQuery()->update(['provider_refresh_token' => CryptoHelper::encrypt($refreshToken, $this->aesKey())]);
            }
            return ['userId' => (int) $identity->user_id, 'isNewUser' => false];
        }
        try {
            $userId = Db::transaction(function () use ($provider, $siteId, $appId, $subject, $name, $consentVersion, $consentAt, $email, $refreshToken): int {
                $userId = (int) Db::table('user_info')->insertGetId([
                    'site_id' => $siteId, 'nickname' => $name !== '' ? $name : match ($provider) {
                        'apple' => 'Apple User', 'tiktok' => 'TikTok User', default => 'Facebook User',
                    },
                    'mobile' => '', 'mobile_hash' => null, 'password' => '',
                    'email' => $email !== '' ? CryptoHelper::encrypt($email, $this->aesKey()) : '',
                    'register_source' => 3, 'register_time' => date('Y-m-d H:i:s'), 'user_status' => 1,
                ]);
                $this->setupReferral($siteId, $userId, '');
                $identityData = [
                    'site_id' => $siteId, 'user_id' => $userId, 'provider' => $provider,
                    'provider_app_id' => $appId, 'provider_user_id' => $subject,
                    'consent_version' => $consentVersion, 'consent_at' => $consentAt,
                ];
                if ($provider === 'apple') {
                    $identityData['provider_refresh_token'] = $refreshToken !== '' ? CryptoHelper::encrypt($refreshToken, $this->aesKey()) : null;
                }
                Db::table('user_social_identity')->insert($identityData);
                return $userId;
            });
            return ['userId' => $userId, 'isNewUser' => true];
        } catch (\Throwable $e) {
            // The unique identity rolls back a losing transaction, including its provisional user/referral code.
            if (str_contains($e->getMessage(), 'uk_social_identity')) {
                $identity = $identityQuery()->first();
                if ($identity) {
                    $this->activeSocialUser((int) $identity->user_id, $siteId);
                    return ['userId' => (int) $identity->user_id, 'isNewUser' => false];
                }
            }
            throw $e;
        }
    }

    public function facebookSession(int $userId, int $siteId, string $ip): array
    {
        return $this->socialSession('Facebook', $userId, $siteId, $ip);
    }

    public function tiktokSession(int $userId, int $siteId, string $ip): array
    {
        return $this->socialSession('TikTok', $userId, $siteId, $ip);
    }

    public function appleSession(int $userId, int $siteId, string $ip): array
    {
        return $this->socialSession('Apple', $userId, $siteId, $ip);
    }

    private function socialSession(string $provider, int $userId, int $siteId, string $ip): array
    {
        $this->activeSocialUser($userId, $siteId);
        Db::table('user_info')->where('id', $userId)->where('site_id', $siteId)->update([
            'last_login_at' => date('Y-m-d H:i:s'), 'last_login_ip' => $ip,
        ]);
        $this->actionLog($siteId, $userId, 1, $provider . ' 登录', $ip);
        return $this->issueToken($userId, $siteId);
    }

    private function activeSocialUser(int $userId, int $siteId): void
    {
        $user = Db::table('user_info')->where('id', $userId)->where('site_id', $siteId)->first();
        if (! $user || $user->deleted_at !== null || (int) $user->user_status !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, 'Account unavailable; please contact support');
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
            'mobileBound' => (string) $user['mobile'] !== '',
            'hasPassword' => (string) $user['password'] !== '',
            'memberLevelId' => (int) $user['member_level_id'],
            'memberLevelName' => $levelName,
            'balance' => (string) $user['balance'],
            'points' => (int) $user['points'],
            'realNameStatus' => (int) $user['real_name_status'],
            // 资料向导(Set Up Profile):profileCompleted=false 时 App 在注册/登录后弹「Set Up Profile Now?」
            'gender' => (int) ($user['gender'] ?? 0),
            'birthday' => $user['birthday'] ?? null,
            'city' => (string) ($user['city'] ?? ''),
            'profileCompleted' => ! empty($user['profile_setup_at']),
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

    public function decryptSafe(string $ciphertext): string
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
