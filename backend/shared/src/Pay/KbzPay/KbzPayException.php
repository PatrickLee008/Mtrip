<?php

declare(strict_types=1);

namespace Mtrip\Shared\Pay\KbzPay;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * KBZPay 调用异常
 *
 * kind 区分故障来源,调用方据此给出不同提示 / 决定是否重试:
 *   - network  :连不上 / 超时 / 无响应体(可重试)
 *   - sign     :响应验签失败,或 KBZ 返回签名/AppKey 类错误码(配置问题,重试无用)
 *   - business :KBZ 返回 result != SUCCESS(其余业务错误,如订单不存在)
 *   - protocol :响应无法解析(非 JSON / 缺 Response)
 *   - config   :本地配置缺失(如退款缺证书)
 *
 * 业务码统一用 THIRD_PARTY_ERROR(50002);消息里只放 KBZ 的 code/msg,
 * **不得**放 AppKey、证书、私钥密码、签名原串或原始响应体。
 */
class KbzPayException extends BusinessException
{
    public const KIND_NETWORK = 'network';
    public const KIND_SIGN = 'sign';
    public const KIND_BUSINESS = 'business';
    public const KIND_PROTOCOL = 'protocol';
    public const KIND_CONFIG = 'config';

    /**
     * 「订单不存在 / 查单失败」类错误码 —— 连通性测试用随机单号查单时,KBZ 回这些码即代表
     * 网络与签名均已通过。KBZ 文档错误码表未能在线核实,以下取自方案 §7 与常见命名,联调时需校准。
     */
    private const ORDER_NOT_FOUND_CODES = [
        'QUERYORDER_FAIL',
        'QUERY_ORDER_FAIL',
        'ORDER_NOT_EXIST',
        'ORDER_NOT_EXISTS',
        'ORDER_NOT_FOUND',
        'ORDER_DOES_NOT_EXIST',
        'TRADE_NOT_EXIST',
        'MERCH_ORDER_NOT_EXIST',
    ];

    public function __construct(
        private string $kind,
        string $message,
        private string $kbzCode = '',
        private string $kbzMsg = '',
    ) {
        parent::__construct(ErrorCode::THIRD_PARTY_ERROR, $message);
    }

    public function kind(): string
    {
        return $this->kind;
    }

    public function kbzCode(): string
    {
        return $this->kbzCode;
    }

    public function kbzMsg(): string
    {
        return $this->kbzMsg;
    }

    /** 由 KBZ 失败响应的 code/msg 构造:签名/AppKey 类归 KIND_SIGN,其余 KIND_BUSINESS */
    public static function fromKbzFailure(string $kbzCode, string $kbzMsg): self
    {
        $kind = self::isSignError($kbzCode, $kbzMsg) ? self::KIND_SIGN : self::KIND_BUSINESS;
        $label = $kind === self::KIND_SIGN ? 'KBZPay 签名校验失败' : 'KBZPay 业务失败';
        return new self($kind, sprintf('%s:%s %s', $label, $kbzCode, mb_substr($kbzMsg, 0, 200)), $kbzCode, $kbzMsg);
    }

    /**
     * 是否「签名错误 / AppKey 错误 / 商户鉴权失败」一类
     *
     * 判定为启发式(错误码表未能在线核实):code 含 SIGN / APPKEY / APP_KEY / AUTH,
     * 或 msg 以整词形式提到 sign / signature / app key。
     */
    public static function isSignError(string $kbzCode, string $kbzMsg = ''): bool
    {
        $code = strtoupper($kbzCode);
        foreach (['SIGN', 'APPKEY', 'APP_KEY', 'AUTH'] as $needle) {
            if (str_contains($code, $needle)) {
                return true;
            }
        }
        return preg_match('/\b(sign|signature|app\s*key)\b/i', $kbzMsg) === 1;
    }

    /** 是否「订单不存在 / 查单失败」类错误码(连通性测试据此判定连通成功) */
    public static function isOrderNotFound(string $kbzCode): bool
    {
        $code = strtoupper(trim($kbzCode));
        if ($code === '') {
            return false;
        }
        if (in_array($code, self::ORDER_NOT_FOUND_CODES, true)) {
            return true;
        }
        return str_contains($code, 'NOT_EXIST') || str_contains($code, 'NOT_FOUND');
    }
}
