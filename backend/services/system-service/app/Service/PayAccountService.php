<?php

declare(strict_types=1);

namespace App\Service;

use App\Model\SysPayAccount;
use App\Support\SecretField;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\PaymentCenterClient;

/**
 * 收款账户(方案22 §5 / §7):KBZPay MMQR 直连/服务商凭据维护 + 连通性测试(转调 payment-service)。
 *
 * 站点隔离:超管(site_id=0)管理全部;站点管理员可见本站点 + 平台共享(site_id=0,只读),
 * 写操作(含连通性测试)只允许本站点账户。
 * 敏感字段只写不读:app_key/key_pwd 列表脱敏,PEM 只回布尔 has_*;任何日志/返回不得含明文。
 */
class PayAccountService
{
    public const CHANNEL_KBZ_MMQR = 'kbz_mmqr';

    // ---------- 查询 ----------

    /**
     * 列表(page/pageSize/siteId/mode/env/status/keyword)
     * @return array{0: array, 1: int}
     */
    public function paginate(array $filter, int $page, int $pageSize): array
    {
        $query = $this->visibleQuery((int) ($filter['siteId'] ?? 0), false);
        if (($mode = (int) ($filter['mode'] ?? 0)) > 0) {
            $query->where('mode', $mode);
        }
        if (($env = (string) ($filter['env'] ?? '')) !== '') {
            $query->where('env', $env);
        }
        if (($status = (int) ($filter['status'] ?? 0)) > 0) {
            $query->where('status', $status);
        }
        if (($keyword = (string) ($filter['keyword'] ?? '')) !== '') {
            $like = '%' . addcslashes($keyword, '%_\\') . '%';
            $query->where(static function ($q) use ($like) {
                $q->where('account_name', 'like', $like)
                    ->orWhere('app_id', 'like', $like)
                    ->orWhere('merch_code', 'like', $like);
            });
        }
        $total = (clone $query)->count();
        $accounts = $query->orderByDesc('id')->forPage($page, $pageSize)->get();
        $bindCounts = $this->bindCounts($accounts->pluck('id')->map(static fn ($v) => (int) $v)->all());
        $list = $accounts->map(fn (SysPayAccount $a) => $this->presentRow($a, $bindCounts[(int) $a->id] ?? 0))->all();
        return [array_values($list), $total];
    }

    /** 可绑定的启用账户下拉(本站点 + 平台共享;超管全部,可选 siteId 过滤为该站点 + 平台共享) */
    public function options(int $siteId): array
    {
        return $this->visibleQuery($siteId, true)
            ->where('status', 1)
            ->where('channel_code', self::CHANNEL_KBZ_MMQR)
            ->orderBy('site_id')->orderByDesc('id')
            ->get(['id', 'account_name', 'mode', 'env', 'site_id'])
            ->map(static fn (SysPayAccount $a) => [
                'id' => (int) $a->id,
                'account_name' => (string) $a->account_name,
                'mode' => (int) $a->mode,
                'env' => (string) $a->env,
                'site_id' => (int) $a->site_id,
            ])->all();
    }

    /**
     * 站点渠道绑定时校验账户可用:启用中、kbz_mmqr、调用者可见
     * (站点管理员:本站点或平台共享;超管:任意,以支持同一账户被多个站点绑定)
     */
    public function findBindable(int $accountId): SysPayAccount
    {
        /** @var SysPayAccount|null $account */
        $account = SysPayAccount::query()->find($accountId);
        if ($account === null || $account->channel_code !== self::CHANNEL_KBZ_MMQR) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '收款账户不存在');
        }
        if (! AdminContext::isSuper() && ! in_array((int) $account->site_id, [0, AdminContext::siteId()], true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        if ((int) $account->status !== 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '收款账户已停用,请先启用或选择其他账户');
        }
        return $account;
    }

    // ---------- 写操作 ----------

    public function create(array $input): int
    {
        $account = new SysPayAccount();
        $account->site_id = AdminContext::isSuper() ? max(0, (int) ($input['siteId'] ?? 0)) : AdminContext::siteId();
        $account->channel_code = self::CHANNEL_KBZ_MMQR;
        $account->status = (int) ($input['status'] ?? 1) === 2 ? 2 : 1;
        $this->fill($account, $input);
        $account->save();
        return (int) $account->id;
    }

    public function update(int $id, array $input): void
    {
        // 所属站点创建后不可变更:已被其他站点绑定的共享账户改归属会破坏绑定
        $account = $this->findWritable($id);
        $this->fill($account, $input);
        $account->save();
    }

    public function delete(int $id): void
    {
        $account = $this->findWritable($id);
        if ((int) $account->status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '账户启用中,请先停用再删除');
        }
        $bound = $this->bindCounts([(int) $account->id], true)[(int) $account->id] ?? 0;
        if ($bound > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "账户仍被 {$bound} 个站点支付渠道绑定,请先解绑");
        }
        $account->delete();
    }

    public function toggleStatus(int $id): int
    {
        $account = $this->findWritable($id);
        $account->status = (int) $account->status === 1 ? 2 : 1;
        $account->save();
        return (int) $account->status;
    }

    /**
     * 连通性测试(方案22 修订记录 2026-10-27:调三方只在 payment-service)。
     * 本服务只做权限与站点校验,判定规则在 payment-service `/internal/v1/channel/test`,结果原样返回。
     * @return array{ok: bool, kind: string, code: string, message: string}
     */
    public function test(int $id): array
    {
        $account = $this->findWritable($id);
        try {
            $data = $this->paymentCenter()->channelTest((int) $account->id);
        } catch (BusinessException $e) {
            return match ($e->getCode()) {
                // 网络失败 / 非 JSON(客户端转换)或支付中心自身 500:对后台统一呈现为"不可用"
                ErrorCode::THIRD_PARTY_ERROR, ErrorCode::SERVER_ERROR => $this->testResult(false, 'network', '', '支付中心不可用,请稍后重试'),
                // 内部 token 未配置/不一致或来源不在内网:部署问题,不能当成管理员无权限(40301)抛给前端
                ErrorCode::FORBIDDEN => $this->testResult(false, 'config', '', '支付中心内部鉴权失败,请检查 MTRIP_INTERNAL_TOKEN 配置'),
                default => throw $e,
            };
        }
        return $this->testResult(
            (bool) ($data['ok'] ?? false),
            (string) ($data['kind'] ?? ''),
            (string) ($data['code'] ?? ''),
            (string) ($data['message'] ?? ''),
        );
    }

    // ---------- 内部 ----------

    /** 支付中心客户端(protected 工厂,便于测试替换) */
    protected function paymentCenter(): PaymentCenterClient
    {
        return new PaymentCenterClient();
    }

    private function testResult(bool $ok, string $kind, string $code, string $message): array
    {
        return ['ok' => $ok, 'kind' => $kind, 'code' => $code, 'message' => $message];
    }

    /**
     * 可见范围查询:非超管 = 本站点 + 平台共享;
     * 超管 = 全部,传 siteId>0 时按站点过滤($withShared=true 时附带平台共享,供绑定下拉)
     */
    private function visibleQuery(int $siteId, bool $withShared): Builder
    {
        $query = SysPayAccount::query();
        if (! AdminContext::isSuper()) {
            return $query->whereIn('site_id', [0, AdminContext::siteId()]);
        }
        if ($siteId > 0) {
            $withShared ? $query->whereIn('site_id', [0, $siteId]) : $query->where('site_id', $siteId);
        }
        return $query;
    }

    /** 写操作定位:站点管理员只能操作本站点账户,平台共享账户只读 */
    private function findWritable(int $id): SysPayAccount
    {
        /** @var SysPayAccount|null $account */
        $account = SysPayAccount::query()->find($id);
        if ($account === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '收款账户不存在');
        }
        if (! AdminContext::isSuper() && (int) $account->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $account;
    }

    /**
     * 账户被未删除站点渠道引用数。
     * 站点管理员看列表时只统计本站点绑定(不暴露其他站点对平台共享账户的使用情况);删除校验用全局口径。
     * @return array<int, int>
     */
    private function bindCounts(array $ids, bool $global = false): array
    {
        if ($ids === []) {
            return [];
        }
        $query = Db::table('sys_pay_channel')->whereNull('deleted_at')->whereIn('account_id', $ids);
        if (! $global && ! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        }
        return $query->groupBy('account_id')
            ->selectRaw('account_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'account_id')
            ->map(static fn ($v) => (int) $v)->all();
    }

    private function presentRow(SysPayAccount $account, int $bindCount): array
    {
        $row = $account->toArray(); // hidden 已剔除全部密文列
        $row['app_key'] = SecretField::mask((string) $account->app_key);
        $row['key_pwd'] = SecretField::mask((string) $account->key_pwd);
        $row['has_cert'] = (string) $account->cert_pem !== '';
        $row['has_key'] = (string) $account->key_pem !== '';
        $row['has_ca'] = (string) $account->ca_pem !== '';
        $row['has_key_pwd'] = (string) $account->key_pwd !== '';
        $row['readonly'] = ! AdminContext::isSuper() && (int) $account->site_id !== AdminContext::siteId();
        $row['bind_count'] = $bindCount;
        return $row;
    }

    private function fill(SysPayAccount $account, array $input): void
    {
        $isNew = ! $account->exists;
        $channelCode = trim((string) ($input['channelCode'] ?? ''));
        if ($channelCode !== '' && $channelCode !== self::CHANNEL_KBZ_MMQR) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '收款账户渠道仅支持 kbz_mmqr');
        }

        $account->account_name = $this->text($input, 'accountName', (string) $account->account_name, 100, true);
        $mode = (int) ($input['mode'] ?? ($account->mode ?? 0));
        if (! in_array($mode, [SysPayAccount::MODE_DIRECT, SysPayAccount::MODE_ISV], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '模式仅支持 1直连 / 2服务商');
        }
        $account->mode = $mode;
        $env = strtolower(trim((string) ($input['env'] ?? ($account->env ?? ''))));
        if (! in_array($env, SysPayAccount::ENVS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '环境仅支持 uat / prod');
        }
        $account->env = $env;
        $account->app_id = $this->text($input, 'appId', (string) $account->app_id, 64, true);
        $account->merch_code = $this->text($input, 'merchCode', (string) $account->merch_code, 64, true);

        // AppKey:留空/脱敏回显值 => 保留原密文;新增必填
        $appKey = trim((string) ($input['appKey'] ?? ''));
        if ($appKey !== '' && ! str_contains($appKey, '*') && preg_match('/[\r\n]/', $appKey)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'AppKey 格式不正确');
        }
        $account->app_key = SecretField::keep($appKey, (string) $account->app_key);
        if ($isNew && (string) $account->app_key === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 appKey 不能为空');
        }

        // 退款双向证书:只校验格式,AES 加密入库,不落盘
        $certPem = $this->pemInput($input, 'certPem');
        if ($certPem !== '') {
            $this->assertCert($certPem, '商户证书 certPem');
            $account->cert_pem = SecretField::keep($certPem, '');
        }
        $caPem = $this->pemInput($input, 'caPem');
        if ($caPem !== '') {
            $this->assertCert($caPem, 'CA 证书 caPem');
            $account->ca_pem = SecretField::keep($caPem, '');
        }
        $keyPwd = (string) ($input['keyPwd'] ?? '');
        $keyPwdChanged = $keyPwd !== '' && ! str_contains($keyPwd, '*');
        $keyPem = $this->pemInput($input, 'keyPem');
        if ($keyPem !== '' || $keyPwdChanged) {
            $effectiveKey = $keyPem !== '' ? $keyPem : SecretField::plain((string) $account->key_pem);
            $effectivePwd = $keyPwdChanged ? $keyPwd : SecretField::plain((string) $account->key_pwd);
            if ($effectiveKey !== '') {
                $this->assertPrivateKey($effectiveKey, $effectivePwd);
            }
            unset($effectiveKey, $effectivePwd);
        }
        if ($keyPem !== '') {
            $account->key_pem = SecretField::keep($keyPem, '');
        }
        $account->key_pwd = SecretField::keep($keyPwdChanged ? $keyPwd : '', (string) $account->key_pwd);
        foreach (['cert_pem', 'key_pem', 'ca_pem', 'key_pwd'] as $col) {
            $account->{$col} = (string) ($account->{$col} ?? '');
        }

        $notify = rtrim(trim((string) ($input['notifyBaseUrl'] ?? ($account->notify_base_url ?? ''))), '/');
        if ($notify !== '' && (! str_starts_with(strtolower($notify), 'https://')
            || filter_var($notify, FILTER_VALIDATE_URL) === false || strlen($notify) > 255)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '回调基础地址须为 https:// 开头的合法 URL');
        }
        $account->notify_base_url = $notify;
        $account->remark = $this->text($input, 'remark', (string) $account->remark, 255, false);
    }

    private function text(array $input, string $key, string $current, int $max, bool $required): string
    {
        $value = array_key_exists($key, $input) && $input[$key] !== null ? trim((string) $input[$key]) : $current;
        if ($required && $value === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为空");
        }
        if (mb_strlen($value) > $max) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能超过 {$max} 个字符");
        }
        return $value;
    }

    /** PEM 入参:留空/含*(脱敏占位)视为不修改,返回 '';否则统一换行并做结构校验 */
    private function pemInput(array $input, string $key): string
    {
        $pem = trim(str_replace(["\r\n", "\r"], "\n", (string) ($input[$key] ?? '')));
        if ($pem === '' || str_contains($pem, '*')) {
            return '';
        }
        $pattern = '/-----BEGIN ([A-Z0-9 ]+)-----\n(.*?)\n?-----END \1-----/s';
        $blocks = [];
        $invalid = strlen($pem) > 32768
            || preg_match_all($pattern, $pem, $blocks, PREG_SET_ORDER) < 1
            || trim((string) preg_replace($pattern, '', $pem)) !== '';
        foreach ($invalid ? [] : $blocks as $block) {
            // 正文仅允许 base64 及加密私钥的 Proc-Type / DEK-Info 头
            if (trim($block[2]) === '' || preg_match('/^[A-Za-z0-9+\/=:,\- \n]+$/D', $block[2]) !== 1) {
                $invalid = true;
                break;
            }
        }
        if ($invalid) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不是合法的 PEM 文本");
        }
        return $pem . "\n";
    }

    private function assertCert(string $pem, string $label): void
    {
        $cert = @openssl_x509_read($pem);
        while (openssl_error_string() !== false) {
        }
        if ($cert === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "{$label} 无法解析,请上传 PEM 格式的 X.509 证书");
        }
    }

    private function assertPrivateKey(string $pem, string $pwd): void
    {
        $key = @openssl_pkey_get_private($pem, $pwd === '' ? null : $pwd);
        while (openssl_error_string() !== false) {
        }
        if ($key === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '私钥 keyPem 无法解析或私钥密码 keyPwd 不正确');
        }
    }
}
