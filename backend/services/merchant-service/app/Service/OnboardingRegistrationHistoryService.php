<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use function Hyperf\Config\config;

/** Call writers only while holding the application row lock. Submission snapshots are immutable. */
final class OnboardingRegistrationHistoryService
{
    public function submitted(array $app): void
    {
        $this->insert($app, 1, '', null, 0, '');
    }

    /** Preserve only known legacy values; unavailable older rounds cannot be reconstructed. */
    public function ensureCurrent(array $app): int
    {
        $id = Db::table('merchant_application_registration_review')->where('application_id', $app['id'])->orderByDesc('round_no')->value('id');
        if ($id) return (int) $id;
        $decided = in_array((int) $app['registration_status'], [3, 4, 5], true);
        $reviewer = '';
        if ($decided && (int) $app['registration_reviewed_by'] > 0) {
            $reviewer = (string) (Db::table('merchant_verify_timeline')->where('application_id', $app['id'])
                ->where('operator_id', $app['registration_reviewed_by'])
                ->whereIn('action', ['rejected', 'registration_approved', 'registration_resubmit_required'])
                ->orderByDesc('id')->value('operator_name') ?? '');
        }
        return $this->insert($app, (int) $app['registration_status'], $decided ? (string) $app['registration_review_reason'] : '',
            $decided ? $app['registration_reviewed_at'] : null, $decided ? (int) $app['registration_reviewed_by'] : 0, $reviewer);
    }

    public function reviewed(array $app, int $status, string $reason, string $now): void
    {
        $id = $this->ensureCurrent($app);
        Db::table('merchant_application_registration_review')->where('id', $id)->update([
            'registration_status' => $status, 'review_reason' => $reason,
            'reviewed_at' => $status === 2 ? null : $now,
            'reviewer_id' => $status === 2 ? 0 : AdminContext::adminId(),
            'reviewer_name' => $status === 2 ? '' : AdminContext::adminName(),
        ]);
    }

    public function history(int $applicationId, bool $revealPhone): array
    {
        return Db::table('merchant_application_registration_review')->where('application_id', $applicationId)->orderByDesc('round_no')->get()->map(static function ($row) use ($revealPhone): array {
            $snapshot = json_decode((string) $row->snapshot, true, 512, JSON_THROW_ON_ERROR);
            foreach ($snapshot['businesses'] as &$business) {
                $phone = '';
                try { $phone = $business['contact_phone'] === '' ? '' : CryptoHelper::decrypt($business['contact_phone'], (string) config('mtrip.aes_key')); } catch (\Throwable) { }
                $business['contact_phone'] = $revealPhone ? $phone : MaskHelper::mobile($phone);
            }
            unset($business);
            return ['id' => (int) $row->id, 'round_no' => (int) $row->round_no, 'registration_status' => (int) $row->registration_status,
                'submitted_at' => $row->submitted_at, 'reviewed_at' => $row->reviewed_at,
                'reviewer_name' => (string) $row->reviewer_name, 'review_reason' => (string) $row->review_reason, 'snapshot' => $snapshot];
        })->all();
    }

    private function insert(array $app, int $status, string $reason, ?string $reviewedAt, int $reviewerId, string $reviewerName): int
    {
        $application = array_intersect_key($app, array_flip(['company_name', 'company_group_name', 'merchant_name', 'reg_number', 'country', 'city', 'address', 'num_businesses', 'business_types']));
        $businesses = Db::table('merchant_application_business')->where('application_id', $app['id'])->orderBy('id')
            ->get(['business_name', 'business_type', 'country_code', 'city', 'city_key', 'address', 'contact_name', 'contact_phone', 'contact_email'])
            ->map(static fn ($row) => (array) $row)->all();
        return (int) Db::table('merchant_application_registration_review')->insertGetId([
            'application_id' => (int) $app['id'], 'site_id' => (int) $app['site_id'],
            'round_no' => (int) Db::table('merchant_application_registration_review')->where('application_id', $app['id'])->max('round_no') + 1,
            'registration_status' => $status, 'submitted_at' => $app['submitted_at'], 'reviewed_at' => $reviewedAt,
            'reviewer_id' => $reviewerId, 'reviewer_name' => $reviewerName, 'review_reason' => $reason,
            'snapshot' => json_encode(['application' => $application, 'businesses' => $businesses], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ]);
    }
}
