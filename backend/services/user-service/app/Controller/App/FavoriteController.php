<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MarketplaceReader;
use Mtrip\Shared\Support\Result;

/**
 * C端收藏(Saved Hotels):列表/收藏/取消
 * PRD 模块 7:可无限收藏、滑动删除、跨设备同步(账号维度)
 */
class FavoriteController extends AbstractController
{
    /** 收藏列表:物业名称、图片、位置与星级 */
    public function list(): array
    {
        $siteId = $this->requireSiteId();
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_favorite as f')
            ->join('merchant_store as p', 'p.id', '=', 'f.property_id')
            ->where('f.site_id', $siteId)
            ->where('p.site_id', $siteId)
            ->where('f.user_id', UserContext::userId())
            ->whereNull('p.deleted_at');
        $total = (clone $query)->count();
        $list = $query->orderByDesc('f.id')->forPage($page, $pageSize)
            ->get(['f.id', 'f.property_id', 'f.created_at', 'p.store_name', 'p.images', 'p.address', 'p.star_level',
                'p.status', 'p.kyc_status', 'p.content_status', 'p.publish_status', 'p.operating_status', 'p.display_enabled'])
            ->map(static function ($row): array {
                $item = (array) $row;
                $images = json_decode((string) ($item['images'] ?? '[]'), true);
                $item['cover_image'] = is_array($images) && is_string($images[0] ?? null) ? $images[0] : '';
                $item['property_name'] = $item['store_name'];
                unset($item['images']);
                return $item;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 收藏(幂等:已收藏不报错) */
    public function add(): array
    {
        $siteId = $this->requireSiteId();
        $propertyId = $this->requireId('propertyId');
        $property = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
            ->whereNull('deleted_at')->first(['country_code', 'city_key']);
        $visible = $property ? array_map('intval', array_column(MarketplaceReader::searchable(
            $siteId, (string) $property->country_code, (string) $property->city_key
        ), 'property_id')) : [];
        if (! in_array($propertyId, $visible, true)) throw new BusinessException(ErrorCode::NOT_FOUND, '酒店物业不存在或不可见');
        Db::table('user_favorite')->insertOrIgnore([
            'site_id' => $siteId,
            'user_id' => UserContext::userId(),
            'property_id' => $propertyId,
            'goods_id' => 0,
        ]);
        return Result::success(null, '已收藏');
    }

    /** 取消收藏(按 propertyId,幂等) */
    public function remove(): array
    {
        $siteId = $this->requireSiteId();
        $propertyId = $this->requireId('propertyId');
        Db::table('user_favorite')
            ->where('site_id', $siteId)
            ->where('user_id', UserContext::userId())
            ->where('property_id', $propertyId)
            ->delete();
        return Result::success(null, '已取消收藏');
    }
}
