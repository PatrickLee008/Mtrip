<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class PayAtHotelTermsService
{
    public function current(array $merchant): array
    {
        $row = Db::table('merchant_pay_at_hotel_terms')
            ->where('merchant_id', (int) $merchant['id'])->where('site_id', (int) $merchant['site_id'])
            ->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('effective_at')->orderByDesc('version')->first();
        return $row ? (array) $row : [
            'version' => 0, 'enabled' => 0, 'no_show_enabled' => 0,
            'deposit_cap_rate' => 0, 'deposit_rate' => 0,
            'commission_rate' => (float) $merchant['commission_rate'],
            'transaction_fee_rate' => 0, 'effective_at' => null,
        ];
    }

    public function history(array $merchant): array
    {
        return Db::table('merchant_pay_at_hotel_terms')
            ->where('merchant_id', (int) $merchant['id'])->where('site_id', (int) $merchant['site_id'])
            ->orderByDesc('version')->get()->map(static fn ($row) => (array) $row)->all();
    }

    public function saveAdmin(array $merchant, array $input, int $actorId): array
    {
        $reason = trim((string) ($input['reason'] ?? ''));
        $effective = trim((string) ($input['effectiveAt'] ?? ''));
        if ($reason === '' || mb_strlen($reason) > 500 || $effective === '' || strtotime($effective) === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '须填写生效时间及变更原因');
        }
        return Db::transaction(function () use ($merchant, $input, $actorId, $reason, $effective) {
            $locked = (array) Db::table('merchant_info')->where('id', (int) $merchant['id'])
                ->where('site_id', (int) $merchant['site_id'])->lockForUpdate()->first();
            $base = $this->current($locked);
            $enabled = ! empty($input['enabled']);
            $noShow = $enabled && ! empty($input['noShowEnabled']);
            $cap = (float) ($input['depositCapRate'] ?? 0);
            $commission = (float) ($input['commissionRate'] ?? $base['commission_rate']);
            $fee = (float) ($input['transactionFeeRate'] ?? 0);
            if ($cap < 0 || $cap > 30 || $commission < 0 || $commission > 100 || $fee < 0 || $fee > 100) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '费率超出允许范围');
            }
            $deposit = $noShow ? min((float) $base['deposit_rate'], $cap) : 0.0;
            $version = (int) Db::table('merchant_pay_at_hotel_terms')->where('merchant_id', (int) $merchant['id'])->max('version') + 1;
            Db::table('merchant_pay_at_hotel_terms')->insert([
                'merchant_id' => (int) $merchant['id'], 'site_id' => (int) $merchant['site_id'],
                'version' => $version, 'enabled' => (int) $enabled, 'no_show_enabled' => (int) $noShow,
                'deposit_cap_rate' => $enabled ? $cap : 0, 'deposit_rate' => $deposit,
                'commission_rate' => $commission, 'transaction_fee_rate' => $fee,
                'effective_at' => gmdate('Y-m-d H:i:s', (int) strtotime($effective)),
                'reason' => $reason, 'actor_type' => 'admin', 'actor_id' => $actorId,
            ]);
            return $this->current($locked);
        });
    }

    public function saveMerchant(array $merchant, bool $noShow, float $rate, int $actorId): array
    {
        return Db::transaction(function () use ($merchant, $noShow, $rate, $actorId) {
            $locked = (array) Db::table('merchant_info')->where('id', (int) $merchant['id'])
                ->where('site_id', (int) $merchant['site_id'])->lockForUpdate()->first();
            $base = $this->current($locked);
            if (! (int) $base['enabled']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商户未开通到店支付');
            }
            $cap = min(30.0, (float) $base['deposit_cap_rate']);
            if ($rate < 0 || $rate > $cap || (! $noShow && $rate > 0)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '商户预收比例超出授权上限');
            }
            $version = (int) Db::table('merchant_pay_at_hotel_terms')->where('merchant_id', (int) $merchant['id'])->max('version') + 1;
            Db::table('merchant_pay_at_hotel_terms')->insert([
                'merchant_id' => (int) $merchant['id'], 'site_id' => (int) $merchant['site_id'],
                'version' => $version, 'enabled' => 1, 'no_show_enabled' => (int) $noShow,
                'deposit_cap_rate' => $cap, 'deposit_rate' => $noShow ? $rate : 0,
                'commission_rate' => $base['commission_rate'],
                'transaction_fee_rate' => $base['transaction_fee_rate'],
                'effective_at' => gmdate('Y-m-d H:i:s'), 'reason' => '商户更新未到店费用',
                'actor_type' => 'merchant', 'actor_id' => $actorId,
            ]);
            return $this->current($locked);
        });
    }
}
