<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantAuthTestMode;
use App\Service\MerchantRegistrationOtpService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;
use Mtrip\Shared\Merchant\MerchantOnboardingSite;

/** Public merchant-app registration verification endpoints. */
class RegistrationController extends AbstractController
{
    #[Inject]
    protected MerchantRegistrationOtpService $otp;

    public function config(): array { return Result::success(['siteId' => MerchantOnboardingSite::ID, 'channels' => $this->otp->availableChannels(MerchantOnboardingSite::ID), 'testMode' => MerchantAuthTestMode::enabled()]); }
    public function sendOtp(): array { return Result::success(['siteId' => MerchantOnboardingSite::ID] + $this->otp->send(MerchantOnboardingSite::ID, $this->requireStr('phone'), $this->requireStr('email'), $this->requireStr('otpChannel'), $this->clientIp()), '验证码已发送'); }
    public function verifyOtp(): array { return Result::success(['siteId' => MerchantOnboardingSite::ID] + $this->otp->verify(MerchantOnboardingSite::ID, $this->requireStr('phone'), $this->requireStr('email'), $this->requireStr('otpChannel'), $this->requireStr('otpCode')), '验证通过'); }
}
