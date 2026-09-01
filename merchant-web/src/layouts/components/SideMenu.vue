<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as Icons from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import { menuTitle } from '@/locales/menuI18n';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

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

/** 将菜单树转为分组结构(保留原逻辑:目录→分组,页面→顶级项) */
const groups = computed<MenuGroup[]>(() => {
  const result: MenuGroup[] = [];
  const nodes = userStore.visibleMenus;

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
</script>

<template>
  <nav class="side-menu">
    <template v-for="group in groups" :key="group.groupKey">
      <!-- 有子菜单的分组:大写分组标题 + 缩进子项 -->
      <div v-if="group.children.length > 0" class="menu-group">
        <div class="group-title">{{ group.groupLabel }}</div>
        <div class="group-children">
          <span
            v-for="child in group.children"
            :key="child.key"
            :class="['menu-item', 'child-item', { active: child.key === activeKey }]"
            @click="navigate(child.key)"
          >
            <component :is="resolveIcon(child.icon || '')" v-if="child.icon" class="item-icon" />
            <span v-else class="child-dot" />
            <span class="item-label">{{ child.label }}</span>
          </span>
        </div>
      </div>

      <!-- 无子菜单的顶级页面项(如工作台) -->
      <div v-else class="menu-group">
        <div
          :class="['menu-item', { active: group.groupKey === activeKey }]"
          @click="navigate(group.groupKey)"
        >
          <component :is="resolveIcon(group.groupIcon || '')" v-if="group.groupIcon" class="item-icon" />
          <span class="item-label">{{ group.groupLabel }}</span>
        </div>
      </div>
    </template>
  </nav>
</template>

<style scoped lang="less">
.side-menu {
  padding: 12px 0;
}

.menu-group {
  margin-bottom: 12px; // 原型组间间距 12px(mb-3)

  &:first-child {
    margin-bottom: 4px; // 原型首组(PORTFOLIO)后仅 4px(mb-1)
  }
}

// ===== 分组标题(原型:11px/600 大写 letter-spacing 1.1px,padding 0 12px,下方 4px) =====
.group-title {
  padding: 0 12px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: var(--mtrip-text-aux);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-children {
  display: flex;
  flex-direction: column;
}

// ===== 菜单项(原型:13px/500 圆角 8px,padding 8px 12px,左右 margin 4px,图标 15px gap 10px) =====
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 4px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  color: var(--mtrip-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;

  .item-icon {
    font-size: 15px;
    color: var(--mtrip-text-aux);
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .item-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover {
    background: var(--mtrip-bg-hover);
  }

  &.active {
    background: var(--mtrip-primary-light);
    color: var(--mtrip-primary);

    .item-icon {
      color: var(--mtrip-primary);
    }

    .child-dot {
      background: var(--mtrip-primary);
    }
  }
}

// ===== 分组子项:无图标时用小圆点指示器 =====
.child-item {
  .child-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--mtrip-text-aux);
    flex-shrink: 0;
    transition: background 0.15s ease;
  }
}
</style>
