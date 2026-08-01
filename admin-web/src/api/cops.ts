import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 移动运营(Consumer App PRD v1.0)后台接口 */
type Row = Record<string, any>;

// ---------- 风控申诉(user-service) ----------
export function apiAppealList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/appeal/list', params);
}
/** action 1通过解冻 / 2驳回维持 / 3升级封禁 */
export function apiAppealHandle(data: Record<string, unknown>): Promise<null> {
  return post('/admin/user/appeal/handle', data);
}
export function apiFraudList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/user/fraud/list', params);
}

// ---------- 客服工作台(user-service) ----------
export function apiChatList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/chat/list', params);
}
export function apiChatMessages(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/chat/messages', params);
}
export function apiChatReply(data: Record<string, unknown>): Promise<null> {
  return post('/admin/chat/reply', data);
}
export function apiChatClose(data: Record<string, unknown>): Promise<null> {
  return post('/admin/chat/close', data);
}

// ---------- 评价审核(goods-service) ----------
export function apiReviewList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/review/list', params);
}
export function apiReviewAudit(data: Record<string, unknown>): Promise<null> {
  return post('/admin/goods/review/audit', data);
}
export function apiReviewReply(data: Record<string, unknown>): Promise<null> {
  return post('/admin/goods/review/reply', data);
}

// ---------- 长住梯度(marketing-service) ----------
export function apiLongstayList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/longstay/list', params);
}
export function apiLongstaySave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/marketing/longstay/save', data);
}
export function apiLongstayDelete(data: Record<string, unknown>): Promise<null> {
  return post('/admin/marketing/longstay/delete', data);
}

// ---------- 动态主题(system-service) ----------
export function apiThemeList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/config/theme/list', params);
}
export function apiThemeSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/config/theme/save', data);
}
export function apiThemeDelete(data: Record<string, unknown>): Promise<null> {
  return post('/admin/config/theme/delete', data);
}

// ---------- Trip 管理(order-service) ----------
export function apiTripList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/order/trip/list', params);
}
export function apiTripDetail(id: number): Promise<Row> {
  return get<Row>('/admin/order/trip/detail', { id });
}

// ---------- 结算分账报表(finance-service) ----------
export function apiEntryList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/finance/entry/list', params);
}
export function apiEntrySummary(params: Record<string, unknown>): Promise<Row> {
  return get<Row>('/admin/finance/entry/summary', params);
}

// ---------- 筛选/排序项配置(goods-service,PRD 模块3) ----------
export function apiFilterList(params: Record<string, unknown>): Promise<Row[]> {
  return get<Row[]>('/admin/goods/filter/list', params);
}
export function apiFilterSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/filter/save', data);
}
export function apiFilterDelete(data: Record<string, unknown>): Promise<null> {
  return post('/admin/goods/filter/delete', data);
}
export function apiSortList(params: Record<string, unknown>): Promise<Row[]> {
  return get<Row[]>('/admin/goods/sort/list', params);
}
export function apiSortSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/sort/save', data);
}
export function apiSortDelete(data: Record<string, unknown>): Promise<null> {
  return post('/admin/goods/sort/delete', data);
}

// ---------- 促销中心活动(marketing-service,PRD 模块6.1) ----------
export function apiCampaignList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/campaign/list', params);
}
export function apiCampaignSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/marketing/campaign/save', data);
}
export function apiCampaignToggle(data: Record<string, unknown>): Promise<null> {
  return post('/admin/marketing/campaign/toggle-status', data);
}
export function apiCampaignDelete(data: Record<string, unknown>): Promise<null> {
  return post('/admin/marketing/campaign/delete', data);
}
