import { get } from '@/utils/http';

export type SearchCategory = 'merchant' | 'booking' | 'affiliate' | 'campaign' | 'user';

export interface SearchHit {
  id: string;
  siteId: number;
  title: string;
  subtitle: string;
  details: Record<string, string | number | null>;
}

export function searchRecords(category: SearchCategory, keyword: string, siteId: number) {
  return get<SearchHit[]>('/admin/sys/search', { category, keyword, siteId });
}
