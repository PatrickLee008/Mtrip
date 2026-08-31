/**
 * 通知页的设计稿静态数据(Figma M-Trip / Section 9 `1770:3863`)
 *
 * 后端没有 App 侧的消息接口(merchant-service 有商户通知路由,user/order 服务都没有),
 * 这里照搬设计稿的四条通知,文案走 i18n。接口就绪后把 NOTIFICATIONS 换成列表返回值即可,
 * 组件不用动 —— 届时 title/body 从接口取,tone 由消息类型映射。
 */

export const NOTIFICATION_TABS = ['system', 'booking'] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

export interface DemoNotification {
  /** 同时是 i18n 键:notifications.items.<key>.{title,body} */
  key: string;
  tab: NotificationTab;
  /** 标题配色:normal 走主色,danger 走 --tertiary(设计稿「Booking Cancelled」) */
  tone: 'normal' | 'danger';
}

export const NOTIFICATIONS: DemoNotification[] = [
  { key: 'version12', tab: 'system', tone: 'normal' },
  { key: 'version11', tab: 'system', tone: 'normal' },
  { key: 'bookingConfirmed', tab: 'booking', tone: 'normal' },
  { key: 'bookingCancelled', tab: 'booking', tone: 'danger' },
];
