import { get, post, request } from '@/utils/http';

export interface Attachment { id: number; filename: string; mime: string; size: number }
export interface Receipt { actor_role: string; actor_id: number; delivered_id: number; read_id: number }
export interface ChatMessage { id: number; sender_type: number; sender_role: string; sender_name: string; content: string; created_at: string; attachments: Attachment[] }
export interface Note { content: string; version: number; editor_name: string; updated_at: string }
export interface Conversation {
  id: number; property_id: number; order_id: number; status: number; version: number; assignee_id: number;
  title: string; order_no: string; property_name: string; guest_name: string; last_message: string; last_time: string;
  unread: number; awaiting_reply: boolean; booking_status: number; business_type: string;
  booking: { id: number; order_no: string; goods_name: string; sku_name: string; use_date: string; end_date: string; quantity: number; booking_status: number; pay_amount: string; currency: string; payment_status: number } | null;
  note: Note | null; receipts: Receipt[]; handlers: { id: number; name: string }[];
}
export interface ChatPage { list: Conversation[]; total: number; page: number; pageSize: number }
const root = '/merchant/chat';
export const chatList = (params: Record<string, unknown>) => get<ChatPage>(root + '/list', params);
export const chatSummary = () => get<{ unread: number; awaitingReply: number }>(root + '/summary');
export const chatPreferences = () => get<{ inapp_enabled: boolean; sound_enabled: boolean }>(root + '/preferences');
export const chatDetail = (conversationId: number) => get<Conversation>(root + '/detail', { conversationId });
export const chatMessages = (conversationId: number, beforeId = 0, afterId = 0) => get<{ list: ChatMessage[]; receipts: Receipt[] }>(root + '/messages', { conversationId, beforeId, afterId });
export const chatAction = <T = unknown>(action: string, data: Record<string, unknown>) => post<T>(root + '/' + action, data);
export const chatReplies = (conversationId: number, language: string) => get<{ kind: string; content: string }[]>(root + '/quick-replies', { conversationId, language });
export const chatNoteHistory = (conversationId: number, page = 1) => get<{ list: (Note & { created_at: string })[]; total: number }>(root + '/note-history', { conversationId, page, pageSize: 50 });
export function chatUpload(conversationId: number, file: File) {
  const data = new FormData(); data.append('conversationId', String(conversationId)); data.append('file', file);
  return request<Attachment>({ method: 'POST', url: root + '/upload', data });
}
export function chatUrl(path: string): string {
  const base = new URL((import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '') + '/', window.location.origin);
  return new URL('merchant/chat/' + path, base).toString();
}
export async function downloadChatAttachment(id: number) {
  const { ticket } = await chatAction<{ ticket: string }>('file-ticket', { attachmentId: id });
  // A temporary authenticated download capability, never a public storage URL.
  const a = document.createElement('a'); a.href = chatUrl('file') + '?ticket=' + encodeURIComponent(ticket); a.click();
}
export async function previewChatAttachment(id: number) {
  const { ticket } = await chatAction<{ ticket: string }>('file-ticket', { attachmentId: id });
  const response = await fetch(chatUrl('file') + '?ticket=' + encodeURIComponent(ticket));
  if (!response.ok) throw new Error('Attachment unavailable');
  return URL.createObjectURL(await response.blob());
}
