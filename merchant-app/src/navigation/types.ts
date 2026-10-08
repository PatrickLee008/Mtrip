export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  RegisterContact: undefined;
  Register: undefined;
  RegisterBusinessDetails: undefined;
  RegisterVerification: undefined;
  RegisterOtp: undefined;
  RegistrationReview: undefined;
  KycDocuments: undefined;
  KycReview: undefined;
  MerchantLogin: undefined;
  MerchantAccount: { mode: 'activation' | 'login' | 'recovery' };
  QrLogin: undefined;
  TwoFaSetup: { mode: 'activation' | 'recovery'; token: string } | { mode: 'login' };
  TwoFaVerify: { mode: 'activation' | 'recovery'; token: string } | { mode: 'login' };
  BiometricOptIn: undefined;
  Dashboard: { openMenu?: boolean } | undefined;
  Notifications: undefined;
  Bookings: undefined;
  BookingDetail: { orderId: number; propertyId: number; action?: 'check-in' | 'check-out' };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
