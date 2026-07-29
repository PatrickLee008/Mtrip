<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import type { MenuNode } from '@/api/types';
import { resolveMenuI18nKey } from '@/locales/menuI18n';

/**
 * PageContainer:面包屑 + 页面标题 + 操作按钮区(UI 方案 3.3)
 * 标题与面包屑均走 i18n:meta.title 优先作为 i18n key 解析,未命中则回退原值
 */
const props = defineProps<{
  /** 覆盖默认标题(默认取路由 meta.title) */
  title?: string;
}>();

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t, te } = useI18n();

const pageTitle = computed(() => {
  const raw = props.title || (route.meta.title as string) || '';
  return te(raw) ? t(raw) : raw;
});

/** 兼容菜单树中的中文 menu_name 走 i18n */
function menuLabel(name: string): string {
  const key = resolveMenuI18nKey(name);
  return key ? t(key) : name;
}

/** 由菜单树推导面包屑:一级目录 / 页面 */
const breadcrumbs = computed<string[]>(() => {
  const crumbs: string[] = [];
  const find = (nodes: MenuNode[], trail: string[]): boolean => {
    for (const node of nodes) {
      const next = [...trail, menuLabel(node.menu_name)];
      if (node.menu_type === 2 && node.route_path === route.path) {
        crumbs.push(...next);
        return true;
      }
      if (node.children?.length && find(node.children, next)) {
        return true;
      }
    }
    return false;
  };
  find(userStore.menus, []);
  return crumbs.length > 0 ? crumbs : [pageTitle.value];
});
</script>

<template>
  <div class="page-container">
    <div class="page-header mtrip-card-shadow">
      <a-breadcrumb class="page-breadcrumb">
        <a-breadcrumb-item>
          <a @click="router.push('/dashboard')">{{ t('common.home') }}</a>
        </a-breadcrumb-item>
        <a-breadcrumb-item v-for="crumb in breadcrumbs" :key="crumb">{{ crumb }}</a-breadcrumb-item>
      </a-breadcrumb>
      <div class="page-title-row">
        <h2 class="page-title">{{ pageTitle }}</h2>
        <div class="page-actions">
          <slot name="extra" />
        </div>
      </div>
    </div>
    <div class="page-body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.page-header {
  padding: 12px 16px;
  background: var(--mtrip-bg-card);

  .page-breadcrumb {
    margin-bottom: 4px;
  }

  .page-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .page-title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 26px;
    }

    .page-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.page-body {
  padding: 16px;
}
</style>
