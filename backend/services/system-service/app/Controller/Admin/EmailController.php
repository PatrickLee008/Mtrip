<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Model\SysEmailChannel;
use App\Support\SecretField;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/** Configurable SMTP channels and delivery audit records. */
class EmailController extends AbstractController
{
    public function channels(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysEmailChannel())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($status = $this->intInput('status')) > 0) $query->where('status', $status);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(static function (SysEmailChannel $channel): array {
            $row = $channel->toArray();
            $row['username'] = SecretField::mask((string) $channel->username);
            $row['password'] = SecretField::mask((string) $channel->password);
            return $row;
        })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:email:add')]
    public function createChannel(): array
    {
        $channel = new SysEmailChannel();
        $channel->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $this->fillChannel($channel);
        $channel->save();
        return Result::success(['id' => (int) $channel->id], '邮件渠道创建成功');
    }

    #[Permission('config:email:edit')]
    public function updateChannel(): array
    {
        $channel = $this->findChannel($this->requireId());
        $this->fillChannel($channel);
        $channel->save();
        return Result::success(null, '邮件渠道更新成功');
    }

    #[Permission('config:email:delete')]
    public function deleteChannel(): array
    {
        $channel = $this->findChannel($this->requireId());
        $channel->delete();
        return Result::success(null, '邮件渠道已删除');
    }

    #[Permission('config:email:status')]
    public function toggleChannelStatus(): array
    {
        $channel = $this->findChannel($this->requireId());
        $channel->status = $channel->status === 1 ? 2 : 1;
        $channel->save();
        return Result::success(['status' => $channel->status], $channel->status === 1 ? '已启用' : '已禁用');
    }

    public function logs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('sys_email_log');
        if (! AdminContext::isSuper()) $query->where('site_id', AdminContext::siteId());
        elseif (($siteId = $this->intInput('siteId')) > 0) $query->where('site_id', $siteId);
        if (($channelId = $this->intInput('channelId')) > 0) $query->where('channel_id', $channelId);
        $total = (clone $query)->count();
        $key = (string) config('mtrip.aes_key');
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(static function ($row) use ($key): array {
            $row = (array) $row;
            try { $row['recipient'] = MaskHelper::email(CryptoHelper::decrypt((string) $row['recipient'], $key)); }
            catch (\Throwable) { $row['recipient'] = '***'; }
            return $row;
        })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    private function fillChannel(SysEmailChannel $channel): void
    {
        $host = $this->strInput('smtpHost', (string) ($channel->smtp_host ?? ''));
        if ($host === '' || mb_strlen($host) > 255 || preg_match('/[\s\/\\\\]/', $host) === 1) throw new BusinessException(ErrorCode::PARAM_ERROR, 'SMTP 主机格式不正确');
        $fromEmail = strtolower($this->strInput('fromEmail', (string) ($channel->from_email ?? '')));
        if (! filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) throw new BusinessException(ErrorCode::PARAM_ERROR, '发件邮箱格式不正确');
        $encryption = $this->strInput('encryption', (string) ($channel->encryption ?? 'tls'));
        if (! in_array($encryption, ['tls', 'ssl', 'none'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '加密方式仅支持 tls/ssl/none');
        $channel->provider_code = 'smtp';
        $channel->provider_name = mb_substr($this->strInput('providerName', (string) ($channel->provider_name ?? 'SMTP')), 0, 50);
        $channel->smtp_host = $host;
        $channel->smtp_port = min(65535, max(1, $this->intInput('smtpPort', (int) ($channel->smtp_port ?? 587))));
        $channel->encryption = $encryption;
        $channel->username = SecretField::keep($this->strInput('username'), (string) ($channel->username ?? ''));
        $channel->password = SecretField::keep($this->strInput('password'), (string) ($channel->password ?? ''));
        $channel->from_email = $fromEmail;
        $channel->from_name = mb_substr($this->strInput('fromName', (string) ($channel->from_name ?? 'mTrip')), 0, 100);
        $channel->otp_subject = mb_substr($this->strInput('otpSubject', (string) ($channel->otp_subject ?? 'Your mTrip verification code')), 0, 200);
        $channel->otp_content = mb_substr($this->strInput('otpContent', (string) ($channel->otp_content ?? 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.')), 0, 5000);
        $channel->code_expire_sec = min(3600, max(60, $this->intInput('codeExpireSec', (int) ($channel->code_expire_sec ?? 300))));
        $channel->pin_length = min(8, max(4, $this->intInput('pinLength', (int) ($channel->pin_length ?? 6))));
        $channel->max_invalid_attempts = min(10, max(1, $this->intInput('maxInvalidAttempts', (int) ($channel->max_invalid_attempts ?? 5))));
        $channel->remark = mb_substr($this->strInput('remark', (string) ($channel->remark ?? '')), 0, 255);
        if ((string) $channel->username === '' || (string) $channel->password === '') throw new BusinessException(ErrorCode::PARAM_ERROR, 'SMTP 用户名和密码不能为空');
    }

    private function findChannel(int $id): SysEmailChannel
    {
        $channel = SysEmailChannel::query()->find($id);
        if ($channel === null) throw new BusinessException(ErrorCode::NOT_FOUND, '邮件渠道不存在');
        if (! AdminContext::isSuper() && (int) $channel->site_id !== AdminContext::siteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return $channel;
    }
}
