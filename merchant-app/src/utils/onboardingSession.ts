import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { RegistrationChannel } from '@/api/types';
import { storage } from '@/utils/storage';

const SESSION_KEY = 'mtrip:merchant:onboarding-session';

export interface OnboardingSession {
  siteId: number;
  phone: string;
  email: string;
  channel: RegistrationChannel;
  registrationToken: string;
  applicationId: number;
  tokenExpiresAt: number;
}

export async function readOnboardingSession(): Promise<OnboardingSession | null> {
  try {
    const raw = Platform.OS === 'web'
      ? await storage.getString(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) as OnboardingSession : null;
  } catch {
    return null;
  }
}

export async function writeOnboardingSession(session: OnboardingSession): Promise<void> {
  try {
    const raw = JSON.stringify(session);
    if (Platform.OS === 'web') {
      await storage.setString(SESSION_KEY, raw);
      return;
    }
    await SecureStore.setItemAsync(SESSION_KEY, raw);
  } catch {
    // Persistence failure must not invalidate a successfully verified one-time code.
  }
}

export async function removeOnboardingSession(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await storage.remove(SESSION_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Keep logout/reset usable even when native secure storage is unavailable.
  }
}
