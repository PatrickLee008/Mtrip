<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { MailOutlined, MobileOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  apiRecoveryChallenge,
  apiRecoveryTotpSetup,
  apiRecoveryTotpVerify,
  apiRecoveryVerify,
  type AuthChallengeResult,
  type SetupResult,
} from '@/api/auth';
import PublicAuthLayout from '@/components/PublicAuthLayout.vue';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();
const currentYear = new Date().getFullYear();
const step = ref(0);
const method = ref<'email' | 'sms'>('email');
const identifier = ref('');
const challenge = ref<AuthChallengeResult | null>(null);
const otpCode = ref('');
const recoveryToken = ref('');
const setup = ref<SetupResult | null>(null);
const totpCode = ref('');
const loading = ref(false);

async function requestRecovery(): Promise<void> {
  if (loading.value) return;
  if (!identifier.value.trim()) {
    message.warning(t(`login.identifierRequired.${method.value}`));
    return;
  }
  loading.value = true;
  try {
    challenge.value = await apiRecoveryChallenge(method.value, identifier.value.trim());
    step.value = 1;
  } finally {
    loading.value = false;
  }
}

async function verifyContact(): Promise<void> {
  if (loading.value || !challenge.value) return;
  if (!/^\d{6}$/.test(otpCode.value)) {
    message.warning(t('login.otpRequired'));
    return;
  }
  loading.value = true;
  try {
    const result = await apiRecoveryVerify(challenge.value.challengeToken, otpCode.value);
    recoveryToken.value = result.recoveryToken;
    setup.value = await apiRecoveryTotpSetup(result.recoveryToken);
    otpCode.value = '';
    step.value = 2;
  } finally {
    loading.value = false;
  }
}

async function finishRecovery(): Promise<void> {
  if (loading.value || !setup.value) return;
  if (!/^\d{6}$/.test(totpCode.value)) {
    message.warning(t('security.codeRequired'));
    return;
  }
  loading.value = true;
  try {
    userStore.acceptSession(await apiRecoveryTotpVerify(recoveryToken.value, totpCode.value));
    message.success(t('recovery.completed'));
    await router.replace('/');
  } finally {
    totpCode.value = '';
    loading.value = false;
  }
}
</script>

<template>
  <PublicAuthLayout :eyebrow="t('recovery.eyebrow')" :title="t('recovery.title')" :subtitle="t('recovery.subtitle')">
    <div class="recovery-section">
      <template v-if="step === 0">
        <h2>{{ t('recovery.identifyTitle') }}</h2>
        <p class="section-copy">{{ t('recovery.identifyCopy') }}</p>
        <div class="method-row">
          <button type="button" :class="{ active: method === 'email' }" @click="method = 'email'; identifier = ''"><MailOutlined />{{ t('login.methods.email') }}</button>
          <button type="button" :class="{ active: method === 'sms' }" @click="method = 'sms'; identifier = ''"><MobileOutlined />{{ t('login.methods.sms') }}</button>
        </div>
        <a-form class="auth-form" layout="vertical" @keyup.enter="requestRecovery">
          <a-form-item :label="t(`login.identifier.${method}`)"><a-input v-model:value="identifier" size="large" :autocomplete="method === 'email' ? 'email' : 'tel'" /></a-form-item>
          <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="requestRecovery">{{ t('recovery.sendOtp') }}</a-button>
        </a-form>
      </template>

      <template v-else-if="step === 1">
        <a-alert v-if="challenge?.testMode" type="warning" show-icon :message="t('login.testOtpHint')" style="margin-bottom: 16px" />
        <h2>{{ t('recovery.verifyTitle') }}</h2>
        <p class="section-copy">{{ t('recovery.sentTo', { recipient: challenge?.recipient }) }}</p>
        <a-alert type="info" show-icon :message="t('recovery.privacyNotice')" />
        <a-form class="auth-form spaced" layout="vertical" @keyup.enter="verifyContact">
          <a-form-item :label="t('login.otpCode')"><a-input v-model:value="otpCode" class="otp-input" size="large" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
          <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="verifyContact">{{ t('recovery.verifyOtp') }}</a-button>
          <a-button type="link" block :disabled="loading" @click="step = 0; challenge = null; otpCode = ''">{{ t('security.back') }}</a-button>
        </a-form>
      </template>

      <template v-else>
        <h2>{{ t('recovery.authenticatorTitle') }}</h2>
        <p class="section-copy">{{ t('recovery.authenticatorCopy') }}</p>
        <div v-if="setup" class="totp-setup">
          <a-qrcode :value="setup.otpauthUri" :size="165" :bordered="false" />
          <div><span>{{ t('security.manualKey') }}</span><code>{{ setup.manualKey }}</code></div>
        </div>
        <a-alert type="warning" show-icon :message="t('recovery.sessionNotice')" />
        <a-form class="auth-form spaced" layout="vertical" @keyup.enter="finishRecovery">
          <a-form-item :label="t('security.code')"><a-input v-model:value="totpCode" class="otp-input" size="large" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
          <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="finishRecovery">{{ t('recovery.finish') }}</a-button>
        </a-form>
      </template>
    </div>

    <template #aside>
      <div class="recovery-panel">
        <div class="shield"><SafetyCertificateOutlined /></div>
        <h2>{{ t('recovery.asideTitle') }}</h2>
        <p>{{ t('recovery.asideCopy') }}</p>
        <ol><li :class="{ active: step === 0, done: step > 0 }"><span>1</span>{{ t('recovery.steps.contact') }}</li><li :class="{ active: step === 1, done: step > 1 }"><span>2</span>{{ t('recovery.steps.otp') }}</li><li :class="{ active: step === 2 }"><span>3</span>{{ t('recovery.steps.authenticator') }}</li></ol>
        <router-link to="/login">{{ t('activation.backToLogin') }}</router-link>
      </div>
    </template>
    <template #footer>{{ t('login.copyright', { year: currentYear }) }}</template>
  </PublicAuthLayout>
</template>

<style scoped lang="less">
.recovery-section h2 { margin: 0 0 5px; font-size: 22px; }
.section-copy { margin: 0 0 24px; color: #64748b; font-size: 13px; line-height: 20px; }
.method-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; button { display: flex; min-height: 62px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: #64748b; cursor: pointer; &.active { border-color: #0d9488; background: #effcf9; color: #08756f; box-shadow: inset 0 -2px #0d9488; } } }
.auth-form { :deep(.ant-form-item) { margin-bottom: 18px; } :deep(.ant-form-item-label > label) { color: #14213d; font-size: 13px; font-weight: 650; } :deep(.ant-input) { min-height: 46px; border-radius: 6px; } }
.spaced { margin-top: 20px; }
.primary-action { min-height: 46px; border-color: #0d9488; border-radius: 6px; background: #0d9488; font-weight: 650; &:hover, &:focus { border-color: #08756f !important; background: #08756f !important; } }
.otp-input { text-align: center; letter-spacing: .25em; }
.totp-setup { display: grid; grid-template-columns: 185px 1fr; align-items: center; gap: 18px; margin-bottom: 18px; padding: 16px; border: 1px solid #bce6df; border-radius: 9px; background: #f3fcfa; span { color: #64748b; font-size: 11px; } code { display: block; margin-top: 6px; overflow-wrap: anywhere; color: #14213d; font-size: 12px; } }
.recovery-panel { display: flex; width: 100%; align-items: center; justify-content: center; flex-direction: column; padding: 28px; border: 1px solid #cfe5df; border-radius: 10px; background: linear-gradient(160deg, #f4fcfa, #edf5ff); text-align: center; .shield { display: flex; width: 84px; height: 84px; align-items: center; justify-content: center; border-radius: 50%; background: #fff; color: #0d9488; font-size: 42px; box-shadow: 0 8px 24px rgba(13,148,136,.12); } h2 { margin: 16px 0 7px; color: #15305c; font-size: 19px; } p { margin: 0; color: #64748b; font-size: 12px; line-height: 19px; } ol { width: 100%; margin: 24px 0; padding: 16px 0; border-top: 1px solid #dbe4f0; border-bottom: 1px solid #dbe4f0; list-style: none; text-align: left; } li { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: #94a3b8; font-size: 12px; &.active, &.done { color: #15305c; font-weight: 650; } span { display: flex; width: 23px; height: 23px; align-items: center; justify-content: center; border: 1px solid currentColor; border-radius: 50%; font-size: 10px; } &.done span { border-color: #0d9488; background: #0d9488; color: #fff; } } a { color: #2463eb; font-size: 12px; } }
@media (max-width: 520px) { .totp-setup { grid-template-columns: 1fr; justify-items: center; text-align: center; } }
</style>
