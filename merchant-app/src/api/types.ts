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
export interface RegistrationOtpResult { expiresIn: number; resendAfter: number; pinLength: number; recipient: string; channel: RegistrationChannel; }
export interface RegistrationVerifyResult { registrationToken: string; expiresIn: number; }
export interface ApplicationStatus { applicationId: number; appNo: string; stage: number; status: string; canUploadKyc: boolean; canSubmitKyc: boolean; rejectReasonCode: number; rejectNote: string; }
export interface KycDocument { id: number; docType: string; name: string; required: boolean; fileUrl: string; fileSize: string; }
export interface KycRequirements { applicationId: number; stage: number; documents: KycDocument[]; }
