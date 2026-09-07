<?php

declare(strict_types=1);

namespace Mtrip\Shared\Constants;

/**
 * 全平台统一错误码(对应功能设计文档 6.3 统一错误码规范)
 */
class ErrorCode
{
    /** 成功 */
    public const SUCCESS = 0;

    /** 参数错误 (HTTP 400) */
    public const PARAM_ERROR = 40001;
    /** 参数校验失败 (HTTP 400) */
    public const PARAM_VALIDATE_FAIL = 40002;

    /** 未登录 / Token无效 (HTTP 401) */
    public const UNAUTHORIZED = 40101;
    /** Token已过期 (HTTP 401) */
    public const TOKEN_EXPIRED = 40102;
    /** 客户端鉴权失败 (HTTP 401) */
    public const CLIENT_AUTH_FAIL = 40103;

    /** 无操作权限 (HTTP 403) */
    public const FORBIDDEN = 40301;
    /** 无数据权限(跨站点) (HTTP 403) */
    public const NO_DATA_PERMISSION = 40302;
    /** 接口权限不足(客户端) (HTTP 403) */
    public const CLIENT_API_FORBIDDEN = 40303;

    /** 资源不存在 (HTTP 404) */
    public const NOT_FOUND = 40401;
    /** 促销码不存在 (HTTP 404) */
    public const PROMO_CODE_NOT_FOUND = 40411;

    /** 数据冲突 (HTTP 409) */
    public const DATA_CONFLICT = 40901;

    /*
     * 促销码兑换的细分错误码(C-M6):
     * App 侧要按「不存在 / 过期 / 领完 / 重复 / 资格不符」给出不同文案,
     * 只靠 40401+40901 两个码区分不出来,故单独编号。
     */
    /** 促销码未生效或已过期 (HTTP 409) */
    public const PROMO_CODE_EXPIRED = 40911;
    /** 促销码已兑完 (HTTP 409) */
    public const PROMO_CODE_EXHAUSTED = 40912;
    /** 促销码已兑换过(超出每人限兑) (HTTP 409) */
    public const PROMO_CODE_DUPLICATED = 40913;
    /** 不符合促销码兑换资格 (HTTP 409) */
    public const PROMO_CODE_INELIGIBLE = 40914;

    /** 请求过于频繁(限流) (HTTP 429) */
    public const TOO_MANY_REQUESTS = 42901;
    /** 重复提交(并发锁/FormId 幂等拦截) (HTTP 429) */
    public const REPEAT_SUBMIT = 42902;

    /** 服务器内部错误 (HTTP 500) */
    public const SERVER_ERROR = 50001;
    /** 第三方服务调用失败 (HTTP 500) */
    public const THIRD_PARTY_ERROR = 50002;
    /** 数据库操作失败 (HTTP 500) */
    public const DB_ERROR = 50003;

    /** 业务code → HTTP 状态码映射 */
    public const HTTP_MAP = [
        self::SUCCESS => 200,
        self::PARAM_ERROR => 400,
        self::PARAM_VALIDATE_FAIL => 400,
        self::UNAUTHORIZED => 401,
        self::TOKEN_EXPIRED => 401,
        self::CLIENT_AUTH_FAIL => 401,
        self::FORBIDDEN => 403,
        self::NO_DATA_PERMISSION => 403,
        self::CLIENT_API_FORBIDDEN => 403,
        self::NOT_FOUND => 404,
        self::PROMO_CODE_NOT_FOUND => 404,
        self::DATA_CONFLICT => 409,
        self::PROMO_CODE_EXPIRED => 409,
        self::PROMO_CODE_EXHAUSTED => 409,
        self::PROMO_CODE_DUPLICATED => 409,
        self::PROMO_CODE_INELIGIBLE => 409,
        self::TOO_MANY_REQUESTS => 429,
        self::REPEAT_SUBMIT => 429,
        self::SERVER_ERROR => 500,
        self::THIRD_PARTY_ERROR => 500,
        self::DB_ERROR => 500,
    ];

    /** 默认错误文案 */
    public const MESSAGE_MAP = [
        self::SUCCESS => 'success',
        self::PARAM_ERROR => '参数错误',
        self::PARAM_VALIDATE_FAIL => '参数校验失败',
        self::UNAUTHORIZED => '未登录或Token无效',
        self::TOKEN_EXPIRED => 'Token已过期',
        self::CLIENT_AUTH_FAIL => '客户端鉴权失败',
        self::FORBIDDEN => '无操作权限',
        self::NO_DATA_PERMISSION => '无数据权限',
        self::CLIENT_API_FORBIDDEN => '接口权限不足',
        self::NOT_FOUND => '资源不存在',
        self::PROMO_CODE_NOT_FOUND => '促销码不存在',
        self::DATA_CONFLICT => '数据冲突',
        self::PROMO_CODE_EXPIRED => '促销码未生效或已过期',
        self::PROMO_CODE_EXHAUSTED => '促销码已兑完',
        self::PROMO_CODE_DUPLICATED => '该促销码已兑换过',
        self::PROMO_CODE_INELIGIBLE => '不符合该促销码的兑换资格',
        self::TOO_MANY_REQUESTS => '请求过于频繁',
        self::REPEAT_SUBMIT => '请求正在处理中,请勿重复提交',
        self::SERVER_ERROR => '服务器内部错误',
        self::THIRD_PARTY_ERROR => '第三方服务调用失败',
        self::DB_ERROR => '数据库操作失败',
    ];

    public static function httpStatus(int $code): int
    {
        return self::HTTP_MAP[$code] ?? 500;
    }

    public static function message(int $code): string
    {
        return self::MESSAGE_MAP[$code] ?? '未知错误';
    }
}
