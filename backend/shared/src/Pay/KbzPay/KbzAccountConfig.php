<?php

declare(strict_types=1);

namespace Mtrip\Shared\Pay\KbzPay;

/**
 * KBZPay 收款账户配置 DTO(由调用方从 sys_pay_account + sys_pay_channel 解密组装)
 *
 * - 直连模式:subMerchCode / subAppId 留空;
 * - 服务商模式:本 DTO 的 appId/merchCode/appKey 为服务商自身凭据,subMerchCode/subAppId 为站点绑定的子商户。
 * - certPem/keyPem/keyPwd/caPem 仅退款(mTLS)需要,均为**明文 PEM 文本**(调用方已解密)。
 *
 * 安全:本对象含 AppKey 与私钥,禁止整体 var_export / json_encode 进日志。
 */
final class KbzAccountConfig
{
    public const ENV_UAT = 'uat';
    public const ENV_PROD = 'prod';

    public function __construct(
        public readonly string $env,
        public readonly string $appId,
        public readonly string $merchCode,
        public readonly string $appKey,
        public readonly string $subMerchCode = '',
        public readonly string $subAppId = '',
        public readonly string $certPem = '',
        public readonly string $keyPem = '',
        public readonly string $keyPwd = '',
        public readonly string $caPem = '',
    ) {
        if ($env !== self::ENV_UAT && $env !== self::ENV_PROD) {
            throw new \InvalidArgumentException('KBZPay env 只能是 uat 或 prod');
        }
    }

    /** 服务商模式:配置了子商户号 */
    public function isServiceProvider(): bool
    {
        return $this->subMerchCode !== '';
    }

    /** 是否具备退款所需的双向证书(cert + key 必需,CA 可选) */
    public function hasRefundCert(): bool
    {
        return trim($this->certPem) !== '' && trim($this->keyPem) !== '';
    }
}
