import { get, post } from '@/utils/http';

/** 平台特性开关(Super Admin Portal 模块 11,system-service /api/v1/admin/config/features/*) */
type Row = Record<string, any>;

export function apiFeatureList(): Promise<Row[]> {
  return get<Row[]>('/admin/config/features/list');
}
export function apiFeatureSave(id: number, enabled: number): Promise<null> {
  return post('/admin/config/features/save', { id, enabled });
}
