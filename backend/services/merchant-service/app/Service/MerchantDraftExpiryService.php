<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

final class MerchantDraftExpiryService
{
    public function expireDue(): void
    {
        foreach ($this->due()->limit(100)->get() as $app) $this->expire((array) $app);
    }

    public function expireContacts(string $emailHash, string $phoneHash): void
    {
        foreach ($this->due()->where(function ($query) use ($emailHash, $phoneHash): void {
            $query->where('registration_email_index', $emailHash)->orWhere('registration_phone_index', $phoneHash);
        })->get() as $app) $this->expire((array) $app);
    }

    private function due(): mixed
    {
        return Db::table('merchant_application')->where('state_model_version', 1)->where('merchant_id', 0)
            ->where('registration_status', 0)->whereNull('submitted_at')->whereNull('deleted_at')
            ->where('created_at', '<=', gmdate('Y-m-d H:i:s', time() - 7 * 86400));
    }

    private function expire(array $app): void
    {
        MerchantPhoneIdentityService::transaction((string) $app['registration_email_index'], (string) $app['registration_phone_index'], function () use ($app): void {
            $current = $this->due()->where('id', $app['id'])->lockForUpdate()->first();
            if (! $current) return;
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'deleted_at' => $now, 'registration_email_released_at' => $now,
                'registration_phone_released_at' => $now, 'last_updated_at' => $now,
            ]);
            Db::table('merchant_verify_timeline')->insert([
                'site_id' => $app['site_id'], 'merchant_id' => 0, 'application_id' => $app['id'],
                'action' => 'registration_draft_expired', 'actor_type' => 0, 'operator_name' => 'System',
                'note' => 'Unsubmitted draft expired seven days after creation; both identities released',
            ]);
        });
    }
}
