import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';
import type { TableRow } from '@/composables/useTable';

export type MarketKind = 'listing' | 'destination';
export interface MarketScope {
  siteId: number;
  entityType: MarketKind;
  businessType: 'hotel';
  countryCode: string;
  cityKey: string;
  region: string;
}
export interface MarketState {
  version: number;
  published_version: number;
  updated_by?: string;
  updated_at?: string;
  published_by?: string;
  published_at?: string;
}
const base = '/admin/merchant/ranking';
export const readMarket = (scope: MarketScope): Promise<{ list: TableRow[]; market: MarketState }> =>
  get(`${base}/${scope.entityType === 'listing' ? 'list' : 'destinations'}`, { ...scope });
export const readCandidates = (scope: MarketScope): Promise<{ properties: TableRow[]; goods: TableRow[] }> =>
  get(`${base}/candidates`, { ...scope });
export const readPreview = (scope: MarketScope, view: string): Promise<{ list: TableRow[]; version: number }> =>
  get(`${base}/preview`, { ...scope, view });
export const readHistory = (scope: MarketScope, page: number): Promise<PageData<TableRow>> =>
  get(`${base}/history`, { ...scope, page, pageSize: 20 });
export const writeMarket = (action: string, scope: MarketScope, version: number, note: string, data: Record<string, unknown> = {}): Promise<{ version: number }> =>
  post(`${base}/${action}`, { ...scope, expectedVersion: version, note, ...data });
