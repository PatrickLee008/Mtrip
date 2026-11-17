/**
 * 站点接口(system-service /api/v1/app/site/*,公开)
 */

import { get, type RequestOptions } from '@/api/request';
import type { SiteConfigData, SiteInfo } from '@/types/models';

export function fetchSiteList(): Promise<SiteInfo[]> {
  return get<SiteInfo[]>('/api/v1/app/site/list');
}

export function fetchSiteConfig(siteId?: number, options?: RequestOptions): Promise<SiteConfigData> {
  return get<SiteConfigData>('/api/v1/app/site/config', siteId ? { siteId } : undefined, options);
}

/** App 版本检查结果(Consumer App PRD 19.1) */
export interface VersionCheckResult {
  /** 已装版本低于最低支持版本:必须更新才能继续使用 */
  forceUpdate: boolean;
  /** 有更新版本(强更时恒为 true) */
  hasUpdate: boolean;
  latestVersion: string;
  minVersion: string;
  /** 应用商店页地址(Google Play / App Store),后台「全局配置 → App Version」维护 */
  storeUrl: string;
  /** 后台配置的更新说明,空串时用 App 内置文案 */
  notes: string;
}

/** 版本检查(公开接口,静默:失败不弹 Toast,也不拦用户) */
export function fetchVersionCheck(platform: 'android' | 'ios', version: string): Promise<VersionCheckResult> {
  return get<VersionCheckResult>('/api/v1/app/site/version-check', { platform, version }, { silent: true });
}
