<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantNotificationService;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/** Delivered in-app messages only; read state belongs to a login account. */
class NotificationController extends AbstractController
{
    private function query(): Builder
    {
        return Db::table('merchant_notify as n')->whereIn('n.merchant_id', MerchantContext::scopeMerchantIds() ?: [0])
            ->where('n.status', 1)->whereRaw("FIND_IN_SET('inapp', n.channels)")
            ->where('n.send_at', '<=', gmdate('Y-m-d H:i:s'))
            ->leftJoin('merchant_notify_read as r', static function ($join) {
                $join->on('r.notify_id', '=', 'n.id')->where('r.account_id', '=', MerchantContext::adminId());
            });
    }

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $q = $this->query();
        if (($keyword = $this->strInput('keyword')) !== '') $q->where(static function ($q) use ($keyword) {
            $q->where('n.title', 'like', "%{$keyword}%")->orWhere('n.message', 'like', "%{$keyword}%");
        });
        if (($category = $this->strInput('category')) !== '') $q->where('n.category', $category);
        $read = $this->input('isRead');
        if ($read !== null && $read !== '') (int) $read === 1 ? $q->whereNotNull('r.read_at') : $q->whereNull('r.read_at');
        $total = (clone $q)->count();
        $rows = $q->select('n.*', 'r.read_at as account_read_at')->orderByDesc('n.send_at')->orderByDesc('n.id')->forPage($page, $pageSize)->get()->map(static function ($r) {
            $row = (array) $r;
            $row['is_read'] = $row['account_read_at'] !== null;
            $row['read_at'] = $row['account_read_at'];
            unset($row['account_read_at'], $row['read_by'], $row['payload_hash'], $row['request_id']);
            return $row;
        })->all();
        return Result::page($rows, $total, $page, $pageSize);
    }

    public function summary(): array
    {
        $q = $this->query();
        return Result::success(['total' => (clone $q)->count(), 'unread' => (clone $q)->whereNull('r.read_at')->count(),
            'categories' => (clone $q)->selectRaw('n.category, COUNT(*) AS cnt')->groupBy('n.category')->pluck('cnt', 'category')->all()]);
    }

    #[Permission('mch:notifications:read')]
    public function read(): array
    {
        $q = $this->query();
        if ($this->intInput('id') > 0) $q->where('n.id', $this->intInput('id'));
        // Keyset batches avoid loading an entire mailbox, insertIgnore makes concurrent reads idempotent.
        $after = 0;
        do {
            $ids = (clone $q)->where('n.id', '>', $after)->whereNull('r.read_at')->orderBy('n.id')->limit(200)->pluck('n.id')->all();
            foreach ($ids as $id) Db::table('merchant_notify_read')->insertOrIgnore(['notify_id' => $id, 'account_id' => MerchantContext::adminId()]);
            if ($ids !== []) $after = (int) end($ids);
        } while (count($ids) === 200);
        return Result::success();
    }

    public function destination(): array
    {
        $row = $this->query()->where('n.id', $this->requireId())->select('n.*')->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        $type = (string) $row->deep_link_type;
        $value = (string) $row->deep_link_value;
        (new MerchantNotificationService())->validateLink((int) $row->merchant_id, (int) $row->site_id, $type, $value);
        $path = match ($type) {
            'booking_detail' => '/order', 'promotion' => '/promotions', 'wallet' => '/earnings',
            'user_profile' => '/settings', 'page' => $value, default => '',
        };
        // Destination pages/API retain their own role and resource checks.
        return Result::success(['path' => $path, 'query' => in_array($type, ['booking_detail', 'promotion'], true) ? ['notificationTarget' => $value] : []]);
    }
}
