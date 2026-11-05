<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Service\UserAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端个人中心:资料/密码/余额积分流水/反馈
 */
class UserController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

    /** 我的资料(脱敏) */
    public function me(): array
    {
        return Result::success($this->authService->profile(UserContext::userId()));
    }

    /** 修改资料(昵称/头像) */
    public function update(): array
    {
        $data = [];
        $nickname = $this->strInput('nickname');
        if ($nickname !== '') {
            $data['nickname'] = mb_substr($nickname, 0, 50);
        }
        $avatar = $this->strInput('avatar');
        if ($avatar !== '') {
            $data['avatar'] = $avatar;
        }
        if ($data === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '没有可更新的字段');
        }
        Db::table('user_info')->where('id', UserContext::userId())->update($data);
        return Result::success($this->authService->profile(UserContext::userId()), '资料已更新');
    }

    /** 修改密码(校验旧密码) */
    public function changePassword(): array
    {
        $oldPassword = $this->requireStr('oldPassword');
        $newPassword = $this->requireStr('newPassword');
        UserAuthService::assertPassword($newPassword);
        $user = Db::table('user_info')->where('id', UserContext::userId())->first();
        if (! $user || ! password_verify($oldPassword, (string) ((array) $user)['password'])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
        }
        Db::table('user_info')->where('id', UserContext::userId())
            ->update(['password' => password_hash($newPassword, PASSWORD_BCRYPT)]);
        return Result::success(null, '密码已修改,请重新登录');
    }

    /**
     * 钱包流水筛选(App mTrip Wallet 页的四个页签)。change_type:1充值 2消费 3退款 4调账(含推荐返利) 5提现;
     * 6 预留给「余额过期」—— 目前钱包余额没有过期机制,Expired 页签恒为空,有了过期任务再按 6 落流水。
     */
    private const BALANCE_LOG_TYPES = ['refund' => [3], 'spend' => [2], 'expired' => [6]];

    /**
     * 余额流水分页。入参 type(all|refund|spend|expired)、month(YYYY-MM,按 UTC 自然月);
     * 每行补 txn_no(展示用流水号)、booking_no / property_name(关联订单或整单 Trip,无则空串)。
     */
    public function balanceLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_balance_log')
            ->where('user_id', UserContext::userId())
            ->orderByDesc('id');
        $types = self::BALANCE_LOG_TYPES[$this->strInput('type')] ?? null;
        if ($types !== null) {
            $query->whereIn('change_type', $types);
        }
        $month = $this->strInput('month');
        if ($month !== '') {
            if (! preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month, $m)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '月份格式应为 YYYY-MM');
            }
            $start = sprintf('%s-%s-01 00:00:00', $m[1], $m[2]);
            $query->where('created_at', '>=', $start)
                ->where('created_at', '<', date('Y-m-d H:i:s', strtotime($start . ' +1 month')));
        }
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($this->withBookingInfo($list), $total, $page, $pageSize);
    }

    /**
     * 流水关联的预订:order_id 有两种口径 —— 整单 Trip 钱包支付记的是 order_trip.id(备注含 trip_no),
     * 其余(单订单支付、退款、推荐返利)记的是 order_main.id。按「备注里出现的单号」判定是哪一种,避免 id 撞号串单。
     *
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private function withBookingInfo(array $rows): array
    {
        $ids = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) $r['order_id'], $rows))));
        $trips = $orders = $tripHotel = [];
        if ($ids !== []) {
            $trips = Db::table('order_trip')->whereIn('id', $ids)->pluck('trip_no', 'id')->all();
            $orders = Db::table('order_main as o')
                ->leftJoin('merchant_store as s', 's.id', '=', 'o.property_id')
                ->whereIn('o.id', $ids)
                ->get(['o.id', 'o.order_no', 'o.goods_name', 's.store_name'])
                ->keyBy('id')->all();
            if ($trips !== []) {
                foreach (Db::table('order_main as o')
                    ->leftJoin('merchant_store as s', 's.id', '=', 'o.property_id')
                    ->whereIn('o.trip_id', array_keys($trips))
                    ->orderBy('o.id')
                    ->get(['o.trip_id', 'o.goods_name', 's.store_name']) as $o) {
                    $tripHotel[(int) $o->trip_id] ??= (string) ($o->store_name ?: $o->goods_name);
                }
            }
        }
        foreach ($rows as &$row) {
            $orderId = (int) $row['order_id'];
            $remark = (string) $row['remark'];
            $row['booking_no'] = '';
            $row['property_name'] = '';
            if (isset($trips[$orderId]) && str_contains($remark, (string) $trips[$orderId])) {
                $row['booking_no'] = (string) $trips[$orderId];
                $row['property_name'] = $tripHotel[$orderId] ?? '';
            } elseif (isset($orders[$orderId])) {
                $o = $orders[$orderId];
                $row['booking_no'] = (string) $o->order_no;
                $row['property_name'] = (string) ($o->store_name ?: $o->goods_name);
            }
            $row['txn_no'] = sprintf('WAL-%s-%06d', date('Ymd', strtotime((string) $row['created_at'])), (int) $row['id']);
        }
        unset($row);
        return $rows;
    }

    /** 积分流水分页 */
    public function pointsLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_points_log')
            ->where('user_id', UserContext::userId())
            ->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 提交反馈/投诉 */
    public function addFeedback(): array
    {
        $content = $this->requireStr('content');
        $type = $this->intInput('feedbackType', 1);
        if (! in_array($type, [1, 2, 3, 4], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '反馈类型不正确');
        }
        $images = $this->input('images');
        Db::table('user_feedback')->insert([
            'site_id' => $this->requireSiteId(),
            'user_id' => UserContext::userId(),
            'feedback_type' => $type,
            'content' => mb_substr($content, 0, 2000),
            'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null,
            'order_id' => $this->intInput('orderId'),
            'status' => 0,
        ]);
        return Result::success(null, '反馈已提交');
    }

    /** 我的反馈列表 */
    public function feedbackList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_feedback')
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['images'] = $row['images'] ? json_decode((string) $row['images'], true) : [];
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
