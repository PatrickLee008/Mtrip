<script setup lang="ts">
import { computed, h, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ItemType } from 'ant-design-vue';
import * as Icons from '@ant-design/icons-vue';
import type { MenuNode } from '@/api/types';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const appStore = useAppStore();

/** 图标名(如 SettingOutlined)→ 组件,渲染动态菜单图标 */
function renderIcon(name: string) {
  const icon = (Icons as Record<string, unknown>)[name] as Component | undefined;
  return icon ? () => h(icon) : undefined;
}

function toItems(nodes: MenuNode[]): ItemType[] {
  return nodes
    .filter((node) => node.menu_type === 1 || node.menu_type === 2)
    .map((node) => {
      const children = node.children?.filter((child) => child.menu_type !== 3) ?? [];
      return {
        key: node.route_path || String(node.id),
        label: node.menu_name,
        icon: node.icon ? renderIcon(node.icon) : undefined,
        children: children.length > 0 ? toItems(children) : undefined,
      } as ItemType;
    });
}

const items = computed<ItemType[]>(() => [
  { key: '/dashboard', label: '数据大屏', icon: renderIcon('DashboardOutlined') },
  ...toItems(userStore.menus),
]);

const selectedKeys = ref<string[]>([route.path]);
const openKeys = ref<string[]>([]);

// 当前路由高亮 + 展开所属一级菜单(手风琴)
watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path];
    const parent = '/' + path.split('/')[1];
    if (!appStore.collapsed && parent !== path) {
      openKeys.value = [parent];
    }
  },
  { immediate: true },
);

// 手风琴模式:仅展开一个一级分类
function onOpenChange(keys: (string | number)[]): void {
  const latest = keys.find((key) => !openKeys.value.includes(String(key)));
  openKeys.value = latest ? [String(latest)] : [];
}

function onClick({ key }: { key: string | number }): void {
  router.push(String(key));
}
</script>

<template>
  <a-menu
    v-model:selected-keys="selectedKeys"
    :open-keys="appStore.collapsed ? [] : openKeys"
    theme="dark"
    mode="inline"
    :items="items"
    @open-change="onOpenChange"
    @click="onClick"
  />
</template>
