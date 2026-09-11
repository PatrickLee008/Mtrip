import { create } from 'zustand';

import { apiAppAccessCodeVerify, apiAppPairingExchange, apiAppTwoFaSetupInfo, apiAppTwoFaVerify, apiLogin, apiLogout, apiMe, apiTwoFaSetup, apiTwoFaVerify } from '@/api/merchant';
import type { ChallengeResult, MerchantProfile, TwoFaSetupResult } from '@/api/types';
import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';

interface MerchantState {
  token: string;
  profile: MerchantProfile | null;
  isLogin: boolean;
  challenge: ChallengeResult | null;
  setup: TwoFaSetupResult | null;
  hydrate: () => Promise<void>;
  beginLogin: (username: string, password: string) => Promise<ChallengeResult>;
  loadTwoFaSetup: () => Promise<TwoFaSetupResult | null>;
  verifyTwoFa: (twoFaCode: string) => Promise<void>;
  beginAccessCode: (accessCode: string) => Promise<ChallengeResult>;
  beginAppPairing: (pairingCode: string) => Promise<ChallengeResult>;
  loadAppTwoFaSetup: () => Promise<TwoFaSetupResult | null>;
  verifyAppTwoFa: (twoFaCode: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  clearLocal: () => void;
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  token: '', profile: null, isLogin: false, challenge: null, setup: null,
  async hydrate() {
    const [token, profile] = await Promise.all([storage.getString(STORAGE_KEYS.TOKEN), storage.getObject<MerchantProfile>(STORAGE_KEYS.PROFILE)]);
    if (token) set({ token, profile, isLogin: true });
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
    if (!challengeToken) throw new Error('Missing challenge token');
    const result = await apiTwoFaVerify(challengeToken, twoFaCode);
    await storage.setString(STORAGE_KEYS.TOKEN, result.token);
    await storage.setObject(STORAGE_KEYS.PROFILE, result.admin);
    set({ token: result.token, profile: result.admin, isLogin: true, challenge: null, setup: null });
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
  async loadAppTwoFaSetup() {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) return null;
    const setup = await apiAppTwoFaSetupInfo(challengeToken);
    set({ setup });
    return setup;
  },
  async verifyAppTwoFa(twoFaCode) {
    const challengeToken = get().challenge?.challengeToken;
    if (!challengeToken) throw new Error('Missing challenge token');
    const result = await apiAppTwoFaVerify(challengeToken, twoFaCode);
    await storage.setString(STORAGE_KEYS.TOKEN, result.token);
    await storage.setObject(STORAGE_KEYS.PROFILE, result.admin);
    set({ token: result.token, profile: result.admin, isLogin: true, challenge: null, setup: null });
  },
  async refreshProfile() {
    if (!get().isLogin) return;
    const profile = await apiMe();
    await storage.setObject(STORAGE_KEYS.PROFILE, profile);
    set({ profile });
  },
  async logout() {
    try { await apiLogout(); } catch { /* Local logout remains safe after network failure. */ }
    get().clearLocal();
  },
  clearLocal() {
    void storage.remove(STORAGE_KEYS.TOKEN);
    void storage.remove(STORAGE_KEYS.PROFILE);
    set({ token: '', profile: null, isLogin: false, challenge: null, setup: null });
  },
}));
