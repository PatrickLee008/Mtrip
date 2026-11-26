import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiTrustDevice, apiUntrustDevice } from '@/api/sessions';
import { STORAGE_KEYS } from '@/config/global';
import { getOsVersion } from '@/utils/device';
import { storage } from '@/utils/storage';

const BIOMETRIC_KEY = 'merchant_session_biometric';
const INSTALLATION_KEY = 'merchant_session_installation';
const NATIVE_TOKEN = 'merchant_session_token';
const PROTECTED_TOKEN = 'merchant_biometric_token';
const deviceOnly = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const protectedOptions = { ...deviceOnly, requireAuthentication: true };

export async function readMerchantToken(prompt: string): Promise<string | null> {
  if (Platform.OS === 'web') return storage.getString(STORAGE_KEYS.TOKEN);
  if (await biometricEnabled()) return SecureStore.getItemAsync(PROTECTED_TOKEN, { ...protectedOptions, authenticationPrompt: prompt });
  const token = await SecureStore.getItemAsync(NATIVE_TOKEN);
  if (token) return token;
  const legacy = await storage.getString(STORAGE_KEYS.TOKEN);
  if (legacy) {
    await SecureStore.setItemAsync(NATIVE_TOKEN, legacy, deviceOnly);
    await storage.remove(STORAGE_KEYS.TOKEN);
  }
  return legacy;
}

export async function writeMerchantToken(token: string): Promise<void> {
  if (Platform.OS === 'web') await storage.setString(STORAGE_KEYS.TOKEN, token);
  else {
    await SecureStore.setItemAsync(NATIVE_TOKEN, token, deviceOnly);
    await storage.remove(BIOMETRIC_KEY);
    await SecureStore.deleteItemAsync(PROTECTED_TOKEN, protectedOptions);
  }
}

export async function clearMerchantSession(): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(NATIVE_TOKEN);
    await SecureStore.deleteItemAsync(PROTECTED_TOKEN, protectedOptions);
    await storage.remove(BIOMETRIC_KEY);
  }
  await storage.remove(STORAGE_KEYS.TOKEN);
  await storage.remove(STORAGE_KEYS.PROFILE);
}

export async function biometricEnabled(): Promise<boolean> {
  return Platform.OS !== 'web' && (await storage.getString(BIOMETRIC_KEY)) === '1';
}

export async function enableBiometric(token: string, prompt: string): Promise<void> {
  if (Platform.OS === 'web' || !SecureStore.canUseBiometricAuthentication()) return;
  const installation = await storage.getString(INSTALLATION_KEY) ?? '';
  await SecureStore.setItemAsync(PROTECTED_TOKEN, token, { ...protectedOptions, authenticationPrompt: prompt });
  try {
    const result = await apiTrustDevice(installation, getOsVersion());
    await storage.setString(INSTALLATION_KEY, result.installationKey);
    await storage.setString(BIOMETRIC_KEY, '1');
    await SecureStore.deleteItemAsync(NATIVE_TOKEN);
    await storage.remove(STORAGE_KEYS.TOKEN);
  } catch (error) {
    await SecureStore.deleteItemAsync(PROTECTED_TOKEN, protectedOptions);
    throw error;
  }
}

export async function disableBiometric(token: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await apiUntrustDevice();
  await writeMerchantToken(token);
}
