<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import {
  BankOutlined,
  CoffeeOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
  ShopOutlined,
} from '@ant-design/icons-vue';
import type { MerchantBusiness, MenuNode } from '@/api/types';
import { useUserStore } from '@/stores/user';
import SupportBanner from '@/components/SupportBanner.vue';
import AppHeader from './components/AppHeader.vue';
import SideMenu from './components/SideMenu.vue';

const userStore = useUserStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const switcherOpen = ref(false);
const currentBusiness = computed(() => userStore.selectedBusiness);
const businessGroups = computed(() => {
  const groups = new Map<string, MerchantBusiness[]>();
  for (const business of userStore.businesses) {
    const list = groups.get(business.business_type) ?? [];
    list.push(business);
    groups.set(business.business_type, list);
  }
  return Array.from(groups.entries()).map(([type, businesses]) => ({ type, businesses }));
});

function businessTypeLabel(type: string): string {
  const key = ['hotel', 'restaurant', 'airline', 'car_rental', 'attraction'].includes(type) ? type : 'other';
  return t(`sidebar.businessType.${key}`);
}

function containsPath(nodes: MenuNode[], path: string): boolean {
  return nodes.some((node) => node.route_path === path || containsPath(node.children ?? [], path));
}

function toggleSwitcher(): void {
  switcherOpen.value = !switcherOpen.value;
}

function selectBusiness(id: number | null): void {
  userStore.selectBusiness(id);
  switcherOpen.value = false;
  if (route.path !== '/dashboard' && !containsPath(userStore.visibleMenus, route.path)) {
    void router.push('/dashboard');
  }
}

/** 点击面板外部关闭 */
function onDocClick(e: MouseEvent): void {
  const el = e.target as HTMLElement;
  if (!el.closest('.switcher-area')) {
    switcherOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

/** 底部登出(原型:侧边栏底部 Logout 按钮) */
function onLogout(): void {
  Modal.confirm({
    title: t('header.logoutConfirm'),
    okType: 'danger',
    onOk: async () => {
      const support = !!userStore.profile?.impersonation;
      await userStore.logout();
      if (support) { window.location.replace('/support-session'); return; }
      window.location.href = '/login';
    },
  });
}
</script>

<template>
  <div class="layout-container">
    <!-- 侧边栏:贯穿整个页面高度(原型 228px 白底) -->
    <aside class="layout-sidebar">
      <!-- Logo 区(原型:纯文字 mTrip + Merchant 副标题) -->
      <div class="sider-logo">
        <div class="logo-text">
          <div class="logo-title">mTrip</div>
          <div class="logo-subtitle">Merchant</div>
        </div>
      </div>

      <!-- 业务切换器:默认全局视图,选择具体注册业务后显示该业务模块菜单 -->
      <div class="switcher-area">
        <div :class="['subject-switcher', { open: switcherOpen }]" @click="toggleSwitcher">
          <HomeOutlined v-if="!currentBusiness" class="switcher-icon" />
          <BankOutlined v-else-if="currentBusiness.business_type === 'hotel'" class="switcher-icon hotel" />
          <CoffeeOutlined v-else-if="currentBusiness.business_type === 'restaurant'" class="switcher-icon restaurant" />
          <ShopOutlined v-else class="switcher-icon" />
          <div class="switcher-text">
            <div class="switcher-title">
              {{ currentBusiness ? currentBusiness.business_name : t('sidebar.allBusinesses') }}
            </div>
            <div class="switcher-sub">
              {{
                currentBusiness
                  ? [businessTypeLabel(currentBusiness.business_type), currentBusiness.city].filter(Boolean).join(' · ')
                  : t('sidebar.portfolioView')
              }}
            </div>
          </div>
          <DownOutlined :class="['switcher-chevron', { rotated: switcherOpen }]" />
        </div>

        <!-- 下拉面板:真实注册业务按业态分组 -->
        <div v-if="switcherOpen" class="switcher-panel" @click.stop>
          <div
            :class="['panel-item', 'panel-all', { selected: userStore.selectedBusinessId === null }]"
            @click="selectBusiness(null)"
          >
            <HomeOutlined class="panel-item-icon" />
            <div class="panel-item-text">
              <div class="panel-item-title">{{ t('sidebar.allBusinesses') }}</div>
              <div class="panel-item-sub">{{ t('sidebar.portfolioOverview') }}</div>
            </div>
          </div>

          <template v-for="group in businessGroups" :key="group.type">
            <div class="panel-group-title">{{ businessTypeLabel(group.type) }}</div>
            <div
              v-for="business in group.businesses"
              :key="business.id"
              :class="['panel-item', { selected: userStore.selectedBusinessId === business.id }]"
              @click="selectBusiness(business.id)"
            >
              <BankOutlined v-if="business.business_type === 'hotel'" class="panel-item-icon hotel" />
              <CoffeeOutlined v-else-if="business.business_type === 'restaurant'" class="panel-item-icon restaurant" />
              <ShopOutlined v-else class="panel-item-icon" />
              <div class="panel-item-text">
                <div class="panel-item-title">{{ business.business_name }}</div>
                <div class="panel-item-sub">
                  {{ business.city || business.merchant_name }}
                </div>
              </div>
            </div>
          </template>

          <div v-if="userStore.businesses.length === 0" class="panel-empty">
            {{ t('sidebar.noBusinesses') }}
          </div>
        </div>
      </div>

      <!-- 菜单区(可滚动) -->
      <div class="sider-menu-wrap">
        <SideMenu />
      </div>

      <!-- 底部登出 -->
      <div class="sider-footer">
        <button class="logout-btn" @click="onLogout">
          <LogoutOutlined />
          <span>{{ t('header.logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- 右侧主区域 -->
    <a-layout class="layout-main">
      <a-layout-header class="layout-header">
        <AppHeader />
      </a-layout-header>
      <!-- 内容区域(多页签已移除:直接渲染当前路由页面) -->
      <a-layout-content class="layout-content">
        <SupportBanner />
        <a-alert v-if="userStore.profile?.bookingRestricted" :message="t('merchantStatus.suspended')" type="warning" show-icon />
        <router-view />
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style scoped lang="less">
.layout-container {
  display: flex;
  height: 100%;
}

// ===== 侧边栏:贯穿全高(原型 228px 白底) =====
.layout-sidebar {
  width: 228px;
  min-width: 228px;
  display: flex;
  flex-direction: column;
  background: var(--mtrip-bg-card);
  border-right: 1px solid var(--mtrip-border);
}

.sider-logo {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;

  .logo-text {
    display: flex;
    align-items: baseline;
    gap: 6px;

    .logo-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--mtrip-primary);
      line-height: 1;
    }

    .logo-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: var(--mtrip-text-aux);
      line-height: 1;
    }
  }
}

// ===== 业务切换器(沿用原型视觉:顶部紧贴 logo 区,卡片左右留 12px) =====
.switcher-area {
  position: relative;
  flex-shrink: 0;
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--mtrip-border);
}

.subject-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--mtrip-bg-soft);
  border: 1px solid var(--mtrip-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--mtrip-bg-hover);
  }

  .switcher-icon {
    font-size: 15px;
    color: #64748b;
    flex-shrink: 0;

    &.hotel {
      color: var(--mtrip-primary);
    }

    &.restaurant {
      color: #f59e0b;
    }
  }

  .switcher-text {
    flex: 1;
    min-width: 0;

    .switcher-title {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--mtrip-text-main);
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .switcher-sub {
      font-size: 10px;
      font-weight: 500;
      color: var(--mtrip-text-aux);
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .switcher-chevron {
    font-size: 10px;
    color: var(--mtrip-text-aux);
    flex-shrink: 0;
    transition: transform 0.2s ease;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

// ===== 下拉面板(原型:白底 + 边框 + 圆角 10px + 大阴影) =====
.switcher-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 12px;
  right: 12px;
  z-index: 100;
  padding: 6px;
  background: var(--mtrip-bg-card);
  border: 1px solid var(--mtrip-border);
  border-radius: 10px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);

  .panel-group-title {
    padding: 8px 10px 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--mtrip-text-aux);
  }

  .panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--mtrip-bg-hover);
    }

    // 选中态(原型:浅蓝底 + 蓝色细边框)
    &.selected {
      background: var(--mtrip-primary-light);
      border-color: var(--mtrip-primary);
    }

    .panel-item-icon {
      font-size: 14px;
      color: #64748b;
      flex-shrink: 0;

      &.hotel {
        color: var(--mtrip-primary);
      }

      &.restaurant {
        color: #f59e0b;
      }
    }

    .panel-item-text {
      flex: 1;
      min-width: 0;

      .panel-item-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--mtrip-text-main);
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .panel-item-sub {
        font-size: 10px;
        color: var(--mtrip-text-aux);
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .panel-empty {
    padding: 12px 10px 8px;
    color: var(--mtrip-text-aux);
    font-size: 11px;
    text-align: center;
  }
}

.sider-menu-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 0 0 12px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

// ===== 底部登出(原型:顶部 1px 分割线 + 菜单项样式按钮) =====
.sider-footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--mtrip-border);

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease;
    outline: none;

    &:hover {
      background: var(--mtrip-bg-hover);
    }
  }
}

// ===== 右侧主区域 =====
.layout-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--mtrip-bg-page);
}

.layout-header {
  height: 56px;
  line-height: 56px;
  padding: 0;
  border-bottom: 1px solid var(--mtrip-border);
}

.layout-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
</style>
