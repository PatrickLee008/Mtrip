<?php

declare(strict_types=1);

/**
 * Support 纯逻辑类用例:Result / ErrorCode / MaskHelper / CryptoHelper / JwtHelper / OrderNoGenerator
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\Result;

// ---------- Result ----------
MiniTest::add('Result::success 默认结构', static function (): void {
    $r = Result::success(['a' => 1]);
    MiniTest::assertSame(0, $r['code']);
    MiniTest::assertSame('success', $r['message']);
    MiniTest::assertSame(['a' => 1], $r['data']);
    MiniTest::assertTrue(is_int($r['timestamp']), 'timestamp 应为整型');
});

MiniTest::add('Result::page 分页结构', static function (): void {
    $r = Result::page([['id' => 1]], 35, 2, 20);
    MiniTest::assertSame(0, $r['code']);
    MiniTest::assertSame([['id' => 1]], $r['data']['list']);
    MiniTest::assertSame(35, $r['data']['total']);
    MiniTest::assertSame(2, $r['data']['page']);
    MiniTest::assertSame(20, $r['data']['pageSize']);
});

MiniTest::add('Result::error 默认取 ErrorCode 文案,可覆盖', static function (): void {
    $r = Result::error(ErrorCode::FORBIDDEN);
    MiniTest::assertSame(40301, $r['code']);
    MiniTest::assertSame('无操作权限', $r['message']);
    $r2 = Result::error(ErrorCode::PARAM_ERROR, '自定义提示');
    MiniTest::assertSame('自定义提示', $r2['message']);
});

// ---------- ErrorCode ----------
MiniTest::add('ErrorCode HTTP 映射与未知码兜底', static function (): void {
    MiniTest::assertSame(200, ErrorCode::httpStatus(ErrorCode::SUCCESS));
    MiniTest::assertSame(401, ErrorCode::httpStatus(ErrorCode::TOKEN_EXPIRED));
    MiniTest::assertSame(403, ErrorCode::httpStatus(ErrorCode::NO_DATA_PERMISSION));
    MiniTest::assertSame(429, ErrorCode::httpStatus(ErrorCode::TOO_MANY_REQUESTS));
    MiniTest::assertSame(500, ErrorCode::httpStatus(99999), '未知码应兜底 500');
    MiniTest::assertSame('未知错误', ErrorCode::message(99999));
});

MiniTest::add('BusinessException 默认文案与自定义文案', static function (): void {
    $e = new BusinessException(ErrorCode::UNAUTHORIZED);
    MiniTest::assertSame(40101, $e->getCode());
    MiniTest::assertSame('未登录或Token无效', $e->getMessage());
    $e2 = new BusinessException(ErrorCode::PARAM_ERROR, '缺少必填项');
    MiniTest::assertSame('缺少必填项', $e2->getMessage());
});

// ---------- MaskHelper ----------
MiniTest::add('MaskHelper::mobile 常规/短号/空值', static function (): void {
    MiniTest::assertSame('138****1234', MaskHelper::mobile('13800001234'));
    MiniTest::assertSame('******', MaskHelper::mobile('123456'), '<7位全星号');
    MiniTest::assertSame('', MaskHelper::mobile(null));
    MiniTest::assertSame('', MaskHelper::mobile(''));
});

MiniTest::add('MaskHelper::email 常规/短前缀/非邮箱', static function (): void {
    MiniTest::assertSame('abc***@ex.com', MaskHelper::email('abcdef@ex.com'));
    MiniTest::assertSame('ab***@ex.com', MaskHelper::email('ab@ex.com'), '前缀不足3位保留全部');
    MiniTest::assertSame('not-an-email', MaskHelper::email('not-an-email'), '无@原样返回');
    MiniTest::assertSame('', MaskHelper::email(null));
});

MiniTest::add('MaskHelper::secret 长短密钥', static function (): void {
    MiniTest::assertSame('sk-**********0123', MaskHelper::secret('sk-abcdefgh0123'));
    MiniTest::assertSame('**********', MaskHelper::secret('short'), '<=8位输出10星');
    MiniTest::assertSame('', MaskHelper::secret(''));
});

MiniTest::add('MaskHelper::bankCard 尾号4位', static function (): void {
    MiniTest::assertSame('***************6789', MaskHelper::bankCard('6222020200112346789'));
    MiniTest::assertSame('1234', MaskHelper::bankCard('1234'), '<=4位原样返回');
});

MiniTest::add('MaskHelper::idCard 保留前3后4', static function (): void {
    MiniTest::assertSame('110***********5678', MaskHelper::idCard('110101199001015678'));
    MiniTest::assertSame('*******', MaskHelper::idCard('1234567'), '<=7位全星号');
});

MiniTest::add('MaskHelper::maskParams 递归+大小写不敏感+自定义键', static function (): void {
    $masked = MaskHelper::maskParams([
        'name' => 'Tom',
        'Password' => '123456',
        'nested' => ['mobile' => '13800001234', 'keep' => 'v'],
        'myKey' => 'raw',
    ], ['mykey']);
    MiniTest::assertSame('Tom', $masked['name']);
    MiniTest::assertSame('***已脱敏***', $masked['Password'], '键名大小写不敏感');
    MiniTest::assertSame('***已脱敏***', $masked['nested']['mobile'], '嵌套数组递归');
    MiniTest::assertSame('v', $masked['nested']['keep']);
    MiniTest::assertSame('***已脱敏***', $masked['myKey'], '自定义敏感键');
});

// ---------- CryptoHelper ----------
MiniTest::add('CryptoHelper 加解密往返(含中文/空串)', static function (): void {
    $key = 'mtrip-test-key';
    foreach (['hello', '支付密钥sk-测试', ''] as $plain) {
        MiniTest::assertSame($plain, CryptoHelper::decrypt(CryptoHelper::encrypt($plain, $key), $key));
    }
});

MiniTest::add('CryptoHelper 同文两次加密密文不同(随机IV)', static function (): void {
    $key = 'k1';
    MiniTest::assertTrue(
        CryptoHelper::encrypt('same', $key) !== CryptoHelper::encrypt('same', $key),
        '随机 IV 下两次密文应不同'
    );
});

MiniTest::add('CryptoHelper 错误密钥/坏密文抛 50001', static function (): void {
    $encoded = CryptoHelper::encrypt('secret-data', 'right-key');
    MiniTest::assertThrows(BusinessException::class, static function () use ($encoded): void {
        CryptoHelper::decrypt($encoded, 'wrong-key');
    }, 50001, '错误密钥');
    MiniTest::assertThrows(BusinessException::class, static function (): void {
        CryptoHelper::decrypt('!!!not-base64!!!', 'k');
    }, 50001, '非法base64');
    MiniTest::assertThrows(BusinessException::class, static function (): void {
        CryptoHelper::decrypt(base64_encode('short'), 'k');
    }, 50001, '长度不足');
});

// ---------- JwtHelper ----------
MiniTest::add('JwtHelper 签发/校验往返', static function (): void {
    $token = JwtHelper::issue(['admin_id' => 7, 'site_id' => 1, 'name' => '管理员'], 's3cret', 60);
    $claims = JwtHelper::verify($token, 's3cret');
    MiniTest::assertSame(7, $claims['admin_id']);
    MiniTest::assertSame(1, $claims['site_id']);
    MiniTest::assertSame('管理员', $claims['name'], '中文载荷不转义');
    MiniTest::assertTrue(isset($claims['iat'], $claims['exp'], $claims['jti']), '标准声明齐全');
    MiniTest::assertSame(3, count(explode('.', $token)), 'JWT 三段式');
});

MiniTest::add('JwtHelper 篡改/错误密钥/格式错误抛 40101', static function (): void {
    $token = JwtHelper::issue(['admin_id' => 1], 'secret-a');
    MiniTest::assertThrows(BusinessException::class, static function () use ($token): void {
        JwtHelper::verify($token, 'secret-b');
    }, 40101, '错误密钥');
    [$h, $p, $s] = explode('.', $token);
    $tampered = rtrim(strtr(base64_encode(json_encode(['admin_id' => 999, 'exp' => time() + 999])), '+/', '-_'), '=');
    MiniTest::assertThrows(BusinessException::class, static function () use ($h, $tampered, $s): void {
        JwtHelper::verify("{$h}.{$tampered}.{$s}", 'secret-a');
    }, 40101, '篡改载荷');
    MiniTest::assertThrows(BusinessException::class, static function (): void {
        JwtHelper::verify('only.two', 'secret-a');
    }, 40101, '非三段式');
});

MiniTest::add('JwtHelper 过期 Token 抛 40102', static function (): void {
    $token = JwtHelper::issue(['admin_id' => 1], 's', -10);
    MiniTest::assertThrows(BusinessException::class, static function () use ($token): void {
        JwtHelper::verify($token, 's');
    }, 40102, '过期');
});

// ---------- OrderNoGenerator ----------
MiniTest::add('OrderNoGenerator 订单号 22 位且前缀正确', static function (): void {
    $no = OrderNoGenerator::orderNo(12);
    MiniTest::assertSame(22, strlen($no));
    MiniTest::assertSame('0012', substr($no, 0, 4), '站点编码左补零');
    MiniTest::assertSame(date('Ymd'), substr($no, 4, 8), '日期段');
    MiniTest::assertTrue(ctype_digit($no), '纯数字');
    MiniTest::assertSame('4382', substr(OrderNoGenerator::orderNo(14382), 0, 4), '站点ID取模万');
});

MiniTest::add('OrderNoGenerator 流水号/核销码/客户端凭证格式', static function (): void {
    $flow = OrderNoGenerator::flowNo();
    MiniTest::assertSame(21, strlen($flow));
    MiniTest::assertSame('F', $flow[0]);
    MiniTest::assertTrue(ctype_digit(substr($flow, 1)), '流水号 F 后纯数字');

    $code = OrderNoGenerator::verifyCode();
    MiniTest::assertSame(16, strlen($code));
    MiniTest::assertSame(1, preg_match('/^[0-9A-F]{16}$/', $code), '核销码16位大写十六进制');

    $cid = OrderNoGenerator::clientId();
    MiniTest::assertSame(1, preg_match('/^CID[0-9A-F]{16}$/', $cid), 'ClientId 格式');

    $sk = OrderNoGenerator::clientSecret();
    MiniTest::assertSame(1, preg_match('/^sk-[0-9a-f]{40}$/', $sk), 'ClientSecret 格式');
});

MiniTest::add('OrderNoGenerator 连续生成不重复(1000次)', static function (): void {
    $set = [];
    for ($i = 0; $i < 1000; ++$i) {
        $set[OrderNoGenerator::orderNo(1)] = true;
    }
    MiniTest::assertSame(1000, count($set), '订单号应全局唯一');
});
