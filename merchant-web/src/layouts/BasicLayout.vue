<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import {
  BankOutlined,
  CoffeeOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import SupportBanner from '@/components/SupportBanner.vue';
import AppHeader from './components/AppHeader.vue';
import SideMenu from './components/SideMenu.vue';

const userStore = useUserStore();
const { t } = useI18n();

// ===== 物业切换器(原型 Property Switcher,假数据照搬原型) =====
interface PropertyItem {
  key: string;
  name: string;
  location: string;
  kind: 'hotel' | 'restaurant';
}

/** 原型假数据:All Properties + 3 酒店 + 2 餐厅 */
const properties: PropertyItem[] = [
  { key: 'horizon', name: 'The Horizon Resort', location: 'Phuket, Thailand', kind: 'hotel' },
  { key: 'lagoon', name: 'Blue Lagoon Boutique', location: 'Koh Samui, Thailand', kind: 'hotel' },
  { key: 'cityview', name: 'Cityview Business Hotel', location: 'Bangkok, Thailand', kind: 'hotel' },
  { key: 'terrace', name: 'The Terrace Kitchen', location: 'Phuket, Thailand', kind: 'restaurant' },
  { key: 'rooftop', name: 'Horizon Rooftop Dining', location: 'Koh Samui, Thailand', kind: 'restaurant' },
];

const switcherOpen = ref(false);
/** 当前选中的物业 key('' = All Properties) */
const currentKey = ref('');

const currentProperty = computed(() => properties.find((p) => p.key === currentKey.value));

function toggleSwitcher(): void {
  switcherOpen.value = !switcherOpen.value;
}

function selectProperty(key: string): void {
  currentKey.value = key;
  switcherOpen.value = false;
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

      <!-- 物业切换器(原型 Property Switcher + 下拉面板,假数据) -->
      <div class="switcher-area">
        <div :class="['subject-switcher', { open: switcherOpen }]" @click="toggleSwitcher">
          <HomeOutlined v-if="!currentProperty" class="switcher-icon" />
          <BankOutlined v-else-if="currentProperty.kind === 'hotel'" class="switcher-icon hotel" />
          <CoffeeOutlined v-else class="switcher-icon restaurant" />
          <div class="switcher-text">
            <div class="switcher-title">
              {{ currentProperty ? currentProperty.name : t('sidebar.allProperties') }}
            </div>
            <div class="switcher-sub">
              {{
                currentProperty
                  ? `${currentProperty.kind === 'hotel' ? t('sidebar.hotel') : t('sidebar.restaurant')} · ${currentProperty.location}`
                  : t('sidebar.portfolioView')
              }}
            </div>
          </div>
          <DownOutlined :class="['switcher-chevron', { rotated: switcherOpen }]" />
        </div>

        <!-- 下拉面板(原型:当前项高亮 + HOTELS/RESTAURANTS 分组 + Add New Property) -->
        <div v-if="switcherOpen" class="switcher-panel" @click.stop>
          <!-- All Properties 条目(选中态:浅蓝底 + 蓝色细边框) -->
          <div
            :class="['panel-item', 'panel-all', { selected: currentKey === '' }]"
            @click="selectProperty('')"
          >
            <HomeOutlined class="panel-item-icon" />
            <div class="panel-item-text">
              <div class="panel-item-title">{{ t('sidebar.allProperties') }}</div>
              <div class="panel-item-sub">{{ t('sidebar.portfolioOverview') }}</div>
            </div>
          </div>

          <!-- HOTELS 分组 -->
          <div class="panel-group-title">{{ t('sidebar.hotels') }}</div>
          <div
            v-for="p in properties.filter((x) => x.kind === 'hotel')"
            :key="p.key"
            :class="['panel-item', { selected: currentKey === p.key }]"
            @click="selectProperty(p.key)"
          >
            <BankOutlined class="panel-item-icon hotel" />
            <div class="panel-item-text">
              <div class="panel-item-title">{{ p.name }}</div>
              <div class="panel-item-sub">{{ p.location }}</div>
            </div>
          </div>

          <!-- RESTAURANTS 分组 -->
          <div class="panel-group-title">{{ t('sidebar.restaurants') }}</div>
          <div
            v-for="p in properties.filter((x) => x.kind === 'restaurant')"
            :key="p.key"
            :class="['panel-item', { selected: currentKey === p.key }]"
            @click="selectProperty(p.key)"
          >
            <CoffeeOutlined class="panel-item-icon restaurant" />
            <div class="panel-item-text">
              <div class="panel-item-title">{{ p.name }}</div>
              <div class="panel-item-sub">{{ p.location }}</div>
            </div>
          </div>

          <!-- 底部操作项 -->
          <div class="panel-add">+ {{ t('sidebar.addProperty') }}</div>
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

// ===== 物业切换器(原型:顶部紧贴 logo 区,卡片左右留 12px,底部分割线贯穿侧边栏全宽) =====
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

  .panel-add {
    margin-top: 4px;
    padding: 8px 10px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: var(--mtrip-primary);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--mtrip-primary-light);
    }
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
