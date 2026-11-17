import { get, post } from '@/utils/http';

export interface PayAtHotelTerms {
  version: number;
  enabled: number;
  no_show_enabled: number;
  deposit_cap_rate: number;
  deposit_rate: number;
  commission_rate: number;
  transaction_fee_rate: number;
  effective_at: string | null;
}

export function getPayAtHotelTerms(): Promise<PayAtHotelTerms> {
  return get('/merchant/pay-at-hotel/terms');
}

export function savePayAtHotelTerms(noShowEnabled: boolean, depositRate: number): Promise<PayAtHotelTerms> {
  return post('/merchant/pay-at-hotel/terms', { noShowEnabled, depositRate });
}
