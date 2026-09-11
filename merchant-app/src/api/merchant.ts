import { get, post, postEncrypted, postForm } from '@/api/request';
import type { ApplicationStatus, ChallengeResult, KycRequirements, LoginResult, MenusResult, MerchantProfile, RegistrationChannelOption, RegistrationOtpResult, RegistrationVerifyResult, TwoFaSetupResult } from '@/api/types';

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
export const apiRegistrationChannels = () => get<{ channels: RegistrationChannelOption[] }>('/api/v1/app/merchant/register/config');
export const apiRegistrationOtpSend = (channel: string, recipient: string) => post<RegistrationOtpResult>('/api/v1/app/merchant/register/otp-send', { channel, recipient });
export const apiRegistrationOtpVerify = (channel: string, recipient: string, code: string) => post<RegistrationVerifyResult>('/api/v1/app/merchant/register/otp-verify', { channel, recipient, code });
export const apiApplicationStatus = (registrationToken: string, applicationId: number) => get<ApplicationStatus>('/api/v1/app/merchant/application/status', { registrationToken, applicationId });
export const apiKycRequirements = (registrationToken: string, applicationId: number) => get<KycRequirements>('/api/v1/app/merchant/application/kyc-requirements', { registrationToken, applicationId });
export const apiApplicationSave = (registrationToken: string, application: Record<string, unknown>) => post<ApplicationStatus>('/api/v1/app/merchant/application/save', { registrationToken, application });
export const apiApplicationSubmit = (registrationToken: string, applicationId: number) => post<ApplicationStatus>('/api/v1/app/merchant/application/submit', { registrationToken, applicationId });

export interface KycUploadFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: Blob;
}

export function apiKycUpload(registrationToken: string, applicationId: number, docType: string, file: KycUploadFile): Promise<{ id: number; docType: string; fileUrl: string; fileName: string; fileSize: string }> {
  const body = new FormData();
  body.append('registrationToken', registrationToken);
  body.append('applicationId', String(applicationId));
  body.append('docType', docType);
  if (file.file) body.append('file', file.file, file.name);
  else body.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  return postForm('/api/v1/app/merchant/kyc/upload', body);
}

export const apiKycSubmit = (registrationToken: string, applicationId: number) => post<ApplicationStatus>('/api/v1/app/merchant/kyc/submit', { registrationToken, applicationId });

export const apiAppAccessCodeVerify = (accessCode: string) => post<ChallengeResult>('/api/v1/app/merchant/auth/access-code-verify', { accessCode });
export const apiAppTwoFaSetupInfo = (challengeToken: string) => post<TwoFaSetupResult>('/api/v1/app/merchant/auth/2fa/setup-info', { challengeToken });
export const apiAppTwoFaVerify = (challengeToken: string, twoFaCode: string) => post<LoginResult>('/api/v1/app/merchant/auth/2fa/verify', { challengeToken, twoFaCode });
export const apiAppLogout = () => post<null>('/api/v1/app/merchant/auth/logout');

export const apiAppPairingExchange = (pairingCode: string) => post<ChallengeResult>('/api/v1/app/merchant/auth/2fa/pairing-exchange', { pairingCode });
