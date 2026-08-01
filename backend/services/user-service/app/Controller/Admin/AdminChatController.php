<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 管理端客服工作台(PRD 模块13):会话列表 / 消息 / 坐席回复 / 结束会话
 * 坐席回复以 sender_type=2 写入,C 端在会话中即可看到
 */
class AdminChatController extends AbstractAdminController
{
    /** 会话列表:筛选 type(1酒店咨询2客服)/status */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('chat_conversation');
        $this->applySiteScope($query);
        if (($type = $this->intInput('type')) > 0) {
            $query->where('type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('last_time')->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 会话消息 */
    public function messages(): array
    {
        $conv = $this->ownScoped($this->requireId('conversationId'));
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('chat_message')->where('conversation_id', $conv['id']);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'sender_type', 'content', 'msg_type', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 坐席回复(sender_type=2) */
    #[Permission('user:chat:reply')]
    public function reply(): array
    {
        $conv = $this->ownScoped($this->requireId('conversationId'));
        if ((int) $conv['status'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束');
        }
        $content = $this->requireStr('content');
        $now = date('Y-m-d H:i:s');
        Db::table('chat_message')->insert([
            'site_id' => (int) $conv['site_id'],
            'conversation_id' => (int) $conv['id'],
            'sender_type' => 2,
            'content' => mb_substr($content, 0, 2000),
            'msg_type' => 1,
        ]);
        Db::table('chat_conversation')->where('id', $conv['id'])
            ->update(['last_message' => mb_substr($content, 0, 500), 'last_time' => $now]);
        return Result::success(null, '已回复');
    }

    /** 结束会话 */
    #[Permission('user:chat:reply')]
    public function close(): array
    {
        $conv = $this->ownScoped($this->requireId('conversationId'));
        Db::table('chat_conversation')->where('id', $conv['id'])->update(['status' => 1]);
        return Result::success(null, '会话已结束');
    }

    /** 取会话并校验站点数据权限 */
    private function ownScoped(int $id): array
    {
        $conv = Db::table('chat_conversation')->where('id', $id)->first();
        if (! $conv) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '会话不存在');
        }
        $conv = (array) $conv;
        $this->assertSiteScope((int) $conv['site_id']);
        return $conv;
    }
}
