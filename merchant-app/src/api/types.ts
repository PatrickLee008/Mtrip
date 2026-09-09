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
