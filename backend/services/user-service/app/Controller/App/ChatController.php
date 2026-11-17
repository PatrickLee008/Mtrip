<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Chat\SupportBot;
use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端在线客服 / 与酒店聊天(PRD 模块 4.1 + 13)
 * type:1酒店咨询使用明确 propertyId/orderId，与商家及订单入口共用会话核心；
 * type:2平台客服保留原有机器人应答和结束规则。
 */
class ChatController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Mtrip\Shared\Chat\ChatService $chat;

    public function detail(): array
    {
        $c = $this->ownConversation($this->requireId('conversationId'));
        unset($c['thread_key']);
        $c['receipts'] = $this->chat->receipts($c);
        if ((int) $c['type'] === 2) {
            // 平台客服:所选预订上下文 + 按场景/语言的推荐问题(PRD 模块 13 预订选择 / 推荐问题)
            $order = (int) $c['order_id'] > 0 ? $this->supportOrder((int) $c['order_id']) : null;
            $scene = SupportBot::scene($order, gmdate('Y-m-d'));
            $c['support'] = [
                'booking' => $order ? $this->bookingRow($order) : null,
                'scene' => $scene,
                'suggestions' => SupportBot::suggestions($this->supportFaqs((int) $c['site_id']), $scene),
            ];
        }
        return Result::success($c);
    }

    public function receipt(): array
    {
        $c = $this->ownConversation($this->requireId('conversationId'));
        $this->chat->receipt($c, 'user', UserContext::userId(), $this->requireId('messageId'), $this->intInput('read') === 1);
        return Result::success();
    }

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
        $query = Db::table('chat_conversation')->where('user_id', UserContext::userId())->where('site_id', UserContext::siteId());
        if (($type = $this->intInput('type')) > 0) {
            $query->where('type', $type);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('last_time')->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'type', 'target_id', 'property_id', 'order_id', 'title', 'status', 'last_message', 'last_time', 'rating', 'handoff_at'])
            ->map(function ($row) { $c = (array) $row; $c['unread'] = $this->chat->unread($c, 'user', UserContext::userId()); return $c; })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function summary(): array
    {
        $userId = UserContext::userId();
        $unread = Db::table('chat_message as m')->join('chat_conversation as c', 'c.id', '=', 'm.conversation_id')
            ->leftJoin('chat_receipt as r', static function ($join) use ($userId) {
                $join->on('r.conversation_id', '=', 'c.id')->where('r.actor_role', 'user')->where('r.actor_id', $userId);
            })->where('c.user_id', $userId)->where('c.site_id', UserContext::siteId())->whereIn('c.type', [1, 2])
            ->where('m.sender_type', 2)->whereRaw('m.id > COALESCE(r.read_id,0)')->count();
        return Result::success(['unread' => $unread]);
    }

    /** 开启/复用会话:type 1酒店(明确 propertyId/orderId)2客服;返回会话ID */
    public function start(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $type = $this->intInput('type', 2);
        if (! in_array($type, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '会话类型不正确');
        }
        if ($type === 1) {
            $orderId = $this->intInput('orderId');
            $propertyId = $this->intInput('propertyId');
            if ($orderId > 0) {
                $order = Db::table('order_main')->where('id', $orderId)->where('site_id', $siteId)
                    ->where('user_id', $userId)->whereNull('deleted_at')->first();
                if (! $order) throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
                $propertyId = (int) $order->property_id;
            }
            if ($propertyId <= 0) throw new BusinessException(ErrorCode::PARAM_ERROR, '请提供明确的 propertyId 或 orderId');
            $c = $this->chat->start($siteId, $userId, $propertyId, $orderId);
            return Result::success(['conversationId' => (int) $c['id']]);
        }
        // 平台客服:每人同一时间一个进行中的会话(离开页面仍保持,回来复用);orderId 可选,带上即切换预订上下文。
        // 标题只存英文默认值供后台列表,App 按 type=2 本地化显示。
        $orderId = $this->intInput('orderId');
        if ($orderId > 0) {
            $this->supportOrder($orderId);
        }
        $exist = Db::table('chat_conversation')
            ->where('site_id', $siteId)->where('user_id', $userId)->where('type', 2)->where('target_id', 0)
            ->where('status', 0)->orderByDesc('id')->first(['id', 'order_id']);
        if ($exist) {
            if ($orderId > 0 && $orderId !== (int) $exist->order_id) {
                $this->switchBooking((int) $exist->id, $orderId);
            }
            return Result::success(['conversationId' => (int) $exist->id]);
        }
        $id = (int) Db::table('chat_conversation')->insertGetId([
            'site_id' => $siteId,
            'user_id' => $userId,
            'type' => 2,
            'target_id' => 0,
            'order_id' => $orderId,
            'title' => self::SUPPORT_TITLE,
            'status' => 0,
        ]);
        return Result::success(['conversationId' => $id]);
    }

    /** 客服可选预订:本人订单(最新 50 条),按场景分当前 / 历史 */
    public function supportBookings(): array
    {
        $today = gmdate('Y-m-d');
        $list = Db::table('order_main')->where('site_id', $this->requireSiteId())->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')->orderByDesc('id')->limit(50)
            ->get(['id', 'order_no', 'order_type', 'property_id', 'goods_name', 'goods_image', 'sku_name', 'use_date', 'end_date', 'order_status'])
            ->map(fn ($row) => $this->bookingRow((array) $row, $today))->all();
        return Result::success($list);
    }

    /** 切换 / 清除当前客服会话的预订上下文(orderId=0 改为一般咨询) */
    public function supportContext(): array
    {
        $conv = $this->activeSupport($this->requireId('conversationId'));
        $orderId = $this->intInput('orderId');
        if ($orderId > 0) {
            $this->supportOrder($orderId);
        }
        if ($orderId !== (int) $conv['order_id']) {
            $this->switchBooking((int) $conv['id'], $orderId);
        }
        return Result::success();
    }

    /** 联系客户支持:转人工(幂等),机器人停止自动应答,后台客服工作台接手 */
    public function supportHandoff(): array
    {
        $conv = $this->activeSupport($this->requireId('conversationId'));
        if (($conv['handoff_at'] ?? null) === null) {
            $this->handoff($conv);
        }
        return Result::success(null, '已转人工');
    }

    /** 会话消息分页(仅本人会话) */
    public function messages(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        if ($this->input('cursor') !== null) {
            return Result::success(['list' => $this->chat->history($conv, $this->intInput('beforeId'), $this->intInput('afterId')), 'receipts' => $this->chat->receipts($conv)]);
        }
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('chat_message')->where('conversation_id', $conv['id']);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get(['id','sender_type','content','msg_type','created_at'])->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 发送消息:写用户消息;客服会话自动机器人应答 */
    public function send(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        if ((int) $conv['type'] === 1) {
            return Result::success($this->chat->send($conv, 'user', UserContext::userId(), '', $this->strInput('content'),
                $this->strInput('clientMessageId'), (array) $this->input('attachmentIds', [])));
        }
        if ((int) $conv['status'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束,请重新发起');
        }
        // 平台客服:用户消息走共享会话核心(幂等请求号/回执/实时推送),未转人工时机器人按 FAQ 应答
        $clientId = $this->strInput('clientMessageId') ?: 'support-' . bin2hex(random_bytes(8));
        $result = $this->chat->send($conv, 'user', UserContext::userId(), '', $this->requireStr('content'), $clientId);
        if (! $result['duplicate'] && ($conv['handoff_at'] ?? null) === null) {
            $this->botReply($conv, $this->requireStr('content'), $this->strInput('faqKey'));
        }
        return Result::success($result, '已发送');
    }

    /** 结束会话(平台客服结束后可评价;再发消息需重新发起) */
    public function finish(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        if ((int) $conv['status'] === 1) {
            return Result::success(null, '会话已结束');
        }
        Db::table('chat_conversation')->where('id', $conv['id'])->update(['status' => 1, 'version' => Db::raw('version + 1'), 'resolved_at' => gmdate('Y-m-d H:i:s')]);
        $this->chat->publish((int) $conv['id'], 'state');
        return Result::success(null, '会话已结束');
    }

    /** 会话评价:结束后 1-5 星 + 可选备注,每个会话一次 */
    public function rate(): array
    {
        $conv = $this->ownConversation($this->requireId('conversationId'));
        $rating = $this->intInput('rating');
        if ($rating < 1 || $rating > 5) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '评分须为1-5');
        }
        $comment = $this->strInput('comment');
        if (mb_strlen($comment) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '评价内容不能超过500字');
        }
        if ((int) $conv['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话结束后才能评价');
        }
        $updated = Db::table('chat_conversation')->where('id', $conv['id'])->where('rating', 0)
            ->update(['rating' => $rating, 'rating_comment' => $comment, 'rated_at' => gmdate('Y-m-d H:i:s')]);
        if (! $updated) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该会话已评价');
        }
        $this->chat->publish((int) $conv['id'], 'state');
        return Result::success(null, '感谢您的评价');
    }

    private const SUPPORT_TITLE = 'mTrip Support';

    /** 本人在当前站点的订单(客服预订上下文);不存在抛 404 */
    private function supportOrder(int $orderId): array
    {
        $order = Db::table('order_main')->where('id', $orderId)->where('site_id', UserContext::siteId())
            ->where('user_id', UserContext::userId())->whereNull('deleted_at')
            ->first(['id', 'order_no', 'order_type', 'property_id', 'goods_name', 'goods_image', 'sku_name', 'use_date', 'end_date', 'order_status']);
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        return (array) $order;
    }

    private function bookingRow(array $order, ?string $today = null): array
    {
        $scene = SupportBot::scene($order, $today ?? gmdate('Y-m-d'));
        return [
            'id' => (int) $order['id'],
            'order_no' => (string) $order['order_no'],
            'order_type' => (int) $order['order_type'],
            'property_id' => (int) $order['property_id'],
            'goods_name' => (string) $order['goods_name'],
            'goods_image' => (string) $order['goods_image'],
            'sku_name' => (string) $order['sku_name'],
            'use_date' => $order['use_date'],
            'end_date' => $order['end_date'],
            'order_status' => (int) $order['order_status'],
            'scene' => $scene,
            'current' => SupportBot::isCurrent($scene),
        ];
    }

    /** 本人进行中的平台客服会话 */
    private function activeSupport(int $id): array
    {
        $conv = $this->ownConversation($id);
        if ((int) $conv['type'] !== 2) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '会话不存在');
        }
        if ((int) $conv['status'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束,请重新发起');
        }
        return $conv;
    }

    private function switchBooking(int $conversationId, int $orderId): void
    {
        Db::table('chat_conversation')->where('id', $conversationId)
            ->update(['order_id' => $orderId, 'version' => Db::raw('version + 1')]);
        $this->chat->publish($conversationId, 'state');
    }

    /** 启用的客服 FAQ(请求语言优先,缺失回退 en-US;站点行覆盖通用行) */
    private function supportFaqs(int $siteId): array
    {
        $language = SupportBot::language($this->request->getHeaderLine('x-lang'));
        $rows = Db::table('chat_support_faq')->whereIn('site_id', [0, $siteId])
            ->whereIn('language', array_unique([$language, 'en-US']))->where('status', 1)
            ->get(['site_id', 'faq_key', 'scene', 'language', 'question', 'answer', 'keywords', 'handoff', 'sort'])
            ->map(static fn ($r) => (array) $r)->all();
        return SupportBot::dedupe($rows, $language);
    }

    /** 机器人应答:命中 FAQ 回答;投诉/争议建议转人工;明确要人工直接转;都不中回退话术并建议转人工 */
    private function botReply(array $conv, string $content, string $faqKey): void
    {
        $faqs = $this->supportFaqs((int) $conv['site_id']);
        $order = (int) $conv['order_id'] > 0 ? Db::table('order_main')->where('id', $conv['order_id'])->first(['order_status', 'end_date']) : null;
        $hit = SupportBot::match($faqs, $content, SupportBot::scene($order ? (array) $order : null, gmdate('Y-m-d')), $faqKey);
        if ($hit && (int) $hit['handoff'] === 2) {
            $this->handoff($conv);
            return;
        }
        $hit ??= $this->systemFaq($faqs, 'system_fallback', 'Sorry, I couldn\'t find an answer to that. Would you like to talk to a support agent?', 1);
        $this->botMessage($conv, (string) $hit['answer'], (int) $hit['handoff'] === 1 ? 'suggest_agent' : '');
    }

    private function handoff(array $conv): void
    {
        $updated = Db::table('chat_conversation')->where('id', $conv['id'])->whereNull('handoff_at')
            ->update(['handoff_at' => gmdate('Y-m-d H:i:s'), 'version' => Db::raw('version + 1')]);
        if (! $updated) {
            return;
        }
        $text = $this->systemFaq($this->supportFaqs((int) $conv['site_id']), 'system_handoff',
            'You\'re now connected to the mTrip support team. An agent will reply here shortly.', 0);
        $this->botMessage($conv, (string) $text['answer'], 'handoff');
    }

    private function systemFaq(array $faqs, string $key, string $default, int $handoff): array
    {
        foreach ($faqs as $f) {
            if ($f['faq_key'] === $key) return $f;
        }
        return ['faq_key' => $key, 'answer' => $default, 'handoff' => $handoff];
    }

    private function botMessage(array $conv, string $content, string $action): void
    {
        $id = (int) Db::table('chat_message')->insertGetId([
            'site_id' => (int) $conv['site_id'],
            'conversation_id' => (int) $conv['id'],
            'sender_type' => 3,
            'sender_role' => 'bot',
            'sender_name' => 'mTrip Assistant',
            'content' => mb_substr($content, 0, 2000),
            'msg_type' => 1,
            'action' => $action,
        ]);
        Db::table('chat_conversation')->where('id', $conv['id'])->update([
            'last_message' => mb_substr($content, 0, 500), 'last_time' => gmdate('Y-m-d H:i:s'),
            'last_sender_type' => 3, 'version' => Db::raw('version + 1'),
        ]);
        $this->chat->publish((int) $conv['id'], 'message', $id, ['senderRole' => 'bot']);
    }

    /** 取本人会话,不存在/非本人抛404 */
    private function ownConversation(int $id): array
    {
        $conv = Db::table('chat_conversation')
            ->where('id', $id)->where('user_id', UserContext::userId())->where('site_id', UserContext::siteId())->first();
        if (! $conv) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '会话不存在');
        }
        return (array) $conv;
    }
}
