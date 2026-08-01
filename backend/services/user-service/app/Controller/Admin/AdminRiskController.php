<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 管理端风控与申诉(PRD 模块10.1):风控看板 + 申诉队列处理
 * 处理动作:1通过(解除限制/解冻)2驳回(维持限制)3升级封禁
 */
class AdminRiskController extends AbstractAdminController
{
    /** 申诉队列:筛选状态 */
    public function appealList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_appeal');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                $row['attachments'] = $row['attachments'] ? json_decode((string) $row['attachments'], true) : [];
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 处理申诉:action 1通过解冻 / 2驳回维持 / 3升级封禁 */
    #[Permission('user:appeal:handle')]
    public function appealHandle(): array
    {
        $id = $this->requireId();
        $action = $this->intInput('action');
        if (! in_array($action, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '处理动作不正确');
        }
        $appeal = Db::table('user_appeal')->where('id', $id)->first();
        if (! $appeal) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '申诉不存在');
        }
        $appeal = (array) $appeal;
        $this->assertSiteScope((int) $appeal['site_id']);
        if ((int) $appeal['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申诉已处理');
        }
        $userId = (int) $appeal['user_id'];
        $remark = mb_substr($this->strInput('remark'), 0, 500);
        $now = date('Y-m-d H:i:s');

        Db::transaction(function () use ($id, $action, $userId, $remark, $now) {
            Db::table('user_appeal')->where('id', $id)->update([
                'status' => $action, // 1通过 2驳回 3封禁,与 action 同义
                'handler_id' => AdminContext::adminId(),
                'handle_remark' => $remark,
                'handled_at' => $now,
            ]);
            if ($action === 1) {
                // 解除限制:风控归零 + 账号恢复正常
                Db::table('user_fraud')->where('user_id', $userId)->update(['level' => 0, 'last_reason' => '申诉通过解除', 'last_eval_at' => $now]);
                Db::table('user_info')->where('id', $userId)->update(['user_status' => 1]);
            } elseif ($action === 3) {
                // 升级封禁:风控置3 + 账号保持冻结
                Db::table('user_fraud')->where('user_id', $userId)->update(['level' => 3, 'last_reason' => '申诉后确认封禁', 'last_eval_at' => $now]);
                Db::table('user_info')->where('id', $userId)->update(['user_status' => 2]);
            }
            // action=2 维持:仅记录处理结果,不变更账号
        });
        return Result::success(null, '申诉已处理');
    }

    /** 风控看板:命中风控的用户列表 */
    public function fraudList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_fraud');
        $this->applySiteScope($query);
        $level = $this->input('level');
        if ($level !== null && $level !== '') {
            $query->where('level', (int) $level);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('level')->orderByDesc('last_eval_at')->forPage($page, $pageSize)
            ->get()->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
