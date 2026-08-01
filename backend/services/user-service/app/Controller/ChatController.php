<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端在线客服 / 与酒店聊天(PRD 模块 4.1 + 13)
 * type:1酒店咨询(target=酒店商品ID) 2客服(target=0)。客服会话对用户消息给机器人自动应答;
 * 转人工/酒店回复由坐席端(后续 admin/merchant 专项)写入,本期只做 C 端会话与消息。
 */
class ChatController extends AbstractController
{
    /** 客服预置常见问题(PRD 模块4.1 示例) */
    private const FAQS = [
        '入住/退房时间是几点?',
        '是否提供免费停车?',
        '是否提供机场接送?',
        '如何修改或取消我的预订?',
    ];

    /** 常见问题列表 */
    public function faqs(): array
    {
        return Result::success(self::FAQS);
    }

    /** 我的会话列表 */
    public function conversations(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('chat_conversation')->where('user_id', UserContext::userId());
        if (($type = $this->intInput('type')) > 0) {
            $query->where('type', $type);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('last_time')->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'type', 'target_id', 'title', 'status', 'last_message', 'last_time', 'rating'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 开启/复用会话:type 1酒店(需 targetId 有效酒店)2客服;返回会话ID */
    public function start(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $type = $this->intInput('type', 2);
        if (! in_array($type, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '会话类型不正确');
        }
        $targetId = 0;
        $title = '在线客服';
        if ($type === 1) {
            $targetId = $this->requireId('targetId');
            $goods = Db::table('goods_info')->where('id', $targetId)->where('site_id', $siteId)
                ->whereNull('deleted_at')->first(['goods_name']);
            if (! $goods) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '酒店不存在');
            }
            $title = (string) $goods->goods_name;
        }
        // 复用进行中的同目标会话
        $exist = Db::table('chat_conversation')
            ->where('user_id', $userId)->where('type', $type)->where('target_id', $targetId)
            ->where('status', 0)->orderByDesc('id')->first(['id']);
        if ($exist) {
            return Result::success(['conversationId' => (int) $exist->id]);
        }
        $id = (int) Db::table('chat_conversation')->insertGetId([
            'site_id' => $siteId,
            'user_id' => $userId,
            'type' => $type,
            'target_id' => $targetId,
            'title' => mb_substr($title, 0, 200),
            'status' => 0,
        ]);
        return Result::success(['conversationId' => $id]);
    }

    /** 会话消息分页(仅本人会话) */
    public function messages(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('chat_message')->where('conversation_id', $conv['id']);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'sender_type', 'content', 'msg_type', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 发送消息:写用户消息;客服会话自动机器人应答 */
    public function send(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        if ((int) $conv['status'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束,请重新发起');
        }
        $content = $this->requireStr('content');
        $now = date('Y-m-d H:i:s');
        Db::table('chat_message')->insert([
            'site_id' => (int) $conv['site_id'],
            'conversation_id' => (int) $conv['id'],
            'sender_type' => 1,
            'content' => mb_substr($content, 0, 2000),
            'msg_type' => 1,
        ]);
        $last = mb_substr($content, 0, 500);
        // 客服会话:机器人即时应答(转人工由坐席端接入)
        if ((int) $conv['type'] === 2) {
            $reply = '您好,已收到您的问题,智能助手正在为您解答;如需人工客服,请回复「人工」,我们将尽快为您转接。';
            Db::table('chat_message')->insert([
                'site_id' => (int) $conv['site_id'],
                'conversation_id' => (int) $conv['id'],
                'sender_type' => 3,
                'content' => $reply,
                'msg_type' => 1,
            ]);
            $last = mb_substr($reply, 0, 500);
        }
        Db::table('chat_conversation')->where('id', $conv['id'])
            ->update(['last_message' => $last, 'last_time' => $now]);
        return Result::success(null, '已发送');
    }

    /** 结束会话 */
    public function finish(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        Db::table('chat_conversation')->where('id', $conv['id'])->update(['status' => 1]);
        return Result::success(null, '会话已结束');
    }

    /** 会话评分(结束后 1-5) */
    public function rate(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        $rating = $this->intInput('rating');
        if ($rating < 1 || $rating > 5) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '评分须为1-5');
        }
        Db::table('chat_conversation')->where('id', $conv['id'])->update(['rating' => $rating]);
        return Result::success(null, '感谢您的评价');
    }

    /** 取本人会话,不存在/非本人抛404 */
    private function ownConversation(int $id): array
    {
        $conv = Db::table('chat_conversation')
            ->where('id', $id)->where('user_id', UserContext::userId())->first();
        if (! $conv) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '会话不存在');
        }
        return (array) $conv;
    }
}
