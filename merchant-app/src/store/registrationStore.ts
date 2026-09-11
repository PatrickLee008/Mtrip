import { create } from 'zustand';

import type { ApplicationStatus, RegistrationChannel } from '@/api/types';

interface RegistrationState {
  channel: RegistrationChannel | null;
  recipient: string;
  pinLength: number;
  registrationToken: string;
  applicationId: number;
  status: ApplicationStatus | null;
  companyName: string;
  business: { city: string; contactName: string; contactPhone: string; contactEmail: string };
  beginOtp: (channel: RegistrationChannel, recipient: string, pinLength: number) => void;
  verified: (token: string) => void;
  setApplication: (status: ApplicationStatus) => void;
  clear: () => void;
  setCompanyName: (companyName: string) => void;
  setBusiness: (patch: Partial<RegistrationState['business']>) => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  channel: null, recipient: '', pinLength: 6, registrationToken: '', applicationId: 0, status: null, companyName: '', business: { city: '', contactName: '', contactPhone: '', contactEmail: '' },
  beginOtp: (channel, recipient, pinLength) => set({ channel, recipient, pinLength }),
  verified: (registrationToken) => set({ registrationToken }),
  setApplication: (status) => set({ applicationId: status.applicationId, status }),
  clear: () => set({ channel: null, recipient: '', pinLength: 6, registrationToken: '', applicationId: 0, status: null, companyName: '', business: { city: '', contactName: '', contactPhone: '', contactEmail: '' } }),
  setCompanyName: (companyName) => set({ companyName }),
  setBusiness: (patch) => set((state) => ({ business: { ...state.business, ...patch } })),
}));
