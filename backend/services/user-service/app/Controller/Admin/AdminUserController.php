<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\WalletLogPresenter;
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

    /**
     * 钱包流水(全平台 / 本站点):筛选 用户ID / 手机号 / 昵称 / 变动类型 / 预订号 / 日期;
     * 行带用户昵称与脱敏手机号、关联预订号与物业、调账操作人,并汇总当前筛选下的入账 / 出账合计(对账用)。
     */
    #[Permission('user:wallet:list')]
    public function balanceLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_balance_log');
        $this->applySiteScope($query);
        if (($userId = $this->intInput('userId')) > 0) {
            $query->where('user_id', $userId);
        }
        if (($mobile = $this->strInput('mobile')) !== '') {
            // 手机号加密存储,按 HMAC 哈希精确检索。App 按用户输入原样存(不带国家码,「+95」只是展示前缀),
            // 运营常粘贴「+95 9xxx」或本地「09xxx」,把去国家码 / 去前导 0 的写法一并当候选
            $digits = (string) preg_replace('/\D/', '', $mobile);
            $candidates = [$mobile, $digits, "+{$digits}"];
            if (str_starts_with($digits, '95')) {
                $candidates[] = substr($digits, 2);
            }
            if (str_starts_with($digits, '0')) {
                $candidates[] = ltrim($digits, '0');
            }
            $hashes = array_map(fn ($m) => hash_hmac('sha256', $m, $this->aesKey()), array_unique(array_filter($candidates)));
            $query->whereIn('user_id', Db::table('user_info')->whereIn('mobile_hash', $hashes)->select('id'));
        }
        if (($nickname = $this->strInput('nickname')) !== '') {
            $query->whereIn('user_id', Db::table('user_info')->where('nickname', 'like', "%{$nickname}%")->select('id'));
        }
        if (($changeType = $this->intInput('changeType')) > 0) {
            $query->where('change_type', $changeType);
        }
        if (($bookingNo = $this->strInput('bookingNo')) !== '') {
            $query->whereIn('order_id', WalletLogPresenter::orderIdsByBookingNo($bookingNo) ?: [0]);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }

        $total = (clone $query)->count();
        $sums = (clone $query)->selectRaw(
            'COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS credit, COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS debit'
        )->first();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();

        $users = Db::table('user_info')->whereIn('id', array_unique(array_column($rows, 'user_id')) ?: [0])
            ->get(['id', 'nickname', 'mobile'])->keyBy('id')->all();
        $operatorIds = array_values(array_filter(array_unique(array_map('intval', array_column($rows, 'operator_id')))));
        $operators = $operatorIds === [] ? [] : Db::connection('system')->table('sys_admin')
            ->whereIn('id', $operatorIds)->pluck('username', 'id')->all();
        foreach ($rows as &$row) {
            $user = $users[(int) $row['user_id']] ?? null;
            $row['nickname'] = $user ? (string) $user->nickname : '';
            $row['mobile'] = $user ? MaskHelper::mobile($this->decryptField((string) $user->mobile)) : '';
            $row['operator_name'] = (string) ($operators[(int) $row['operator_id']] ?? '');
        }
        unset($row);

        $data = Result::page(WalletLogPresenter::withBookingInfo($rows), $total, $page, $pageSize);
        $data['data']['summary'] = [
            'credit' => number_format((float) $sums->credit, 2, '.', ''),
            'debit' => number_format((float) $sums->debit, 2, '.', ''),
        ];
        return $data;
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

    /** 手动调账:正数增加、负数扣减,余额与流水原子写入。 */
    #[Permission('user:list:adjust-balance')]
    public function adjustBalance(): array
    {
        $id = $this->requireId();
        $amount = $this->input('amount');
        if ((! is_string($amount) && ! is_int($amount) && ! is_float($amount))
            || ! preg_match('/^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/D', (string) $amount)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调整金额须为最多两位小数的有效金额');
        }
        // DECIMAL(12,2) 转为整数分计算,避免浮点累加误差。
        $cents = (int) round((float) $amount * 100);
        if ($cents === 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调整金额不能为0');
        }
        $reason = $this->requireStr('reason');
        if (mb_strlen($reason) > 200) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调整原因不能超过200字');
        }

        $data = Db::transaction(function () use ($id, $cents, $reason): array {
            $user = Db::table('user_info')->where('id', $id)->whereNull('deleted_at')
                ->lockForUpdate()->first();
            if (! $user) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '用户不存在');
            }
            $user = (array) $user;
            $this->assertSiteScope((int) $user['site_id']);
            $before = (int) round((float) $user['balance'] * 100);
            $after = $before + $cents;
            if ($after < 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '扣减金额不能超过当前余额');
            }
            if ($after > 999999999999) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '调整后余额超出允许范围');
            }
            $balance = number_format($after / 100, 2, '.', '');
            Db::table('user_info')->where('id', $id)->update(['balance' => $balance]);
            Db::table('user_balance_log')->insert([
                'site_id' => (int) $user['site_id'],
                'user_id' => $id,
                'change_type' => 4,
                'amount' => number_format($cents / 100, 2, '.', ''),
                'before_balance' => number_format($before / 100, 2, '.', ''),
                'after_balance' => $balance,
                'order_id' => 0,
                'operator_id' => AdminContext::adminId(),
                'remark' => $reason,
            ]);
            return ['balance' => $balance];
        });
        return Result::success($data, '余额调整成功');
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
