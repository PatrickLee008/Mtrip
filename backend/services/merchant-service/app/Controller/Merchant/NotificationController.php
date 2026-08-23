<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\Result;

/**
 * 商户端通知中心(Merchant App M6)。
 * 读取平台写入的 merchant_notify,并在商户账号维度记录已读状态。
 */
class NotificationController extends AbstractController
{
    /** 通知列表:关键词/分类/已读状态筛选 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_notify')
            ->whereIn('merchant_id', $this->scopeMerchantIds());

        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('title', 'like', "%{$keyword}%")
                    ->orWhere('message', 'like', "%{$keyword}%");
            });
        }
        if (($category = $this->strInput('category')) !== '') {
            $query->where('category', $category);
        }
        $isRead = $this->input('isRead');
        if ($isRead !== null && $isRead !== '') {
            ((int) $isRead) === 1 ? $query->whereNotNull('read_at') : $query->whereNull('read_at');
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('send_at')->orderByDesc('id')
            ->forPage($page, $pageSize)
            ->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['is_read'] = $row['read_at'] !== null;
                return $row;
            })
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    /** 顶部铃铛/页面统计 */
    public function summary(): array
    {
        $base = Db::table('merchant_notify')->whereIn('merchant_id', $this->scopeMerchantIds());
        $categoryRows = (clone $base)
            ->groupBy('category')
            ->selectRaw('category, COUNT(*) AS cnt')
            ->pluck('cnt', 'category')
            ->all();
        $categories = [];
        foreach ($categoryRows as $category => $count) {
            $categories[(string) $category] = (int) $count;
        }

        return Result::success([
            'total' => (clone $base)->count(),
            'unread' => (clone $base)->whereNull('read_at')->count(),
            'categories' => $categories,
        ]);
    }

    /** 标记单条或全部通知已读 */
    #[Permission('mch:notifications:read')]
    public function read(): array
    {
        $id = $this->intInput('id');
        $query = Db::table('merchant_notify')
            ->whereIn('merchant_id', $this->scopeMerchantIds())
            ->whereNull('read_at');
        if ($id > 0) {
            $query->where('id', $id);
        }
        $query->update([
            'read_at' => date('Y-m-d H:i:s'),
            'read_by' => MerchantContext::adminId(),
        ]);

        return Result::success(null, '已标记为已读');
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }
}
