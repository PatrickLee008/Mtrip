<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import {
  ReloadOutlined,
  QuestionCircleOutlined,
  BellOutlined,
  ApartmentOutlined,
  GlobalOutlined,
  DownOutlined,
  LockOutlined,
  LogoutOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { apiUpdatePassword } from '@/api/auth';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/locales';
import { menuTitle, resolveMenuTitle } from '@/locales/menuI18n';
import type { MenuNode } from '@/api/types';
import GlobalSearch from './GlobalSearch.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';

const appStore = useAppStore();
const userStore = useUserStore();
const route = useRoute();
const { t } = useI18n();

const displayName = computed(() => userStore.profile?.realName || userStore.profile?.username || '-');
const roleLabel = computed(() => (userStore.isSuper ? t('app.superAdmin') : t('app.siteAdmin')));
const userInitials = computed(() => displayName.value.slice(0, 2).toUpperCase());

// ===== 面包屑:由菜单树反查当前路由的层级链(Home / 一级 / 二级…) =====
interface Crumb {
  label: string;
}

const breadcrumbs = computed<Crumb[]>(() => {
  const crumbs: Crumb[] = [{ label: t('common.home') }];
  const byPath = new Map<string, MenuNode>();
  const parentById = new Map<number, MenuNode>();
  const walk = (nodes: MenuNode[], parent?: MenuNode): void => {
    for (const node of nodes) {
      if (node.route_path) byPath.set(node.route_path, node);
      if (parent) parentById.set(node.id, parent);
      if (node.children?.length) walk(node.children, node);
    }
  };
  walk(userStore.menus);

  const page = byPath.get(route.path);
  if (page) {
    const chain: MenuNode[] = [];
    let cur: MenuNode | undefined = page;
    while (cur) {
      chain.unshift(cur);
      cur = parentById.get(cur.id);
    }
    for (const node of chain) {
      crumbs.push({ label: menuTitle(node) });
    }
  } else {
    const display = resolveMenuTitle(
      (route.meta.title as string) || '',
      (route.meta.rawTitle as string) || '',
      (route.meta.rawTitleEn as string) || '',
    );
    if (display) crumbs.push({ label: display });
  }
  return crumbs;
});

const sitePanelOpen = ref(false);
const siteWrap = ref<HTMLDivElement | null>(null);
const sitePanel = ref<HTMLDivElement | null>(null);

function toggleSitePanel(): void {
  sitePanelOpen.value = !sitePanelOpen.value;
}

function sitePopupContainer(): HTMLElement {
  return sitePanel.value as HTMLElement;
}

function onSiteDocClick(e: MouseEvent): void {
  if (sitePanelOpen.value && siteWrap.value && !siteWrap.value.contains(e.target as Node)) {
    sitePanelOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onSiteDocClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onSiteDocClick);
});

// ===== 顶栏操作 =====
function onRefresh(): void {
  window.location.reload();
}

function onLocaleClick(e: { key: string | number }): void {
  appStore.setLocale(String(e.key) as SupportedLocale);
}

function onSiteChange(v: number): void {
  appStore.setSiteId(v);
  sitePanelOpen.value = false;
}

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

// ===== 修改密码弹窗 =====
const pwdOpen = ref(false);
const pwdLoading = ref(false);
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });

async function onSubmitPassword(): Promise<void> {
  const { oldPassword, newPassword, confirmPassword } = pwdForm.value;
  if (!oldPassword || !newPassword) {
    message.warning(t('user.passwordRule'));
    return;
  }
  if (newPassword !== confirmPassword) {
    message.warning(t('user.passwordMismatch'));
    return;
  }
  pwdLoading.value = true;
  try {
    await apiUpdatePassword(oldPassword, newPassword);
    message.success(t('tip.saveSuccess'));
    pwdOpen.value = false;
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  } finally {
    pwdLoading.value = false;
  }
}
</script>

<template>
  <div class="app-header">
    <!-- 面包屑(原型:Home / Group / Page) -->
    <div class="header-crumbs">
      <template v-for="(crumb, i) in breadcrumbs" :key="i">
        <span v-if="i > 0" class="crumb-sep">/</span>
        <span :class="['crumb', { active: i === breadcrumbs.length - 1 }]">{{ crumb.label }}</span>
      </template>
    </div>

    <GlobalSearch />

    <!-- 右侧操作区 -->
    <div class="header-right">
      <a-tooltip :title="t('common.refresh')">
        <span class="header-action" @click="onRefresh"><ReloadOutlined /></span>
      </a-tooltip>
      <a-tooltip :title="t('app.help')">
        <span class="header-action"><QuestionCircleOutlined /></span>
      </a-tooltip>

      <!-- 待办铃铛(角标数据由后端接入) -->
      <a-badge :count="0" :offset="[-2, 6]">
        <span class="header-action"><BellOutlined /></span>
      </a-badge>

      <!-- Site switch: icon opens a popup panel -->
      <div ref="siteWrap" class="site-switch-wrap">
        <a-tooltip :title="t('app.siteSwitch')">
          <span class="header-action" @click="toggleSitePanel"><ApartmentOutlined /></span>
        </a-tooltip>
        <div v-if="sitePanelOpen" ref="sitePanel" class="site-panel">
          <SiteTreeSelect
            v-model:value="appStore.siteId"
            :disabled="!userStore.isSuper"
            :allow-all="userStore.isSuper"
            :popup-container="sitePopupContainer"
            style="width: 240px"
            @change="onSiteChange"
          />
        </div>
      </div>

      <!-- 语言切换 -->
      <a-dropdown :trigger="['click']">
        <a-tooltip :title="t('app.language')">
          <span class="header-action"><GlobalOutlined /></span>
        </a-tooltip>
        <template #overlay>
          <a-menu :selected-keys="[appStore.locale]" @click="onLocaleClick">
            <a-menu-item v-for="loc in SUPPORTED_LOCALES" :key="loc.key">
              <CheckOutlined v-if="appStore.locale === loc.key" style="margin-right: 6px" />
              <span v-else style="display: inline-block; width: 16px" />
              {{ loc.label }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <div class="header-divider" />

      <!-- 个人账号区(原型:头像 + 姓名 + 角色 + 箭头) -->
      <a-dropdown>
        <span class="header-user">
          <span class="user-avatar">{{ userInitials }}</span>
          <span class="user-meta">
            <span class="user-name">{{ displayName }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </span>
          <DownOutlined class="user-caret" />
        </span>
        <template #overlay>
          <a-menu>
            <a-menu-item key="password" @click="pwdOpen = true">
              <LockOutlined /> {{ t('user.updatePassword') }}
            </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="logout" @click="onLogout">
              <LogoutOutlined /> {{ t('user.logout') }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <!-- 修改密码弹窗 -->
    <a-modal
      v-model:open="pwdOpen"
      :title="t('user.updatePassword')"
      :confirm-loading="pwdLoading"
      @ok="onSubmitPassword"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('user.oldPassword')" required>
          <a-input-password v-model:value="pwdForm.oldPassword" autocomplete="current-password" />
        </a-form-item>
        <a-form-item :label="t('user.newPassword')" required :extra="t('user.passwordRule')">
          <a-input-password v-model:value="pwdForm.newPassword" autocomplete="new-password" />
        </a-form-item>
        <a-form-item :label="t('user.confirmPassword')" required>
          <a-input-password v-model:value="pwdForm.confirmPassword" autocomplete="new-password" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="less">
.app-header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 20px;
  gap: 16px;
  background: var(--mtrip-bg-card);
  position: relative;
  z-index: 20;
}

// ===== 面包屑(原型:12px,灰 → 深色末级) =====
.header-crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;

  .crumb {
    font-size: 12px;
    color: var(--mtrip-text-aux);
    font-weight: 400;

    &.active {
      color: var(--mtrip-text-main);
      font-weight: 500;
    }
  }

  .crumb-sep {
    color: var(--mtrip-border);
    font-size: 12px;
  }
}

// ===== 右侧操作区(原型 32px 幽灵按钮) =====
.header-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
    color: #1a2332;
  }
}

.header-divider {
  width: 1px;
  height: 24px;
  background: var(--mtrip-border);
  margin: 0 6px;
}

.site-switch-wrap {
  position: relative;
  display: inline-flex;
}

.site-panel {
  position: absolute;
  top: 44px;
  right: 0;
  z-index: 2000;
  padding: 8px;
  border-radius: 8px;
  background: var(--mtrip-bg-card);
  border: 1px solid var(--mtrip-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

// ===== 个人账号区(原型:头像 + 姓名 + 角色 + 箭头) =====
.header-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #1664ff;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;

    .user-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--mtrip-text-main);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-role {
      font-size: 11px;
      color: var(--mtrip-text-aux);
    }
  }

  .user-caret {
    font-size: 12px;
    color: var(--mtrip-text-aux);
    flex-shrink: 0;
  }
}
</style>
