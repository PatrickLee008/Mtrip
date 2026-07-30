import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 回收站 API(软删数据统一管理)。行结构为后端直出 snake_case。 */
export type RecycleRow = Record<string, any>;

/** 可回收表清单项 */
export interface RecycleTable {
  key: string;
  label: string;
  labelEn: string;
  group: string;
  scope: string;
  count: number;
}

type Params = Record<string, unknown>;

/** 当前管理员可见的表清单(含各表软删行数) */
export const apiRecycleTables = () => get<RecycleTable[]>('/admin/sys/recycle/tables');

/** 某表软删数据分页 */
export const apiRecycleList = (params: Params) => get<PageData<RecycleRow>>('/admin/sys/recycle/list', params);

/** 恢复单条 */
export const apiRecycleRestore = (key: string, id: number) =>
  post<null>('/admin/sys/recycle/restore', { key, id });

/** 彻底删除单条 */
export const apiRecyclePurge = (key: string, id: number) =>
  post<null>('/admin/sys/recycle/purge', { key, id });

/** 一键清空该表可见范围内全部软删数据 */
export const apiRecycleEmpty = (key: string) =>
  post<{ deleted: number }>('/admin/sys/recycle/empty', { key, confirm: 1 });
