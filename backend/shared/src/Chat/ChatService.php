<?php

declare(strict_types=1);

namespace Mtrip\Shared\Chat;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class ChatService
{
    public function start(int $siteId, int $userId, int $propertyId, int $orderId = 0): array
    {
        if ($userId <= 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订无关联消费者账号，暂不支持站内消息');
        return Db::transaction(function () use ($siteId, $userId, $propertyId, $orderId) {
            // The property lock serializes new threads without ever merging unrelated old target IDs.
            $p = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
                ->where('business_type', 'hotel')->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $p) throw new BusinessException(ErrorCode::NOT_FOUND, '酒店不存在');
            if ($orderId > 0) {
                $o = Db::table('order_main')->where('id', $orderId)->where('site_id', $siteId)->where('user_id', $userId)
                    ->where('property_id', $propertyId)->whereNull('deleted_at')->first();
                if (! $o) throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
            } elseif ((int) $p->status !== 1 || (int) $p->publish_status !== 1 || (int) $p->operating_status !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '酒店暂不可咨询');
            }
            $key = "$siteId:$propertyId:$userId:$orderId";
            $old = Db::table('chat_conversation')->where('thread_key', $key)->first();
            if ($old) return (array) $old;
            $id = Db::table('chat_conversation')->insertGetId(['site_id' => $siteId, 'user_id' => $userId,
                'type' => 1, 'target_id' => $propertyId, 'property_id' => $propertyId, 'order_id' => $orderId,
                'thread_key' => $key, 'title' => $p->store_name]);
            return (array) Db::table('chat_conversation')->where('id', $id)->first();
        });
    }

    public function conversation(int $id, string $role, int $actorId, int $siteId, int $selected = 0, string $permission = 'mch:chat:list'): array
    {
        $c = Db::table('chat_conversation')->where('id', $id)->where('site_id', $siteId)->first();
        if (! $c || ($role === 'user' && (int) $c->user_id !== $actorId)) throw new BusinessException(ErrorCode::NOT_FOUND, '会话不存在');
        if ($role === 'merchant') {
            if ((int) $c->type !== 1 || (int) $c->property_id <= 0 || ($selected > 0 && $selected !== (int) $c->property_id)) throw new BusinessException(ErrorCode::NOT_FOUND);
            ChatAccess::require($actorId, (int) $c->property_id, $permission);
        }
        return (array) $c;
    }

    public function send(array $c, string $role, int $actorId, string $name, string $content, string $clientId, array $attachmentIds = []): array
    {
        $content = trim($content);
        if (mb_strlen($content) > 2000 || ($content === '' && $attachmentIds === []) || count($attachmentIds) > 5
            || ! preg_match('/^[A-Za-z0-9_-]{8,64}$/D', $clientId)) throw new BusinessException(ErrorCode::PARAM_ERROR, '消息内容、附件数量或请求号不正确');
        $hash = hash('sha256', json_encode([$content, $attachmentIds]));
        $result = Db::transaction(function () use ($c, $role, $actorId, $name, $content, $clientId, $attachmentIds, $hash) {
            $current = (array) Db::table('chat_conversation')->where('id', $c['id'])->lockForUpdate()->first();
            $old = Db::table('chat_message')->where('conversation_id', $c['id'])->where('sender_role', $role)
                ->where('sender_id', $actorId)->where('client_message_id', $clientId)->first();
            if ($old) {
                if ($old->payload_hash !== $hash) throw new BusinessException(ErrorCode::DATA_CONFLICT, '请求号已用于其他内容');
                return ['messageId' => (int) $old->id, 'duplicate' => true];
            }
            if ((int) $current['type'] === 2 && (int) $current['status'] === 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束');
            $ids = array_values(array_unique(array_map('intval', $attachmentIds)));
            $attachments = $ids === [] ? [] : Db::table('chat_attachment')->whereIn('id', $ids)->where('conversation_id', $c['id'])
                ->where('actor_role', $role)->where('actor_id', $actorId)->whereNull('message_id')->lockForUpdate()->get()->all();
            if (count($attachments) !== count($ids)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '附件不可用');
            $sender = $role === 'user' ? 1 : 2;
            $id = (int) Db::table('chat_message')->insertGetId(['site_id' => $c['site_id'], 'conversation_id' => $c['id'],
                'sender_type' => $sender, 'sender_role' => $role, 'sender_id' => $actorId, 'sender_name' => mb_substr($name, 0, 100),
                'content' => $content, 'msg_type' => $ids ? 2 : 1, 'client_message_id' => $clientId, 'payload_hash' => $hash]);
            if ($ids) Db::table('chat_attachment')->whereIn('id', $ids)->update(['message_id' => $id]);
            Db::table('chat_conversation')->where('id', $c['id'])->update(['status' => 0, 'resolved_at' => null,
                'version' => (int) $current['version'] + 1, 'last_sender_type' => $sender,
                'last_message' => mb_substr($content ?: '[Attachment]', 0, 500), 'last_time' => gmdate('Y-m-d H:i:s')]);
            if ((int) $current['status'] === 1) $this->audit($c, $role, $actorId, 'reopened');
            $this->notifications($current, $role, $id, $content);
            return ['messageId' => $id, 'duplicate' => false];
        });
        if (! $result['duplicate']) {
            $recipients = $role === 'user' ? Db::table('merchant_notify')->where('request_id', 'like', 'chat-' . $result['messageId'] . '-%')->pluck('recipient_id')->map(static fn ($id) => (int) $id)->all() : [];
            $this->publish((int) $c['id'], 'message', (int) $result['messageId'], ['senderRole' => $role, 'recipientIds' => $recipients]);
        }
        return $result;
    }

    public function history(array $c, int $before = 0, int $after = 0, int $limit = 50): array
    {
        $q = Db::table('chat_message')->where('conversation_id', $c['id']);
        if ($before > 0) $q->where('id', '<', $before);
        if ($after > 0) $q->where('id', '>', $after);
        $rows = ($after > 0 ? $q->orderBy('id') : $q->orderByDesc('id'))->limit(min(200, max(1, $limit)))->get()
            ->map(static function ($row) {
                $r = (array) $row;
                unset($r['payload_hash']);
                $r['attachments'] = Db::table('chat_attachment')->where('message_id', $r['id'])
                    ->get(['id', 'filename', 'mime', 'size'])->map(static fn ($a) => (array) $a)->all();
                return $r;
            })->all();
        if ($after <= 0) $rows = array_reverse($rows);
        return $rows;
    }

    public function receipt(array $c, string $role, int $actorId, int $messageId, bool $read): void
    {
        if (! Db::table('chat_message')->where('conversation_id', $c['id'])->where('id', $messageId)->exists()) throw new BusinessException(ErrorCode::PARAM_ERROR);
        Db::statement('INSERT INTO chat_receipt(conversation_id,actor_role,actor_id,delivered_id,read_id) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE delivered_id=GREATEST(delivered_id,VALUES(delivered_id)),read_id=GREATEST(read_id,VALUES(read_id))',
            [$c['id'], $role, $actorId, $messageId, $read ? $messageId : 0]);
        $this->publish((int) $c['id'], 'receipt', $messageId);
    }

    public function receipts(array $c): array
    {
        return Db::table('chat_receipt')->where('conversation_id', $c['id'])->get()->map(static fn ($r) => (array) $r)->all();
    }

    public function unread(array $c, string $role, int $actorId, ?array $account = null): int
    {
        $read = (int) Db::table('chat_receipt')->where('conversation_id', $c['id'])->where('actor_role', $role)->where('actor_id', $actorId)->value('read_id');
        $q = Db::table('chat_message')->where('conversation_id', $c['id'])->where('id', '>', $read)->where('sender_type', $role === 'user' ? 2 : 1);
        if ($account !== null) $q->where('created_at', '>=', ChatAccess::authorizedSince($account, (int) $c['property_id']));
        return $q->count();
    }

    public function audit(array $c, string $role, int $actorId, string $action, string $details = ''): void
    {
        Db::table('chat_audit')->insert(['conversation_id' => $c['id'], 'actor_role' => $role, 'actor_id' => $actorId, 'action' => $action, 'details' => $details]);
    }

    public function releaseInvalidAssignments(int $siteId, array $propertyIds): void
    {
        foreach ($propertyIds as $propertyId) {
            $eligible = array_column(ChatAccess::handlers($siteId, (int) $propertyId), 'id');
            $q = Db::table('chat_conversation')->where('site_id', $siteId)->where('type', 1)->where('property_id', $propertyId)->where('assignee_id', '>', 0);
            if ($eligible !== []) $q->whereNotIn('assignee_id', $eligible);
            foreach ($q->get() as $row) {
                $c = (array) $row;
                $updated = Db::transaction(function () use ($c) {
                    $updated = Db::table('chat_conversation')->where('id', $c['id'])->where('version', $c['version'])
                        ->update(['assignee_id' => 0, 'version' => (int) $c['version'] + 1]);
                    if ($updated) $this->audit($c, 'system', 0, 'assignee_released', (string) $c['assignee_id']);
                    return $updated;
                });
                if ($updated) $this->publish((int) $c['id'], 'internal');
            }
        }
    }

    public function publish(int $conversationId, string $kind, int $messageId = 0, array $metadata = []): void
    {
        try {
            \Hyperf\Support\make(\Hyperf\Redis\Redis::class)->publish('mtrip:chat:events', json_encode(['conversationId' => $conversationId, 'kind' => $kind, 'messageId' => $messageId] + $metadata));
        } catch (\Throwable $e) {
            // HTTP success still means persisted. Reconnect always refreshes the authoritative snapshot.
            error_log('chat_realtime_publish_failed ' . $e::class);
        }
    }

    private function notifications(array $c, string $role, int $messageId, string $content): void
    {
        if ((int) $c['type'] !== 1 || (int) $c['property_id'] <= 0) return;
        if ($role === 'user') {
            $handlers = ChatAccess::handlers((int) $c['site_id'], (int) $c['property_id']);
            $validAssignee = in_array((int) $c['assignee_id'], array_column($handlers, 'id'), true);
            if (! $validAssignee && (int) $c['assignee_id'] > 0) Db::table('chat_conversation')->where('id', $c['id'])->update(['assignee_id' => 0]);
            $merchantId = (int) Db::table('merchant_store')->where('id', $c['property_id'])->value('merchant_id');
            foreach ($handlers as $h) {
                if ($validAssignee && $h['id'] !== (int) $c['assignee_id']) continue;
                if (Db::table('chat_preferences')->where('site_id', $c['site_id'])->where('admin_id', $h['id'])->where('inapp_enabled', 0)->exists()) continue;
                Db::table('merchant_notify')->insert(['site_id' => $c['site_id'], 'merchant_id' => $merchantId,
                    'property_id' => $c['property_id'], 'recipient_id' => $h['id'], 'category' => 'support',
                    'title' => 'Guest message', 'message' => mb_substr($content ?: '[Attachment]', 0, 1000),
                    'deep_link_type' => 'guest_chat', 'deep_link_value' => (string) $c['id'], 'channels' => 'inapp',
                    'send_at' => gmdate('Y-m-d H:i:s'), 'delivered_at' => gmdate('Y-m-d H:i:s'),
                    'request_id' => 'chat-' . $messageId . '-' . $h['id']]);
            }
        } else {
            Db::table('notify_record')->insert(['site_id' => $c['site_id'], 'user_id' => $c['user_id'],
                'event_key' => 'guest_chat', 'title' => $c['title'], 'content' => mb_substr($content ?: '[Attachment]', 0, 500),
                'biz_type' => 4, 'biz_id' => $c['id']]);
        }
    }
}
