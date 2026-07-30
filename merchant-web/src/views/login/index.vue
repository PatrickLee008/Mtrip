<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const REMEMBER_KEY = 'mtrip_merchant_remember';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useI18n();

const form = ref({ username: '', password: '', remember: true });
const loading = ref(false);

onMounted(() => {
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (remembered) {
    form.value.username = remembered;
  }
});

async function onSubmit(): Promise<void> {
  if (!form.value.username) {
    message.warning(t('login.usernameRequired'));
    return;
  }
  if (!form.value.password) {
    message.warning(t('login.passwordRequired'));
    return;
  }
  loading.value = true;
  try {
    await userStore.login(form.value.username.trim(), form.value.password);
    if (form.value.remember) {
      localStorage.setItem(REMEMBER_KEY, form.value.username.trim());
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    message.success(t('login.success'));
    const redirect = (route.query.redirect as string) || '/';
    await router.replace(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel mtrip-card-shadow">
      <div class="login-brand">
        <span class="logo-badge">M</span>
        <div class="brand-text">
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>
      </div>
      <a-form layout="vertical" @keyup.enter="onSubmit">
        <a-form-item :label="t('login.username')">
          <a-input v-model:value="form.username" size="large" :placeholder="t('login.usernameRequired')" autocomplete="username">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item :label="t('login.password')">
          <a-input-password
            v-model:value="form.password"
            size="large"
            :placeholder="t('login.passwordRequired')"
            autocomplete="current-password"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="form.remember">{{ t('login.remember') }}</a-checkbox>
        </a-form-item>
        <a-button type="primary" size="large" block :loading="loading" @click="onSubmit">
          {{ t('login.submit') }}
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<style scoped lang="less">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background:
    radial-gradient(circle at 20% 20%, rgba(22, 119, 255, 0.12), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(255, 125, 0, 0.08), transparent 40%),
    var(--mtrip-bg-page);
}

.login-panel {
  width: 400px;
  padding: 40px 36px 32px;
  border-radius: 8px;
  background: var(--mtrip-bg-card);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;

  .logo-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 10px;
    background: var(--mtrip-primary);
    color: #fff;
    font-size: 24px;
    font-weight: 700;
  }

  .brand-text {
    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      line-height: 26px;
    }

    p {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--mtrip-text-aux);
    }
  }
}
</style>
