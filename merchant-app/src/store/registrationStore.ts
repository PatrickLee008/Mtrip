import { create } from 'zustand';

import { apiApplicationDetail } from '@/api/merchant';
import { ApiError } from '@/api/request';
import { API_CODE, type ApplicationStatus, type RegistrationChannel, type RegistrationOtpResult, type RegistrationVerifyResult } from '@/api/types';
import { useCommonStore } from '@/store/commonStore';
import { readOnboardingSession, removeOnboardingSession, writeOnboardingSession } from '@/utils/onboardingSession';

/** 单个业务主体的草稿字段,与后端 `application/save` 的 businesses[] 入参一一对应。 */
export interface RegistrationBusiness {
  businessType: string;
  city: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const EMPTY_BUSINESS: RegistrationBusiness = { businessType: '', city: '', contactName: '', contactPhone: '', contactEmail: '' };

interface RegistrationState {
  registrationPhone: string;
  registrationEmail: string;
  channel: RegistrationChannel | null;
  recipient: string;
  pinLength: number;
  testMode: boolean;
  otpExpiresAt: number;
  resendAvailableAt: number;
  registrationToken: string;
  tokenExpiresAt: number;
  applicationId: number;
  status: ApplicationStatus | null;
  companyName: string;
  /** Step 4 Company Info 选择的业务主体数量,决定 Step 5 渲染几张业务卡片,对应后端 `num_businesses`。 */
  businessCount: number;
  business: RegistrationBusiness;
  hydrate: () => Promise<void>;
  setContacts: (phone: string, email: string) => void;
  beginOtp: (result: RegistrationOtpResult) => void;
  verified: (result: RegistrationVerifyResult, siteId: number) => Promise<void>;
  setApplication: (status: ApplicationStatus) => void;
  clear: () => void;
  setCompanyName: (companyName: string) => void;
  setBusinessCount: (businessCount: number) => void;
  setBusiness: (patch: Partial<RegistrationBusiness>) => void;
}

const INITIAL_STATE = {
  registrationPhone: '', registrationEmail: '', channel: null, recipient: '', pinLength: 6,
  testMode: false, otpExpiresAt: 0, resendAvailableAt: 0, registrationToken: '', tokenExpiresAt: 0,
  applicationId: 0, status: null, companyName: '', businessCount: 1, business: { ...EMPTY_BUSINESS },
} satisfies Omit<RegistrationState, 'hydrate' | 'setContacts' | 'beginOtp' | 'verified' | 'setApplication' | 'clear' | 'setCompanyName' | 'setBusinessCount' | 'setBusiness'>;

export const useRegistrationStore = create<RegistrationState>((set) => ({
  ...INITIAL_STATE,
  async hydrate() {
    const session = await readOnboardingSession();
    if (!session || session.siteId !== useCommonStore.getState().siteId) {
      if (session) await removeOnboardingSession();
      return;
    }
    const active = session.registrationToken !== '' && session.tokenExpiresAt > Date.now();
    set({
      registrationPhone: session.phone,
      registrationEmail: session.email,
      channel: session.channel,
      registrationToken: active ? session.registrationToken : '',
      tokenExpiresAt: session.tokenExpiresAt,
      applicationId: session.applicationId,
    });
    if (!active) return;
    try {
      const detail = await apiApplicationDetail(session.registrationToken, session.applicationId);
      const first = detail.businesses[0];
      set({
        status: detail,
        companyName: detail.application.companyName,
        businessCount: Math.max(1, detail.businesses.length),
        business: first ? {
          businessType: first.businessType,
          city: first.city,
          contactName: first.contactName,
          contactPhone: first.contactPhone,
          contactEmail: first.contactEmail,
        } : { ...EMPTY_BUSINESS },
      });
    } catch (error) {
      if (!(error instanceof ApiError)
        || (error.code !== API_CODE.UNAUTHORIZED && error.code !== API_CODE.TOKEN_EXPIRED)) return;
      await removeOnboardingSession();
      set({ registrationToken: '', tokenExpiresAt: 0, status: null });
    }
  },
  setContacts: (registrationPhone, registrationEmail) => set({ registrationPhone, registrationEmail }),
  beginOtp: (result) => {
    const now = Date.now();
    set({
      channel: result.channel,
      recipient: result.recipient,
      pinLength: result.pinLength,
      testMode: result.testMode,
      otpExpiresAt: now + result.expiresIn * 1000,
      resendAvailableAt: now + result.resendAfter * 1000,
    });
  },
  async verified(result, siteId) {
    const tokenExpiresAt = Date.now() + result.expiresIn * 1000;
    set({ registrationToken: result.registrationToken, applicationId: result.applicationId, tokenExpiresAt });
    const state = useRegistrationStore.getState();
    await writeOnboardingSession({
      siteId,
      phone: state.registrationPhone,
      email: state.registrationEmail,
      channel: state.channel ?? 'email',
      registrationToken: result.registrationToken,
      applicationId: result.applicationId,
      tokenExpiresAt,
    });
  },
  setApplication: (status) => set({ applicationId: status.applicationId, status }),
  clear: () => {
    void removeOnboardingSession();
    set({ ...INITIAL_STATE, business: { ...EMPTY_BUSINESS } });
  },
  setCompanyName: (companyName) => set({ companyName }),
  setBusinessCount: (businessCount) => set({ businessCount }),
  setBusiness: (patch) => set((state) => ({ business: { ...state.business, ...patch } })),
}));
