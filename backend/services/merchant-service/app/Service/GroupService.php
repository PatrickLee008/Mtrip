<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 集团服务:集团主账号生成/重置(集团账号 = merchant_admin 中 merchant_id=0 且 group_id>0)
 */
class GroupService
{
    /**
     * 生成或重置集团主账号:无主账号则创建,已有则重置密码并恢复启用
     * @return array{username: string, password: string, created: bool}
     */
    public function resetAccount(array $group): array
    {
        $password = $this->randomPassword();
        $owner = Db::table('merchant_admin')
            ->where('group_id', $group['id'])->where('merchant_id', 0)
            ->where('is_owner', 1)->whereNull('deleted_at')->first();
        if ($owner) {
            Db::table('merchant_admin')->where('id', $owner->id)->update([
                'password' => password_hash($password, PASSWORD_BCRYPT),
                'status' => 1,
            ]);
            return ['username' => (string) $owner->username, 'password' => $password, 'created' => false];
        }
        $username = $this->uniqueUsername((int) $group['id']);
        Db::table('merchant_admin')->insert([
            'site_id' => (int) $group['site_id'],
            'merchant_id' => 0,
            'group_id' => (int) $group['id'],
            'username' => $username,
            'password' => password_hash($password, PASSWORD_BCRYPT),
            'real_name' => (string) $group['contact_name'],
            'mobile' => (string) $group['contact_phone'],
            'is_owner' => 1,
            'status' => 1,
        ]);
        return ['username' => $username, 'password' => $password, 'created' => true];
    }

    /** 集团主账号登录名:g{集团ID}(冲突追加随机后缀) */
    private function uniqueUsername(int $groupId): string
    {
        $username = 'g' . str_pad((string) $groupId, 6, '0', STR_PAD_LEFT);
        while (Db::table('merchant_admin')->where('username', $username)->exists()) {
            $username = 'g' . str_pad((string) $groupId, 6, '0', STR_PAD_LEFT) . random_int(10, 99);
        }
        return $username;
    }

    /** 随机初始密码:12位含大小写字母数字 */
    private function randomPassword(): string
    {
        $pool = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $password = '';
        for ($i = 0; $i < 12; ++$i) {
            $password .= $pool[random_int(0, strlen($pool) - 1)];
        }
        return $password;
    }
}
