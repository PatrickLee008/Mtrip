<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * 单号生成器
 * 订单号规则(文档模块5):站点编码 + 日期 + 时间戳 + 随机数,全局唯一
 */
class OrderNoGenerator
{
    /** 进程内自增序列(随机起点),同一毫秒内防碰撞;跨进程由时间戳段 + DB 唯一索引兜底 */
    private static ?int $sequence = null;

    /**
     * 订单号:{站点编码4位}{yyyyMMdd}{时间戳后6位}{序列4位} = 22 位
     */
    public static function orderNo(int $siteId): string
    {
        $site = str_pad((string) ($siteId % 10000), 4, '0', STR_PAD_LEFT);
        $date = date('Ymd');
        $ts = substr((string) (int) (microtime(true) * 1000), -6);
        self::$sequence = self::$sequence === null ? random_int(0, 9999) : (self::$sequence + 1) % 10000;
        $seq = str_pad((string) self::$sequence, 4, '0', STR_PAD_LEFT);
        return $site . $date . $ts . $seq;
    }

    /**
     * 资金流水号:F + yyyyMMddHHmmss + 随机6位
     */
    public static function flowNo(): string
    {
        return 'F' . date('YmdHis') . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    /**
     * 核销码:16位大写字母数字
     */
    public static function verifyCode(): string
    {
        return strtoupper(bin2hex(random_bytes(8)));
    }

    /**
     * ClientId:CID + 16位十六进制;ClientSecret:sk- + 40位
     */
    public static function clientId(): string
    {
        return 'CID' . strtoupper(bin2hex(random_bytes(8)));
    }

    public static function clientSecret(): string
    {
        return 'sk-' . bin2hex(random_bytes(20));
    }
}
