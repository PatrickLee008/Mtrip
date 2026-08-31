<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 门店服务:门店账号生成/重置(门店账号 = merchant_admin 中 account_type=3 且 store_id>0)
 * 数据范围=本门店履约(核销、接单),由 merchant-web 登录侧按 account_type 裁剪(二期)
 */
class StoreService
{
    /**
     * 生成或重置门店账号:无账号则创建,已有则重置密码并恢复启用
     * @return array{username: string, password: string, created: bool}
     */
    public function resetAccount(array $store): array
    {
        $password = $this->randomPassword();
        $owner = Db::table('merchant_admin')
            ->where('account_type', 3)->where('store_id', $store['id'])
            ->where('is_owner', 1)->whereNull('deleted_at')->first();
        if ($owner) {
            Db::table('merchant_admin')->where('id', $owner->id)->update([
                'password' => password_hash($password, PASSWORD_BCRYPT),
                'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '',
                'status' => 1,
            ]);
            return ['username' => (string) $owner->username, 'password' => $password, 'created' => false];
        }
        $username = $this->uniqueUsername((int) $store['id']);
        Db::table('merchant_admin')->insert([
            'site_id' => (int) $store['site_id'],
            'account_type' => 3,
            'merchant_id' => (int) $store['merchant_id'],
            'store_id' => (int) $store['id'],
            'username' => $username,
            'password' => password_hash($password, PASSWORD_BCRYPT),
            'real_name' => (string) $store['contact_name'],
            'mobile' => (string) $store['contact_phone'],
            'is_owner' => 1,
            'status' => 1,
        ]);
        return ['username' => $username, 'password' => $password, 'created' => true];
    }

    /** 门店账号登录名:s{门店ID}(冲突追加随机后缀) */
    private function uniqueUsername(int $storeId): string
    {
        $username = 's' . str_pad((string) $storeId, 6, '0', STR_PAD_LEFT);
        while (Db::table('merchant_admin')->where('username', $username)->exists()) {
            $username = 's' . str_pad((string) $storeId, 6, '0', STR_PAD_LEFT) . random_int(10, 99);
        }
        return $username;
    }

    /** 随机初始密码:12位,保证含大小写字母与数字(见 PasswordGenerator) */
    private function randomPassword(): string
    {
        return \App\Support\PasswordGenerator::random();
    }
}
