import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';

const BIOMETRIC_KEY = 'mtrip:merchant:biometric-enabled';

export async function readMerchantToken(): Promise<string | null> {
  if (Platform.OS === 'web') return storage.getString(STORAGE_KEYS.TOKEN);
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
  if (token) return token;
  const legacy = await storage.getString(STORAGE_KEYS.TOKEN);
  if (legacy) {
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, legacy);
    await storage.remove(STORAGE_KEYS.TOKEN);
  }
  return legacy;
}

export async function writeMerchantToken(token: string): Promise<void> {
  if (Platform.OS === 'web') await storage.setString(STORAGE_KEYS.TOKEN, token);
  else await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
}

export async function clearMerchantSession(): Promise<void> {
  if (Platform.OS === 'web') await storage.remove(STORAGE_KEYS.TOKEN);
  else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    await storage.remove(STORAGE_KEYS.TOKEN);
  }
  await storage.remove(STORAGE_KEYS.PROFILE);
}

export async function biometricEnabled(): Promise<boolean> {
  return Platform.OS !== 'web' && (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1';
}

export async function enableBiometric(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
}

export async function disableBiometric(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}
