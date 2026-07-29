<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import AppHeader from './components/AppHeader.vue';
import SideMenu from './components/SideMenu.vue';

const appStore = useAppStore();
const userStore = useUserStore();
const { t } = useI18n();

const siderWidth = computed(() => (appStore.collapsed ? 64 : 256));
const roleLabel = computed(() => (userStore.isSuper ? t('app.superAdmin') : t('app.siteAdmin')));
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
        <!-- 底部固定栏:版本 + 身份(UI 方案 3.2) -->
        <div class="sider-footer">
          <template v-if="!appStore.collapsed">
            <span>V1.0</span>
            <span class="divider">|</span>
            <span>{{ roleLabel }}</span>
          </template>
          <template v-else>V1.0</template>
        </div>
      </a-layout-sider>
      <a-layout-content class="layout-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </a-layout-content>
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

  .sider-menu-wrap {
    height: calc(100% - 36px);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sider-footer {
    height: 36px;
    line-height: 36px;
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    white-space: nowrap;

    .divider {
      margin: 0 6px;
      opacity: 0.4;
    }
  }
}

.layout-content {
  overflow: auto;
  height: calc(100vh - 48px);
}
</style>
