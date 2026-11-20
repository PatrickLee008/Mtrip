import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export type DeletionRow = Record<string, any>;
const base = '/admin/user/deletion';
export const deletionList = (params: Record<string, unknown>) => get<PageData<DeletionRow>>(`${base}/list`, params);
export const deletionDetail = (id: number) => get<{ request: DeletionRow; consumer: DeletionRow; blockers: DeletionRow[]; policy: DeletionRow; events: DeletionRow[] }>(`${base}/detail`, { id });
export const deletionRequest = (params: Record<string, unknown>) => post<DeletionRow>(`${base}/request`, params);
export const deletionAction = (action: string, params: Record<string, unknown>) => post<DeletionRow>(`${base}/${action}`, params);
export const deletionPolicy = () => get<{ current: DeletionRow; history: DeletionRow[]; version: number }>(`${base}/config`);
export const saveDeletionPolicy = (params: Record<string, unknown>) => post(`${base}/config/save`, params);
export const forfeitureReport = (params: Record<string, unknown>) => get<PageData<DeletionRow> & { summary: { completedAmount: string; currency: string } }>(`${base}/report`, params);
export const forfeitureExport = (params: Record<string, unknown>) => post<{ filename: string; mime: string; base64: string }>(`${base}/export`, params);
