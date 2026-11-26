import { get, post } from '@/api/request';

export interface MerchantSession {
  id: number;
  method: string;
  client: string;
  device_name: string;
  logged_in_at: string;
}

const path = '/api/v1/app/merchant/security';
export const apiOwnSessions = () => get<{ sessions: MerchantSession[]; currentSessionId: number }>(path + '/sessions');
export const apiEndSession = (id: number) => post<null>(path + '/sessions/end', { id });
export const apiTrustDevice = (installationKey: string, deviceName: string) =>
  post<{ id: number; installationKey: string }>(path + '/device/trust', { installationKey, deviceName });
export const apiUntrustDevice = () => post<null>(path + '/device/untrust');
