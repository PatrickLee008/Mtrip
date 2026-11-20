<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** Optional property commission; null explicitly restores inheritance, with immutable history. */
final class PropertyCommercialSettings
{
    public static function effective(int $merchant, int $site, int $property, bool $currentRead = false): ?array
    {
        $q = Db::table('merchant_property_commercial_config')->where('merchant_id', $merchant)->where('site_id', $site)
            ->where('property_id', $property)->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('effective_at')->orderByDesc('version');
        if ($currentRead) $q->sharedLock();
        $row = $q->first();
        return $row ? (array) $row : null;
    }

    public static function read(int $merchantId, int $propertyId): array
    {
        MerchantCommercialSettings::read($merchantId);
        $property = self::property($merchantId, $propertyId);
        $q = self::query($property);
        return ['property' => $property, 'current' => self::effective($merchantId, (int) $property['site_id'], $propertyId),
            'latest_version' => (int) (clone $q)->max('version'),
            'history' => $q->orderByDesc('version')->limit(100)->get()->map(static fn ($r) => (array) $r)->all()];
    }

    public static function save(int $merchantId, int $propertyId, array $input): array
    {
        if (! AdminContext::hasPermission('merchant:list:edit')) throw new BusinessException(ErrorCode::FORBIDDEN);
        // Reuse strict money/version/date validation, without granting property editors any other commercial fields.
        $inherit = $input['commissionRate'] === null;
        $terms = CommercialTerms::validate(array_replace($input, ['commissionPlan' => 'standard',
            'commissionRate' => $inherit ? 0 : $input['commissionRate'], 'transactionFeeRate' => 0,
            'payAtHotelEnabled' => false, 'noShowFeeEnabled' => false, 'merchantUpfrontRate' => 0]));
        $rate = $inherit ? null : $terms['commission_rate'];
        return Db::transaction(function () use ($merchantId, $propertyId, $terms, $rate): array {
            $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant || (int) $merchant->status === 5) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Merchant is unavailable');
            $property = self::property($merchantId, $propertyId, true);
            $q = self::query($property);
            $hash = hash('sha256', json_encode([$rate, $terms['effective_at'], $terms['reason']], JSON_THROW_ON_ERROR));
            $old = (clone $q)->where('request_id', $terms['request_id'])->first();
            if ($old) {
                if (! hash_equals($old->payload_hash, $hash)) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Request ID was reused');
            } else {
                if ((int) (clone $q)->max('version') !== $terms['expected_version']) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Property terms changed; reload');
                $id = $q->insertGetId(['merchant_id' => $merchantId, 'site_id' => $property['site_id'], 'property_id' => $propertyId,
                    'version' => $terms['expected_version'] + 1, 'commission_rate' => $rate, 'effective_at' => $terms['effective_at'],
                    'reason' => $terms['reason'], 'request_id' => $terms['request_id'], 'payload_hash' => $hash,
                    'created_by' => AdminContext::adminId(), 'created_by_name' => AdminContext::adminName(), 'created_at' => gmdate('Y-m-d H:i:s')]);
                Db::table('merchant_activity_log')->insert(['merchant_id' => $merchantId, 'site_id' => $property['site_id'],
                    'activity_type' => 'commercial_settings', 'description' => mb_substr('Property ' . $propertyId . ': ' . $terms['reason'], 0, 255),
                    'performed_by' => AdminContext::adminName(), 'performed_by_id' => AdminContext::adminId(), 'actor_type' => 'admin',
                    'entity_type' => 'property_commercial_config', 'entity_id' => $id, 'created_at' => gmdate('Y-m-d H:i:s')]);
            }
            return self::read($merchantId, $propertyId);
        });
    }

    private static function property(int $merchant, int $id, bool $lock = false): array
    {
        $q = Db::table('merchant_store')->where('id', $id)->where('merchant_id', $merchant)->whereNull('deleted_at');
        if ($lock) $q->lockForUpdate();
        $row = $q->first(['id','merchant_id','site_id','store_name']);
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        if (! AdminContext::isSuper() && (int) $row->site_id !== AdminContext::siteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return (array) $row;
    }

    private static function query(array $property)
    {
        return Db::table('merchant_property_commercial_config')->where('merchant_id', $property['merchant_id'])
            ->where('site_id', $property['site_id'])->where('property_id', $property['id']);
    }
}
