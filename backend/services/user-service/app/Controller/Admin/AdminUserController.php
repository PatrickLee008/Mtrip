<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * C端用户管理(文档 6.4.4)
 * 用户状态:1正常 2冻结 3注销;冻结/解冻需备注原因,注销为用户侧操作后台不可逆
 */
class AdminUserController extends AbstractAdminController
{
    /** 用户列表:筛选 昵称/状态/实名状态/注册来源/注册日期;手机号脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_info')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($nickname = $this->strInput('nickname')) !== '') {
            $query->where('nickname', 'like', "%{$nickname}%");
        }
        if (($status = $this->intInput('userStatus')) > 0) {
            $query->where('user_status', $status);
        }
        $realName = $this->input('realNameStatus');
        if ($realName !== null && $realName !== '') {
            $query->where('real_name_status', (int) $realName);
        }
        if (($source = $this->intInput('registerSource')) > 0) {
            $query->where('register_source', $source);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('register_time', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('register_time', '<=', "{$end} 23:59:59");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['mobile'] = MaskHelper::mobile($this->decryptField((string) $row['mobile']));
                // 密码与加密身份信息列表不下发
                unset($row['password'], $row['email'], $row['real_name'], $row['id_card'], $row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 用户详情:含余额/积分流水摘要;超管可见明文手机号 */
    public function detail(): array
    {
        $user = $this->findScoped($this->requireId());
        $mobile = $this->decryptField((string) $user['mobile']);
        $user['mobile'] = AdminContext::isSuper() ? $mobile : MaskHelper::mobile($mobile);
        $user['email'] = MaskHelper::email($this->decryptField((string) $user['email']));
        $user['real_name'] = $this->decryptField((string) $user['real_name']);
        $user['id_card'] = MaskHelper::idCard($this->decryptField((string) $user['id_card']));
        unset($user['password'], $user['deleted_at']);

        $balanceLogs = Db::table('user_balance_log')
            ->where('user_id', $user['id'])->orderByDesc('id')->limit(10)->get()
            ->map(static fn ($row) => (array) $row)->all();
        $pointsLogs = Db::table('user_points_log')
            ->where('user_id', $user['id'])->orderByDesc('id')->limit(10)->get()
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'user' => $user,
            'balanceLogs' => $balanceLogs,
            'pointsLogs' => $pointsLogs,
        ]);
    }

    /** 冻结/解冻:1正常 ⇄ 2冻结(必填原因,写入备注前缀留痕) */
    #[Permission('user:list:status')]
    public function toggleStatus(): array
    {
        $user = $this->findScoped($this->requireId());
        $status = (int) $user['user_status'];
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销用户不可操作');
        }
        $reason = $this->requireStr('reason');
        $target = $status === 1 ? 2 : 1;
        $prefix = $target === 2 ? '[冻结]' : '[解冻]';
        Db::table('user_info')->where('id', $user['id'])->update([
            'user_status' => $target,
            'remark' => mb_substr("{$prefix}{$reason} " . $user['remark'], 0, 500),
        ]);
        return Result::success(['userStatus' => $target], $target === 2 ? '用户已冻结' : '用户已解冻');
    }

    /** Customer 360:聚合用户资料 + 会员 + 钱包/积分流水 + 预订 + 优惠券 + 推荐数(容错:缺表降级为空) */
    public function customer360(): array
    {
        $user = $this->findScoped($this->requireId());
        $mobile = $this->decryptField((string) $user['mobile']);
        $user['mobile'] = AdminContext::isSuper() ? $mobile : MaskHelper::mobile($mobile);
        $user['email'] = MaskHelper::email($this->decryptField((string) $user['email']));
        $user['real_name'] = $this->decryptField((string) $user['real_name']);
        $user['id_card'] = MaskHelper::idCard($this->decryptField((string) $user['id_card']));
        unset($user['password'], $user['deleted_at']);
        $uid = (int) $user['id'];

        $level = null;
        if ((int) $user['member_level_id'] > 0) {
            $lv = Db::table('user_member_level')->where('id', $user['member_level_id'])->first();
            $level = $lv ? (array) $lv : null;
        }

        return Result::success([
            'user' => $user,
            'level' => $level,
            'balanceLogs' => $this->safeRows('user_balance_log', $uid, 20),
            'pointsLogs' => $this->safeRows('user_points_log', $uid, 20),
            'bookings' => $this->safeRows('order_main', $uid, 20, true),
            'coupons' => $this->safeRows('marketing_coupon_receive', $uid, 50),
            'transactions' => $this->safeRows('finance_account_entry', $uid, 30),
            'referralCount' => $this->safeCount('user_referral', 'inviter_user_id', $uid),
        ]);
    }

    /** 拉黑用户:记录黑名单 + user_status=4(拉黑),区分「冻结」与「拉黑」 */
    #[Permission('user:list:status')]
    public function blacklist(): array
    {
        $user = $this->findScoped($this->requireId());
        if ((int) $user['user_status'] === 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销用户不可拉黑');
        }
        $reason = $this->requireStr('reason');
        $evidence = $this->strInput('evidence');
        Db::transaction(function () use ($user, $reason, $evidence) {
            Db::table('user_blacklist')->insert([
                'site_id' => (int) $user['site_id'],
                'user_id' => (int) $user['id'],
                'reason' => mb_substr($reason, 0, 255),
                'evidence' => mb_substr($evidence, 0, 500),
                'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(),
                'status' => 1,
            ]);
            Db::table('user_info')->where('id', $user['id'])->update(['user_status' => 4]);
        });
        return Result::success(null, '用户已拉黑');
    }

    /** 移出黑名单:失效黑名单记录 + user_status 恢复正常 */
    #[Permission('user:list:status')]
    public function unblacklist(): array
    {
        $user = $this->findScoped($this->requireId());
        Db::transaction(function () use ($user) {
            Db::table('user_blacklist')->where('user_id', $user['id'])->where('status', 1)
                ->update(['status' => 2, 'removed_at' => date('Y-m-d H:i:s'), 'removed_by' => AdminContext::adminId()]);
            Db::table('user_info')->where('id', $user['id'])->update(['user_status' => 1]);
        });
        return Result::success(null, '已移出黑名单');
    }

    /** 容错查询:表/列不存在时降级为空数组(360 聚合跨表,防个别表缺失导致整体 500) */
    private function safeRows(string $table, int $uid, int $limit, bool $softDelete = false): array
    {
        try {
            $q = Db::table($table)->where('user_id', $uid);
            if ($softDelete) {
                $q->whereNull('deleted_at');
            }
            return $q->orderByDesc('id')->limit($limit)->get()->map(static fn ($r) => (array) $r)->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function safeCount(string $table, string $column, int $uid): int
    {
        try {
            return (int) Db::table($table)->where($column, $uid)->count();
        } catch (\Throwable) {
            return 0;
        }
    }

    /** 取用户并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $user = Db::table('user_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '用户不存在');
        }
        $user = (array) $user;
        $this->assertSiteScope((int) $user['site_id']);
        return $user;
    }
}
