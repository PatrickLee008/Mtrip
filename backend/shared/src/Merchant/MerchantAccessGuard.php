<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class MerchantAccessGuard
{
    /** 必须在订单事务内、任何库存/券/订单写入之前调用。供应商独立门票沿用原路径。 */
    public static function lockBookable(array $items, int $siteId): void
    {
        $ids = [];
        foreach ($items as $item) {
            $merchantId = (int) $item['merchant_id'];
            if ($merchantId <= 0) {
                if ((int) ($item['goods_type'] ?? $item['order_type'] ?? 0) === 2 && (int) ($item['supplier_id'] ?? 0) > 0) {
                    continue;
                }
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商品缺少有效商户归属');
            }
            $ids[] = $merchantId;
        }
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);
        foreach ($ids as $id) {
            $merchant = Db::table('merchant_info')->where('id', $id)->where('site_id', $siteId)
                ->whereNull('deleted_at')->lockForUpdate()->first();
            $blacklisted = Db::table('merchant_blacklist')->where('merchant_id', $id)->where('status', 1)->lockForUpdate()->first() !== null;
            if (! $merchant || ! MerchantAccessPolicy::canBook((int) $merchant->status, $blacklisted)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商户当前不接受新预订或待支付订单付款');
            }
        }
    }

    /** 商户锁之后锁商品，防止事务外商品快照已变更归属/上架状态。 */
    public static function lockGoods(array $snapshots, int $siteId): void
    {
        usort($snapshots, static fn ($a, $b) => (int) $a['id'] <=> (int) $b['id']);
        foreach ($snapshots as $snapshot) {
            $goods = Db::table('goods_info')->where('id', $snapshot['id'])->where('site_id', $siteId)
                ->where('status', 3)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $goods || (int) $goods->merchant_id !== (int) $snapshot['merchant_id']
                || (int) $goods->goods_type !== (int) $snapshot['goods_type']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商品已下架或归属变更，请刷新后重试');
            }
        }
    }

    public static function assertMerchant(int $id, int $siteId): void
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->where('site_id', $siteId)->whereNull('deleted_at')->first();
        $blacklisted = Db::table('merchant_blacklist')->where('merchant_id', $id)->where('status', 1)->exists();
        if (! $merchant || ! MerchantAccessPolicy::canAccess((int) $merchant->status, $blacklisted)) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '所属商户不可访问商户端');
        }
    }

    /** 每个JWT请求读取实时账号和主体，禁用/删除/换绑/拉黑立即生效。 */
    public static function assertSession(array $claims): void
    {
        $account = Db::table('merchant_admin')->where('id', (int) ($claims['admin_id'] ?? 0))->whereNull('deleted_at')->first();
        if (! $account || (int) $account->status !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已禁用或删除');
        }
        foreach (['site_id', 'account_type', 'group_id', 'merchant_id', 'store_id', 'is_owner'] as $field) {
            if ((int) $account->{$field} !== (int) ($claims[$field] ?? 0)) {
                throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号授权范围已变更，请重新登录');
            }
        }
        self::assertSubject((array) $account);
    }

    public static function assertSubject(array $account): void
    {
        $siteId = (int) $account['site_id'];
        switch ((int) $account['account_type']) {
            case 1:
                $group = Db::table('merchant_group')->where('id', $account['group_id'])->where('site_id', $siteId)
                    ->where('status', 1)->whereNull('deleted_at')->first();
                if (! $group) {
                    throw new BusinessException(ErrorCode::FORBIDDEN, '所属集团不可用');
                }
                break;
            case 3:
                $store = Db::table('merchant_store')->where('id', $account['store_id'])->where('site_id', $siteId)
                    ->where('merchant_id', $account['merchant_id'])->where('status', 1)->whereNull('deleted_at')->first();
                if (! $store) {
                    throw new BusinessException(ErrorCode::FORBIDDEN, '所属门店不可用或归属不匹配');
                }
                self::assertMerchant((int) $account['merchant_id'], $siteId);
                break;
            case 2:
                self::assertMerchant((int) $account['merchant_id'], $siteId);
                break;
            default:
                throw new BusinessException(ErrorCode::FORBIDDEN, '账号类型无效');
        }
    }
}
