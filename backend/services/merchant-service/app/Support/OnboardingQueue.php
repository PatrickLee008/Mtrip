<?php
declare(strict_types=1);

namespace App\Support;

use Hyperf\Database\Query\Builder;

/** Registration rejection and legacy lead closure share the rejected queue. */
final class OnboardingQueue
{
    public static function rejected(Builder $query): Builder
    {
        return $query->where('merchant_id', 0)->where(function ($q) {
            $q->where(function ($q) { $q->where('state_model_version', '>=', 1)->where('registration_status', 5); })
                ->orWhere(function ($q) { $q->where('state_model_version', 0)->where('stage', 6); });
        });
    }

    public static function excludeRejected(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where(function ($q) { $q->where('state_model_version', '>=', 1)->where('registration_status', '!=', 5); })
                ->orWhere(function ($q) { $q->where('state_model_version', 0)->where('stage', '!=', 6); });
        });
    }

    public static function isRejected(array $app): bool
    {
        return (int) $app['merchant_id'] === 0 && ((int) $app['state_model_version'] >= 1
            ? (int) $app['registration_status'] === 5 : (int) $app['stage'] === 6);
    }
}
