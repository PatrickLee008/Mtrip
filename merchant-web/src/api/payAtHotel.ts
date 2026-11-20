import { get, post } from '@/utils/http';

export interface PayAtHotelTerms {
  version: number;
  policy_version: number;
  policy_source: string;
  selection_version: number;
  no_show_allowed: number;
  properties?: { id: number; store_name: string; commission_rate: number; commission_scope: string }[];
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

export function savePayAtHotelTerms(noShowEnabled: boolean, depositRate: number, terms: PayAtHotelTerms): Promise<PayAtHotelTerms> {
  return post('/merchant/pay-at-hotel/terms', { noShowEnabled, depositRate,
    policyVersion: terms.policy_version, policySource: terms.policy_source, selectionVersion: terms.selection_version });
}
