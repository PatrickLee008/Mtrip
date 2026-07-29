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
