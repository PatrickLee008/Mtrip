<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Tooltip, Popover } from 'ant-design-vue';
import * as Icons from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import { menuTitle } from '@/locales/menuI18n';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const appStore = useAppStore();

/** 图标名 → 组件 */
function resolveIcon(name: string) {
  return (Icons as Record<string, unknown>)[name] as (() => unknown) | undefined;
}

interface FlatChild {
  key: string;
  label: string;
  icon?: string;
}

interface MenuGroup {
  /** 一级分类 key */
  groupKey: string;
  groupLabel: string;
  groupIcon?: string;
  children: FlatChild[];
}

/** 将菜单树转为分组结构 */
const groups = computed<MenuGroup[]>(() => {
  const result: MenuGroup[] = [];
  const nodes = userStore.menus;

  for (const node of nodes) {
    if (node.menu_type === 1) {
      const children: FlatChild[] = (node.children ?? [])
        .filter((child) => child.menu_type === 2)
        .map((child) => ({
          key: child.route_path || String(child.id),
          label: menuTitle(child),
          icon: child.icon || undefined,
        }));
      if (children.length > 0) {
        result.push({
          groupKey: node.route_path || String(node.id),
          groupLabel: menuTitle(node),
          groupIcon: node.icon || undefined,
          children,
        });
      }
    } else if (node.menu_type === 2) {
      result.push({
        groupKey: node.route_path || String(node.id),
        groupLabel: menuTitle(node),
        groupIcon: node.icon || undefined,
        children: [],
      });
    }
  }
  return result;
});

const activeKey = ref(route.path);
const popoverOpen = ref<Record<string, boolean>>({});

watch(
  () => route.path,
  (path) => {
    activeKey.value = path;
  },
  { immediate: true },
);

function navigate(key: string): void {
  router.push(key);
}

function closePopover(groupKey: string): void {
  popoverOpen.value[groupKey] = false;
}

function onPopoverVisibleChange(groupKey: string, visible: boolean): void {
  popoverOpen.value[groupKey] = visible;
}
</script>

<template>
  <nav class="side-menu" :class="{ collapsed: appStore.collapsed }">
    <template v-for="group in groups" :key="group.groupKey">
      <!-- 有子菜单的分组 -->
      <div v-if="group.children.length > 0" class="menu-group">
        <!-- 展开模式 -->
        <template v-if="!appStore.collapsed">
          <div class="group-title">
            <component :is="resolveIcon(group.groupIcon || '')" v-if="group.groupIcon" class="group-icon" />
            <span class="group-label">{{ group.groupLabel }}</span>
          </div>
          <div class="group-children">
            <span
              v-for="child in group.children"
              :key="child.key"
              :class="['child-item', { active: child.key === activeKey }]"
              @click="navigate(child.key)"
            >
              {{ child.label }}
            </span>
          </div>
        </template>

        <!-- 折叠模式：仅 Popover -->
        <template v-else>
          <Popover
            :open="popoverOpen[group.groupKey]"
            placement="rightTop"
            trigger="hover"
            overlay-class-name="side-menu-popover"
            @open-change="(v: boolean) => onPopoverVisibleChange(group.groupKey, v)"
          >
            <template #content>
              <div class="popover-title">{{ group.groupLabel }}</div>
              <div class="popover-children">
                <span
                  v-for="child in group.children"
                  :key="child.key"
                  :class="['popover-child', { active: child.key === activeKey }]"
                  @click="navigate(child.key); closePopover(group.groupKey)"
                >
                  {{ child.label }}
                </span>
              </div>
            </template>
            <div
              :class="['collapsed-icon', { 'has-active-child': group.children.some(c => c.key === activeKey) }]"
            >
              <component :is="resolveIcon(group.groupIcon || '')" v-if="group.groupIcon" />
            </div>
          </Popover>
        </template>
      </div>

      <!-- 无子菜单的顶级项（如 Dashboard） -->
      <div v-else class="menu-group">
        <Tooltip :title="group.groupLabel" placement="right" v-if="appStore.collapsed">
          <div
            :class="['top-item', { active: group.groupKey === activeKey }]"
            @click="navigate(group.groupKey)"
          >
            <component :is="resolveIcon(group.groupIcon || '')" v-if="group.groupIcon" class="top-icon" />
          </div>
        </Tooltip>
        <div
          v-else
          :class="['top-item', { active: group.groupKey === activeKey }]"
          @click="navigate(group.groupKey)"
        >
          <component :is="resolveIcon(group.groupIcon || '')" v-if="group.groupIcon" class="top-icon" />
          <span class="top-label">{{ group.groupLabel }}</span>
        </div>
      </div>
    </template>
  </nav>
</template>

<style scoped lang="less">
.side-menu {
  padding: 8px 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.menu-group {
  margin-bottom: 4px;
}

// ===== 一级分类标题 =====
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 6px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  overflow: hidden;

  .group-icon {
    font-size: 14px;
    opacity: 0.7;
  }

  .group-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// ===== 二级菜单：网格标签式 =====
.group-children {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 4px 12px 12px;
}

.child-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.06);
  text-align: center;

  &:hover {
    background: rgba(22, 119, 255, 0.3);
    color: #fff;
  }

  &.active {
    background: #1677ff;
    color: #fff;
  }
}

// ===== 顶级菜单项 =====
.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin: 0 8px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;

  .top-icon {
    font-size: 16px;
  }

  .top-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  &.active {
    background: #1677ff;
    color: #fff;
  }
}

// ===== 折叠模式 =====
.collapsed {
  .collapsed-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: 4px auto;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.65);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    &.has-active-child {
      color: #1677ff;
      background: rgba(22, 119, 255, 0.15);
    }
  }

  .top-item {
    justify-content: center;
    padding: 10px 0;
    margin: 4px auto;
    width: 48px;
    height: 48px;
    border-radius: 8px;

    .top-icon {
      font-size: 18px;
    }
  }
}
</style>

<style lang="less">
// Popover 弹窗全局样式（暗色主题）
.side-menu-popover {
  .ant-popover-inner {
    background: #1f1f1f !important;
    border: 1px solid #303030 !important;
    padding: 0 !important;
    min-width: 160px;
    border-radius: 8px;
  }

  .ant-popover-arrow::before {
    background: #1f1f1f !important;
    border: 1px solid #303030 !important;
  }

  .ant-popover-inner-content {
    padding: 0;
  }

  .popover-title {
    padding: 8px 12px 6px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .popover-children {
    padding: 4px;
  }

  .popover-child {
    display: block;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(22, 119, 255, 0.3);
      color: #fff;
    }

    &.active {
      background: #1677ff;
      color: #fff;
    }
  }
}
</style>
