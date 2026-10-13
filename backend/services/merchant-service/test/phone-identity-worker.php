<?php

declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantPhoneIdentityService;
use App\Service\MerchantEmailIdentityService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Exception\BusinessException;

[$script, $mode, $emailHash, $phoneHash, $merchantId] = $argv;
try {
    MerchantPhoneIdentityService::transaction($emailHash, $phoneHash, function () use ($mode, $emailHash, $phoneHash, $merchantId): void {
        MerchantEmailIdentityService::assertAvailable($emailHash);
        MerchantPhoneIdentityService::assertAvailable($phoneHash);
        usleep(150000);
        if ($mode === 'application') Db::table('merchant_application')->insert([
            'site_id' => 991, 'app_no' => 'PHONE-RACE-' . bin2hex(random_bytes(3)), 'company_name' => 'Race',
            'registration_email_index' => $emailHash, 'registration_phone_index' => $phoneHash,
        ]);
        else Db::table('merchant_admin')->insert([
            'site_id' => 992, 'merchant_id' => (int) $merchantId, 'username' => 'phone-race-' . bin2hex(random_bytes(3)),
            'password' => '', 'is_owner' => 1, 'account_type' => 2, 'email_index' => $emailHash, 'mobile_index' => $phoneHash,
        ]);
    });
    echo json_encode(['ok' => true]);
} catch (BusinessException $e) {
    echo json_encode(['ok' => false, 'code' => $e->getCode()]);
}
