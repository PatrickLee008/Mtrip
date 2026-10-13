<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantEmailIdentityService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;

$mode = $argv[1];
$hash = $argv[2];
$merchantId = (int) $argv[3];
$plainEmail = $argv[4] ?? 'identity-race@example.test';
try {
    MerchantEmailIdentityService::transaction($hash, function () use ($mode, $hash, $merchantId, $plainEmail): void {
        MerchantEmailIdentityService::assertAvailable($hash);
        usleep(100000);
        $email = CryptoHelper::encrypt($plainEmail, (string) Hyperf\Config\config('mtrip.aes_key'));
        if ($mode === 'application') {
            Db::table('merchant_application')->insert(['site_id' => 991, 'app_no' => 'EMAIL-RACE-' . substr($hash, 0, 8),
                'company_name' => 'Race', 'registration_email' => $email, 'registration_email_index' => $hash]);
        } else {
            Db::table('merchant_admin')->insert(['site_id' => 992, 'merchant_id' => $merchantId,
                'username' => 'email-race-' . substr($hash, 0, 8), 'password' => '', 'email' => $email, 'email_index' => $hash]);
        }
    });
    echo json_encode(['ok' => true]) . PHP_EOL;
} catch (BusinessException $e) {
    if ($e->getCode() !== \Mtrip\Shared\Constants\ErrorCode::DATA_CONFLICT) throw $e;
    echo json_encode(['ok' => false, 'code' => $e->getCode()]) . PHP_EOL;
}
