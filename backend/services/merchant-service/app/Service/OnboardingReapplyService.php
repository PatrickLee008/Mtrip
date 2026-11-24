<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** Reopen the existing identity; never release it or create formal entities. */
final class OnboardingReapplyService
{
    public function __construct(private readonly OnboardingRegistrationHistoryService $history) { }

    public function canReapply(array $app): bool
    {
        return (int) $app['state_model_version'] >= 1 && (int) $app['registration_status'] === 5
            && (int) $app['merchant_id'] === 0 && (int) $app['account_status'] === 0 && (int) $app['merchant_kyc_status'] === 0
            && (int) $app['stage'] !== 5 && empty($app['final_approved_at']) && empty($app['final_approval_request_id'])
            && !empty($app['registration_phone']) && !empty($app['registration_email'])
            && strlen((string) $app['registration_phone_index']) === 64 && strlen((string) $app['registration_email_index']) === 64
            && empty($app['registration_phone_released_at']) && empty($app['registration_email_released_at'])
            && !Db::table('merchant_credential_delivery')->where('application_id', $app['id'])->exists();
    }

    /** Caller owns the application lock (App owned() or admin transaction below). */
    public function reopen(array $app, string $reason, bool $admin): void
    {
        if (!$this->canReapply($app)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅身份完整且未转换的基础注册驳回申请可重新开启');
        $this->history->ensureCurrent($app);
        $now = gmdate('Y-m-d H:i:s');
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'registration_status' => 4, 'stage' => 1, 'current_step' => 1,
            'registration_reviewed_by' => 0, 'registration_reviewed_at' => null, 'registration_review_reason' => '',
            'reject_reason_code' => 0, 'reject_note' => '', 'last_activity_at' => $now, 'last_updated_at' => $now,
        ]);
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $app['site_id'], 'merchant_id' => 0, 'application_id' => (int) $app['id'],
            'action' => 'registration_reopened', 'actor_type' => $admin ? 2 : 3,
            'operator_id' => $admin ? AdminContext::adminId() : 0,
            'operator_name' => $admin ? AdminContext::adminName() : 'Merchant App', 'note' => $reason, 'is_exception' => 1,
        ]);
    }

    public function adminReopen(int $id, array $input): void
    {
        if (!AdminContext::isSuper() || !AdminContext::hasPermission('merchant:onboarding:reopen')) throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可重新开启入驻申请');
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($reason === '' || mb_strlen($reason) > 200) throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写200字符以内的重开原因');
        foreach (['expectedRegistrationStatus', 'expectedStage'] as $field) {
            if (!isset($input[$field]) || !is_numeric($input[$field])) throw new BusinessException(ErrorCode::PARAM_ERROR, '请刷新列表后重新确认申请进度');
        }
        Db::transaction(function () use ($id, $input, $reason): void {
            $row = Db::table('merchant_application')->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first();
            if (!$row) throw new BusinessException(ErrorCode::NOT_FOUND, '入驻申请不存在');
            if ((int) $row->registration_status !== (int) $input['expectedRegistrationStatus'] || (int) $row->stage !== (int) $input['expectedStage']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请进度已变化，请刷新后重新确认');
            }
            $this->reopen((array) $row, $reason, true);
        });
    }
}
