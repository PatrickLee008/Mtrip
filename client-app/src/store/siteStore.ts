/**
 * 站点状态:当前站点/站点列表/货币/语言/时区(多站点隔离核心)
 */

import { create } from 'zustand';

import { ApiError, type RequestOptions } from '@/api/request';
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
  switchSite: (siteId: number, options?: RequestOptions) => Promise<void>;
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

/** 后端「站点不存在或已停用」(ErrorCode::NOT_FOUND) */
const SITE_NOT_FOUND = 40401;
/** 本次启动是否已向服务端核实过当前站点 */
let siteVerified = false;

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

  async switchSite(siteId, options) {
    const data = await fetchSiteConfig(siteId, options);
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
    // 本地缓存的站点每次启动至少核实一次:后台停用站点后(生产 2026-11 停用站点 1),
    // 老客户端还会一直带着它浏览、注册,账号落进停用站点
    if (target === siteId && siteName && siteVerified) return;
    try {
      await get().switchSite(target, { silent: true });
      siteVerified = true;
    } catch (e) {
      // 只有服务端明确说站点不存在 / 已停用才回默认站点;断网等失败保持原站点,下次再试
      if (e instanceof ApiError && e.code === SITE_NOT_FOUND && target !== DEFAULT_SITE_ID) {
        await get().switchSite(DEFAULT_SITE_ID, { silent: true }).then(
          () => {
            siteVerified = true;
          },
          () => undefined,
        );
      }
    }
  },
}));
