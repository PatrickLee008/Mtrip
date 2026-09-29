import { create } from 'zustand';

import type { ApplicationStatus, RegistrationChannel } from '@/api/types';

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
  channel: RegistrationChannel | null;
  recipient: string;
  pinLength: number;
  registrationToken: string;
  applicationId: number;
  status: ApplicationStatus | null;
  companyName: string;
  /** Step 4 Company Info 选择的业务主体数量,决定 Step 5 渲染几张业务卡片,对应后端 `num_businesses`。 */
  businessCount: number;
  business: RegistrationBusiness;
  beginOtp: (channel: RegistrationChannel, recipient: string, pinLength: number) => void;
  verified: (token: string) => void;
  setApplication: (status: ApplicationStatus) => void;
  clear: () => void;
  setCompanyName: (companyName: string) => void;
  setBusinessCount: (businessCount: number) => void;
  setBusiness: (patch: Partial<RegistrationBusiness>) => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  channel: null, recipient: '', pinLength: 6, registrationToken: '', applicationId: 0, status: null, companyName: '', businessCount: 1, business: { ...EMPTY_BUSINESS },
  beginOtp: (channel, recipient, pinLength) => set({ channel, recipient, pinLength }),
  verified: (registrationToken) => set({ registrationToken }),
  setApplication: (status) => set({ applicationId: status.applicationId, status }),
  clear: () => set({ channel: null, recipient: '', pinLength: 6, registrationToken: '', applicationId: 0, status: null, companyName: '', businessCount: 1, business: { ...EMPTY_BUSINESS } }),
  setCompanyName: (companyName) => set({ companyName }),
  setBusinessCount: (businessCount) => set({ businessCount }),
  setBusiness: (patch) => set((state) => ({ business: { ...state.business, ...patch } })),
}));
