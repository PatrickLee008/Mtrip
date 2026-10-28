import { request, post, requestBlob } from '@/utils/http';

export interface SupportFile { id: number; filename: string; mime: string; size: number }
export interface SupportPage<T> { list: T[]; total: number; page: number; pageSize: number }
export interface SupportTicket {
  id: number; ticket_no: string; merchant_id: number; property_id: number | null; merchant_name: string; property_name: string | null;
  subject: string; description: string; category: string; priority: string; status: string; version: number; creator_name: string;
  assignee_name: string | null; created_at: string; updated_at: string; attachments: SupportFile[]; capabilities: Record<string, boolean>; violation_id: number | null;
}
export interface SupportReply { id: number; actor_type: string; actor_name: string; content: string; created_at: string; attachments: SupportFile[] }
export interface SupportEvent { id: number; action: string; actor_name: string; reason: string; created_at: string; version: number; changes: Record<string, { from: unknown; to: unknown } | string> }
export interface SupportOptions {
  categories: string[]; priorities: string[]; states: string[]; maxAttachments: number; maxFileBytes: number; extensions: string[];
  capabilities: Record<string, boolean>; merchants: { id: number; merchant_name: string }[];
  properties: { id: number; merchant_id: number; store_name: string; business_type: string }[];
}
const root = '/merchant/support/';
export function supportGet<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) { return request<T>({ method: 'GET', url: root + path, params, signal }); }
export function supportAction(action: string, data: Record<string, unknown>) { return post<{ id: number; version: number; status: string }>(root + action, data); }
export function supportUpload(file: File, scope: Record<string, unknown>) {
  const data = new FormData(); data.append('file', file);
  Object.entries(scope).forEach(([k, v]) => { if (v !== null && v !== undefined) data.append(k, String(v)); });
  return request<SupportFile>({ method: 'POST', url: root + 'attachments/upload', data });
}
export async function supportDownload(file: SupportFile) {
  const response = await requestBlob({ method: 'GET', url: root + 'attachments/download', params: { attachmentId: file.id } });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const supportRequestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
