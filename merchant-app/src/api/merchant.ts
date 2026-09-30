import { get, post, postEncrypted, postForm } from '@/api/request';
import type { ActivationIdentity, AgreementDetail, ApplicationDetail, ApplicationStatus, AuthOtpChallenge, ChallengeResult, KycRequirements, KycSubmitResult, LoginResult, MenusResult, MerchantProfile, RegistrationChannel, RegistrationConfig, RegistrationOtpResult, RegistrationVerifyResult, TwoFaSetupResult } from '@/api/types';

export function apiLogin(username: string, password: string): Promise<ChallengeResult> {
  return postEncrypted('/auth/login', { username, password });
}

export function apiTwoFaSetup(challengeToken: string): Promise<TwoFaSetupResult> {
  return post('/auth/2fa/setup', { challengeToken });
}

export function apiTwoFaVerify(challengeToken: string, twoFaCode: string): Promise<LoginResult> {
  return post('/auth/2fa/verify', { challengeToken, twoFaCode });
}

export function apiLogout(): Promise<null> {
  return post<null>('/auth/logout');
}

export function apiMe(): Promise<MerchantProfile> {
  return get<MerchantProfile>('/auth/me');
}

export function apiMenus(): Promise<MenusResult> {
  return get<MenusResult>('/auth/menus');
}

// Merchant onboarding is intentionally outside the authenticated merchant-web prefix.
// 注意:OTP 两个接口的手机号与邮箱**都必传**(后端按两者哈希做联系方式一致性校验),渠道由 `otpChannel` 指定。
export const apiRegistrationChannels = () => get<RegistrationConfig>('/api/v1/app/merchant/register/config');
export const apiRegistrationOtpSend = (phone: string, email: string, otpChannel: RegistrationChannel) => post<RegistrationOtpResult>('/api/v1/app/merchant/register/otp-send', { phone, email, otpChannel });
export const apiRegistrationOtpVerify = (phone: string, email: string, otpChannel: RegistrationChannel, otpCode: string) => post<RegistrationVerifyResult>('/api/v1/app/merchant/register/otp-verify', { phone, email, otpChannel, otpCode });
export const apiApplicationDetail = (registrationToken: string, applicationId: number) => get<ApplicationDetail>('/api/v1/app/merchant/application/detail', { registrationToken, applicationId });
export const apiApplicationStatus = (registrationToken: string, applicationId: number) => get<ApplicationStatus>('/api/v1/app/merchant/application/status', { registrationToken, applicationId });
export const apiKycRequirements = (registrationToken: string, applicationId: number) => get<KycRequirements>('/api/v1/app/merchant/application/kyc-requirements', { registrationToken, applicationId });
export const apiApplicationSave = (registrationToken: string, application: Record<string, unknown>) => post<ApplicationDetail>('/api/v1/app/merchant/application/save', { registrationToken, application });
export const apiApplicationSubmit = (registrationToken: string, applicationId: number) => post<ApplicationStatus>('/api/v1/app/merchant/application/submit', { registrationToken, applicationId });

export interface KycUploadFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: Blob;
}

export function apiKycUpload(registrationToken: string, applicationId: number, scopeType: 'merchant' | 'property', applicationBusinessId: number, docType: string, file: KycUploadFile): Promise<{ id: number; docType: string; fileName: string; fileSize: string }> {
  const body = new FormData();
  body.append('registrationToken', registrationToken);
  body.append('applicationId', String(applicationId));
  body.append('scopeType', scopeType);
  body.append('applicationBusinessId', String(applicationBusinessId));
  body.append('docType', docType);
  if (file.file) body.append('file', file.file, file.name);
  else body.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  return postForm('/api/v1/app/merchant/kyc/upload', body);
}

export const apiKycSubmit = (registrationToken: string, applicationId: number) => post<KycSubmitResult>('/api/v1/app/merchant/kyc/submit', { registrationToken, applicationId });
export const apiAgreement = (registrationToken: string, applicationId: number) => get<AgreementDetail>('/api/v1/app/merchant/agreements/current', { registrationToken, applicationId });
export const apiAgreementRead = (registrationToken: string, applicationId: number, agreementId: number, version: string) => post<{ readReceipt: string }>('/api/v1/app/merchant/agreements/read-confirm', { registrationToken, applicationId, agreementId, version, scrollConfirmed: true });
export const apiAgreementSign = (registrationToken: string, applicationId: number, agreementId: number, version: string, readReceipt: string, signerName: string, signature: string) => post<{ signatureId: number; agreementVersion: string; signedAt: string }>('/api/v1/app/merchant/agreements/sign', { registrationToken, applicationId, agreementId, version, readReceipt, signerName, signerRole: 'owner', signature });

export const apiAppAccessCodeVerify = (accessCode: string) => post<ChallengeResult>('/api/v1/app/merchant/auth/access-code-verify', { accessCode });
export const apiAppTwoFaSetupInfo = (challengeToken: string) => post<TwoFaSetupResult>('/api/v1/app/merchant/auth/2fa/setup-info', { challengeToken });
export const apiAppTwoFaVerify = (challengeToken: string, twoFaCode: string) => post<LoginResult>('/api/v1/app/merchant/auth/2fa/verify', { challengeToken, twoFaCode });
export const apiAppLogout = () => post<null>('/api/v1/app/merchant/auth/logout');

export const apiAppPairingExchange = (pairingCode: string) => post<ChallengeResult>('/api/v1/app/merchant/auth/2fa/pairing-exchange', { pairingCode });
export const apiActivationStart = (accessCode: string, username: string, temporaryPassword: string) => post<ActivationIdentity>('/api/v1/app/merchant/activation/start', { accessCode, username, temporaryPassword });
export const apiActivationOtpSend = (activationToken: string) => post<AuthOtpChallenge>('/api/v1/app/merchant/activation/otp-send', { activationToken, channel: 'email' });
export const apiActivationOtpVerify = (challengeToken: string, otpCode: string) => post<ActivationIdentity>('/api/v1/app/merchant/activation/otp-verify', { challengeToken, otpCode });
export const apiActivationTotpSetup = (activationToken: string) => post<TwoFaSetupResult>('/api/v1/app/merchant/activation/totp/setup', { activationToken });
export const apiActivationTotpVerify = (activationToken: string, twoFaCode: string) => post<unknown>('/api/v1/app/merchant/activation/totp/verify', { activationToken, twoFaCode });
export const apiActivationFinish = (activationToken: string) => post<LoginResult>('/api/v1/app/merchant/activation/finish', { activationToken });
export const apiEmailLoginStart = (identifier: string) => post<AuthOtpChallenge>('/api/v1/app/merchant/auth/challenge', { method: 'email', identifier });
export const apiEmailLoginVerify = (challengeToken: string, otpCode: string) => post<LoginResult>('/api/v1/app/merchant/auth/challenge/verify', { method: 'email', challengeToken, otpCode });
export const apiRecoveryStart = (identifier: string) => post<AuthOtpChallenge>('/api/v1/app/merchant/auth/recovery/challenge', { method: 'email', identifier });
export const apiRecoveryVerify = (challengeToken: string, otpCode: string) => post<{ recoveryToken: string; expiresIn: number }>('/api/v1/app/merchant/auth/recovery/verify', { challengeToken, otpCode });
export const apiRecoveryTotpSetup = (recoveryToken: string) => post<TwoFaSetupResult>('/api/v1/app/merchant/auth/recovery/totp/setup', { recoveryToken });
export const apiRecoveryTotpVerify = (recoveryToken: string, twoFaCode: string) => post<LoginResult>('/api/v1/app/merchant/auth/recovery/totp/verify', { recoveryToken, twoFaCode });
