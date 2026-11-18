import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export type KycScope = 'merchant' | 'property';
export type KycBusiness = 'unified' | 'hotel' | 'restaurant' | 'airline' | 'car_rental' | 'attraction';
export interface KycDocument { docType: string; name: string; required: boolean }
export interface KycTemplate {
  id: number;
  site_id: number;
  scope_type: KycScope;
  business_type: KycBusiness;
  name: string;
  status: 1 | 2;
  sort: number;
  template_group_id: number;
  template_version: number;
  is_current: boolean;
  created_by: number;
  created_by_name: string;
  change_action: 'create' | 'copy' | 'edit' | 'enable' | 'disable' | 'baseline';
  change_reason: string;
  created_at: string;
  documents: KycDocument[];
  can_manage: boolean;
  is_legacy?: boolean;
}
type KycDraft = {
  name: string;
  sort: number;
  documents: KycDocument[];
  reason?: string;
};
const base = '/admin/merchant/kyc-template';
export const apiKycTemplateList = (params: Record<string, unknown>) => get<PageData<KycTemplate>>(`${base}/list`, params);
export const apiKycTemplateHistory = (params: { id: number; page: number; pageSize: number }) => get<PageData<KycTemplate>>(`${base}/history`, params);
export const apiKycTemplateCreate = (data: KycDraft & { siteId: number; scopeType: KycScope; businessType: KycBusiness; status: 1 | 2; copyFromId?: number }) => post<KycTemplate>(`${base}/create`, data);
export const apiKycTemplateUpdate = (data: KycDraft & { id: number; expectedVersion: number }) => post<KycTemplate>(`${base}/update`, data);
export const apiKycTemplateStatus = (data: { id: number; expectedVersion: number; status: 1 | 2; reason?: string }) => post<KycTemplate>(`${base}/status`, data);
