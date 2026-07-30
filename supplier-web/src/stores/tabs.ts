import { defineStore } from 'pinia';

export interface TabItem {
  /** 唯一标识，通常是路由 path */
  key: string;
  /** 页签标题（已翻译） */
  title: string;
  /** 国际化 key，用于语言切换时重新翻译 */
  i18nKey?: string;
  /** 是否可关闭（首页不可关闭） */
  closable: boolean;
  /** 路由完整路径（含 query） */
  fullPath?: string;
  /** 路由 name（=页面组件名，供 KeepAlive include） */
  name?: string;
  /** 是否缓存页面（来自菜单 is_cache） */
  keepAlive?: boolean;
}

const TABS_KEY = 'mtrip_supplier_tabs';
const ACTIVE_TAB_KEY = 'mtrip_supplier_active_tab';

interface TabsState {
  tabs: TabItem[];
  activeKey: string;
}

export const useTabsStore = defineStore('tabs', {
  state: (): TabsState => ({
    tabs: [],
    activeKey: '',
  }),
  getters: {
    /** 需要 KeepAlive 缓存的页面组件名(开启缓存且页签在列的才缓存,关页签即释放) */
    cachedViews(state): string[] {
      return state.tabs.filter((t) => t.keepAlive && t.name).map((t) => t.name as string);
    },
  },
  actions: {
    /** 从 localStorage 恢复页签 */
    restore(): void {
      try {
        const saved = localStorage.getItem(TABS_KEY);
        if (saved) {
          this.tabs = JSON.parse(saved);
        }
        const active = localStorage.getItem(ACTIVE_TAB_KEY);
        if (active) {
          this.activeKey = active;
        }
      } catch {
        // ignore
      }
    },
    /** 持久化页签 */
    persist(): void {
      localStorage.setItem(TABS_KEY, JSON.stringify(this.tabs));
      localStorage.setItem(ACTIVE_TAB_KEY, this.activeKey);
    },
    /** 添加页签(已存在则同步 fullPath/name/keepAlive,保证重访时能回到带 query 的地址) */
    addTab(tab: TabItem): void {
      const exists = this.tabs.find((t) => t.key === tab.key);
      if (exists) {
        exists.fullPath = tab.fullPath;
        exists.name = tab.name;
        exists.keepAlive = tab.keepAlive;
        exists.title = tab.title;
        exists.i18nKey = tab.i18nKey;
      } else {
        // Dashboard 不可关闭，其他页面可关闭
        const closable = tab.key !== '/dashboard';
        this.tabs.push({ ...tab, closable });
      }
      this.activeKey = tab.key;
      this.persist();
    },
    /** 关闭页签,返回需要跳转到的相邻页签(关的不是当前页签时返回 null) */
    closeTab(key: string): TabItem | null {
      const index = this.tabs.findIndex((t) => t.key === key);
      if (index === -1) return null;
      const tab = this.tabs[index];
      if (!tab.closable) return null;

      this.tabs.splice(index, 1);

      // 如果关闭的是当前激活页签，切换到上一个或下一个
      if (this.activeKey === key) {
        const nextTab = this.tabs[Math.min(index, this.tabs.length - 1)] ?? null;
        this.activeKey = nextTab?.key || '';
        this.persist();
        return nextTab;
      }
      this.persist();
      return null;
    },
    /** 关闭其他页签 */
    closeOtherTabs(key: string): void {
      this.tabs = this.tabs.filter((t) => t.key === key || !t.closable);
      this.activeKey = key;
      this.persist();
    },
    /** 关闭左侧页签 */
    closeLeftTabs(key: string): void {
      const index = this.tabs.findIndex((t) => t.key === key);
      if (index === -1) return;
      this.tabs = this.tabs.filter((t, i) => i >= index || !t.closable);
      this.persist();
    },
    /** 关闭右侧页签 */
    closeRightTabs(key: string): void {
      const index = this.tabs.findIndex((t) => t.key === key);
      if (index === -1) return;
      this.tabs = this.tabs.filter((t, i) => i <= index || !t.closable);
      this.persist();
    },
    /** 关闭所有可关闭页签 */
    closeAllTabs(): void {
      this.tabs = this.tabs.filter((t) => !t.closable);
      this.activeKey = this.tabs[0]?.key || '';
      this.persist();
    },
    /** 更新页签标题（语言切换时） */
    updateTabTitle(key: string, title: string): void {
      const tab = this.tabs.find((t) => t.key === key);
      if (tab) {
        tab.title = title;
      }
    },
    /** 设置当前激活页签 */
    setActiveKey(key: string): void {
      this.activeKey = key;
      this.persist();
    },
  },
});
