<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantRegistrationOtpService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/** Public merchant-app registration verification endpoints. */
class RegistrationController extends AbstractController
{
    #[Inject]
    protected MerchantRegistrationOtpService $otp;

    public function config(): array { return Result::success(['channels' => $this->otp->availableChannels($this->requireAppSiteId())]); }
    public function sendOtp(): array { return Result::success($this->otp->send($this->requireAppSiteId(), $this->requireStr('channel'), $this->requireStr('recipient'), $this->clientIp()), '验证码已发送'); }
    public function verifyOtp(): array { return Result::success($this->otp->verify($this->requireAppSiteId(), $this->requireStr('channel'), $this->requireStr('recipient'), $this->requireStr('code')), '验证通过'); }
}
