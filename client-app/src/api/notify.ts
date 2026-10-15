/**
 * 站内通知接口(user-service /api/v1/app/user/notify/*,需登录)
 *
 * 通知由后端在预订事件时写入(shared UserNotify):一条 = 事件键 + 变量。
 * App 按当前语言用 i18n `notifications.events.{event_key}` 渲染,`title/content` 只是英文兜底
 * (旧数据没有 params,或者 App 还没有这个事件的文案时用)。
 */

import { get, post } from '@/api/request';
import type { PageData } from '@/api/types';

/** 1 订单(Booking 页签)/ 3 系统(System 页签) */
export type NotifyBizType = 1 | 3;

export interface NotifyItem {
  id: number;
  event_key: string;
  /** 事件变量(酒店名 / 订单号 / 入离日期 / 金额 / 取消方 / 申诉结果…);旧数据为 null */
  params: Record<string, string | number | boolean> | null;
  title: string;
  content: string;
  biz_type: number;
  /** 订单类为订单 ID,申诉为申诉单 ID */
  biz_id: number;
  is_read: number;
  created_at: string;
}

export function fetchNotifications(params: { bizType: NotifyBizType; page: number; pageSize: number }): Promise<PageData<NotifyItem>> {
  return get<PageData<NotifyItem>>('/api/v1/app/user/notify/list', params);
}

export function fetchNotifyUnread(): Promise<{ unread: number }> {
  return get<{ unread: number }>('/api/v1/app/user/notify/unread-count', undefined, { silent: true });
}

/** 标记已读:传 id 只标这一条 */
export function markNotifyRead(id: number): Promise<null> {
  return post<null>('/api/v1/app/user/notify/read', { id });
}
