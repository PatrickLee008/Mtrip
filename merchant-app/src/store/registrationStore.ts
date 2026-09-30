import { create } from 'zustand';

import { apiApplicationDetail } from '@/api/merchant';
import { ApiError } from '@/api/request';
import { API_CODE, type ApplicationDetail, type ApplicationStatus, type RegistrationChannel, type RegistrationOtpResult, type RegistrationVerifyResult } from '@/api/types';
import { useCommonStore } from '@/store/commonStore';
import { readOnboardingSession, removeOnboardingSession, writeOnboardingSession } from '@/utils/onboardingSession';
import { genNonce } from '@/utils/sign';

/** 单个业务主体的草稿字段,与后端 `application/save` 的 businesses[] 入参一一对应。 */
export interface RegistrationBusiness {
  applicationBusinessId: number;
  clientRef: string;
  businessName: string;
  businessType: string;
  countryCode: string;
  city: string;
  cityKey: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const emptyBusiness = (): RegistrationBusiness => ({
  applicationBusinessId: 0, clientRef: genNonce(), businessName: '', businessType: '',
  countryCode: 'MM', city: '', cityKey: '', address: '', contactName: '', contactPhone: '', contactEmail: '',
});

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
  regNumber: string;
  country: string;
  address: string;
  /** Step 4 Company Info 选择的业务主体数量,决定 Step 5 渲染几张业务卡片,对应后端 `num_businesses`。 */
  businessCount: number;
  businesses: RegistrationBusiness[];
  removedBusinessIds: number[];
  hydrate: () => Promise<void>;
  setContacts: (phone: string, email: string) => void;
  beginOtp: (result: RegistrationOtpResult) => void;
  verified: (result: RegistrationVerifyResult, siteId: number) => Promise<void>;
  setApplication: (status: ApplicationStatus) => void;
  setApplicationDetail: (detail: ApplicationDetail) => void;
  clear: () => void;
  setCompany: (patch: Partial<Pick<RegistrationState, 'companyName' | 'regNumber' | 'country' | 'address'>>) => void;
  setBusinessCount: (businessCount: number) => void;
  setBusiness: (index: number, patch: Partial<RegistrationBusiness>) => void;
}

const INITIAL_STATE = {
  registrationPhone: '', registrationEmail: '', channel: null, recipient: '', pinLength: 6,
  testMode: false, otpExpiresAt: 0, resendAvailableAt: 0, registrationToken: '', tokenExpiresAt: 0,
  applicationId: 0, status: null, companyName: '', regNumber: '', country: 'Myanmar', address: '',
  businessCount: 1, businesses: [emptyBusiness()], removedBusinessIds: [],
} satisfies Omit<RegistrationState, 'hydrate' | 'setContacts' | 'beginOtp' | 'verified' | 'setApplication' | 'setApplicationDetail' | 'clear' | 'setCompany' | 'setBusinessCount' | 'setBusiness'>;

function detailState(detail: ApplicationDetail) {
  return {
    status: detail,
    companyName: detail.application.companyName,
    regNumber: detail.application.regNumber,
    country: detail.application.country,
    address: detail.application.address,
    businessCount: Math.max(1, detail.businesses.length),
    businesses: detail.businesses.length ? detail.businesses.map((business) => ({ ...business,
      clientRef: business.clientRef || genNonce(),
      countryCode: business.countryCode || 'MM',
      cityKey: business.cityKey || business.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    })) : [emptyBusiness()],
    removedBusinessIds: [],
  };
}

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
      set(detailState(detail));
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
  setApplicationDetail: (detail) => set(detailState(detail)),
  clear: () => {
    void removeOnboardingSession();
    set({ ...INITIAL_STATE, businesses: [emptyBusiness()] });
  },
  setCompany: (patch) => set(patch),
  setBusinessCount: (businessCount) => set((state) => {
    const count = Math.max(1, Math.min(5, businessCount));
    const removed = state.businesses.slice(count).map((business) => business.applicationBusinessId).filter((id) => id > 0);
    return {
      businessCount: count,
      businesses: Array.from({ length: count }, (_, index) => state.businesses[index] ?? emptyBusiness()),
      removedBusinessIds: [...state.removedBusinessIds, ...removed],
    };
  }),
  setBusiness: (index, patch) => set((state) => ({
    businesses: state.businesses.map((business, position) => position === index ? { ...business, ...patch } : business),
  })),
}));
