<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useTabsStore } from '@/stores/tabs';
import AppHeader from './components/AppHeader.vue';
import SideMenu from './components/SideMenu.vue';
import TabsView from './components/TabsView.vue';

const appStore = useAppStore();
const userStore = useUserStore();
const tabsStore = useTabsStore();
const { t } = useI18n();

const siderWidth = computed(() => (appStore.collapsed ? 64 : 256));

/** 底部身份标签:按 account_type 展示 集团/商户/门店 */
const ACCOUNT_TYPE_KEY: Record<number, string> = {
  1: 'accountType.group',
  2: 'accountType.merchant',
  3: 'accountType.store',
};
const roleLabel = computed(() => {
  const key = ACCOUNT_TYPE_KEY[userStore.accountType];
  return key ? t(key) : '';
});
</script>

<template>
  <a-layout class="basic-layout">
    <a-layout-header class="layout-header">
      <AppHeader />
    </a-layout-header>
    <a-layout>
      <a-layout-sider
        v-model:collapsed="appStore.collapsed"
        :width="256"
        :collapsed-width="64"
        collapsible
        :trigger="null"
        class="layout-sider"
        :style="{ width: siderWidth + 'px' }"
      >
        <div class="sider-menu-wrap">
          <SideMenu />
        </div>
        <!-- 底部固定栏:版本 + 身份(集团/商户/门店) -->
        <div class="sider-footer">
          <template v-if="!appStore.collapsed">
            <span>{{ t('app.version') }}</span>
            <span class="divider">|</span>
            <span>{{ roleLabel }}</span>
          </template>
          <template v-else>{{ t('app.version') }}</template>
        </div>
      </a-layout-sider>
      <a-layout class="layout-right">
        <!-- 页签栏 -->
        <TabsView />
        <!-- 内容区域:按页签缓存页面(菜单 is_cache 控制,关页签即释放缓存) -->
        <a-layout-content class="layout-content">
          <router-view v-slot="{ Component }">
            <keep-alive :include="tabsStore.cachedViews">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="less">
.basic-layout {
  height: 100%;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 48px;
  line-height: 48px;
  padding: 0;
  border-bottom: 1px solid var(--mtrip-border);
}

.layout-sider {
  position: relative;
  overflow: hidden;
  background: #001529 !important;

  .sider-menu-wrap {
    height: calc(100% - 36px);
    overflow-y: auto;
    overflow-x: hidden;
    background: #001529;
  }

  .sider-footer {
    height: 36px;
    line-height: 36px;
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    white-space: nowrap;
    background: #001529;

    .divider {
      margin: 0 6px;
      opacity: 0.4;
    }
  }
}

// 修复 Ant Design Menu 在 dark 主题下的背景色
.layout-sider :deep(.ant-menu.ant-menu-dark) {
  background: #001529;
}

.layout-right {
  display: flex;
  flex-direction: column;
  background: var(--mtrip-bg-page);
}

.layout-content {
  flex: 1;
  overflow: auto;
  min-height: 0; // 让 flex 子元素可滚动
}
</style>
