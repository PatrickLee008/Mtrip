<?php

declare(strict_types=1);

namespace Mtrip\Shared\Account;

use Hyperf\DbConnection\Db;

/**
 * 注销账户 90 天保留期到期后的匿名化(Consumer App PRD 模块 19「数据保留」)。
 *
 * 只清个人信息,不删账号行与订单 / 钱包流水 / 没收台账 —— 那些是会计与审计凭证。
 * 账号行置 deleted_at(各处查询都按 whereNull('deleted_at') 过滤,后台列表随之不再显示),
 * 常旅客 / 收藏这类纯个人数据直接删除,注销记录里的归档哈希与社交身份一并清空。
 *
 * 定时任务挂在 order-service 的 crontab(该服务已有 crontab 进程与 onOneServer 互斥,
 * 钱包到期任务也在那里);user-service 本身没有 crontab 进程。
 */
class AccountPurge
{
    /** @return int 本轮匿名化的账号数 */
    public function purgeDue(int $limit = 200): int
    {
        $now = date('Y-m-d H:i:s');
        $rows = Db::table('user_account_deletion')
            ->where('status', 2)->whereNull('purged_at')
            ->whereNotNull('purge_after')->where('purge_after', '<=', $now)
            ->orderBy('id')->limit($limit)->get(['id', 'user_id']);
        $done = 0;
        foreach ($rows as $row) {
            Db::transaction(static function () use ($row, $now): void {
                $userId = (int) $row->user_id;
                Db::table('user_info')->where('id', $userId)->where('user_status', 3)->update([
                    'nickname' => 'Deleted User',
                    'avatar' => '',
                    'mobile' => '',
                    'mobile_hash' => null,
                    'email' => '',
                    'email_hash' => null,
                    'password' => '',
                    'real_name' => '',
                    'id_card' => '',
                    'gender' => 0,
                    'birthday' => null,
                    'city' => '',
                    'home_address' => '',
                    'nationality' => '',
                    'id_card_front' => '',
                    'id_card_back' => '',
                    'selfie_image' => '',
                    'deleted_at' => $now,
                ]);
                Db::table('user_traveler')->where('user_id', $userId)->delete();
                Db::table('user_favorite')->where('user_id', $userId)->delete();
                Db::table('user_social_identity')->where('user_id', $userId)->delete();
                Db::table('user_account_deletion')->where('id', $row->id)->update([
                    'purged_at' => $now,
                    'archived_mobile_hash' => null,
                    'archived_email_hash' => null,
                    'archived_identities' => null,
                ]);
            });
            ++$done;
        }
        return $done;
    }
}
