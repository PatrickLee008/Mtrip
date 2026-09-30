import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import RegisterBusinessDetailsScreen from '@/screens/auth/RegisterBusinessDetailsScreen';
import MerchantAccountScreen from '@/screens/auth/MerchantAccountScreen';
import RegisterContactScreen from '@/screens/auth/RegisterContactScreen';
import {
  BiometricOptInScreen,
  KycDocumentsScreen,
  KycReviewScreen,
  MerchantLoginScreen,
  QrLoginScreen,
  RegisterOtpScreen,
  RegistrationReviewScreen,
  RegisterVerificationScreen,
  TwoFaSetupScreen,
  TwoFaVerifyScreen,
} from '@/screens/onboarding/MerchantFlowScreens';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const isLogin = useMerchantStore((s) => s.isLogin);
  const registrationToken = useRegistrationStore((s) => s.registrationToken);
  const registrationPhone = useRegistrationStore((s) => s.registrationPhone);
  const registrationStatus = useRegistrationStore((s) => s.status?.registrationStatus);
  const initialRoute = isLogin
    ? 'Dashboard'
    : registrationStatus && registrationStatus !== 'draft' && registrationStatus !== 'resubmit_required'
      ? 'RegistrationReview'
      : registrationToken
        ? 'Register'
        : registrationPhone
          ? 'RegisterContact'
          : 'Onboarding';
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterContact" component={RegisterContactScreen} />
        <Stack.Screen name="RegisterVerification" component={RegisterVerificationScreen} />
        <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="RegisterBusinessDetails" component={RegisterBusinessDetailsScreen} />
        <Stack.Screen name="RegistrationReview" component={RegistrationReviewScreen} />
        <Stack.Screen name="KycDocuments" component={KycDocumentsScreen} />
        <Stack.Screen name="KycReview" component={KycReviewScreen} />
        <Stack.Screen name="MerchantLogin" component={MerchantLoginScreen} />
        <Stack.Screen name="MerchantAccount" component={MerchantAccountScreen} />
        <Stack.Screen name="QrLogin" component={QrLoginScreen} />
        <Stack.Screen name="TwoFaSetup" component={TwoFaSetupScreen} />
        <Stack.Screen name="TwoFaVerify" component={TwoFaVerifyScreen} />
        <Stack.Screen name="BiometricOptIn" component={BiometricOptInScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
