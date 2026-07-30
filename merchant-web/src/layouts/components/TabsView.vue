<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CloseOutlined } from '@ant-design/icons-vue';
import { useTabsStore, type TabItem } from '@/stores/tabs';

const router = useRouter();
const tabsStore = useTabsStore();
const { t } = useI18n();

const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuTab = ref<TabItem | null>(null);

/** 点击页签(优先跳 fullPath,找回上次的查询参数) */
function onTabClick(tab: TabItem): void {
  tabsStore.setActiveKey(tab.key);
  router.push(tab.fullPath || tab.key);
}

/** 关闭页签 */
function onTabClose(e: MouseEvent, key: string): void {
  e.stopPropagation();
  const nextTab = tabsStore.closeTab(key);
  if (nextTab && nextTab.key !== router.currentRoute.value.path) {
    router.push(nextTab.fullPath || nextTab.key);
  }
}

/** 右键菜单 */
function onContextMenu(e: MouseEvent, tab: TabItem): void {
  e.preventDefault();
  contextMenuTab.value = tab;
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
}

function closeContextMenu(): void {
  contextMenuVisible.value = false;
  contextMenuTab.value = null;
}

function closeOther(): void {
  if (contextMenuTab.value) {
    tabsStore.closeOtherTabs(contextMenuTab.value.key);
    if (router.currentRoute.value.path !== contextMenuTab.value.key) {
      router.push(contextMenuTab.value.fullPath || contextMenuTab.value.key);
    }
  }
  closeContextMenu();
}

function closeLeft(): void {
  if (contextMenuTab.value) {
    tabsStore.closeLeftTabs(contextMenuTab.value.key);
  }
  closeContextMenu();
}

function closeRight(): void {
  if (contextMenuTab.value) {
    tabsStore.closeRightTabs(contextMenuTab.value.key);
  }
  closeContextMenu();
}

function closeAll(): void {
  tabsStore.closeAllTabs();
  if (router.currentRoute.value.path !== '/dashboard') {
    router.push('/dashboard');
  }
  closeContextMenu();
}

// 点击其他地方关闭右键菜单
watch(contextMenuVisible, (visible) => {
  if (visible) {
    document.addEventListener('click', closeContextMenu);
  } else {
    document.removeEventListener('click', closeContextMenu);
  }
});
</script>

<template>
  <div class="tabs-view">
    <div class="tabs-container">
      <div
        v-for="tab in tabsStore.tabs"
        :key="tab.key"
        :class="['tab-item', { active: tab.key === tabsStore.activeKey }]"
        @click="onTabClick(tab)"
        @contextmenu="onContextMenu($event, tab)"
      >
        <span class="tab-title">{{ tab.title }}</span>
        <span v-if="tab.closable" class="tab-close" @click="onTabClose($event, tab.key)">
          <CloseOutlined />
        </span>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <div class="context-menu-item" @click="closeOther">
          {{ t('tabs.closeOther') }}
        </div>
        <div class="context-menu-item" @click="closeLeft">
          {{ t('tabs.closeLeft') }}
        </div>
        <div class="context-menu-item" @click="closeRight">
          {{ t('tabs.closeRight') }}
        </div>
        <div class="context-menu-divider" />
        <div class="context-menu-item" @click="closeAll">
          {{ t('tabs.closeAll') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="less">
.tabs-view {
  height: 40px;
  background: var(--mtrip-bg-card);
  border-bottom: 1px solid var(--mtrip-border);
  padding: 0 12px;
  display: flex;
  align-items: center;
}

.tabs-container {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  height: 100%;
  align-items: center;

  &::-webkit-scrollbar {
    height: 4px;
  }
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  background: var(--mtrip-bg-page);
  border: 1px solid var(--mtrip-border);
  transition: all 0.2s ease;
  color: var(--mtrip-text-secondary);

  &:hover {
    background: var(--mtrip-primary);
    color: #fff;
    border-color: var(--mtrip-primary);
  }

  &.active {
    background: var(--mtrip-primary);
    color: #fff;
    border-color: var(--mtrip-primary);
  }

  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 10px;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--mtrip-bg-card);
  border: 1px solid var(--mtrip-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 120px;
  padding: 4px 0;

  .context-menu-item {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    color: var(--mtrip-text-main);
    transition: background 0.2s;

    &:hover {
      background: var(--mtrip-primary);
      color: #fff;
    }
  }

  .context-menu-divider {
    height: 1px;
    background: var(--mtrip-border);
    margin: 4px 0;
  }
}
</style>
