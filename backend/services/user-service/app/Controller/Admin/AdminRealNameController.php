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
 * C端实名审核(App 资料向导第 2 步 Identity Verification 的后台审核)
 *
 * real_name_status:0未认证 1已认证 2认证失败 3审核中;本页三个队列 pending=3 / approved=1 / rejected=2。
 * 只有审核中(3)可以通过或驳回;驳回原因写 real_name_reject_reason,用户可重交(重交后回到 3)。
 * 列表证件号脱敏;详情给审核员明文姓名 + 证件号(需与证件照比对),证件照为 /uploads 相对地址。
 */
class AdminRealNameController extends AbstractAdminController
{
    /** 队列 tab → real_name_status */
    private const TAB_STATUS = ['pending' => 3, 'approved' => 1, 'rejected' => 2];

    /** 三个队列的计数(卡片导航用) */
    #[Permission('user:realname:list')]
    public function queues(): array
    {
        $query = Db::table('user_info')->whereNull('deleted_at')->whereIn('real_name_status', [1, 2, 3]);
        $this->applySiteScope($query);
        $counts = $query->groupBy('real_name_status')
            ->selectRaw('real_name_status, COUNT(*) AS cnt')->pluck('cnt', 'real_name_status')->all();
        $result = [];
        foreach (self::TAB_STATUS as $tab => $status) {
            $result[$tab] = (int) ($counts[$status] ?? 0);
        }
        return Result::success($result);
    }

    /** 队列列表:tab + keyword(昵称 / 用户 ID) + nationality;按提交时间倒序 */
    #[Permission('user:realname:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $status = self::TAB_STATUS[$this->strInput('tab', 'pending')] ?? 3;
        $query = Db::table('user_info')->whereNull('deleted_at')->where('real_name_status', $status);
        $this->applySiteScope($query);
        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('nickname', 'like', "%{$keyword}%");
                if (ctype_digit($keyword)) {
                    $q->orWhere('id', (int) $keyword);
                }
            });
        }
        if (($nationality = strtoupper($this->strInput('nationality'))) !== '') {
            $query->where('nationality', $nationality);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('real_name_submit_at')->orderByDesc('id')
            ->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'nickname', 'avatar', 'mobile', 'real_name', 'id_card', 'nationality',
                'real_name_status', 'real_name_submit_at', 'real_name_audit_by', 'real_name_audit_at', 'real_name_reject_reason'])
            ->map(function ($row) {
                $row = (array) $row;
                $row['mobile'] = MaskHelper::mobile($this->decryptField((string) $row['mobile']));
                $row['real_name'] = $this->decryptField((string) $row['real_name']);
                $row['id_card'] = MaskHelper::idCard($this->decryptField((string) $row['id_card']));
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 详情:资料向导两步的全部字段 + 证件照 / 自拍 + 审核时间线 */
    #[Permission('user:realname:list')]
    public function detail(): array
    {
        $user = $this->findUser($this->requireId());
        $mobile = $this->decryptField((string) $user['mobile']);
        $timeline = [];
        if (! empty($user['real_name_submit_at'])) {
            $timeline[] = ['action' => 'submitted', 'operator' => (string) $user['nickname'], 'at' => $user['real_name_submit_at'], 'note' => ''];
        }
        if (! empty($user['real_name_audit_at']) && in_array((int) $user['real_name_status'], [1, 2], true)) {
            $timeline[] = [
                'action' => (int) $user['real_name_status'] === 1 ? 'approved' : 'rejected',
                'operator' => (string) $user['real_name_audit_by'],
                'at' => $user['real_name_audit_at'],
                'note' => (string) $user['real_name_reject_reason'],
            ];
        }
        return Result::success([
            'id' => (int) $user['id'],
            'site_id' => (int) $user['site_id'],
            'nickname' => (string) $user['nickname'],
            'avatar' => (string) $user['avatar'],
            'mobile' => AdminContext::isSuper() ? $mobile : MaskHelper::mobile($mobile),
            'register_time' => $user['register_time'],
            'real_name' => $this->decryptField((string) $user['real_name']),
            'id_card' => $this->decryptField((string) $user['id_card']),
            'nationality' => (string) $user['nationality'],
            'gender' => (int) $user['gender'],
            'birthday' => $user['birthday'],
            'city' => (string) $user['city'],
            'home_address' => $this->decryptField((string) $user['home_address']),
            'id_card_front' => (string) $user['id_card_front'],
            'id_card_back' => (string) $user['id_card_back'],
            'selfie_image' => (string) $user['selfie_image'],
            'real_name_status' => (int) $user['real_name_status'],
            'real_name_submit_at' => $user['real_name_submit_at'],
            'real_name_audit_by' => (string) $user['real_name_audit_by'],
            'real_name_audit_at' => $user['real_name_audit_at'],
            'real_name_reject_reason' => (string) $user['real_name_reject_reason'],
            'timeline' => $timeline,
        ]);
    }

    /** 通过:3 → 1 */
    #[Permission('user:realname:approve')]
    public function approve(): array
    {
        $user = $this->findPending($this->requireId());
        $this->finish((int) $user['id'], 1, '');
        return Result::success(null, '实名认证已通过');
    }

    /** 驳回:3 → 2,必填原因(回显给用户,用户可重交) */
    #[Permission('user:realname:reject')]
    public function reject(): array
    {
        $user = $this->findPending($this->requireId());
        $reason = mb_substr($this->requireStr('reason'), 0, 500);
        $this->finish((int) $user['id'], 2, $reason);
        return Result::success(null, '已驳回实名认证');
    }

    private function finish(int $userId, int $status, string $reason): void
    {
        // 条件更新防并发:两个审核员同时点,只有一个能把 3 改走
        $affected = Db::table('user_info')->where('id', $userId)->where('real_name_status', 3)->update([
            'real_name_status' => $status,
            'real_name_audit_by' => mb_substr(AdminContext::adminName() ?: 'Admin', 0, 64),
            'real_name_audit_at' => date('Y-m-d H:i:s'),
            'real_name_reject_reason' => $reason,
        ]);
        if ($affected === 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已被处理,请刷新');
        }
    }

    private function findPending(int $id): array
    {
        $user = $this->findUser($id);
        if ((int) $user['real_name_status'] !== 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请不在审核中');
        }
        return $user;
    }

    private function findUser(int $id): array
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
