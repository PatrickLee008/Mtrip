<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 管理端酒店评价审核(PRD 模块4):列表 / 显示隐藏 / 商户回复
 */
class AdminReviewController extends AbstractAdminController
{
    /** 评价列表:筛选 goodsId/status/rating */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('goods_review')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($goodsId = $this->intInput('goodsId')) > 0) {
            $query->where('goods_id', $goodsId);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($rating = $this->intInput('rating')) > 0) {
            $query->where('rating', $rating);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                $row['images'] = $row['images'] ? json_decode((string) $row['images'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 审核显示/隐藏:status 1显示 2隐藏 */
    #[Permission('goods:review:audit')]
    public function audit(): array
    {
        $review = $this->scoped($this->requireId());
        $status = $this->intInput('status');
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '状态只能为1显示/2隐藏');
        }
        Db::table('goods_review')->where('id', $review['id'])->update(['status' => $status]);
        return Result::success(null, '已更新');
    }

    /** 商户/平台回复 */
    #[Permission('goods:review:reply')]
    public function reply(): array
    {
        $review = $this->scoped($this->requireId());
        $content = $this->requireStr('content');
        Db::table('goods_review')->where('id', $review['id'])
            ->update(['reply_content' => mb_substr($content, 0, 2000)]);
        return Result::success(null, '已回复');
    }

    private function scoped(int $id): array
    {
        $review = Db::table('goods_review')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $review) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '评价不存在');
        }
        $review = (array) $review;
        $this->assertSiteScope((int) $review['site_id']);
        return $review;
    }
}
