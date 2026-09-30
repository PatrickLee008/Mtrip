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
  TwoFaSetup: undefined;
  TwoFaVerify: undefined;
  BiometricOptIn: undefined;
  Dashboard: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
