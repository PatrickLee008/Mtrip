<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端申诉(Booking Risk Appeal):提交申诉 / 查询风控与申诉状态(PRD 模块10.1)
 * 账号受限(user_status=2 或 user_fraud.level>=2)时可提交;每次仅允许一条待审申诉
 */
class AppealController extends AbstractController
{
    /** 风控与申诉状态:账号状态 + 风控级别/原因 + 最近一条申诉 */
    public function status(): array
    {
        $userId = UserContext::userId();
        $user = (array) Db::table('user_info')->where('id', $userId)->first(['user_status']);
        $fraud = Db::table('user_fraud')->where('user_id', $userId)->first(['level', 'last_reason', 'last_eval_at']);
        $latest = Db::table('user_appeal')->where('user_id', $userId)
            ->orderByDesc('id')->first(['id', 'status', 'handle_remark', 'handled_at', 'created_at']);
        return Result::success([
            'userStatus' => (int) ($user['user_status'] ?? 1),
            'fraudLevel' => $fraud ? (int) $fraud->level : 0,
            'fraudReason' => $fraud ? (string) $fraud->last_reason : '',
            'latestAppeal' => $latest ? (array) $latest : null,
        ]);
    }

    /** 提交申诉:说明必填,附件可选(≤20MB 由上传侧控制) */
    public function submit(): array
    {
        $userId = UserContext::userId();
        $content = $this->requireStr('content');

        $user = (array) Db::table('user_info')->where('id', $userId)->first(['user_status']);
        $level = (int) (Db::table('user_fraud')->where('user_id', $userId)->value('level') ?? 0);
        if ((int) ($user['user_status'] ?? 1) !== 2 && $level < 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号状态正常,无需申诉');
        }
        if (Db::table('user_appeal')->where('user_id', $userId)->where('status', 0)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已有待处理申诉,请耐心等待审核');
        }
        $attachments = $this->input('attachments');
        $id = (int) Db::table('user_appeal')->insertGetId([
            'site_id' => $this->requireSiteId(),
            'user_id' => $userId,
            'content' => mb_substr($content, 0, 2000),
            'attachments' => is_array($attachments) ? json_encode($attachments, JSON_UNESCAPED_UNICODE) : null,
            'status' => 0,
        ]);
        return Result::success(['appealId' => $id], '申诉已提交,请等待审核');
    }
}
