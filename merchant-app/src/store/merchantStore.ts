import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import i18n from '@/i18n';

import { apiAppAccessCodeVerify, apiAppLogout, apiAppPairingExchange, apiAppTwoFaSetupInfo, apiAppTwoFaVerify, apiEmailLoginStart, apiEmailLoginVerify, apiLogin, apiMe, apiTwoFaSetup, apiTwoFaVerify } from '@/api/merchant';
import type { AuthOtpChallenge, ChallengeResult, LoginResult, MerchantProfile, TwoFaSetupResult } from '@/api/types';
import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';
import { biometricEnabled, clearMerchantSession, disableBiometric, readMerchantToken, writeMerchantToken } from '@/utils/merchantSession';

interface MerchantState {
  token: string;
  profile: MerchantProfile | null;
  isLogin: boolean;
  propertyId: number;
  setPropertyId: (id: number) => void;
  challenge: ChallengeResult | null;
  setup: TwoFaSetupResult | null;
  hydrate: () => Promise<void>;
  beginLogin: (username: string, password: string) => Promise<ChallengeResult>;
  loadTwoFaSetup: () => Promise<TwoFaSetupResult | null>;
  verifyTwoFa: (twoFaCode: string) => Promise<void>;
  beginAccessCode: (accessCode: string) => Promise<ChallengeResult>;
  beginAppPairing: (pairingCode: string) => Promise<ChallengeResult>;
  beginEmailLogin: (email: string) => Promise<AuthOtpChallenge>;
  verifyEmailLogin: (challengeToken: string, otpCode: string) => Promise<ChallengeResult>;
  loadAppTwoFaSetup: () => Promise<TwoFaSetupResult | null>;
  verifyAppTwoFa: (twoFaCode: string) => Promise<void>;
  acceptSession: (result: LoginResult) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  clearLocal: () => Promise<void>;
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  token: '', profile: null, isLogin: false, propertyId: 0, challenge: null, setup: null,
  setPropertyId: (propertyId) => set({ propertyId }),
  async hydrate() {
    try {
      const [token, profile] = await Promise.all([readMerchantToken(), storage.getObject<MerchantProfile>(STORAGE_KEYS.PROFILE)]);
      if (!token || !profile) return;
      if (await biometricEnabled()) {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: i18n.t('flow.biometric.unlock'), disableDeviceFallback: true });
        if (!result.success) return;
      }
      set({ token, profile, isLogin: true, propertyId: profile.storeId || 0 });
    } catch {
      // A failed secure-store read must never bypass the unlock gate.
    }
  },
  async beginLogin(username, password) {
    const challenge = await apiLogin(username, password);
    set({ challenge, setup: null });
    return challenge;
  },
  async loadTwoFaSetup() {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) return null;
    const setup = await apiTwoFaSetup(challengeToken);
    set({ setup });
    return setup;
  },
  async verifyTwoFa(twoFaCode) {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) throw new Error(i18n.t('flow.twoFa.missingChallenge'));
    const result = await apiTwoFaVerify(challengeToken, twoFaCode);
    await get().acceptSession(result);
  },
  async beginAccessCode(accessCode) {
    const challenge = await apiAppAccessCodeVerify(accessCode);
    set({ challenge, setup: null });
    return challenge;
  },
  async beginAppPairing(pairingCode) {
    const challenge = await apiAppPairingExchange(pairingCode);
    set({ challenge, setup: null });
    return challenge;
  },
  async beginEmailLogin(email) {
    return apiEmailLoginStart(email);
  },
  async verifyEmailLogin(challengeToken, otpCode) {
    const challenge = await apiEmailLoginVerify(challengeToken, otpCode);
    set({ challenge, setup: null });
    return challenge;
  },
  async loadAppTwoFaSetup() {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) return null;
    const setup = await apiAppTwoFaSetupInfo(challengeToken);
    set({ setup });
    return setup;
  },
  async verifyAppTwoFa(twoFaCode) {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) throw new Error(i18n.t('flow.twoFa.missingChallenge'));
    const result = await apiAppTwoFaVerify(challengeToken, twoFaCode);
    await get().acceptSession(result);
  },
  async acceptSession(result) {
    if (get().profile?.id && get().profile?.id !== result.admin.id) await disableBiometric();
    await writeMerchantToken(result.token);
    await storage.setObject(STORAGE_KEYS.PROFILE, result.admin);
    set({ token: result.token, profile: result.admin, isLogin: true, propertyId: result.admin.storeId || 0, challenge: null, setup: null });
  },
  async refreshProfile() {
    if (!get().isLogin) return;
    const profile = await apiMe();
    await storage.setObject(STORAGE_KEYS.PROFILE, profile);
    set({ profile });
  },
  async logout() {
    try { await apiAppLogout(); } catch { /* Local logout remains safe after network failure. */ }
    await get().clearLocal();
  },
  async clearLocal() {
    set({ token: '', profile: null, isLogin: false, propertyId: 0, challenge: null, setup: null });
    await clearMerchantSession();
  },
}));
