<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import type { MenuNode } from '@/api/types';
import { menuTitle, resolveMenuTitle } from '@/locales/menuI18n';

/**
 * PageContainer:面包屑 + 页面标题 + 操作按钮区
 * 标题与面包屑均走 i18n:meta.title(词条 key)命中则翻译,未命中按语言回退 rawTitle/rawTitleEn
 */
const props = defineProps<{
  /** 覆盖默认标题(默认取路由 meta.title;可传词条 key 或纯文本) */
  title?: string;
}>();

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t, te } = useI18n();

const pageTitle = computed(() => {
  if (props.title) {
    return te(props.title) ? t(props.title) : props.title;
  }
  return resolveMenuTitle(
    (route.meta.title as string) || '',
    (route.meta.rawTitle as string) || '',
    (route.meta.rawTitleEn as string) || '',
  );
});

/** 由菜单树推导面包屑:一级目录 / 页面 */
const breadcrumbs = computed<string[]>(() => {
  const crumbs: string[] = [];
  const find = (nodes: MenuNode[], trail: string[]): boolean => {
    for (const node of nodes) {
      const next = [...trail, menuTitle(node)];
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
  border-bottom: 1px solid var(--mtrip-border);

  .page-breadcrumb {
    margin-bottom: 0;
  }
}

.page-body {
  padding: 16px;
  background: var(--mtrip-bg-page);
  min-height: calc(100vh - 48px - 40px - 40px); // 减去 header + tabs-bar + page-header
}
</style>
