export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export const API_CODE = {
  SUCCESS: 0,
  UNAUTHORIZED: 40101,
  TOKEN_EXPIRED: 40102,
} as const;

export interface MerchantProfile {
  id: number;
  username: string;
  realName: string;
  accountType: 1 | 2 | 3;
  groupId: number;
  merchantId: number;
  storeId: number;
  isOwner: boolean;
  subjectName: string;
  permissions: string[];
  lastLoginAt?: string;
  bookingRestricted?: boolean;
}

export interface ChallengeResult {
  challengeToken: string;
  requiresEnrollment: boolean;
  expiresIn: number;
}

export interface TwoFaSetupResult {
  manualKey: string;
  otpauthUri: string;
}

export interface LoginResult {
  token: string;
  admin: MerchantProfile;
}

export interface MenuNode {
  id: number;
  parent_id?: number;
  title?: string;
  name?: string;
  component?: string;
  path?: string;
  perm_key?: string;
  children?: MenuNode[];
}

export interface MerchantBusiness {
  id: number;
  merchant_id: number;
  merchant_name: string;
  business_name: string;
  business_type: string;
  city: string;
}

export interface MenusResult {
  menus: MenuNode[];
  perms: string[];
  businesses: MerchantBusiness[];
}

export type RegistrationChannel = 'email' | 'sms';
export interface RegistrationChannelOption { channel: RegistrationChannel; label: string; }
export interface RegistrationConfig { channels: RegistrationChannelOption[]; testMode: boolean; }
/** 后端 `register/otp-send` 返回:手机号与邮箱都必传,recipient 为后端脱敏后的实际收件方。 */
export interface RegistrationOtpResult { expiresIn: number; resendAfter: number; pinLength: number; recipient: string; channel: RegistrationChannel; testMode: boolean; }
export interface RegistrationVerifyResult { registrationToken: string; applicationId: number; expiresIn: number; }
export type RegistrationStatus = 'draft' | 'submitted' | 'under_review' | 'resubmit_required' | 'approved' | 'rejected' | 'unknown';
export type KycStatus = 'locked' | 'draft' | 'submitted' | 'under_review' | 'resubmit_required' | 'approved' | 'rejected' | 'unknown';
export type AccountStatus = 'not_created' | 'pending_activation' | 'active' | 'suspended' | 'disabled' | 'unknown';
export interface InitialPropertyStatus {
  applicationBusinessId: number;
  businessType: string;
  kycStatus: KycStatus;
}
export interface ApplicationStatus {
  applicationId: number;
  appNo: string;
  stage: number;
  testMode: boolean;
  registrationStatus: RegistrationStatus;
  merchantKycStatus: KycStatus;
  accountStatus: AccountStatus;
  currentStep: number;
  completionPercent: number;
  canEdit: boolean;
  canSubmit: boolean;
  reviewReason: string;
  initialProperties: InitialPropertyStatus[];
}
export interface ApplicationDetail extends ApplicationStatus {
  application: {
    merchantName: string;
    companyName: string;
    companyGroupName: string;
    regNumber: string;
    country: string;
    city: string;
    address: string;
    registrationPhone: string;
    registrationEmail: string;
  };
  businesses: Array<{
    applicationBusinessId: number;
    clientRef: string;
    businessName: string;
    businessType: string;
    countryCode: string;
    city: string;
    cityKey: string;
    address: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  }>;
}
export interface KycDocument { id: number; docType: string; name: string; required: boolean; fileUrl: string; fileSize: string; }
export interface KycRequirements { applicationId: number; stage: number; documents: KycDocument[]; }
