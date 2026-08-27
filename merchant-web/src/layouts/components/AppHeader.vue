<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  GlobalOutlined,
  LockOutlined,
  LogoutOutlined,
  RightOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { apiUpdatePassword } from '@/api/auth';
import { apiNotificationSummary } from '@/api/notifications';
import { resolveMenuTitle } from '@/locales/menuI18n';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/locales';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const unreadCount = ref(0);

const displayName = computed(() => userStore.profile?.realName || userStore.profile?.username || '-');

/** 当前语言 key,用于下拉菜单选中态 */
const currentLocale = computed(() => locale.value as SupportedLocale);

/** 当前语言展示名(显示在按钮文字中) */
const currentLocaleLabel = computed(
  () => SUPPORTED_LOCALES.find((item) => item.key === currentLocale.value)?.label ?? '',
);

/** 切换语言:写入 localStorage 并即时切换 i18n locale */
function onSwitchLanguage(key: SupportedLocale): void {
  if (key === currentLocale.value) return;
  locale.value = key;
  localStorage.setItem('mtrip_merchant_locale', key);
}

/** a-menu 点击事件:从 key 字段取出选中的语言 */
function onMenuClick(info: { key: string }): void {
  onSwitchLanguage(info.key as SupportedLocale);
}

/** 面包屑当前页名(与页面标题同一套解析:词条 key → 中英回退) */
const currentPage = computed(() =>
  resolveMenuTitle(
    (route.meta.title as string) || '',
    (route.meta.rawTitle as string) || '',
    (route.meta.rawTitleEn as string) || '',
  ),
);

function onLogout(): void {
  Modal.confirm({
    title: t('header.logoutConfirm'),
    okType: 'danger',
    onOk: async () => {
      const support = !!userStore.profile?.impersonation;
      await userStore.logout();
      window.location.href = support ? '/support-session' : '/login';
    },
  });
}

async function loadUnreadCount(): Promise<void> {
  try {
    const data = await apiNotificationSummary();
    unreadCount.value = data.unread;
  } catch {
    unreadCount.value = 0;
  }
}

// ===== 修改密码弹窗 =====
const pwdOpen = ref(false);
const pwdLoading = ref(false);
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });

async function onSubmitPassword(): Promise<void> {
  const { oldPassword, newPassword, confirmPassword } = pwdForm.value;
  if (!oldPassword || !newPassword) {
    message.warning(t('common.required'));
    return;
  }
  if (newPassword !== confirmPassword) {
    message.warning(t('header.passwordMismatch'));
    return;
  }
  pwdLoading.value = true;
  try {
    await apiUpdatePassword(oldPassword, newPassword);
    message.success(t('header.changeSuccess'));
    pwdOpen.value = false;
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    // 改密后需重新登录
    await userStore.logout();
    window.location.href = '/login';
  } finally {
    pwdLoading.value = false;
  }
}

onMounted(() => {
  void loadUnreadCount();
});
</script>

<template>
  <div class="app-header">
    <!-- 面包屑(原型:mTrip › 当前页) -->
    <div class="breadcrumb">
      <span class="crumb-root">mTrip</span>
      <RightOutlined class="crumb-arrow" />
      <span class="crumb-current">{{ currentPage }}</span>
    </div>

    <div class="header-space" />

    <!-- 搜索框(原型:176px 浅灰底,视觉占位) -->
    <div class="header-search">
      <SearchOutlined class="search-icon" />
      <input class="search-input" type="text" :placeholder="t('header.searchPlaceholder')" />
    </div>

    <!-- 通知铃铛(原型:32px 按钮 + 右上红点) -->
    <a-tooltip :title="t('header.notifications')">
      <button class="bell-btn" type="button" @click="router.push('/notifications')">
        <BellOutlined class="bell-icon" />
        <span v-if="unreadCount > 0" class="bell-dot" />
        <span v-if="unreadCount > 0" class="bell-count">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
    </a-tooltip>

    <!-- 语言切换(地球图标 + 当前语言名 + 下拉菜单) -->
    <a-dropdown :trigger="['click']">
      <a-tooltip :title="t('header.switchLanguage')">
        <button class="lang-btn" type="button">
          <GlobalOutlined class="lang-icon" />
          <span class="lang-name">{{ currentLocaleLabel }}</span>
          <DownOutlined class="lang-chevron" />
        </button>
      </a-tooltip>
      <template #overlay>
        <a-menu :selected-keys="[currentLocale]" @click="onMenuClick">
          <a-menu-item v-for="item in SUPPORTED_LOCALES" :key="item.key">
            <span class="lang-menu-label">
              <CheckOutlined v-if="item.key === currentLocale" class="lang-menu-check" />
              <span v-else class="lang-menu-check-placeholder" />
              {{ item.label }}
            </span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <!-- 用户区(原型:28px 蓝底圆头像 + 用户名 + chevron) -->
    <a-dropdown :trigger="['click']">
      <span class="header-user">
        <span class="user-avatar"><UserOutlined /></span>
        <span class="user-name">{{ displayName }}</span>
        <DownOutlined class="user-chevron" />
      </span>
      <template #overlay>
        <a-menu>
          <a-menu-item v-if="!userStore.profile?.impersonation" key="password" @click="pwdOpen = true">
            <LockOutlined /> {{ t('header.changePassword') }}
          </a-menu-item>
          <a-menu-divider />
          <a-menu-item key="logout" @click="onLogout">
            <LogoutOutlined /> {{ t('header.logout') }}
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <!-- 修改密码弹窗 -->
    <a-modal
      v-model:open="pwdOpen"
      :title="t('header.changePassword')"
      :confirm-loading="pwdLoading"
      @ok="onSubmitPassword"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('header.oldPassword')" required>
          <a-input-password v-model:value="pwdForm.oldPassword" autocomplete="current-password" />
        </a-form-item>
        <a-form-item :label="t('header.newPassword')" required>
          <a-input-password v-model:value="pwdForm.newPassword" autocomplete="new-password" />
        </a-form-item>
        <a-form-item :label="t('header.confirmPassword')" required>
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
  gap: 16px;
  height: 56px;
  padding: 0 20px;
}

// ===== 面包屑(原型:13px,mTrip 灰 / 箭头浅灰 / 当前页加粗深色) =====
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;

  .crumb-root {
    color: var(--mtrip-text-aux);
  }

  .crumb-arrow {
    font-size: 11px;
    color: #cbd5e1;
  }

  .crumb-current {
    font-weight: 600;
    color: var(--mtrip-text-main);
  }
}

.header-space {
  flex: 1;
}

// ===== 搜索框(原型:176px,浅灰底 #F8FAFC,圆角 8px,12px 字) =====
.header-search {
  position: relative;
  width: 176px;
  flex-shrink: 0;

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: var(--mtrip-text-aux);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 31px;
    padding: 6px 12px 6px 32px;
    border: 1px solid var(--mtrip-border);
    border-radius: 8px;
    background: var(--mtrip-bg-soft);
    font-size: 12px;
    font-family: inherit;
    color: var(--mtrip-text-main);
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;

    &::placeholder {
      color: var(--mtrip-text-aux);
    }

    &:focus {
      border-color: var(--mtrip-primary);
      background: var(--mtrip-bg-card);
    }
  }
}

// ===== 通知铃铛(原型:32px 圆角 8px,hover 浅灰,右上 8px 红点) =====
.bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;
  outline: none;

  &:hover {
    background: var(--mtrip-bg-hover);
  }

  .bell-icon {
    font-size: 15px;
    color: #64748b;
  }

  .bell-dot {
    position: absolute;
    top: 6px;
    right: 7px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
  }

  .bell-count {
    position: absolute;
    top: 1px;
    right: 1px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border: 2px solid #fff;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    line-height: 10px;
  }
}

// ===== 语言切换(地球图标 + 当前语言名 + chevron) =====
.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;
  outline: none;

  &:hover {
    background: var(--mtrip-bg-hover);
  }

  .lang-icon {
    font-size: 14px;
    color: #64748b;
  }

  .lang-name {
    font-size: 12px;
    font-weight: 500;
    color: #334155;
  }

  .lang-chevron {
    font-size: 10px;
    color: var(--mtrip-text-aux);
  }
}

.lang-menu-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  .lang-menu-check {
    font-size: 12px;
    color: var(--mtrip-primary);
  }

  .lang-menu-check-placeholder {
    width: 12px;
  }
}

// ===== 用户区(原型:28px 蓝底圆头像 + 12px 用户名 + chevron) =====
.header-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  cursor: pointer;

  .user-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #dbeafe;
    color: var(--mtrip-primary);
    font-size: 13px;
    flex-shrink: 0;
  }

  .user-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    color: #334155;
  }

  .user-chevron {
    font-size: 10px;
    color: var(--mtrip-text-aux);
  }
}
</style>
