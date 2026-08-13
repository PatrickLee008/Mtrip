<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ShopOutlined, LogoutOutlined } from '@ant-design/icons-vue';
import { Modal } from 'ant-design-vue';
import { useUserStore } from '@/stores/user';
import AppHeader from './components/AppHeader.vue';
import SideMenu from './components/SideMenu.vue';

const userStore = useUserStore();
const { t } = useI18n();

const userInitials = computed(() => {
  const name = userStore.profile?.realName || userStore.profile?.username || 'Admin';
  return name.slice(0, 2).toUpperCase();
});

/** 环境徽标(原型:绿色圆点 + Production · v4.2.1,这里按真实环境显示) */
const envLabel = import.meta.env.PROD ? 'Production' : 'Development';
const envVersion = 'v1.0';

function onLogout(): void {
  Modal.confirm({
    title: t('user.logoutConfirm'),
    okType: 'danger',
    onOk: async () => {
      await userStore.logout();
      window.location.href = '/login';
    },
  });
}
</script>

<template>
  <div class="layout-container">
    <!-- 侧边栏:贯穿整个页面高度(原型 228px 深色导航) -->
    <aside class="layout-sidebar">
      <!-- Logo 区 -->
      <div class="sider-logo">
        <div class="logo-icon">
          <ShopOutlined />
        </div>
        <div class="logo-text">
          <div class="logo-title">mTrip</div>
          <div class="logo-subtitle">Super Admin Portal</div>
        </div>
      </div>

      <!-- 环境徽标(原型 Production · v4.2.1) -->
      <div class="sider-env">
        <span class="env-badge">
          <span class="env-dot" />
          <span class="env-label">{{ envLabel }} · {{ envVersion }}</span>
        </span>
      </div>

      <!-- 菜单区(可滚动) -->
      <div class="sider-menu-wrap">
        <SideMenu />
      </div>

      <!-- 底部用户信息 + 登出 -->
      <div class="sider-user">
        <div class="user-row">
          <div class="user-avatar">{{ userInitials }}</div>
          <div class="user-info">
            <div class="user-name">{{ userStore.profile?.realName || userStore.profile?.username || 'Admin' }}</div>
            <div class="user-email">{{ userStore.profile?.email || 'admin@mtrip.com' }}</div>
          </div>
        </div>
        <button class="logout-btn" @click="onLogout">
          <LogoutOutlined />
          <span>{{ t('user.logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- 右侧主区域 -->
    <a-layout class="layout-main">
      <a-layout-header class="layout-header">
        <AppHeader />
      </a-layout-header>
      <!-- 内容区域(多页签已取消:直接渲染当前路由页面) -->
      <a-layout-content class="layout-content">
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

// ===== 侧边栏:贯穿全高(原型 228px 深色) =====
.layout-sidebar {
  width: 228px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--sap-navy);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.sider-logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;

  .logo-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #1664ff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 15px;
    flex-shrink: 0;
  }

  .logo-text {
    .logo-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      line-height: 1;
    }

    .logo-subtitle {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.38);
      margin-top: 2px;
      line-height: 1;
    }
  }
}

// ===== 环境徽标(原型:蓝底胶囊 + 绿色圆点) =====
.sider-env {
  padding: 8px 16px 4px;
  flex-shrink: 0;

  .env-badge {
    width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    background: rgba(22, 100, 255, 0.14);
  }

  .env-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ade80;
    flex-shrink: 0;
  }

  .env-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
  }
}

.sider-menu-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

// ===== 底部用户区 + 登出 =====
.sider-user {
  flex-shrink: 0;
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);

  .user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #1664ff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;

    .user-name {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-email {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.33);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 32px;
    padding: 0 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;

    &:hover {
      background: rgba(239, 68, 68, 0.12);
      color: #fca5a5;
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
