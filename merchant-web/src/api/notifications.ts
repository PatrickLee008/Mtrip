import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface MerchantNotification {
  id: number;
  site_id: number;
  merchant_id: number;
  category: string;
  title: string;
  message: string;
  deep_link_type: string;
  deep_link_value: string;
  channels: string;
  send_type: number;
  send_at: string | null;
  status: number;
  read_at: string | null;
  read_by: number;
  operator_name: string;
  created_at: string;
  is_read: boolean;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  categories: Record<string, number>;
}

export function apiNotificationList(params: Record<string, unknown>): Promise<PageData<MerchantNotification>> {
  return get('/merchant/notifications/list', params);
}

export function apiNotificationSummary(): Promise<NotificationSummary> {
  return get('/merchant/notifications/summary');
}

export function apiNotificationRead(id?: number): Promise<null> {
  return post('/merchant/notifications/read', id ? { id } : {});
}
