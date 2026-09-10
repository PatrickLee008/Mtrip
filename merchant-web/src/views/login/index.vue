<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { LockOutlined, LoginOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { apiTwoFaSetup, apiTwoFaVerify, type SetupResult, type ChallengeResult } from '@/api/auth';
import mtripLogo from '@/assets/login/mtrip-logo.png';
import worldMapBackground from '@/assets/login/world-map-background.jpeg';

const REMEMBER_KEY = 'mtrip_merchant_remember';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useI18n();

const form = ref({ username: '', password: '', remember: true });
const loading = ref(false);
const challenge = ref<ChallengeResult | null>(null);
const setup = ref<SetupResult | null>(null);
const otp = ref('');
const currentYear = new Date().getFullYear();
function cancelTwoFa(): void { challenge.value = null; setup.value = null; otp.value = ''; form.value.password = ''; }
async function completeTwoFa(): Promise<void> {
  if (loading.value) return;
  if (!challenge.value || !/^[0-9]{6}$/.test(otp.value)) { message.warning(t('security.codeRequired')); return; }
  loading.value = true;
  try {
    const result = await apiTwoFaVerify(challenge.value.challengeToken, otp.value);
    userStore.acceptSession(result);
    cancelTwoFa();
    message.success(t('login.success'));
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
  } finally { otp.value = ''; loading.value = false; }
}

onMounted(() => {
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (remembered) {
    form.value.username = remembered;
  }
});

async function onSubmit(): Promise<void> {
  if (loading.value) return;
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
    const pending = await userStore.login(form.value.username.trim(), form.value.password);
    form.value.password = '';
    setup.value = pending.requiresEnrollment ? await apiTwoFaSetup(pending.challengeToken) : null;
    challenge.value = pending;
    if (form.value.remember) {
      localStorage.setItem(REMEMBER_KEY, form.value.username.trim());
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <header class="login-header">
      <span class="login-logo">
        <img :src="mtripLogo" alt="mTrip" />
      </span>
    </header>

    <main class="login-main" :style="{ backgroundImage: `url(${worldMapBackground})` }">
      <div class="login-card">
        <div class="login-card-header">
          <h1>{{ t('login.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>

        <div class="login-card-body">
          <section class="login-form-column">
            <h2>{{ t(challenge ? 'login.otpAccess' : 'login.accountAccess') }}</h2>

            <a-form v-if="!challenge" class="login-form" layout="vertical" @keyup.enter="onSubmit">
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
              <div class="login-form-options">
                <a-checkbox v-model:checked="form.remember">{{ t('login.remember') }}</a-checkbox>
              </div>
              <a-button class="login-submit" type="primary" size="large" block :loading="loading" @click="onSubmit">
                <LoginOutlined />
                {{ t('login.submit') }}
              </a-button>
            </a-form>

            <a-form v-else class="login-form" layout="vertical" @keyup.enter="completeTwoFa">
              <p class="login-step-description">{{ t('login.otpDescription') }}</p>
              <a-form-item :label="t('security.code')">
                <a-input
                  v-model:value="otp"
                  class="otp-input"
                  size="large"
                  :maxlength="6"
                  :placeholder="t('security.codeRequired')"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
              </a-form-item>
              <a-button class="login-submit" type="primary" size="large" block :loading="loading" @click="completeTwoFa">
                <SafetyCertificateOutlined />
                {{ t('security.verify') }}
              </a-button>
              <a-button class="login-back" type="link" block :disabled="loading" @click="cancelTwoFa">
                {{ t('security.back') }}
              </a-button>
            </a-form>
          </section>

          <div class="login-divider" aria-hidden="true">
            <span>{{ t('login.twoFaBadge') }}</span>
          </div>

          <aside class="login-security-panel">
            <template v-if="setup">
              <h2>{{ t('security.enroll') }}</h2>
              <div class="enrollment-qr">
                <a-qrcode :value="setup.otpauthUri" :size="166" :bordered="false" />
              </div>
              <p>{{ t('security.keepPrivate') }}</p>
              <div class="manual-key">
                <span>{{ t('security.manualKey') }}</span>
                <code>{{ setup.manualKey }}</code>
              </div>
            </template>
            <template v-else>
              <h2>{{ t('login.securityTitle') }}</h2>
              <div class="security-icon"><SafetyCertificateOutlined /></div>
              <p>{{ t(challenge ? 'login.verifyDescription' : 'login.securityDescription') }}</p>
            </template>
          </aside>
        </div>
      </div>
    </main>

    <footer class="login-footer">
      <strong>{{ t('login.copyright', { year: currentYear }) }}</strong>
    </footer>
  </div>
</template>

<style scoped lang="less">
.login-page {
  --login-primary: #4169ed;
  --login-background: #ebf0ff;
  --login-text: #1b1d30;
  --login-muted: rgba(25, 26, 37, 0.5);
  display: flex;
  min-height: 100%;
  flex-direction: column;
  background: #f7f8fa;
  color: var(--login-text);
}

.login-header {
  z-index: 1;
  display: flex;
  min-height: 55px;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #c3c6d6;
  background: var(--login-primary);
}

.login-logo {
  position: relative;
  display: block;
  width: 68px;
  height: 42px;
  overflow: hidden;

  img {
    position: absolute;
    top: -72.73%;
    left: -40.3%;
    width: 180.6%;
    height: 245.45%;
    max-width: none;
  }
}

.login-main {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 36px 32px;
  background-color: #f7f8fa;
  background-position: center;
  background-repeat: repeat;
  background-size: 512px 279px;
}

.login-main::before {
  position: absolute;
  inset: 0;
  background: rgba(247, 248, 250, 0.38);
  content: '';
}

.login-card {
  position: relative;
  width: min(900px, 100%);
  overflow: hidden;
  border: 1px solid var(--mtrip-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.login-card-header {
  padding: 24px 40px 25px;
  border-bottom: 1px solid var(--mtrip-border);
  background: var(--login-background);
  text-align: center;

  h1 {
    margin: 0;
    color: var(--login-text);
    font-family: 'Space Grotesk', 'Plus Jakarta Sans', Inter, sans-serif;
    font-size: 32px;
    font-weight: 700;
    line-height: 40px;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    color: var(--login-muted);
    font-size: 16px;
    line-height: 24px;
  }
}

.login-card-body {
  display: grid;
  min-height: 438px;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1.15fr);
  gap: 40px;
  padding: 40px;
}

.login-form-column {
  min-width: 0;

  h2,
  .login-security-panel h2 {
    margin: 0 0 24px;
    color: var(--login-primary);
    font-family: 'Space Grotesk', 'Plus Jakarta Sans', Inter, sans-serif;
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
  }
}

.login-form {
  :deep(.ant-form-item) {
    margin-bottom: 24px;
  }

  :deep(.ant-form-item-label) {
    padding-bottom: 4px;
  }

  :deep(.ant-form-item-label > label) {
    height: 16px;
    color: var(--login-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input) {
    min-height: 48px;
    border-color: var(--mtrip-border);
    border-radius: 0;
    background: #fff;
    box-shadow: none;
  }

  :deep(.ant-input-affix-wrapper-focused),
  :deep(.ant-input:focus) {
    border-color: var(--login-primary);
    box-shadow: 0 0 0 2px rgba(65, 105, 237, 0.1);
  }
}

.login-form-options {
  min-height: 40px;
  margin-top: -8px;
  color: var(--login-muted);

  :deep(.ant-checkbox-wrapper) {
    color: var(--login-muted);
    font-size: 14px;
  }
}

.login-submit {
  height: 48px;
  border-color: var(--login-primary);
  border-radius: 0;
  background: var(--login-primary);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;

  &:hover,
  &:focus {
    border-color: #3159e4 !important;
    background: #3159e4 !important;
  }
}

.login-back {
  margin-top: 8px;
  color: var(--login-primary);
}

.login-step-description {
  min-height: 40px;
  margin: 0 0 24px;
  color: var(--login-muted);
  font-size: 14px;
  line-height: 20px;
}

.otp-input {
  text-align: center;
  letter-spacing: 0.12em;
}

.login-divider {
  position: relative;
  display: flex;
  width: 1px;
  align-items: center;
  justify-content: center;
  background: var(--mtrip-border);

  span {
    padding: 5px;
    border: 1px solid var(--mtrip-border);
    border-radius: 999px;
    background: #fff;
    color: var(--login-muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    line-height: 16px;
  }
}

.login-security-panel {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  flex-direction: column;
  padding: 24px;
  border: 1px dashed var(--mtrip-border);
  border-radius: 8px;
  text-align: center;

  h2 {
    align-self: flex-start;
    margin: 0 0 24px;
    color: var(--login-primary);
    font-family: 'Space Grotesk', 'Plus Jakarta Sans', Inter, sans-serif;
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
  }

  p {
    max-width: 270px;
    margin: 16px auto 0;
    color: var(--login-muted);
    font-size: 14px;
    line-height: 20px;
  }
}

.security-icon {
  display: flex;
  width: 112px;
  height: 112px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mtrip-border);
  border-radius: 8px;
  background: #f7faff;
  color: var(--login-primary);
  font-size: 58px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.enrollment-qr {
  display: flex;
  width: 192px;
  height: 192px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mtrip-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.manual-key {
  width: 100%;
  margin-top: 14px;
  color: var(--login-muted);
  font-size: 12px;
  text-align: left;

  code {
    display: block;
    margin-top: 4px;
    overflow-wrap: anywhere;
    color: var(--login-text);
  }
}

.login-footer {
  display: flex;
  min-height: 74px;
  align-items: center;
  padding: 0 32px;
  border-top: 1px solid var(--mtrip-border);
  background: var(--login-background);

  strong {
    color: var(--login-text);
    font-size: 14px;
    letter-spacing: 0.01em;
  }
}

@media (max-width: 760px) {
  .login-main {
    padding: 24px 16px;
  }

  .login-card-header {
    padding: 24px;

    h1 {
      font-size: 26px;
      line-height: 34px;
    }

    p {
      white-space: normal;
    }
  }

  .login-card-body {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 24px;
  }

  .login-divider {
    width: 100%;
    height: 1px;
  }

  .login-security-panel {
    min-height: 300px;
  }

  .login-footer {
    min-height: 60px;
    justify-content: center;
    padding: 12px 20px;
    text-align: center;
  }
}

@media (max-height: 760px) and (min-width: 761px) {
  .login-main {
    align-items: flex-start;
    padding-top: 24px;
    padding-bottom: 24px;
  }
}
</style>
