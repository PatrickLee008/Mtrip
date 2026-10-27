<?php

declare(strict_types=1);

namespace App\Service;

use App\Payment\KbzMmqrChannel;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Pay\KbzPay\KbzAccountConfig;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Support\CryptoHelper;

/**
 * 收款账户与站点路由(方案 22 §5.2)
 *
 * - 下单:sys_pay_channel(site_id + channel_code + status=1 + 未删除,按 sort、id)→ 本站点无可用绑定时
 *   沿 sys_site.parent_id 向上回溯直至 site_id=0(PaymentRules::siteCandidates,防环);
 *   账户 sys_pay_account 须启用且未删除,停用账户的绑定视为不可用(跳过,继续按顺序/向上找)。
 * - 回调 / 查单 / 退款:只按流水快照 account_id / binding_id 取账户,不看当前启停状态,
 *   也不依赖回调报文字段选账户。
 *
 * 凭据只在内存中解密使用,不写日志、不进异常消息。
 */
class PayAccountResolver
{
    public const CALLBACK_PATH = '/api/v1/payment/callback/kbz-mmqr';

    public const MODE_DIRECT = 1;
    public const MODE_ISV = 2;

    #[Inject]
    protected ConfigInterface $config;

    /**
     * 下单选路并校验币种 / 限额 / 服务商子商户
     *
     * @return array{binding: array, account: array, config: KbzAccountConfig, notifyUrl: string}
     */
    public function resolveForCreate(int $siteId, string $channel, string $currency, int $amountCents): array
    {
        if ($channel !== KbzMmqrChannel::CODE) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '暂不支持的支付渠道');
        }
        if ($currency !== 'MMK') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'KBZPay MMQR 仅支持 MMK');
        }
        $found = $this->firstUsableBinding($siteId, $channel);
        if ($found === null) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前站点未开通 KBZPay 扫码支付');
        }
        [$binding, $account] = $found;
        $this->assertBindingAccepts($binding, $currency, $amountCents);
        return [
            'binding' => $binding,
            'account' => $account,
            'config' => $this->buildConfig($account, $binding, false),
            'notifyUrl' => $this->notifyUrl($account),
        ];
    }

    /**
     * 站点可用渠道(业务方渲染支付方式用):与下单同一套回溯与启停判定,不解密凭据
     *
     * @return list<array{channel: string, currencies: list<string>, minAmount: string, maxAmount: string}>
     */
    public function availableForSite(int $siteId): array
    {
        $found = $this->firstUsableBinding($siteId, KbzMmqrChannel::CODE);
        if ($found === null) {
            return [];
        }
        [$binding] = $found;
        $currencies = $binding['currencies'] ?? null;
        if (is_string($currencies) && $currencies !== '') {
            $currencies = json_decode($currencies, true);
        }
        $list = is_array($currencies) && $currencies !== []
            ? array_values(array_intersect(['MMK'], array_map(static fn ($c) => strtoupper(trim((string) $c)), $currencies)))
            : ['MMK'];
        if ($list === []) {
            return [];
        }
        return [[
            'channel' => KbzMmqrChannel::CODE,
            'currencies' => $list,
            'minAmount' => PaymentRules::fromCents(PaymentRules::toCents((string) ($binding['min_amount'] ?? '0')) ?? 0),
            'maxAmount' => PaymentRules::fromCents(PaymentRules::toCents((string) ($binding['max_amount'] ?? '0')) ?? 0),
        ]];
    }

    /**
     * 本站点 → 上级 → … → 全局,取第一个「绑定启用 + 账户启用且未删除」的绑定
     *
     * @return array{0: array, 1: array}|null [binding, account]
     */
    private function firstUsableBinding(int $siteId, string $channel): ?array
    {
        $parentMap = Db::connection('system')->table('sys_site')
            ->whereNull('deleted_at')->pluck('parent_id', 'id')->all();

        foreach (PaymentRules::siteCandidates($siteId, $parentMap) as $candidate) {
            $bindings = Db::connection('system')->table('sys_pay_channel')
                ->where('site_id', $candidate)
                ->where('channel_code', $channel)
                ->where('status', 1)
                ->whereNull('deleted_at')
                ->orderBy('sort')->orderBy('id')
                ->get();
            foreach ($bindings as $binding) {
                $binding = (array) $binding;
                $accountId = (int) ($binding['account_id'] ?? 0);
                if ($accountId <= 0) {
                    continue;
                }
                $account = Db::connection('system')->table('sys_pay_account')
                    ->where('id', $accountId)
                    ->where('channel_code', $channel)
                    ->where('status', 1)
                    ->whereNull('deleted_at')
                    ->first();
                if ($account === null) {
                    continue;
                }
                return [$binding, (array) $account];
            }
        }
        return null;
    }

    /**
     * 按流水快照取账户配置(回调验签 / 查单 / 退款);不过滤启停与软删,保证历史流水可验签与退款
     */
    public function configForTransaction(array $tx, bool $withCert = false): KbzAccountConfig
    {
        $account = Db::connection('system')->table('sys_pay_account')
            ->where('id', (int) ($tx['account_id'] ?? 0))->first();
        if ($account === null) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '流水快照的收款账户不存在');
        }
        $binding = null;
        if ((int) ($tx['binding_id'] ?? 0) > 0) {
            $row = Db::connection('system')->table('sys_pay_channel')->where('id', (int) $tx['binding_id'])->first();
            $binding = $row === null ? null : (array) $row;
        }
        return $this->buildConfig((array) $account, $binding, $withCert);
    }

    /** 解密密文字段;空串或失败返回 '' */
    public function decrypt(?string $cipher): string
    {
        $cipher = (string) $cipher;
        if ($cipher === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($cipher, (string) $this->config->get('mtrip.aes_key', ''));
        } catch (\Throwable) {
            return '';
        }
    }

    /**
     * KBZ notify_url = 账户 notify_base_url(或 env PAYMENT_NOTIFY_BASE_URL)+ 固定回调路径
     * 两者都没有 → 配置错误(不调 KBZ);不在代码中写死任何域名。
     */
    public function notifyUrl(array $account): string
    {
        $base = rtrim(trim((string) ($account['notify_base_url'] ?? '')), '/');
        if ($base === '') {
            $base = rtrim(trim((string) $this->config->get('mtrip.payment_notify_base_url', '')), '/');
        }
        if ($base === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR,
                '支付渠道配置错误:未配置 KBZ 回调基地址(收款账户 notify_base_url 或 env PAYMENT_NOTIFY_BASE_URL)');
        }
        $scheme = strtolower((string) parse_url($base, PHP_URL_SCHEME));
        if (filter_var($base, FILTER_VALIDATE_URL) === false || ! in_array($scheme, ['http', 'https'], true)
            || str_contains($base, '?') || str_contains($base, '#')) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '支付渠道配置错误:KBZ 回调基地址不合法');
        }
        return $base . self::CALLBACK_PATH;
    }

    /**
     * 组装 KbzAccountConfig;服务商模式从绑定取子商户,缺失视为配置错误
     */
    public function buildConfig(array $account, ?array $binding, bool $withCert): KbzAccountConfig
    {
        $appKey = $this->decrypt($account['app_key'] ?? '');
        $env = (string) ($account['env'] ?? '');
        if ($appKey === '' || (string) ($account['app_id'] ?? '') === '' || (string) ($account['merch_code'] ?? '') === ''
            || ! in_array($env, [KbzAccountConfig::ENV_UAT, KbzAccountConfig::ENV_PROD], true)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR,
                '支付渠道配置错误:收款账户 AppId / MerchCode / AppKey / 环境不完整,或 AppKey 解密失败');
        }
        $subMerch = '';
        $subApp = '';
        if ((int) ($account['mode'] ?? self::MODE_DIRECT) === self::MODE_ISV) {
            $subMerch = trim((string) ($binding['sub_merch_code'] ?? ''));
            $subApp = trim((string) ($binding['sub_app_id'] ?? ''));
            if ($subMerch === '') {
                throw new BusinessException(ErrorCode::SERVER_ERROR, '支付渠道配置错误:服务商模式未配置子商户号');
            }
        }
        return new KbzAccountConfig(
            $env,
            (string) $account['app_id'],
            (string) $account['merch_code'],
            $appKey,
            $subMerch,
            $subApp,
            $withCert ? $this->decrypt($account['cert_pem'] ?? '') : '',
            $withCert ? $this->decrypt($account['key_pem'] ?? '') : '',
            $withCert ? $this->decrypt($account['key_pwd'] ?? '') : '',
            $withCert ? $this->decrypt($account['ca_pem'] ?? '') : '',
        );
    }

    /** 绑定的币种列表与限额(0 = 不限) */
    private function assertBindingAccepts(array $binding, string $currency, int $amountCents): void
    {
        $currencies = $binding['currencies'] ?? null;
        if (is_string($currencies) && $currencies !== '') {
            $currencies = json_decode($currencies, true);
        }
        if (is_array($currencies) && $currencies !== []) {
            $list = array_map(static fn ($c) => strtoupper(trim((string) $c)), $currencies);
            if (! in_array($currency, $list, true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '当前支付渠道不支持币种 ' . $currency);
            }
        }
        $min = PaymentRules::toCents((string) ($binding['min_amount'] ?? '0')) ?? 0;
        $max = PaymentRules::toCents((string) ($binding['max_amount'] ?? '0')) ?? 0;
        if (! PaymentRules::amountInRange($amountCents, $min, $max)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, sprintf(
                '支付金额超出渠道限额(%s – %s)',
                $min > 0 ? PaymentRules::fromCents($min) : '不限',
                $max > 0 ? PaymentRules::fromCents($max) : '不限'
            ));
        }
    }
}
