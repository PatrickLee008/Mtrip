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
 * 用户反馈与投诉处理(文档 6.4.4)
 * 状态机:0待处理 → 1处理中 → 2已处理;0/1 → 3已关闭
 */
class AdminFeedbackController extends AbstractAdminController
{
    /** 反馈列表:筛选 用户/类型/状态/日期 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_feedback')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($userId = $this->intInput('userId')) > 0) {
            $query->where('user_id', $userId);
        }
        if (($type = $this->intInput('feedbackType')) > 0) {
            $query->where('feedback_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $images = $row['images'];
                $row['images'] = is_string($images) && $images !== '' ? (json_decode($images, true) ?: []) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 处理反馈:targetStatus 1处理中 2已处理(必填回复) 3关闭 */
    #[Permission('user:feedback:handle')]
    public function handle(): array
    {
        $feedback = $this->findScoped($this->requireId());
        $current = (int) $feedback['status'];
        $target = $this->intInput('targetStatus');
        // 允许流转:0→1/2/3,1→2/3
        $allowed = [0 => [1, 2, 3], 1 => [2, 3]];
        if (! in_array($target, $allowed[$current] ?? [], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前状态不允许该流转');
        }
        $reply = $this->strInput('replyContent');
        if ($target === 2 && $reply === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '标记已处理必须填写回复内容');
        }
        Db::table('user_feedback')->where('id', $feedback['id'])->update([
            'status' => $target,
            'reply_content' => mb_substr($reply, 0, 2000),
            'handler_id' => AdminContext::adminId(),
            'handled_at' => date('Y-m-d H:i:s'),
        ]);
        return Result::success(null, '反馈已更新');
    }

    /** 取反馈并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $feedback = Db::table('user_feedback')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $feedback) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '反馈不存在');
        }
        $feedback = (array) $feedback;
        $this->assertSiteScope((int) $feedback['site_id']);
        return $feedback;
    }
}
