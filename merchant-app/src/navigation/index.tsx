import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import RegisterBusinessDetailsScreen from '@/screens/auth/RegisterBusinessDetailsScreen';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const isLogin = useMerchantStore((s) => s.isLogin);
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isLogin ? 'Dashboard' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="RegisterBusinessDetails" component={RegisterBusinessDetailsScreen} />
        <Stack.Screen name="RegisterVerification" component={RegisterVerificationScreen} />
        <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
        <Stack.Screen name="RegistrationReview" component={RegistrationReviewScreen} />
        <Stack.Screen name="KycDocuments" component={KycDocumentsScreen} />
        <Stack.Screen name="KycReview" component={KycReviewScreen} />
        <Stack.Screen name="MerchantLogin" component={MerchantLoginScreen} />
        <Stack.Screen name="QrLogin" component={QrLoginScreen} />
        <Stack.Screen name="TwoFaSetup" component={TwoFaSetupScreen} />
        <Stack.Screen name="TwoFaVerify" component={TwoFaVerifyScreen} />
        <Stack.Screen name="BiometricOptIn" component={BiometricOptInScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
