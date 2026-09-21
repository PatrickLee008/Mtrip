import { get, request } from '@/utils/http';
import type { PageData } from '@/api/types';

const propertyHeaders = (propertyId: number) => ({ 'X-Mtrip-Property-Id': String(propertyId) });

export interface PropertyRow {
  id: number;
  merchant_id: number;
  merchant_name: string;
  store_name: string;
  business_type: string;
  address: string;
  images: string[];
  status: number;
  kyc_status: number;
  kyc_version: number;
  content_status: number;
  content_approved_version: number;
  publish_status: number;
  operating_status: number;
  display_enabled: number;
  live_room_count: number;
  latest_content_review_status?: number | null;
  latest_content_reject_reason?: string | null;
  source_business_id?: number | null;
}

export interface PropertyKycDocument {
  id: number;
  docType: string;
  name: string;
  required: boolean;
  uploaded: boolean;
  fileName: string;
  fileSize: string;
  status: number;
  rejectReason: string;
}

export interface PropertyKyc {
  propertyId: number;
  propertyName: string;
  merchantId: number;
  businessType: string;
  location: string;
  kycStatus: number;
  kycVersion: number;
  rejectReason: string;
  documents: PropertyKycDocument[];
}

export interface PropertyProfileResult {
  property: PropertyRow & Record<string, unknown>;
  editable: Record<string, unknown>;
  latestRevision: (Record<string, unknown> & { status: number; reject_reason: string }) | null;
  metrics: {
    roomTypes: string[];
    totalRooms: number;
    guestRating: number;
    guestReviewCount: number;
  };
}

export interface PropertyImage {
  url: string;
  enabled: boolean;
}

export type AmenityCategory = 'essential' | 'reception' | 'dining' | 'tags';

export interface PropertyAmenity {
  id: string;
  category: AmenityCategory;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  highlighted: boolean;
}

export function apiPropertyList(params: Record<string, unknown> = {}): Promise<PageData<PropertyRow>> {
  return get('/merchant/properties/list', params);
}

export function apiPropertySave(data: Record<string, unknown>): Promise<{ propertyId: number; kycStatus: number }> {
  const propertyId = Number(data.propertyId || 0);
  return request({
    method: 'POST',
    url: '/merchant/properties/save',
    data,
    ...(propertyId > 0 ? { headers: propertyHeaders(propertyId) } : {}),
  });
}

export function apiPropertyKyc(propertyId: number): Promise<PropertyKyc> {
  return request({ method: 'GET', url: '/merchant/properties/kyc', params: { propertyId }, headers: propertyHeaders(propertyId) });
}

export function apiPropertyKycUpload(propertyId: number, docType: string, file: File): Promise<{ documentId: number; docType: string; fileName: string; fileSize: string }> {
  const data = new FormData();
  data.append('propertyId', String(propertyId));
  data.append('docType', docType);
  data.append('file', file);
  return request({ method: 'POST', url: '/merchant/properties/kyc/upload', data, headers: propertyHeaders(propertyId) });
}

export function apiPropertyKycSubmit(propertyId: number): Promise<{ propertyId: number; kycStatus: number; kycVersion: number }> {
  return request({ method: 'POST', url: '/merchant/properties/kyc/submit', data: { propertyId }, headers: propertyHeaders(propertyId) });
}

export function apiPropertyProfile(propertyId: number): Promise<PropertyProfileResult> {
  return request({ method: 'GET', url: '/merchant/properties/profile', params: { propertyId }, headers: propertyHeaders(propertyId) });
}

export function apiPropertyProfileSave(data: Record<string, unknown>): Promise<{ propertyId: number; revisionId: number; version: number; reviewStatus: number }> {
  const propertyId = Number(data.propertyId || 0);
  return request({ method: 'POST', url: '/merchant/properties/profile/save', data, headers: propertyHeaders(propertyId) });
}

export function apiPropertyProfileImageUpload(propertyId: number, file: File): Promise<{ url: string; name: string }> {
  const data = new FormData();
  data.append('propertyId', String(propertyId));
  data.append('file', file);
  return request({ method: 'POST', url: '/merchant/properties/profile/media/upload', data, headers: propertyHeaders(propertyId) });
}

export function apiPropertyPublish(propertyId: number, enabled: boolean): Promise<{ propertyId: number; publishStatus: number }> {
  return request({
    method: 'POST',
    url: '/merchant/properties/publish',
    data: { propertyId, enabled: enabled ? 1 : 0 },
    headers: propertyHeaders(propertyId),
  });
}
