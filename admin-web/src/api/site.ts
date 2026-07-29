import { get } from '@/utils/http';
import type { SiteNode } from '@/api/types';

export function apiSiteTree(): Promise<SiteNode[]> {
  return get<SiteNode[]>('/admin/site/tree');
}
