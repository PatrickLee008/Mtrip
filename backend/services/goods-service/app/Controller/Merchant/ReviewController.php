<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端评价管理(Merchant App M9)。
 * goods_review 本身无 merchant_id,通过 goods_info 做商户数据范围裁剪。
 */
class ReviewController extends AbstractAdminController
{
    /** 评价列表:关键词/状态/评分/是否已回复/是否已标记 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->baseQuery();

        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('r.content', 'like', "%{$keyword}%")
                    ->orWhere('g.goods_name', 'like', "%{$keyword}%")
                    ->orWhere('o.order_no', 'like', "%{$keyword}%");
            });
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('r.status', (int) $status);
        }
        if (($rating = $this->intInput('rating')) > 0) {
            $query->where('r.rating', $rating);
        }
        $replied = $this->input('replied');
        if ($replied !== null && $replied !== '') {
            ((int) $replied) === 1 ? $query->where('r.reply_content', '<>', '') : $query->where('r.reply_content', '');
        }
        $flagged = $this->input('flagged');
        if ($flagged !== null && $flagged !== '') {
            $query->where('r.merchant_flag_status', (int) $flagged === 1 ? 1 : 0);
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('r.id')
            ->forPage($page, $pageSize)
            ->get($this->columns())
            ->map(function ($row) {
                $row = (array) $row;
                $row['images'] = $this->jsonDecode($row['images'] ?? null);
                $row['is_replied'] = (string) ($row['reply_content'] ?? '') !== '';
                $row['is_flagged'] = (int) ($row['merchant_flag_status'] ?? 0) === 1;
                return $row;
            })
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    /** 评价统计卡 */
    public function summary(): array
    {
        $base = $this->baseQuery();
        $row = (array) (clone $base)->first([
            Db::raw('COUNT(*) AS total'),
            Db::raw('COALESCE(AVG(r.rating),0) AS avg_rating'),
            Db::raw('SUM(CASE WHEN r.reply_content <> "" THEN 1 ELSE 0 END) AS replied'),
            Db::raw('SUM(CASE WHEN r.merchant_flag_status = 1 THEN 1 ELSE 0 END) AS flagged'),
        ]);
        $statuses = (clone $base)
            ->groupBy('r.status')
            ->selectRaw('r.status, COUNT(*) AS cnt')
            ->pluck('cnt', 'status')
            ->all();

        return Result::success([
            'total' => (int) ($row['total'] ?? 0),
            'avgRating' => round((float) ($row['avg_rating'] ?? 0), 1),
            'replied' => (int) ($row['replied'] ?? 0),
            'flagged' => (int) ($row['flagged'] ?? 0),
            'pending' => (int) ($statuses[0] ?? 0),
            'published' => (int) ($statuses[1] ?? 0),
            'hidden' => (int) ($statuses[2] ?? 0),
        ]);
    }

    /** 商户官方回复 */
    #[Permission('mch:reviews:reply')]
    public function reply(): array
    {
        $review = $this->findScoped($this->requireId());
        $content = $this->requireStr('content');
        Db::table('goods_review')->where('id', $review['id'])->update([
            'reply_content' => mb_substr($content, 0, 2000),
        ]);
        return Result::success(null, '已回复');
    }

    /** 标记评价给平台复核 */
    #[Permission('mch:reviews:flag')]
    public function flag(): array
    {
        $review = $this->findScoped($this->requireId());
        $reason = $this->requireStr('reason');
        Db::table('goods_review')->where('id', $review['id'])->update([
            'merchant_flag_status' => 1,
            'merchant_flag_reason' => mb_substr($reason, 0, 500),
            'merchant_flagged_at' => date('Y-m-d H:i:s'),
            'merchant_flagged_by' => MerchantContext::adminId(),
        ]);
        return Result::success(null, '已提交平台复核');
    }

    private function baseQuery()
    {
        return Db::table('goods_review as r')
            ->join('goods_info as g', 'g.id', '=', 'r.goods_id')
            ->leftJoin('order_main as o', 'o.id', '=', 'r.order_id')
            ->leftJoin('user_info as u', 'u.id', '=', 'r.user_id')
            ->whereNull('r.deleted_at')
            ->whereNull('g.deleted_at')
            ->whereIn('g.merchant_id', $this->scopeMerchantIds());
    }

    private function columns(): array
    {
        return [
            'r.id', 'r.site_id', 'r.goods_id', 'r.user_id', 'r.order_id', 'r.rating', 'r.content',
            'r.images', 'r.reply_content', 'r.status', 'r.created_at', 'r.updated_at',
            'r.merchant_flag_status', 'r.merchant_flag_reason', 'r.merchant_flagged_at',
            'g.goods_name', 'g.merchant_id', 'o.order_no', 'u.nickname', 'u.avatar',
        ];
    }

    private function findScoped(int $id): array
    {
        $review = $this->baseQuery()->where('r.id', $id)->first($this->columns());
        if (! $review) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '评价不存在');
        }
        return (array) $review;
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }
}
