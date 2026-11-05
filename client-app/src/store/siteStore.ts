/**
 * 站点状态:当前站点/站点列表/货币/语言/时区(多站点隔离核心)
 */

import { create } from 'zustand';

import { fetchSiteConfig, fetchSiteList } from '@/api/site';
import { DEFAULT_SITE_ID } from '@/config/env';
import { STORAGE_KEYS } from '@/config/global';
import type { SiteInfo } from '@/types/models';
import { storage } from '@/utils/storage';

interface SiteState {
  siteId: number;
  siteName: string;
  currency: string;
  timezone: string;
  /** 站点默认语言(i18n 联动) */
  language: string;
  /** 站点公开配置(config_group=app) */
  configs: Record<string, string>;
  siteList: SiteInfo[];
  hydrate: () => Promise<void>;
  loadSiteList: () => Promise<SiteInfo[]>;
  /** 切换站点并拉取站点配置 */
  switchSite: (siteId: number) => Promise<void>;
  /**
   * 对齐到账号所属站点:登录后 / 启动时调用。站点不同,或本地还没有站点快照
   * (货币还是占位值)时拉一次站点配置;失败静默,下次进首页会再补拉。
   */
  followUserSite: (userSiteId?: number) => Promise<void>;
}

interface PersistedSite {
  siteId: number;
  siteName: string;
  currency: string;
  timezone: string;
  language: string;
}

export const useSiteStore = create<SiteState>((set, get) => ({
  siteId: DEFAULT_SITE_ID,
  siteName: '',
  currency: 'EUR',
  timezone: 'UTC',
  language: 'en-US',
  configs: {},
  siteList: [],

  async hydrate() {
    const saved = await storage.getObject<PersistedSite>(STORAGE_KEYS.SITE);
    if (saved && saved.siteId > 0) {
      set({ ...saved });
    }
  },

  async loadSiteList() {
    const list = await fetchSiteList();
    set({ siteList: list });
    return list;
  },

  async switchSite(siteId) {
    const data = await fetchSiteConfig(siteId);
    const persisted: PersistedSite = {
      siteId: data.site.id,
      siteName: data.site.site_name,
      currency: data.site.currency || 'EUR',
      timezone: data.site.timezone || 'UTC',
      language: data.site.language || get().language,
    };
    await storage.setObject(STORAGE_KEYS.SITE, persisted);
    set({ ...persisted, configs: data.configs });
  },

  async followUserSite(userSiteId) {
    const { siteId, siteName } = get();
    const target = userSiteId && userSiteId > 0 ? userSiteId : siteId;
    if (target === siteId && siteName) return;
    await get().switchSite(target).catch(() => undefined);
  },
}));
