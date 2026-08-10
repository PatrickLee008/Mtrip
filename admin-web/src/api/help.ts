import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 帮助中心(Super Admin Portal 模块 12,system-service /api/v1/admin/help/*) */
type Row = Record<string, any>;

// 文章
export function apiHelpArticles(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/help/article/list', params);
}
export function apiHelpArticleSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/help/article/save', data);
}
export function apiHelpArticleDelete(id: number): Promise<null> {
  return post('/admin/help/article/delete', { id });
}

// 分类(不分页)
export function apiHelpCategories(): Promise<Row[]> {
  return get<Row[]>('/admin/help/category/list');
}
export function apiHelpCategorySave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/help/category/save', data);
}
export function apiHelpCategoryDelete(id: number): Promise<null> {
  return post('/admin/help/category/delete', { id });
}

// 公告
export function apiHelpAnnouncements(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/help/announcement/list', params);
}
export function apiHelpAnnouncementSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/help/announcement/save', data);
}
export function apiHelpAnnouncementDelete(id: number): Promise<null> {
  return post('/admin/help/announcement/delete', { id });
}

// 搜索分析
export function apiHelpAnalytics(): Promise<{ topKeywords: Row[]; noResultKeywords: Row[] }> {
  return get('/admin/help/analytics');
}
