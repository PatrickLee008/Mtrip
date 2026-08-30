import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 系统配置模块 API(全局参数/站点/存储/文件库/支付/短信/地图) */
export type Row = Record<string, any>;
type Params = Record<string, unknown>;

/** 全局配置按 config_group 分组返回 */
export type GroupedConfigs = Record<string, Row[]>;

// ---------- 全局参数 ----------
export const apiConfigList = (group?: string) => get<GroupedConfigs>('/admin/sys/config/list', group ? { group } : undefined);
export const apiConfigSave = (configs: { key: string; value: string }[]) =>
  post<{ updated: number }>('/admin/sys/config/save', { configs });
export const apiConfigReset = (payload: { keys?: string[]; group?: string }) =>
  post<{ reset: number }>('/admin/sys/config/reset', payload);

// ---------- 站点 ----------
export const apiSiteList = (params: Params) => get<PageData<Row>>('/admin/site/list', params);
export const apiSiteAdd = (data: Params) => post<{ id: number }>('/admin/site/add', data);
export const apiSiteUpdate = (data: Params) => post<null>('/admin/site/update', data);
export const apiSiteDelete = (id: number) => post<null>('/admin/site/delete', { id });
export const apiSiteToggleStatus = (id: number) => post<{ status: number }>('/admin/site/toggle-status', { id });
export const apiSiteConfigs = (siteId: number) => get<GroupedConfigs>('/admin/site/configs', { siteId });
export const apiSiteSaveConfigs = (siteId: number, configs: Row[]) =>
  post<{ saved: number }>('/admin/site/save-configs', { siteId, configs });

// ---------- 文件存储 ----------
export const apiStorageList = (params: Params) => get<PageData<Row>>('/admin/sys/storage/list', params);
export const apiStorageAdd = (data: Params) => post<{ id: number }>('/admin/sys/storage/add', data);
export const apiStorageUpdate = (data: Params) => post<null>('/admin/sys/storage/update', data);
export const apiStorageDelete = (id: number) => post<null>('/admin/sys/storage/delete', { id });
export const apiStorageToggleStatus = (id: number) => post<{ status: number }>('/admin/sys/storage/toggle-status', { id });

// ---------- 文件库 ----------
export const apiFileList = (params: Params) => get<PageData<Row>>('/admin/sys/file/list', params);
export const apiFileTree = (params: Params) => get<Row[]>('/admin/sys/file/tree', params);
export const apiFileDirSave = (data: Params) => post<Row>('/admin/sys/file/dir/save', data);
export const apiFileDirDelete = (data: Params) => post<null>('/admin/sys/file/dir/delete', data);
export function apiFileUpload(file: File, params: Params = {}): Promise<Row> {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      fd.append(key, String(value));
    }
  });
  return post<Row>('/admin/sys/file/upload', fd);
}
export const apiFileDelete = (id: number) => post<null>('/admin/sys/file/delete', { id });

// ---------- 支付渠道 ----------
export const apiPayList = (params: Params) => get<PageData<Row>>('/admin/sys/pay/list', params);
export const apiPayAdd = (data: Params) => post<{ id: number }>('/admin/sys/pay/add', data);
export const apiPayUpdate = (data: Params) => post<null>('/admin/sys/pay/update', data);
export const apiPayDelete = (id: number) => post<null>('/admin/sys/pay/delete', { id });
export const apiPayToggleStatus = (id: number) => post<{ status: number }>('/admin/sys/pay/toggle-status', { id });
export const apiPayCopy = (id: number, siteIds: number[]) =>
  post<{ copied: number[]; skipped: number[] }>('/admin/sys/pay/copy', { id, siteIds });

// ---------- 短信 ----------
export const apiSmsChannelList = (params: Params) => get<PageData<Row>>('/admin/sys/sms/channel/list', params);
export const apiSmsChannelAdd = (data: Params) => post<{ id: number }>('/admin/sys/sms/channel/add', data);
export const apiSmsChannelUpdate = (data: Params) => post<null>('/admin/sys/sms/channel/update', data);
export const apiSmsChannelDelete = (id: number) => post<null>('/admin/sys/sms/channel/delete', { id });
export const apiSmsChannelToggleStatus = (id: number) =>
  post<{ status: number }>('/admin/sys/sms/channel/toggle-status', { id });
export const apiSmsTemplateList = (params: Params) => get<PageData<Row>>('/admin/sys/sms/template/list', params);
export const apiSmsTemplateAdd = (data: Params) => post<{ id: number }>('/admin/sys/sms/template/add', data);
export const apiSmsTemplateUpdate = (data: Params) => post<null>('/admin/sys/sms/template/update', data);
export const apiSmsTemplateDelete = (id: number) => post<null>('/admin/sys/sms/template/delete', { id });
export const apiSmsLogList = (params: Params) => get<PageData<Row>>('/admin/sys/sms/log/list', params);

// ---------- 地图 ----------
export const apiMapList = (params?: Params) => get<Row[]>('/admin/sys/map/list', params);
export const apiMapSave = (data: Params) => post<{ id: number }>('/admin/sys/map/save', data);
