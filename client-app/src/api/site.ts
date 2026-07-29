/**
 * 站点接口(system-service /api/v1/app/site/*,公开)
 */

import { get } from '@/api/request';
import type { SiteConfigData, SiteInfo } from '@/types/models';

export function fetchSiteList(): Promise<SiteInfo[]> {
  return get<SiteInfo[]>('/api/v1/app/site/list');
}

export function fetchSiteConfig(siteId?: number): Promise<SiteConfigData> {
  return get<SiteConfigData>('/api/v1/app/site/config', siteId ? { siteId } : undefined);
}
