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

export interface DashboardProperty {
  id: number;
  store_name: string;
  address: string;
  status: number;
  business_type: string;
  is_main: number;
}

export interface DashboardBooking {
  orderId: number;
  orderNo: string;
  guest: string;
  propertyName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  paymentStatus: number;
  bookingStatus: number;
  orderStatus: number;
}

export interface DashboardStats {
  kpi: {
    todayArrivalGuestCount: number;
    todayDepartureGuestCount: number;
    occupancyRate: number | null;
  };
  recentBookings: DashboardBooking[];
}

export interface DashboardEarnings {
  netSettlement: number;
  currency: string;
}

export interface DashboardBookingDetail {
  order: {
    contact_name: string;
    contact_phone: string;
    assigned_room_no: string;
    special_requests: string;
  };
}

export interface NotificationItem {
  id: number;
  category: string;
  title: string;
  message: string;
  deep_link_type: string;
  deep_link_value: string;
  send_at: string | null;
  created_at: string;
  is_read: boolean;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  categories: Record<string, number>;
}

export interface NotificationPage {
  list: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotificationBookingDetail {
  order: {
    order_no: string;
    contact_name: string;
    contact_phone: string;
    use_date: string;
    end_date: string;
    assigned_room_no: string;
    special_requests: string;
  };
}

export interface GuestThread {
  guestName: string;
  status: number;
  messages: Array<{ id: number; sender_type: number; content: string; created_at: string }>;
}

export type BookingAction = 'check-in' | 'check-out' | 'mark-paid' | 'cancel' | 'no-show' | 'note';
export type PaymentFilter = 'paid' | 'unpaid' | 'refunded' | 'hotel' | 'partial' | 'failed';
export interface BookingOrder {
  id: number; order_no: string; property_id: number; user_id: number;
  contact_name: string; contact_phone: string; goods_name: string; sku_name: string;
  use_date: string | null; end_date: string | null; quantity: number;
  booking_status: number; payment_status: number; pay_method: number;
  total_amount: string | number; pay_amount: string | number; currency: string;
  no_show_deadline: string; availableActions?: string[];
}
export interface BookingPage { list: BookingOrder[]; total: number; page: number; pageSize: number; }
export interface BookingDetail {
  order: BookingOrder;
  nights: number;
  payment: {
    totalAmount: string | number; discountAmount: string | number; payAmount: string | number;
    payMethod: number; paymentStatus: number; paymentExpiresAt: string | null;
  };
  stay: {
    useDate: string | null; endDate: string | null; nights: number; quantity: number;
    specialRequests: string; roomNo: string; noShowDeadline: string;
  };
  notes: Array<{ id: number; content: string; author_name: string; created_at: string }>;
  availableActions: string[];
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
  businessName?: string;
  businessType: string;
  kycStatus: KycStatus;
  reviewReason?: string;
  documents?: KycDocument[];
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
  merchantKyc?: { status: KycStatus; reviewReason: string; documents: KycDocument[] };
  agreement?: AgreementState;
  finalApproval?: { ready: boolean; reasons: string[] };
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
export interface KycDocument {
  id: number;
  docType: string;
  name: string;
  required: boolean;
  status: string;
  hasFile: boolean;
  fileName: string;
  fileSize: string;
  documentVersion: number;
  rejectReason: string;
}
export interface AgreementState {
  status: 'unsigned' | 'signed' | 'resign_required' | 'test_confirmed';
  satisfied: boolean;
  agreementId: number;
  version: string;
  title: string;
  signedAt: string | null;
  signerName: string;
}
export interface AgreementDetail extends AgreementState { content: string; contentSha256: string; }
export interface KycPropertyScope {
  applicationBusinessId: number;
  businessName: string;
  businessType: string;
  kycStatus: KycStatus;
  reviewReason: string;
  documents: KycDocument[];
}
export interface KycRequirements {
  applicationId: number;
  merchantKyc: { status: KycStatus; reviewReason: string; documents: KycDocument[] };
  initialProperties: KycPropertyScope[];
  agreement: AgreementState;
  finalApproval: { ready: boolean; reasons: string[] };
}
export interface KycSubmitResult { submittedScopes: string[]; status: KycRequirements; }
export interface AuthOtpChallenge {
  challengeToken: string;
  recipient: string;
  expiresIn: number;
  resendAfter: number;
  testMode: boolean;
}
export interface ActivationIdentity {
  activationToken: string;
  expiresIn: number;
  profile: { username: string; email: string; otpVerified: boolean; methods: { accessCode: boolean } };
}
