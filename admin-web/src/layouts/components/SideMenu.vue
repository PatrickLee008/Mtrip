<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as Icons from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import { menuTitle } from '@/locales/menuI18n';
import { apiVerifyQueues } from '@/api/merchant';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** 商户验证队列计数(侧边栏徽标:入驻申请/待核实/重新提交显示,60s 自动刷新) */
const queueCounts = ref<Record<string, number>>({});
let queueTimer: number | undefined;
async function loadQueues(): Promise<void> {
  try {
    // 待核实/重新提交均来自 merchant_info.status，不能使用入驻线索 stage 统计。
    queueCounts.value = await apiVerifyQueues();
  } catch {
    queueCounts.value = {};
  }
}
onMounted(() => {
  void loadQueues();
  queueTimer = window.setInterval(() => void loadQueues(), 60000);
});
onUnmounted(() => {
  if (queueTimer) {
    window.clearInterval(queueTimer);
  }
});

/** 子菜单徽标:入驻申请、待核实、重新提交；计数 0 不显示 */
function childBadge(child: MenuItem): number | undefined {
  if (child.key === '/merchant-verify/onboarding') return (queueCounts.value.onboarding ?? 0) > 0 ? queueCounts.value.onboarding : undefined;
  if (child.key === '/merchant-verify/pending') return (queueCounts.value.pending ?? 0) > 0 ? queueCounts.value.pending : undefined;
  if (child.key === '/merchant-verify/resubmission') return (queueCounts.value.resubmission ?? 0) > 0 ? queueCounts.value.resubmission : undefined;
  return undefined;
}

/** 父级徽标:商户验证显示三项待办总计,计数 0 不显示 */
function groupBadge(group: MenuGroup): number | undefined {
  if (group.key !== '/merchant-verify') return undefined;
  const total = (queueCounts.value.onboarding ?? 0) + (queueCounts.value.pending ?? 0) + (queueCounts.value.resubmission ?? 0);
  return total > 0 ? total : undefined;
}

/** 图标名 → 组件 */
function resolveIcon(name: string) {
  return (Icons as Record<string, unknown>)[name] as (() => unknown) | undefined;
}

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
}

interface MenuGroup {
  key: string;
  label: string;
  icon?: string;
  children: MenuItem[];
}

/** 将后端菜单树转为侧边栏分组结构 */
const groups = computed<MenuGroup[]>(() => {
  const result: MenuGroup[] = [];
  const nodes = userStore.menus;

  for (const node of nodes) {
    if (node.menu_type === 1) {
      const children: MenuItem[] = (node.children ?? [])
        .filter((child) => child.menu_type === 2)
        .map((child) => ({
          key: child.route_path || String(child.id),
          label: menuTitle(child),
          icon: child.icon || undefined,
        }));
      result.push({
        key: node.route_path || String(node.id),
        label: menuTitle(node),
        icon: node.icon || undefined,
        children,
      });
    } else if (node.menu_type === 2) {
      result.push({
        key: node.route_path || String(node.id),
        label: menuTitle(node),
        icon: node.icon || undefined,
        children: [],
      });
    }
  }
  return result;
});

/** 展开的分组 key 集合 */
const expandedKeys = ref<Set<string>>(new Set());

const activeKey = ref(route.path);

watch(
  () => route.path,
  (path) => {
    activeKey.value = path;
    // 自动展开包含当前路由的分组
    for (const g of groups.value) {
      if (g.children.some((c) => c.key === path)) {
        expandedKeys.value.add(g.key);
      }
    }
  },
  { immediate: true },
);

/** 分组是否处于激活状态(自身或子项匹配) */
function isGroupActive(group: MenuGroup): boolean {
  if (group.children.length === 0) return group.key === activeKey.value;
  return group.key === activeKey.value || group.children.some((c) => c.key === activeKey.value);
}

/** 点击分组 */
function onGroupClick(group: MenuGroup): void {
  if (group.children.length > 0) {
    // 切换展开/折叠
    if (expandedKeys.value.has(group.key)) {
      expandedKeys.value.delete(group.key);
    } else {
      expandedKeys.value.add(group.key);
    }
  } else {
    router.push(group.key);
  }
}

/** 点击子菜单项 */
function onChildClick(key: string): void {
  router.push(key);
}
</script>

<template>
  <nav class="sidebar-nav">
    <div v-for="group in groups" :key="group.key" class="nav-group">
      <!-- 一级菜单项 -->
      <button
        :class="['nav-item', { active: isGroupActive(group), expanded: expandedKeys.has(group.key) }]"
        @click="onGroupClick(group)"
      >
        <span class="nav-icon">
          <component :is="resolveIcon(group.icon || '')" v-if="group.icon" />
        </span>
        <span class="nav-label">{{ group.label }}</span>
        <span v-if="groupBadge(group)" class="nav-badge">{{ groupBadge(group) }}</span>
        <span v-if="group.children.length > 0" class="nav-arrow">
          <Icons.CaretDownOutlined />
        </span>
      </button>

      <!-- 子菜单列表 -->
      <Transition name="submenu">
        <div v-if="group.children.length > 0 && expandedKeys.has(group.key)" class="submenu-wrap">
          <div class="submenu-inner">
            <button
              v-for="child in group.children"
              :key="child.key"
              :class="['submenu-item', { active: child.key === activeKey }]"
              @click="onChildClick(child.key)"
            >
              <span class="dot" />
              <span class="submenu-label">{{ child.label }}</span>
              <span
                v-if="childBadge(child)"
                class="nav-badge"
                :class="{ 'nav-badge--pending': child.key === '/merchant-verify/pending' }"
              >{{ childBadge(child) }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped lang="less">
.sidebar-nav {
  padding: 4px 12px 12px;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-group {
  margin-bottom: 2px;
}

// ===== 一级菜单按钮 =====
.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12.5px;
  font-weight: 400;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  gap: 8px;
  outline: none;

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 15px;
    opacity: 0.6;
  }

  .nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .nav-arrow {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.45;
    transition: transform 0.2s ease;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.75);
  }

  &.active {
    color: #fff;
    font-weight: 500;
  }

  &.active:not(.expanded) {
    background: rgba(22, 100, 255, 0.22);
    border-left-color: #1664ff;

    .nav-icon {
      opacity: 1;
    }
  }

  &.expanded {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);

    .nav-icon {
      opacity: 1;
    }

    .nav-arrow {
      transform: rotate(180deg);
    }
  }
}

// ===== 子菜单区域 =====
.submenu-wrap {
  overflow: hidden;
}

.submenu-inner {
  margin: 4px 0 4px 18px;
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  padding-left: 8px;
}

.submenu-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 29px;
  padding: 0 6px 0 8px;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  gap: 8px;
  outline: none;

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
    opacity: 0.5;
  }

  .submenu-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.04);
  }

  &.active {
    color: #fff;
    font-weight: 500;
    background: rgba(22, 100, 255, 0.2);
    border-left-color: #1664ff;

    .dot {
      opacity: 1;
    }
  }
}

// ===== 菜单徽标(一级/子级通用;待审核橙色,其余品牌蓝) =====
.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #1664ff;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}

.nav-badge--pending {
  background: rgb(245, 158, 11);
}

// ===== 展开/折叠过渡动画 =====
.submenu-enter-active {
  transition: all 0.2s ease;
}

.submenu-leave-active {
  transition: all 0.15s ease;
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  max-height: 0;
}

.submenu-enter-to,
.submenu-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
