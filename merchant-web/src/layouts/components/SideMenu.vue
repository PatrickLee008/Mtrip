<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import * as Icons from '@ant-design/icons-vue';
import type { MenuNode } from '@/api/types';
import { useUserStore } from '@/stores/user';
import { menuTitle } from '@/locales/menuI18n';
import { isMenuPathVisible } from '@/config/menuSections';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();

interface MenuItem { path: string; label: string; icon: string }

/** 不进侧边栏的历史页面(页面与路由保留:工作台与「所有物业」列表仍有 /store 入口) */
const HIDDEN_PATHS = ['/store', '/goods'];

/** 当前选中酒店的详情页(酒店资料入口);未选物业或选中非酒店物业时为空,该分组随之消失 */
const hotelProfilePath = computed(() =>
  userStore.selectedProperty?.business_type === 'hotel'
    ? `/properties/${userStore.selectedProperty.id}/profile`
    : '',
);

/** 侧边栏分组:hotelManagement / operations 的物业专属口径见 config/menuSections.ts */
const sections = computed(() => [
  { key: 'portfolio', paths: ['/properties', '/dashboard'] },
  // M8 促销与活动:促销页 + 效果分析 + 平台活动同属「Business」分组
  { key: 'business', paths: ['/earnings', '/promotions', '/promotions/analytics', '/campaigns', '/reviews', '/notifications'] },
  { key: 'hotelManagement', paths: [hotelProfilePath.value, '/rooms'] },
  { key: 'operations', paths: ['/availability', '/order'] },
  { key: 'team', paths: ['/account/list', '/account/role'] },
  { key: 'system', paths: ['/support', '/settings'] },
]);

function pages(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [
    ...(node.menu_type === 2 && node.route_path ? [node] : []),
    ...pages(node.children ?? []),
  ]);
}

const groups = computed(() => {
  const authorized = new Map(pages(userStore.visibleMenus).map((node) => [node.route_path, node]));
  const label: Record<string, string> = {
    '/properties': t('sidebar.allProperties'),
    '/earnings': t('sidebar.dashboardEarnings'),
    '/account/list': t('sidebar.staffManagement'),
    '/settings': t('sidebar.settingsSecurity'),
    ...(hotelProfilePath.value ? { [hotelProfilePath.value]: t('properties.profile.title') } : {}),
  };
  const icon: Record<string, string> = {
    '/properties': 'HomeOutlined',
    '/dashboard': 'AppstoreOutlined',
    '/earnings': 'BarChartOutlined',
    '/account/list': 'TeamOutlined',
    ...(hotelProfilePath.value ? { [hotelProfilePath.value]: 'BankOutlined' } : {}),
  };
  const item = (path: string): MenuItem | null => {
    // 物业专属菜单:未选物业(或选中非酒店物业)时不出现在侧边栏
    if (!path || !isMenuPathVisible(path, userStore.selectedProperty)) return null;
    const node = authorized.get(path);
    if (!node && path !== '/properties' && path !== '/dashboard' && path !== hotelProfilePath.value) return null;
    return { path, label: label[path] || (node ? menuTitle(node) : t('dashboard.title')), icon: icon[path] || node?.icon || 'AppstoreOutlined' };
  };
  const result = sections.value.map((section) => ({
    key: section.key,
    title: t('sidebar.sections.' + section.key),
    items: section.paths.map(item).filter((entry): entry is MenuItem => entry !== null),
  })).filter((section) => section.items.length > 0);
  const listed = new Set(sections.value.flatMap((section) => section.paths));
  const extra = [...authorized.keys()]
    .filter((path) => !listed.has(path) && !HIDDEN_PATHS.includes(path))
    .map(item)
    .filter((entry): entry is MenuItem => entry !== null);
  if (extra.length) result.push({ key: 'other', title: t('sidebar.sections.other'), items: extra });
  return result;
});

/** 当前高亮项:物业详情页由「酒店资料」自己高亮,「所有物业」不再重复高亮 */
function isActive(entry: MenuItem): boolean {
  if (route.path === entry.path) return true;
  return entry.path === '/properties' && route.path.startsWith('/properties/') && !/^\/properties\/\d+\/profile$/.test(route.path);
}

function resolveIcon(name: string) {
  return (Icons as Record<string, unknown>)[name] as (() => unknown) | undefined;
}
</script>

<template>
  <nav class="side-menu">
    <section v-for="group in groups" :key="group.key" class="menu-group">
      <div class="group-title">{{ group.title }}</div>
      <button
        v-for="entry in group.items"
        :key="entry.path"
        type="button"
        :class="['menu-item', { active: isActive(entry) }]"
        @click="router.push(entry.path)"
      >
        <component :is="resolveIcon(entry.icon)" class="item-icon" />
        <span class="item-label">{{ entry.label }}</span>
      </button>
    </section>
  </nav>
</template>

<style scoped lang="less">
.side-menu { padding: 0 8px 12px; }
.menu-group { padding: 16px 0; border-bottom: 1px solid var(--mtrip-border); }
.menu-group:last-child { border-bottom: 0; }
.group-title { padding: 0 12px; margin-bottom: 8px; font-size: 11px; font-weight: 600; line-height: 18px; text-transform: uppercase; color: var(--mtrip-text-aux); }
.menu-item { display: flex; align-items: center; gap: 10px; width: 100%; height: 44px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: var(--mtrip-text-main); font: inherit; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
.menu-item:hover { background: var(--mtrip-bg-hover); }
.menu-item.active { background: rgba(65, 105, 237, 0.08); color: var(--mtrip-primary); }
.item-icon { width: 15px; height: 15px; flex-shrink: 0; font-size: 15px; }
.item-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
