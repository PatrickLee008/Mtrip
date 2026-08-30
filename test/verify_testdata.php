#!/usr/bin/env php
<?php
/**
 * 测试数据抽样校验:证明 test/sql 下的加密数据可被后端同款算法回解。
 *
 * 校验内容:
 *   1) AES-256-GCM 密文(sys_storage / sys_pay_channel / sys_sms_channel /
 *      sys_map_config / sys_client)可被 CryptoHelper 同款算法解密为明文;
 *   2) user_info.mobile_hash 与 merchant_info.contact_phone_index 的 HMAC 与
 *      后端 UserAuthService / MerchantPhoneIndex 算法一致;
 *   3) bcrypt 口令(sys_admin / merchant_admin / user_info / supplier_admin)可
 *      用已知明文(Admin@123456 等)校验通过。
 *
 * 用法: php test/verify_testdata.php
 * 连接参数同 apply.sh,可被环境变量覆盖。
 */

function loadEnvDb(): array
{
    $envFile = __DIR__ . '/../deploy/.env';
    $cfg = [
        'host' => '127.0.0.1', 'port' => '3307',
        'user' => 'mtrip', 'pass' => 'mtrip@2026',
    ];
    if (file_exists($envFile)) {
        foreach (file($envFile) as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) {
                continue;
            }
            $parts = explode('=', $line, 2);
            $k = trim($parts[0]);
            $v = isset($parts[1]) ? trim($parts[1]) : '';
            $v = trim($v, "\"'");
            switch ($k) {
                case 'DB_HOST': $cfg['host'] = $v; break;
                case 'DB_PORT': $cfg['port'] = $v; break;
                case 'DB_USERNAME': $cfg['user'] = $v; break;
                case 'DB_PASSWORD': $cfg['pass'] = $v; break;
            }
        }
    }
    foreach (['DB_HOST' => 'host', 'DB_PORT' => 'port', 'DB_USERNAME' => 'user', 'DB_PASSWORD' => 'pass'] as $e => $c) {
        if (getenv($e) !== false) {
            $cfg[$c] = getenv($e);
        }
    }
    return $cfg;
}

function decryptAes(string $encoded, string $rawKey): ?string
{
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 28) {
        return null;
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $ct = substr($raw, 28);
    $pt = openssl_decrypt($ct, 'aes-256-gcm', $rawKey, OPENSSL_RAW_DATA, $iv, $tag);
    return $pt === false ? null : $pt;
}

$db = loadEnvDb();
$mysqli = new mysqli($db['host'], $db['user'], $db['pass'], '', (int) $db['port']);
if ($mysqli->connect_error) {
    fwrite(STDERR, "连接数据库失败: {$mysqli->connect_error}\n");
    exit(2);
}

$manifestPath = __DIR__ . '/sql/.verify_manifest.json';
if (!file_exists($manifestPath)) {
    fwrite(STDERR, "缺少校验清单 .verify_manifest.json,请先运行 gen_testdata.py\n");
    exit(2);
}
$manifest = json_decode(file_get_contents($manifestPath), true);
$aesKey = $manifest['aes_key'];
$rawKey = hash('sha256', $aesKey, true);

$pass = 0;
$fail = 0;
function check(bool $ok, string $label, string $detail = ''): void
{
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "  [OK]   $label\n";
    } else {
        $fail++;
        echo "  [FAIL] $label" . ($detail ? "  -> $detail" : '') . "\n";
    }
}

echo "==> AES-256-GCM 密文回解(后端同款算法)\n";
foreach ($manifest['samples'] as $s) {
    $dbName = $s['db'];
    $tbl = $s['table'];
    $col = $s['col'];
    $id = (int) $s['id'];
    $plain = $s['plaintext'];
    $res = $mysqli->query("SELECT `$col` AS v FROM `$dbName`.`$tbl` WHERE id = $id");
    if (!$res || $res->num_rows === 0) {
        check(false, "$dbName.$tbl#$id.$col", "行不存在(数据未导入?)");
        continue;
    }
    $row = $res->fetch_assoc();
    $stored = $row['v'];
    if ($col === 'mobile_hash' || $col === 'contact_phone_index') {
        // HMAC 校验
        $expect = $col === 'mobile_hash'
            ? hash_hmac('sha256', $plain, $aesKey)
            : hash_hmac('sha256', 'm12-phone-v1:' . ltrim(preg_replace('/[\s().\-+]/', '', $plain), '0'), $aesKey);
        check($stored === $expect, "$dbName.$tbl#$id.$col", "HMAC 不匹配");
    } else {
        $dec = decryptAes($stored, $rawKey);
        check($dec === $plain, "$dbName.$tbl#$id.$col", "解密结果=" . var_export($dec, true));
    }
}

echo "==> bcrypt 口令校验(已知明文)\n";
$checks = [
    ['mtrip_system', 'sys_admin', 'id BETWEEN 101 AND 107', 'Admin@123456', '站点管理员/运营/财务/客服/审计/法站/禁用'],
    ['mtrip_business', 'merchant_admin', 'id = 4001', 'Merchant@123456', '商户管理员'],
    ['mtrip_business', 'user_info', 'id = 1001', 'User@123456', 'C 端用户'],
    ['mtrip_business', 'supplier_admin', 'id = 1001', 'Supplier@123456', '供应商管理员'],
];
foreach ($checks as [$dbName, $tbl, $where, $pwd, $desc]) {
    $res = $mysqli->query("SELECT password AS v FROM `$dbName`.`$tbl` WHERE $where");
    if (!$res) {
        check(false, "$dbName.$tbl ($desc)", $mysqli->error);
        continue;
    }
    $okAll = true;
    $cnt = 0;
    while ($row = $res->fetch_assoc()) {
        $cnt++;
        if (!password_verify($pwd, $row['v'])) {
            $okAll = false;
            break;
        }
    }
    check($okAll && $cnt > 0, "$dbName.$tbl ($desc)", $cnt === 0 ? "无匹配行" : "口令校验未通过");
}

$mysqli->close();
echo "\n结果: 通过 $pass 项, 失败 $fail 项\n";
exit($fail === 0 ? 0 : 1);
