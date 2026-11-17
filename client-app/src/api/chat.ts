import { get, post, postForm } from '@/api/request';
import { API_BASE_URL } from '@/config/env';
import type { PageData } from '@/api/types';

export interface ChatAttachment { id: number; filename: string; mime: string; size: number }
export interface ChatReceipt { actor_role: string; delivered_id: number; read_id: number }
export interface ChatMessage { id: number; sender_type: number; sender_role: string; sender_name: string; content: string; created_at: string; attachments: ChatAttachment[]; action?: string }
/** 平台客服(type 2)可选预订;scene 决定推荐问题(general/payment/upcoming/in_stay/completed/cancelled) */
export interface SupportBooking { id: number; order_no: string; order_type: number; property_id: number; goods_name: string; goods_image: string; sku_name: string; use_date: string | null; end_date: string | null; order_status: number; scene: string; current: boolean }
export interface SupportInfo { booking: SupportBooking | null; scene: string; suggestions: { key: string; question: string }[] }
export interface ChatConversation { id: number; title: string; type: number; status: number; last_message: string; last_time: string; unread: number; order_id: number; receipts?: ChatReceipt[]; rating?: number; rating_comment?: string; handoff_at?: string | null; support?: SupportInfo }
const root = '/api/v1/app/chat';
/** 「消息」列表:酒店咨询与平台客服会话一起列出(客服会话可从这里继续,PRD 模块 13 会话管理) */
export const listChats = (page = 1) => get<PageData<ChatConversation>>(root + '/conversations', { page, pageSize: 30 });
export const chatSummary = () => get<{ unread: number }>(root + '/summary');
export const startChat = (params: { propertyId?: number; orderId?: number; type?: number }) => post<{ conversationId: number }>(root + '/start', { type: 1, ...params });
export const getChat = (conversationId: number) => get<ChatConversation>(root + '/detail', { conversationId });
export const getChatMessages = (conversationId: number, beforeId = 0, afterId = 0) => get<{ list: ChatMessage[]; receipts: ChatReceipt[] }>(root + '/messages', { conversationId, cursor: 1, beforeId, afterId });
export const sendChat = (data: Record<string, unknown>) => post<{ messageId: number }>(root + '/send', data);
export const chatReceipt = (conversationId: number, messageId: number, read: boolean) => post(root + '/receipt', { conversationId, messageId, read: read ? 1 : 0 }, { silent: true });
/** 平台客服:开启 / 复用进行中的会话,带 orderId 即切换到该预订 */
export const startSupportChat = (orderId?: number) => post<{ conversationId: number }>(root + '/start', { type: 2, orderId: orderId || 0 });
export const supportBookings = () => get<SupportBooking[]>(root + '/support/bookings');
export const setSupportBooking = (conversationId: number, orderId: number) => post(root + '/support/context', { conversationId, orderId });
export const supportHandoff = (conversationId: number) => post(root + '/support/handoff', { conversationId });
export const finishChat = (conversationId: number) => post(root + '/finish', { conversationId });
export const rateChat = (conversationId: number, rating: number, comment: string) => post(root + '/rate', { conversationId, rating, comment });
export const uploadChat = (data: FormData) => postForm<ChatAttachment>(root + '/upload', data);
export function chatEndpoint(path: string) { return API_BASE_URL.replace(/\/$/, '') + root + '/' + path; }
export async function chatFile(id: number) {
  const { ticket } = await post<{ ticket: string }>(root + '/file-ticket', { attachmentId: id });
  return chatEndpoint('file') + '?ticket=' + encodeURIComponent(ticket);
}
export function connectChat(onEvent: (event: { kind: string; conversationId?: number }) => void, onState: (online: boolean) => void): () => void {
  let socket: WebSocket | undefined;
  let stopped = false;
  let delay = 1000;
  let retry: ReturnType<typeof setTimeout>;
  let heartbeat: ReturnType<typeof setInterval>;
  const connect = async () => {
    if (stopped) return;
    try {
      const { ticket } = await post<{ ticket: string }>(root + '/ticket', {}, { silent: true });
      if (stopped) return;
      const endpoint = chatEndpoint('socket');
      const absolute = endpoint.startsWith('/') && typeof window !== 'undefined'
        ? new URL(endpoint, window.location.href).href : endpoint;
      socket = new WebSocket(absolute.replace(/^http/, 'ws') + '?ticket=' + encodeURIComponent(ticket));
      socket.onmessage = (e) => {
        if (stopped) return;
        const data = JSON.parse(String(e.data));
        if (data.kind === 'pong') return;
        if (data.kind === 'ready') { delay = 1000; onState(true); }
        onEvent(data);
      };
      socket.onopen = () => { heartbeat = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000); };
      socket.onclose = () => { clearInterval(heartbeat); onState(false); if (!stopped) { retry = setTimeout(connect, delay); delay = Math.min(30000, delay * 2); } };
      socket.onerror = () => socket?.close();
    } catch { if (!stopped) retry = setTimeout(connect, Math.min(30000, delay *= 2)); }
  };
  void connect();
  return () => { stopped = true; clearTimeout(retry); clearInterval(heartbeat); if (socket) { socket.onclose = null; socket.close(); } };
}
