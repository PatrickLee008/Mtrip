<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端收藏(Saved Hotels):列表/收藏/取消
 * PRD 模块 7:可无限收藏、滑动删除、跨设备同步(账号维度)
 */
class FavoriteController extends AbstractController
{
    /** 收藏列表:join 商品输出图片/名称/位置/星级(仅未删商品) */
    public function list(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_favorite as f')
            ->join('goods_info as g', 'g.id', '=', 'f.goods_id')
            ->where('f.user_id', UserContext::userId())
            ->whereNull('g.deleted_at');
        $total = (clone $query)->count();
        $list = $query->orderByDesc('f.id')->forPage($page, $pageSize)
            ->get(['f.id', 'f.goods_id', 'f.created_at',
                'g.goods_name', 'g.cover_image', 'g.address', 'g.star_level', 'g.goods_type', 'g.status'])
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 收藏(幂等:已收藏不报错) */
    public function add(): array
    {
        $siteId = $this->requireSiteId();
        $goodsId = $this->requireId('goodsId');
        $exists = Db::table('goods_info')
            ->where('id', $goodsId)->where('site_id', $siteId)->whereNull('deleted_at')
            ->exists();
        if (! $exists) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在');
        }
        Db::table('user_favorite')->insertOrIgnore([
            'site_id' => $siteId,
            'user_id' => UserContext::userId(),
            'goods_id' => $goodsId,
        ]);
        return Result::success(null, '已收藏');
    }

    /** 取消收藏(按 goodsId,幂等) */
    public function remove(): array
    {
        $goodsId = $this->requireId('goodsId');
        Db::table('user_favorite')
            ->where('user_id', UserContext::userId())
            ->where('goods_id', $goodsId)
            ->delete();
        return Result::success(null, '已取消收藏');
    }
}
