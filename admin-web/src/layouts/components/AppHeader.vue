<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  BulbOutlined,
  BulbFilled,
  BellOutlined,
  UserOutlined,
  LockOutlined,
  LogoutOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { apiUpdatePassword } from '@/api/auth';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/locales';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';

const appStore = useAppStore();
const userStore = useUserStore();
const router = useRouter();
const { t } = useI18n();

const displayName = computed(() => userStore.profile?.realName || userStore.profile?.username || '-');

/** 语言切换(模板内禁用类型标注/as 断言,回调放 script 具名函数) */
function onLocaleClick(e: { key: string | number }): void {
  appStore.setLocale(String(e.key) as SupportedLocale);
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
    <!-- Logo 区:点击回数据大屏(UI 方案 3.1) -->
    <div class="logo" @click="router.push('/dashboard')">
      <span class="logo-badge">M</span>
      <span class="logo-title">{{ t('app.title') }}</span>
    </div>

    <span class="header-action" @click="appStore.toggleCollapsed()">
      <MenuFoldOutlined v-if="!appStore.collapsed" />
      <MenuUnfoldOutlined v-else />
    </span>

    <div class="header-space" />

    <!-- 站点切换(超管可切换,站点管理员锁定) -->
    <div class="site-switch">
      <SiteTreeSelect
        v-model:value="appStore.siteId"
        :disabled="!userStore.isSuper"
        :allow-all="userStore.isSuper"
        style="width: 200px"
        @change="(v: number) => appStore.setSiteId(v)"
      />
    </div>

    <!-- 待办铃铛(角标数据由模块05/07接入) -->
    <a-badge :count="0" :offset="[-2, 6]">
      <span class="header-action"><BellOutlined /></span>
    </a-badge>

    <!-- 主题切换 -->
    <a-tooltip :title="appStore.theme === 'light' ? t('app.darkTheme') : t('app.lightTheme')">
      <span class="header-action" @click="appStore.toggleTheme()">
        <BulbFilled v-if="appStore.theme === 'dark'" />
        <BulbOutlined v-else />
      </span>
    </a-tooltip>

    <!-- 语言切换(下拉,支持英文/中文切换) -->
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

    <!-- 个人账号区 -->
    <a-dropdown>
      <span class="header-user">
        <a-avatar size="small" :src="userStore.profile?.avatar || undefined">
          <template #icon><UserOutlined /></template>
        </a-avatar>
        <span class="user-name">{{ displayName }}</span>
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
  height: 48px;
  padding: 0 16px;
  gap: 4px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
  cursor: pointer;
  white-space: nowrap;

  .logo-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--mtrip-primary);
    color: #fff;
    font-weight: 700;
    font-size: 16px;
  }

  .logo-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.header-space {
  flex: 1;
}

.site-switch {
  margin-right: 8px;
}

.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.header-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .user-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
