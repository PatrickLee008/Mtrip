<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Constants\BookingConst;
use App\Controller\Admin\AbstractAdminController;
use App\Service\Booking\BookingEventService;
use App\Service\Booking\BookingLifecycleService;
use App\Service\Booking\BookingRefundService;
use App\Service\Booking\BookingSyncService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;
use Psr\Http\Message\ResponseInterface;

/**
 * 商户端酒店预订管理(实现方案-Merchant-M4 §7):
 * 列表/统计/详情/时间线/确认/入住/退房/取消/No-show/退款/备注/同步/导出/凭证。
 * 数据范围:集团→绑定商户;商户→本商户;门店子账号→仅获授权酒店商品(merchant_store_goods)。
 * 越权访问按 404 处理,不泄露预订是否存在。
 */
class BookingController extends AbstractAdminController
{
    #[Inject]
    protected BookingLifecycleService $lifecycle;

    #[Inject]
    protected BookingRefundService $refundService;

    #[Inject]
    protected BookingSyncService $syncService;

    #[Inject]
    protected BookingEventService $events;

    /** 页签数量与待处理统计 */
    #[Permission('mch:order:list')]
    public function stats(): array
    {
        $base = Db::table('order_main')->whereNull('deleted_at')->where('order_type', 1);
        $this->applyBookingScope($base);
        $counts = (clone $base)->get()
            ->groupBy('booking_status')
            ->mapWithKeys(static fn ($g) => [(int) $g->first()->booking_status => $g->count()]);
        $byStatus = static fn (int $s) => (int) ($counts[$s] ?? 0);
        $today = date('Y-m-d');
        return Result::success([
            'all' => (clone $base)->count(),
            'pending' => $byStatus(BookingConst::STATUS_PENDING_PAYMENT),
            'confirmed' => $byStatus(BookingConst::STATUS_CONFIRMED),
            'pendingCheckin' => $byStatus(BookingConst::STATUS_CONFIRMED),
            'inhouse' => $byStatus(BookingConst::STATUS_CHECKED_IN),
            'checkedOut' => $byStatus(BookingConst::STATUS_CHECKED_OUT),
            'cancelled' => $byStatus(BookingConst::STATUS_CANCELLED),
            'noShow' => $byStatus(BookingConst::STATUS_NO_SHOW),
            'arrivalsToday' => (clone $base)->where('booking_status', BookingConst::STATUS_CONFIRMED)->where('use_date', $today)->count(),
            'departuresToday' => (clone $base)->where('booking_status', BookingConst::STATUS_CHECKED_IN)->where('end_date', $today)->count(),
        ]);
    }

    /** 酒店预订列表:搜索/筛选/排序/分页(仅酒店订单) */
    #[Permission('mch:order:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_main')->whereNull('deleted_at')->where('order_type', 1);
        $this->applyBookingScope($query);
        $this->applyListFilters($query);

        $total = (clone $query)->count();
        [$sortField, $sortDir] = $this->sortParams();
        $list = $query->orderBy($sortField, $sortDir)->orderByDesc('id')
            ->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 预订详情:摘要/住客/支付/住宿明细/备注/同步/可执行动作 */
    #[Permission('mch:order:detail')]
    public function detail(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $order['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $order['contact_phone']));
        $order['guests'] = $this->decryptGuests((string) ($order['guests'] ?? ''));
        unset($order['deleted_at']);

        $notes = Db::table('order_internal_note')->where('order_id', (int) $order['id'])
            ->whereNull('deleted_at')->orderByDesc('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['edit_history'] = is_string($row['edit_history']) && $row['edit_history'] !== '' ? json_decode($row['edit_history'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        $refunds = Db::table('order_refund')->where('order_id', (int) $order['id'])->whereNull('deleted_at')
            ->orderByDesc('id')->get()->map(static fn ($row) => (array) $row)->all();
        $syncLogs = Db::table('order_sync_log')->where('order_id', (int) $order['id'])
            ->orderByDesc('id')->limit(5)->get()->map(static fn ($row) => (array) $row)->all();

        $nights = $order['use_date'] !== null && $order['end_date'] !== null
            ? (int) ((strtotime((string) $order['end_date']) - strtotime((string) $order['use_date'])) / 86400)
            : 0;
        return Result::success([
            'order' => $order,
            'nights' => $nights,
            'payment' => [
                'totalAmount' => $order['total_amount'],
                'discountAmount' => $order['discount_amount'],
                'payAmount' => $order['pay_amount'],
                'payMethod' => $order['pay_method'],
                'payTradeNo' => $order['pay_trade_no'],
                'payTime' => $order['pay_time'],
                'paymentStatus' => (int) $order['payment_status'],
                'paymentExpiresAt' => $order['payment_expires_at'],
                'refunds' => $refunds,
            ],
            'stay' => [
                'useDate' => $order['use_date'],
                'endDate' => $order['end_date'],
                'nights' => $nights,
                'quantity' => (int) $order['quantity'],
                'specialRequests' => (string) $order['special_requests'],
                'mealPlan' => (string) $order['meal_plan_snapshot'],
                'roomNo' => (string) $order['assigned_room_no'],
                'cancellationPolicy' => $this->jsonField($order['cancellation_policy_snapshot'] ?? null),
                'noShowPolicy' => $this->jsonField($order['no_show_policy_snapshot'] ?? null),
                'noShowDeadline' => $order['use_date'] !== null ? BookingConst::noShowDeadline((string) $order['use_date']) : null,
            ],
            'notes' => $notes,
            'sync' => [
                'pms' => $this->syncService->statusOf($order),
                'channel' => (string) ($order['channel_sync_status'] ?? BookingConst::SYNC_NOT_CONNECTED),
                'logs' => $syncLogs,
            ],
            'availableActions' => $this->lifecycle->availableActions($order),
        ]);
    }

    /** 预订时间线(倒序分页) */
    #[Permission('mch:order:detail')]
    public function timeline(): array
    {
        $this->findScopedBooking($this->requireId());
        [$page, $pageSize] = $this->pageParams();
        $data = $this->events->list($this->requireId(), $page, $pageSize);
        return Result::page($data['list'], $data['total'], $page, $pageSize);
    }

    /** 人工确认(仅外部渠道/到店付预订) */
    #[Permission('mch:order:confirm')]
    public function confirm(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $this->lifecycle->confirm((int) $order['id'], MerchantContext::adminId(), MerchantContext::adminName());
        return Result::success(null, '预订已确认');
    }

    /** 办理入住(可分配房号) */
    #[Permission('mch:order:check-in')]
    public function checkIn(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $this->lifecycle->checkIn((int) $order['id'], MerchantContext::adminId(), MerchantContext::adminName(), $this->strInput('roomNo'));
        return Result::success(null, '入住办理成功');
    }

    /** 办理退房 */
    #[Permission('mch:order:check-out')]
    public function checkOut(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $this->lifecycle->checkOut((int) $order['id'], MerchantContext::adminId(), MerchantContext::adminName());
        return Result::success(null, '退房办理成功');
    }

    /** 取消预订(释放/回补库存;退款另行按政策处理) */
    #[Permission('mch:order:cancel')]
    public function cancel(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $this->lifecycle->cancel((int) $order['id'], MerchantContext::adminId(), MerchantContext::adminName(), $this->strInput('reason', '商户取消'));
        return Result::success(null, '预订已取消');
    }

    /** 标记 No-show(须过入住截止时间;豁免须独立权限+原因) */
    #[Permission('mch:order:no-show')]
    public function noShow(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $waive = $this->intInput('waiveFee') === 1;
        if ($waive && ! MerchantContext::hasPermission('mch:order:no-show-waive')) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '豁免 No-show 费用需要独立权限');
        }
        $this->lifecycle->markNoShow((int) $order['id'], MerchantContext::adminId(), MerchantContext::adminName(), $waive, $this->strInput('waiveReason'));
        return Result::success(null, '已标记 No-show');
    }

    /** 退款政策试算(按下单时政策快照) */
    #[Permission('mch:order:refund')]
    public function refundQuote(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        return Result::success($this->refundService->quote($order));
    }

    /** 商户发起退款(按试算上限内金额直退钱包) */
    #[Permission('mch:order:refund')]
    public function refundApply(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $amount = $this->input('amount') !== null && $this->input('amount') !== '' ? $this->floatInput('amount') : null;
        $result = $this->refundService->apply($order, MerchantContext::adminId(), MerchantContext::adminName(), $amount, $this->strInput('reason'));
        return Result::success(['refundNo' => $result['refundNo'], 'refundAmount' => $result['refundAmount']], '退款已完成');
    }

    /** 新增内部备注(仅酒店员工可见) */
    #[Permission('mch:order:note')]
    public function noteAdd(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $content = mb_substr($this->requireStr('content'), 0, 2000);
        Db::table('order_internal_note')->insert([
            'site_id' => (int) $order['site_id'],
            'merchant_id' => (int) $order['merchant_id'],
            'order_id' => (int) $order['id'],
            'order_no' => (string) $order['order_no'],
            'content' => $content,
            'author_id' => MerchantContext::adminId(),
            'author_name' => MerchantContext::adminName(),
        ]);
        $this->events->log($order, 'note_added', BookingConst::OPERATOR_MERCHANT, MerchantContext::adminId(), MerchantContext::adminName());
        return Result::success(null, '备注已添加');
    }

    /** PMS/渠道手动同步(未连接时业务失败) */
    #[Permission('mch:order:sync')]
    public function sync(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $target = $this->strInput('target', 'pms') === 'channel' ? 'channel' : 'pms';
        return Result::success($this->syncService->forceSync($order, $target), '同步任务已提交');
    }

    /** 住客联系方式明文查看(独立权限+审计) */
    #[Permission('mch:order:guest-contact')]
    public function guestContact(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $phone = $this->decryptField((string) $order['contact_phone']);
        $this->events->log($order, 'guest_contact_viewed', BookingConst::OPERATOR_MERCHANT, MerchantContext::adminId(), MerchantContext::adminName(), 1, null, 'security');
        return Result::success(['phone' => $phone, 'name' => (string) $order['contact_name']]);
    }

    /** 住客消息会话(§9.2):按预订定位/创建会话并返回历史消息,范围由 findScopedBooking 控制 */
    #[Permission('mch:order:message')]
    public function guestThread(): array
    {
        $this->requireMessagePermission();
        $order = $this->findScopedBooking($this->requireId());
        $conv = $this->guestConversation($order);
        $messages = Db::table('chat_message')->where('conversation_id', (int) $conv['id'])
            ->orderBy('id')->limit(200)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::success([
            'conversationId' => (int) $conv['id'],
            'title' => (string) $conv['title'],
            'status' => (int) $conv['status'],
            'guestName' => (string) $order['contact_name'],
            'messages' => $messages,
        ]);
    }

    /** 发送住客消息(§9.2):商户以酒店方身份写入会话,时间线留痕 */
    #[Permission('mch:order:message')]
    public function guestMessage(): array
    {
        $this->requireMessagePermission();
        $order = $this->findScopedBooking($this->requireId());
        $content = mb_substr($this->requireStr('content'), 0, 2000);
        $conv = $this->guestConversation($order);
        if ((int) $conv['status'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '会话已结束,无法继续发送');
        }
        $messageId = Db::table('chat_message')->insertGetId([
            'site_id' => (int) $conv['site_id'],
            'conversation_id' => (int) $conv['id'],
            'sender_type' => 2, // 坐席/酒店侧消息,复用 C 端既有展示
            'content' => $content,
            'msg_type' => 1,
        ]);
        Db::table('chat_conversation')->where('id', $conv['id'])
            ->update(['last_message' => mb_substr($content, 0, 500), 'last_time' => date('Y-m-d H:i:s')]);
        $this->events->log($order, 'guest_message_sent', BookingConst::OPERATOR_MERCHANT, MerchantContext::adminId(), MerchantContext::adminName());
        return Result::success(['messageId' => (int) $messageId], '消息已发送');
    }

    /** 预订凭证(前端打印版数据) */
    #[Permission('mch:order:voucher')]
    public function voucher(): array
    {
        $order = $this->findScopedBooking($this->requireId());
        $order['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $order['contact_phone']));
        return Result::success([
            'orderNo' => (string) $order['order_no'],
            'goodsName' => (string) $order['goods_name'],
            'skuName' => (string) $order['sku_name'],
            'quantity' => (int) $order['quantity'],
            'useDate' => $order['use_date'],
            'endDate' => $order['end_date'],
            'guestName' => (string) $order['contact_name'],
            'guestPhone' => (string) $order['contact_phone'],
            'payAmount' => $order['pay_amount'],
            'bookingStatus' => (int) $order['booking_status'],
            'roomNo' => (string) $order['assigned_room_no'],
            'verifyCode' => in_array((int) $order['booking_status'], [BookingConst::STATUS_CONFIRMED, BookingConst::STATUS_CHECKED_IN], true) ? (string) $order['verify_code'] : '',
            'issuedAt' => date('Y-m-d H:i:s'),
        ]);
    }

    /** 导出 CSV(按当前筛选,上限 5000 行;前端亦可自行导出当前页) */
    #[Permission('mch:order:export')]
    public function export(): ResponseInterface
    {
        $query = Db::table('order_main')->whereNull('deleted_at')->where('order_type', 1);
        $this->applyBookingScope($query);
        $this->applyListFilters($query);
        [$sortField, $sortDir] = $this->sortParams();
        $rows = $query->orderBy($sortField, $sortDir)->orderByDesc('id')->limit(5000)->get();

        $statusText = [1 => 'Pending Payment', 2 => 'Confirmed', 3 => 'Checked-in', 4 => 'Checked-out', 5 => 'Cancelled', 6 => 'No-show'];
        $payText = [1 => 'Pending', 2 => 'Paid', 3 => 'Partially Refunded', 4 => 'Refunded', 5 => 'Failed'];
        $csv = "\u{FEFF}" . implode(',', ['Booking ID', 'Guest', 'Phone', 'Hotel', 'Room', 'Check-in', 'Check-out', 'Nights', 'Qty', 'Status', 'Payment', 'Channel', 'Amount', 'Room No', 'Booked At']) . "\n";
        foreach ($rows as $row) {
            $row = (array) $row;
            $nights = $row['use_date'] !== null && $row['end_date'] !== null
                ? (int) ((strtotime((string) $row['end_date']) - strtotime((string) $row['use_date'])) / 86400) : 0;
            $csv .= implode(',', array_map(static function ($v) {
                $v = str_replace('"', '""', (string) $v);
                return '"' . $v . '"';
            }, [
                $row['order_no'],
                $row['contact_name'],
                MaskHelper::mobile($this->decryptField((string) $row['contact_phone'])),
                $row['goods_name'],
                $row['sku_name'],
                (string) $row['use_date'],
                (string) $row['end_date'],
                $nights,
                $row['quantity'],
                $statusText[(int) $row['booking_status']] ?? '-',
                $payText[(int) $row['payment_status']] ?? '-',
                (string) $row['booking_channel'],
                $row['pay_amount'],
                (string) $row['assigned_room_no'],
                (string) $row['created_at'],
            ])) . "\n";
        }
        return (new Response())
            ->withHeader('Content-Type', 'text/csv; charset=utf-8')
            ->withHeader('Content-Disposition', 'attachment; filename=bookings-' . date('Ymd-His') . '.csv')
            ->withBody(new SwooleStream($csv));
    }

    // ---------- 数据范围与筛选 ----------

    /**
     * 住客消息权限显式兜底:运行期验证发现共享包 PermissionAspect 未被切面收集器注册,
     * #[Permission] 注解在 order-service 未被织入(平台级问题,阶段6专项修复)。
     * 与 no-show 豁免同模式:控制器内 MerchantContext::hasPermission 显式拦截,键与菜单种子一致。
     */
    private function requireMessagePermission(): void
    {
        if (! MerchantContext::hasPermission('mch:order:message')) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
    }

    /**
     * 住客会话定位:按 order_id 查;不存在则按预订信息创建(复用客服会话表)。
     * 无关联用户的预订(如线下单)不建会话,直接业务失败。
     */
    private function guestConversation(array $order): array
    {
        $conv = Db::table('chat_conversation')->where('order_id', (int) $order['id'])
            ->orderByDesc('id')->first();
        if ($conv) {
            return (array) $conv;
        }
        if ((int) ($order['user_id'] ?? 0) <= 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订无关联用户,无法发送住客消息');
        }
        $id = Db::table('chat_conversation')->insertGetId([
            'site_id' => (int) $order['site_id'],
            'user_id' => (int) $order['user_id'],
            'type' => 1, // 酒店咨询会话
            'target_id' => (int) $order['goods_id'],
            'order_id' => (int) $order['id'],
            'title' => mb_substr((string) $order['goods_name'], 0, 200),
            'status' => 0,
        ]);
        return (array) Db::table('chat_conversation')->where('id', $id)->first();
    }

    /** 数据范围:门店子账号仅获授权酒店商品;越权返回空集(列表) */
    private function applyBookingScope($query): void
    {
        $query->where('site_id', MerchantContext::siteId());
        $storeId = MerchantContext::scopeStoreId();
        if ($storeId !== null) {
            $query->whereIn('goods_id', Db::table('merchant_store_goods')
                ->where('store_id', $storeId)->whereNull('deleted_at')->select('goods_id'));
        } else {
            $query->whereIn('merchant_id', MerchantContext::scopeMerchantIds());
        }
    }

    /** 详情/操作前置范围校验:越权按 404 处理,不泄露预订是否存在 */
    private function findScopedBooking(int $id): array
    {
        $order = Db::table('order_main')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        $order = (array) $order;
        if ((int) $order['site_id'] !== MerchantContext::siteId()) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        $storeId = MerchantContext::scopeStoreId();
        if ($storeId !== null) {
            $granted = Db::table('merchant_store_goods')
                ->where('store_id', $storeId)->where('goods_id', (int) $order['goods_id'])
                ->whereNull('deleted_at')->exists();
            if (! $granted) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
            }
        } elseif (! in_array((int) $order['merchant_id'], MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        return $order;
    }

    /** 列表筛选:关键字/日期/酒店/房型/状态/支付/渠道 */
    private function applyListFilters($query): void
    {
        if (($q = $this->strInput('q')) !== '') {
            $phoneScan = preg_match('/^[0-9+\-\s]{5,20}$/', $q) === 1;
            $query->where(function ($sub) use ($q, $phoneScan) {
                $sub->where('order_no', 'like', "%{$q}%")
                    ->orWhere('contact_name', 'like', "%{$q}%")
                    ->orWhere('channel_reference', 'like', "%{$q}%");
                if ($phoneScan) {
                    // 电话为 AES-GCM 随机 IV 加密,无法密文检索:候选集内解密匹配
                    $ids = $this->matchByPhone($q);
                    $sub->orWhereIn('id', $ids !== [] ? $ids : [-1]);
                }
            });
        }
        if (($hotelId = $this->intInput('hotelId')) > 0) {
            $query->where('goods_id', $hotelId);
        }
        if (($roomTypeId = $this->intInput('roomTypeId')) > 0) {
            $query->where('sku_id', $roomTypeId);
        }
        $bookingStatus = $this->input('bookingStatus');
        if ($bookingStatus !== null && $bookingStatus !== '') {
            $query->where('booking_status', (int) $bookingStatus);
        }
        $paymentStatus = $this->input('paymentStatus');
        if ($paymentStatus !== null && $paymentStatus !== '') {
            $query->where('payment_status', (int) $paymentStatus);
        }
        if (($channel = $this->strInput('channel')) !== '') {
            $query->where('booking_channel', $channel);
        }
        if (($from = $this->strInput('dateFrom')) !== '') {
            $query->where('use_date', '>=', $from);
        }
        if (($to = $this->strInput('dateTo')) !== '') {
            $query->where('use_date', '<=', $to);
        }
    }

    /** 电话搜索:范围缩窄后候选集解密匹配(上限 2000 行) */
    private function matchByPhone(string $phone): array
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        $ids = [];
        $rows = Db::table('order_main')->whereNull('deleted_at')->where('order_type', 1)
            ->where('site_id', MerchantContext::siteId())
            ->orderByDesc('id')->limit(2000)->get(['id', 'contact_phone']);
        foreach ($rows as $row) {
            $plain = $this->decryptField((string) $row->contact_phone);
            if ($plain !== '' && str_contains(preg_replace('/\D/', '', $plain) ?? '', $digits)) {
                $ids[] = (int) $row->id;
            }
        }
        return $ids;
    }

    /** 排序:checkin入住日/checkout退房日/booked预订时间,默认倒序 */
    private function sortParams(): array
    {
        $map = ['checkin' => 'use_date', 'checkout' => 'end_date', 'booked' => 'created_at', 'status' => 'booking_status'];
        $field = $map[$this->strInput('sort')] ?? 'created_at';
        $dir = $this->strInput('dir') === 'asc' ? 'asc' : 'desc';
        return [$field, $dir];
    }

    /** 解密住客名单(手机号/邮箱脱敏) */
    private function decryptGuests(string $ciphertext): array
    {
        if ($ciphertext === '') {
            return [];
        }
        try {
            $json = CryptoHelper::decrypt($ciphertext, (string) $this->config->get('mtrip.aes_key', ''));
        } catch (\Throwable) {
            return [];
        }
        $arr = json_decode($json, true);
        if (! is_array($arr)) {
            return [];
        }
        return array_map(static function ($g) {
            $g = (array) $g;
            return [
                'firstName' => (string) ($g['firstName'] ?? ''),
                'lastName' => (string) ($g['lastName'] ?? ''),
                'phone' => MaskHelper::mobile((string) ($g['phone'] ?? '')),
                'email' => MaskHelper::email((string) ($g['email'] ?? '')),
            ];
        }, $arr);
    }

    private function jsonField(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : null;
        }
        return null;
    }
}
