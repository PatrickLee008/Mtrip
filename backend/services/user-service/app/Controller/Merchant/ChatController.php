<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Chat\ChatAccess;
use Mtrip\Shared\Chat\ChatService;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class ChatController extends AbstractController
{
    #[Inject]
    protected ChatService $chat;

    private function account(string $permission = 'mch:chat:list'): array
    {
        $a = ChatAccess::employee(MerchantContext::adminId());
        if (! ChatAccess::permission($a, $permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
        return $a;
    }

    private function conversation(string $permission = 'mch:chat:list'): array
    {
        $this->account();
        return $this->chat->conversation($this->requireId('conversationId'), 'merchant', MerchantContext::adminId(),
            MerchantContext::siteId(), MerchantContext::selectedPropertyId(), $permission);
    }

    public function preferences(): array
    {
        $a = $this->account();
        $prefs = Db::table('chat_preferences')->where('site_id', $a['site_id'])->where('admin_id', $a['id'])->first();
        return Result::success(['inapp_enabled' => (bool) ($prefs->inapp_enabled ?? true), 'sound_enabled' => (bool) ($prefs->sound_enabled ?? false)]);
    }

    #[Permission('mch:chat:list')]
    public function savePreferences(): array
    {
        $a = $this->account();
        Db::table('chat_preferences')->updateOrInsert(['site_id' => $a['site_id'], 'admin_id' => $a['id']],
            ['inapp_enabled' => $this->intInput('inappEnabled', 1) === 1 ? 1 : 0, 'sound_enabled' => $this->intInput('soundEnabled') === 1 ? 1 : 0]);
        return Result::success();
    }

    public function index(): array
    {
        $a = $this->account();
        $scope = ChatAccess::properties($a);
        $selected = MerchantContext::selectedPropertyId();
        if ($selected > 0) $scope = in_array($selected, $scope, true) ? [$selected] : [];
        $this->chat->releaseInvalidAssignments((int) $a['site_id'], $scope);
        [$page, $size] = $this->pageParams();
        $q = Db::table('chat_conversation as c')->join('merchant_store as p', 'p.id', '=', 'c.property_id')
            ->leftJoin('order_main as o', 'o.id', '=', 'c.order_id')->leftJoin('user_info as u', 'u.id', '=', 'c.user_id')
            ->where('c.site_id', $a['site_id'])->where('c.type', 1)->whereIn('c.property_id', $scope ?: [-1]);
        $keyword = $this->strInput('keyword');
        if ($keyword !== '') $q->where(static fn ($q) => $q->where('u.nickname', 'like', "%$keyword%")
            ->orWhere('o.contact_name', 'like', "%$keyword%")->orWhere('o.order_no', 'like', "%$keyword%")->orWhere('p.store_name', 'like', "%$keyword%"));
        if ($this->strInput('status') !== '') $q->where('c.status', $this->intInput('status'));
        if ($this->strInput('tab') === 'inhouse') $q->where('o.booking_status', 3);
        if ($this->strInput('assignee') === 'mine') $q->where('c.assignee_id', $a['id']);
        if ($this->strInput('assignee') === 'unassigned') $q->where('c.assignee_id', 0);
        // Per-account unread is a separate dimension from the team's last sender/resolve state.
        if ($this->strInput('tab') === 'unread') {
            $q->whereExists(function ($mq) use ($a) {
                $mq->selectRaw('1')->from('chat_message as m')->whereColumn('m.conversation_id', 'c.id')->where('m.sender_type', 1)
                    ->whereRaw('m.id > COALESCE((SELECT read_id FROM chat_receipt r WHERE r.conversation_id=c.id AND r.actor_role=? AND r.actor_id=?),0)', ['merchant', $a['id']]);
                $this->unreadSince($mq, $a, 'c.property_id');
            });
        }
        $total = (clone $q)->count();
        $rows = $q->select('c.*', 'p.store_name as property_name', 'p.business_type', 'o.contact_name', 'u.nickname', 'o.booking_status', 'o.order_no')
            ->orderByDesc('c.last_time')->orderByDesc('c.id')->forPage($page, $size)->get()->map(function ($r) use ($a) {
                $c = (array) $r;
                $c['guest_name'] = $c['contact_name'] ?: ($c['nickname'] ?: 'Guest');
                $c['unread'] = $this->chat->unread($c, 'merchant', (int) $a['id'], $a);
                $c['awaiting_reply'] = (int) $c['status'] === 0 && (int) $c['last_sender_type'] === 1;
                unset($c['thread_key']);
                return $c;
            })->all();
        return Result::page($rows, $total, $page, $size);
    }

    private function unreadSince($q, array $a, string $propertyColumn): void
    {
        $q->where('m.created_at', '>=', $a['created_at']);
        if (! $a['is_owner']) {
            $q->whereRaw("m.created_at >= (SELECT ep.created_at FROM merchant_employee_property ep WHERE ep.admin_id=? AND ep.property_id=$propertyColumn)", [$a['id']]);
            $q->whereRaw("m.created_at >= (SELECT MIN(GREATEST(ar.created_at,rm.created_at)) FROM merchant_admin_role ar JOIN merchant_role r ON r.id=ar.role_id JOIN merchant_role_menu rm ON rm.role_id=r.id JOIN merchant_menu mm ON mm.id=rm.menu_id WHERE ar.admin_id=? AND mm.perm_key='mch:chat:list' AND r.status=1 AND r.deleted_at IS NULL AND mm.status=1 AND mm.deleted_at IS NULL)", [$a['id']]);
        }
    }

    public function summary(): array
    {
        $a = $this->account();
        $ids = ChatAccess::properties($a);
        if (MerchantContext::selectedPropertyId() > 0) $ids = array_values(array_intersect($ids, [MerchantContext::selectedPropertyId()]));
        $this->chat->releaseInvalidAssignments((int) $a['site_id'], $ids);
        $q = Db::table('chat_message as m')->join('chat_conversation as c', 'c.id', '=', 'm.conversation_id')
            ->where('c.site_id', $a['site_id'])->where('c.type', 1)->whereIn('c.property_id', $ids ?: [-1])->where('m.sender_type', 1)
            ->whereRaw('m.id > COALESCE((SELECT read_id FROM chat_receipt r WHERE r.conversation_id=c.id AND r.actor_role=? AND r.actor_id=?),0)', ['merchant', $a['id']]);
        $this->unreadSince($q, $a, 'c.property_id');
        $unread = $q->count();
        $pending = Db::table('chat_conversation')->where('site_id', $a['site_id'])->where('type', 1)->whereIn('property_id', $ids ?: [-1])
            ->where('status', 0)->where('last_sender_type', 1)->count();
        return Result::success(['unread' => $unread, 'awaitingReply' => $pending]);
    }

    public function detail(): array
    {
        $c = $this->conversation();
        $o = null;
        // A chat role alone does not expose booking payment or contact fields.
        if ($c['order_id'] && ChatAccess::permission($this->account(), 'mch:order:detail')) {
            $o = Db::table('order_main')->where('id', $c['order_id'])->where('site_id', $c['site_id'])
                ->where('property_id', $c['property_id'])->whereNull('deleted_at')
                ->first(['id', 'order_no', 'goods_name', 'sku_name', 'use_date', 'end_date', 'quantity', 'booking_status', 'contact_name', 'pay_amount', 'payment_status', 'room_type_id']);
            if ($o) {
                $o->currency = Db::table('hotel_room_type')->where('id', $o->room_type_id)->value('currency')
                    ?: Db::connection('system')->table('sys_site')->where('id', $c['site_id'])->value('currency');
                unset($o->room_type_id);
            }
        }
        $c['booking'] = $o ? (array) $o : null;
        $c['property_name'] = Db::table('merchant_store')->where('id', $c['property_id'])->value('store_name');
        $c['guest_name'] = $o?->contact_name ?: (Db::table('user_info')->where('id', $c['user_id'])->value('nickname') ?: 'Guest');
        $c['note'] = Db::table('chat_note')->where('conversation_id', $c['id'])->first();
        $c['receipts'] = $this->chat->receipts($c);
        $c['handlers'] = ChatAccess::handlers((int) $c['site_id'], (int) $c['property_id']);
        unset($c['thread_key']);
        return Result::success($c);
    }

    #[Permission('mch:order:guest-contact')]
    public function contact(): array
    {
        $c = $this->conversation('mch:order:guest-contact');
        $cipher = $c['order_id'] > 0
            ? Db::table('order_main')->where('id', $c['order_id'])->where('site_id', $c['site_id'])->where('property_id', $c['property_id'])->value('contact_phone')
            : Db::table('user_info')->where('id', $c['user_id'])->where('site_id', $c['site_id'])->value('mobile');
        $plain = $cipher ? \Mtrip\Shared\Support\CryptoHelper::decrypt((string) $cipher, (string) \Hyperf\Config\config('mtrip.aes_key')) : '';
        $this->chat->audit($c, 'merchant', MerchantContext::adminId(), 'guest_contact_viewed');
        return Result::success(['phone' => $plain]);
    }

    public function messages(): array
    {
        $c = $this->conversation();
        return Result::success(['list' => $this->chat->history($c, $this->intInput('beforeId'), $this->intInput('afterId')), 'receipts' => $this->chat->receipts($c)]);
    }

    #[Permission('mch:chat:reply')]
    public function send(): array
    {
        $c = $this->conversation('mch:chat:reply');
        return Result::success($this->chat->send($c, 'merchant', MerchantContext::adminId(), MerchantContext::adminName(),
            $this->strInput('content'), $this->strInput('clientMessageId'), (array) $this->input('attachmentIds', [])));
    }

    #[Permission('mch:chat:list')]
    public function receipt(): array
    {
        $c = $this->conversation();
        $this->chat->receipt($c, 'merchant', MerchantContext::adminId(), $this->requireId('messageId'), $this->intInput('read') === 1);
        return Result::success();
    }

    #[Permission('mch:chat:note')]
    public function saveNote(): array
    {
        $c = $this->conversation('mch:chat:note');
        $content = $this->strInput('content');
        if (mb_strlen($content) > 10000) throw new BusinessException(ErrorCode::PARAM_ERROR);
        $version = $this->intInput('version');
        Db::transaction(function () use ($c, $content, $version) {
            Db::table('chat_conversation')->where('id', $c['id'])->lockForUpdate()->first();
            $old = Db::table('chat_note')->where('conversation_id', $c['id'])->first();
            if ((int) ($old->version ?? 0) !== $version) throw new BusinessException(ErrorCode::DATA_CONFLICT, '备注已更新，请刷新后编辑');
            $data = ['content' => $content, 'version' => $version + 1, 'editor_id' => MerchantContext::adminId(),
                'editor_name' => MerchantContext::adminName(), 'updated_at' => gmdate('Y-m-d H:i:s')];
            Db::table('chat_note')->updateOrInsert(['conversation_id' => $c['id']], $data);
            unset($data['updated_at']);
            Db::table('chat_note_history')->insert(['conversation_id' => $c['id']] + $data);
        });
        $this->chat->publish((int) $c['id'], 'internal');
        return Result::success();
    }

    public function noteHistory(): array
    {
        $c = $this->conversation();
        [$page, $size] = $this->pageParams();
        $q = Db::table('chat_note_history')->where('conversation_id', $c['id']);
        $total = (clone $q)->count();
        return Result::page($q->orderByDesc('version')->forPage($page, $size)->get()->all(), $total, $page, $size);
    }

    #[Permission('mch:chat:assign')]
    public function assign(): array
    {
        return $this->change('assign');
    }

    #[Permission('mch:chat:reply')]
    public function claim(): array
    {
        return $this->change('claim');
    }

    #[Permission('mch:chat:resolve')]
    public function resolve(): array
    {
        return $this->change('resolve');
    }

    private function change(string $action): array
    {
        $c = $this->conversation($action === 'resolve' ? 'mch:chat:resolve' : ($action === 'claim' ? 'mch:chat:reply' : 'mch:chat:assign'));
        Db::transaction(function () use ($c, $action) {
            $current = Db::table('chat_conversation')->where('id', $c['id'])->lockForUpdate()->first();
            if ((int) $current->version !== $this->intInput('version')) throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已变更，请刷新');
            $data = ['version' => (int) $current->version + 1];
            if ($action === 'resolve') {
                $data['status'] = $this->intInput('resolved', 1) === 1 ? 1 : 0;
                $data['resolved_at'] = $data['status'] ? gmdate('Y-m-d H:i:s') : null;
            } else {
                if ($action === 'claim' && (int) $current->assignee_id !== 0 && (int) $current->assignee_id !== MerchantContext::adminId()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已被认领');
                $target = $action === 'claim' ? MerchantContext::adminId() : $this->intInput('assigneeId');
                if ($target < 0) throw new BusinessException(ErrorCode::PARAM_ERROR);
                if ($target > 0) {
                    ChatAccess::require($target, (int) $c['property_id']);
                    ChatAccess::require($target, (int) $c['property_id'], 'mch:chat:reply');
                }
                $data['assignee_id'] = $target;
            }
            Db::table('chat_conversation')->where('id', $c['id'])->update($data);
            $this->chat->audit($c, 'merchant', MerchantContext::adminId(), $action, json_encode($data));
        });
        $this->chat->publish((int) $c['id'], 'internal');
        return Result::success();
    }

    public function quickReplies(): array
    {
        $c = $this->conversation();
        $language = $this->strInput('language', 'en-US');
        $items = Db::table('chat_quick_reply')->where('site_id', $c['site_id'])->where('property_id', $c['property_id'])->where('language', $language)->get()->all();
        $inhouse = $c['order_id'] > 0 && Db::table('order_main')->where('id', $c['order_id'])->where('booking_status', 3)->exists();
        return Result::success(array_values(array_filter($items, static fn ($r) => $r->kind !== 'wifi' || $inhouse)));
    }

    #[Permission('mch:chat:settings')]
    public function saveQuickReply(): array
    {
        $c = $this->conversation('mch:chat:settings');
        $kind = $this->strInput('kind');
        $lang = $this->strInput('language', 'en-US');
        $content = $this->strInput('content');
        if (! in_array($kind, ['checkin', 'wifi', 'directions'], true) || ! in_array($lang, ['en-US', 'zh-CN', 'my-MM'], true) || mb_strlen($content) > 2000) throw new BusinessException(ErrorCode::PARAM_ERROR);
        Db::table('chat_quick_reply')->updateOrInsert(['site_id' => $c['site_id'], 'property_id' => $c['property_id'], 'language' => $lang, 'kind' => $kind], ['content' => $content, 'editor_id' => MerchantContext::adminId()]);
        return Result::success();
    }
}
