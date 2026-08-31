<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 商户审核与注销服务；经营状态变化统一由MerchantStatusService负责。
 */
class MerchantService
{
    /**
     * 审核通过:置为已启用并生成商户后台主账号(一次性初始密码明文仅返回一次),同时自动创建主门店
     * 同步生成商户门户访问码(access_code,原型 MTRP-{业态}-{6位})与凭证下发渠道记录
     * @return array{username: string, password: string, one_time_password: string, access_code: string}
     */
    public function approve(
        array $merchant,
        string $remark,
        string $channels = '',
        string $accessCode = '',
        string $password = ''
    ): array
    {
        $username = $this->uniqueUsername((int) $merchant['id']);
        $password = $password !== '' ? $password : $this->randomPassword();
        $accessCode = $accessCode !== '' ? $accessCode : $this->generateAccessCode((int) $merchant['merchant_type']);
        Db::transaction(static function () use ($merchant, $remark, $username, $password, $accessCode, $channels) {
            Db::table('merchant_info')->where('id', $merchant['id'])->update([
                'status' => 3,
                'audit_remark' => mb_substr($remark, 0, 500),
                'audit_by' => \Mtrip\Shared\Context\AdminContext::adminId(),
                'audit_time' => date('Y-m-d H:i:s'),
                'access_code' => $accessCode,
                'credential_channels' => mb_substr($channels, 0, 30),
            ]);
            Db::table('merchant_admin')->insert([
                'site_id' => (int) $merchant['site_id'],
                'account_type' => 2,
                'merchant_id' => (int) $merchant['id'],
                'username' => $username,
                'password' => password_hash($password, PASSWORD_BCRYPT),
                'real_name' => (string) $merchant['contact_name'],
                'mobile' => (string) $merchant['contact_phone'],
                'is_owner' => 1,
                'status' => 1,
            ]);
            // 主门店:一商户一门店的默认形态,信息从商户带入(手机号已加密存储,直接复用密文)
            $hasStore = Db::table('merchant_store')
                ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')->exists();
            if (! $hasStore) {
                Db::table('merchant_store')->insert([
                    'site_id' => (int) $merchant['site_id'],
                    'merchant_id' => (int) $merchant['id'],
                    'store_name' => (string) $merchant['merchant_name'],
                    'contact_name' => (string) $merchant['contact_name'],
                    'contact_phone' => (string) $merchant['contact_phone'],
                    'address' => (string) $merchant['address'],
                    'longitude' => $merchant['longitude'],
                    'latitude' => $merchant['latitude'],
                    'is_main' => 1,
                    'status' => 1,
                ]);
            }
        });
        return [
            'username' => $username,
            'password' => $password,
            'one_time_password' => $password,
            'access_code' => $accessCode,
        ];
    }

    /** 审核驳回:可修改后重新提交 */
    public function reject(array $merchant, string $remark): void
    {
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'status' => 2,
            'audit_remark' => mb_substr($remark, 0, 500),
            'audit_by' => \Mtrip\Shared\Context\AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
        ]);
    }



    /**
     * 注销商户(终态):下架全部商品、停用全部子账号、门店联动停业
     * @return int 联动下架商品数
     */
    public function close(array $merchant, string $remark): int
    {
        return (int) Db::transaction(static function () use ($merchant, $remark) {
            Db::table('merchant_info')->where('id', $merchant['id'])->update([
                'status' => 5,
                'remark' => mb_substr($remark, 0, 500),
            ]);
            Db::table('merchant_admin')->where('merchant_id', $merchant['id'])
                ->whereNull('deleted_at')->update(['status' => 2]);
            Db::table('merchant_store')->where('merchant_id', $merchant['id'])
                ->whereNull('deleted_at')->update(['status' => 2]);
            return Db::table('goods_info')
                ->where('merchant_id', $merchant['id'])->whereIn('status', [1, 3])
                ->whereNull('deleted_at')
                ->update(['status' => 4]);
        });
    }

    /** 商户主账号登录名:m{商户ID}(冲突追加随机后缀) */
    private function uniqueUsername(int $merchantId): string
    {
        $username = 'm' . str_pad((string) $merchantId, 6, '0', STR_PAD_LEFT);
        while (Db::table('merchant_admin')->where('username', $username)->exists()) {
            $username = 'm' . str_pad((string) $merchantId, 6, '0', STR_PAD_LEFT) . random_int(10, 99);
        }
        return $username;
    }

    /**
     * 生成商户门户访问码:MTRP-{业态}-{6位随机}(原型 Approve Merchant 弹窗),全平台唯一
     * @param int $merchantType 商户类型(1酒店 2景区 3综合)
     */
    public function generateAccessCode(int $merchantType): string
    {
        $label = [1 => 'HOTEL', 2 => 'ATTRACTION', 3 => 'TRAVEL'][$merchantType] ?? 'TRAVEL';
        $pool = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        do {
            $suffix = '';
            for ($i = 0; $i < 6; ++$i) {
                $suffix .= $pool[random_int(0, strlen($pool) - 1)];
            }
            $code = sprintf('MTRP-%s-%s', $label, $suffix);
        } while (Db::table('merchant_info')->where('access_code', $code)->exists());
        return $code;
    }

    /** @return array{access_code: string, one_time_password: string} */
    public function generateApprovalCredentials(int $merchantType): array
    {
        return [
            'access_code' => $this->generateAccessCode($merchantType),
            'one_time_password' => $this->randomPassword(),
        ];
    }

    /** 随机初始密码:12位,保证含大小写字母与数字(见 PasswordGenerator) */
    private function randomPassword(): string
    {
        return \App\Support\PasswordGenerator::random();
    }
}
