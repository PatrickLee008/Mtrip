<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { CheckCircleFilled, KeyOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  apiActivationFinish,
  apiActivationGoogleLink,
  apiActivationOtpSend,
  apiActivationOtpVerify,
  apiActivationStart,
  apiActivationTotpSetup,
  apiActivationTotpVerify,
  apiAuthConfig,
  type ActivationProfile,
  type AuthChallengeResult,
  type AuthConfig,
  type SetupResult,
} from '@/api/auth';
import GoogleIdentityButton from '@/components/GoogleIdentityButton.vue';
import PublicAuthLayout from '@/components/PublicAuthLayout.vue';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();
const currentYear = new Date().getFullYear();
const config = ref<AuthConfig | null>(null);
const step = ref(0);
const credentialMode = ref<'access_code' | 'temporary_password'>('access_code');
const credentials = ref({ accessCode: '', username: '', temporaryPassword: '' });
const activationToken = ref('');
const profile = ref<ActivationProfile | null>(null);
const channel = ref<'email' | 'sms'>('email');
const otpChallenge = ref<AuthChallengeResult | null>(null);
const otpCode = ref('');
const setup = ref<SetupResult | null>(null);
const totpCode = ref('');
const loading = ref(false);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const googleEnabled = computed(() => Boolean(config.value?.googleAvailable && googleClientId));
const canUseEmail = computed(() => Boolean(profile.value?.email));
const canUseSms = computed(() => Boolean(profile.value?.mobile));

async function startActivation(): Promise<void> {
  if (loading.value) return;
  if (credentialMode.value === 'access_code' && !credentials.value.accessCode.trim()) {
    message.warning(t('activation.accessCodeRequired'));
    return;
  }
  if (credentialMode.value === 'temporary_password' && (!credentials.value.username.trim() || !credentials.value.temporaryPassword)) {
    message.warning(t('activation.temporaryRequired'));
    return;
  }
  loading.value = true;
  try {
    const result = await apiActivationStart(credentialMode.value === 'access_code'
      ? { accessCode: credentials.value.accessCode.trim() }
      : { username: credentials.value.username.trim(), temporaryPassword: credentials.value.temporaryPassword });
    activationToken.value = result.activationToken;
    profile.value = result.profile;
    credentials.value.temporaryPassword = '';
    channel.value = canUseEmail.value ? 'email' : 'sms';
    step.value = 1;
  } finally {
    loading.value = false;
  }
}

async function sendOtp(): Promise<void> {
  if (loading.value || !activationToken.value) return;
  loading.value = true;
  try {
    otpChallenge.value = await apiActivationOtpSend(activationToken.value, channel.value);
    otpCode.value = '';
    message.success(t('activation.otpSent', { recipient: otpChallenge.value.recipient }));
  } finally {
    loading.value = false;
  }
}

async function verifyOtp(): Promise<void> {
  if (loading.value || !otpChallenge.value) return;
  if (!/^\d{6}$/.test(otpCode.value)) {
    message.warning(t('login.otpRequired'));
    return;
  }
  loading.value = true;
  try {
    const result = await apiActivationOtpVerify(otpChallenge.value.challengeToken, otpCode.value);
    activationToken.value = result.activationToken;
    profile.value = result.profile;
    otpChallenge.value = null;
    otpCode.value = '';
    step.value = 2;
  } finally {
    loading.value = false;
  }
}

async function prepareTotp(): Promise<void> {
  if (loading.value || !activationToken.value) return;
  loading.value = true;
  try {
    setup.value = await apiActivationTotpSetup(activationToken.value);
  } finally {
    loading.value = false;
  }
}

async function verifyTotp(): Promise<void> {
  if (loading.value || !setup.value || !/^\d{6}$/.test(totpCode.value)) {
    if (!loading.value) message.warning(t('security.codeRequired'));
    return;
  }
  loading.value = true;
  try {
    profile.value = await apiActivationTotpVerify(activationToken.value, totpCode.value);
    setup.value = null;
    totpCode.value = '';
    message.success(t('activation.authenticatorLinked'));
  } finally {
    loading.value = false;
  }
}

async function linkGoogle(idToken: string): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  try {
    profile.value = await apiActivationGoogleLink(activationToken.value, idToken);
    message.success(t('activation.googleLinked'));
  } finally {
    loading.value = false;
  }
}

async function finishActivation(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  try {
    userStore.acceptSession(await apiActivationFinish(activationToken.value));
    message.success(t('activation.completed'));
    await router.replace('/');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    config.value = await apiAuthConfig();
  } catch {
    config.value = null;
  }
});
</script>

<template>
  <PublicAuthLayout :eyebrow="t('activation.eyebrow')" :title="t('activation.title')" :subtitle="t('activation.subtitle')">
    <a-alert v-if="config?.testMode" type="warning" show-icon :message="t('login.testOtpHint')" style="margin-bottom: 16px" />
    <div v-if="step === 0" class="activation-section">
      <h2>{{ t('activation.identifyTitle') }}</h2>
      <p class="section-copy">{{ t('activation.identifyCopy') }}</p>
      <div class="choice-row">
        <button type="button" :class="{ active: credentialMode === 'access_code' }" @click="credentialMode = 'access_code'"><KeyOutlined />{{ t('activation.byAccessCode') }}</button>
        <button type="button" :class="{ active: credentialMode === 'temporary_password' }" @click="credentialMode = 'temporary_password'"><UserOutlined />{{ t('activation.byTemporaryPassword') }}</button>
      </div>
      <a-form class="auth-form" layout="vertical" @keyup.enter="startActivation">
        <a-form-item v-if="credentialMode === 'access_code'" :label="t('activation.accessCode')">
          <a-input v-model:value="credentials.accessCode" size="large" autocomplete="username" />
        </a-form-item>
        <template v-else>
          <a-form-item :label="t('activation.username')"><a-input v-model:value="credentials.username" size="large" autocomplete="username" /></a-form-item>
          <a-form-item :label="t('activation.temporaryPassword')"><a-input-password v-model:value="credentials.temporaryPassword" size="large" autocomplete="one-time-code" /></a-form-item>
        </template>
        <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="startActivation">{{ t('activation.continue') }}</a-button>
      </a-form>
    </div>

    <div v-else-if="step === 1" class="activation-section">
      <h2>{{ t('activation.verifyContactTitle') }}</h2>
      <p class="section-copy">{{ t('activation.verifyContactCopy') }}</p>
      <div class="profile-strip"><span>{{ profile?.username }}</span><strong>{{ profile?.email }}</strong><strong>{{ profile?.mobile }}</strong></div>
      <template v-if="!otpChallenge">
        <div class="channel-list">
          <label :class="{ disabled: !canUseEmail }"><input v-model="channel" type="radio" value="email" :disabled="!canUseEmail" /><span><strong>{{ t('login.methods.email') }}</strong><small>{{ profile?.email }}</small></span></label>
          <label :class="{ disabled: !canUseSms }"><input v-model="channel" type="radio" value="sms" :disabled="!canUseSms" /><span><strong>{{ t('login.methods.sms') }}</strong><small>{{ profile?.mobile }}</small></span></label>
        </div>
        <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="sendOtp">{{ t('activation.sendOtp') }}</a-button>
      </template>
      <a-form v-else class="auth-form" layout="vertical" @keyup.enter="verifyOtp">
        <a-alert type="success" show-icon :message="t('activation.otpSent', { recipient: otpChallenge.recipient })" />
        <a-form-item :label="t('login.otpCode')"><a-input v-model:value="otpCode" class="otp-input" size="large" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
        <a-button class="primary-action" type="primary" size="large" block :loading="loading" @click="verifyOtp">{{ t('activation.verifyOtp') }}</a-button>
      </a-form>
    </div>

    <div v-else class="activation-section">
      <h2>{{ t('activation.connectTitle') }}</h2>
      <p class="section-copy">{{ t('activation.connectCopy') }}</p>
      <div class="connection-card">
        <div><SafetyCertificateOutlined /><span><strong>{{ t('activation.authenticator') }}</strong><small>{{ t('activation.authenticatorHint') }}</small></span></div>
        <CheckCircleFilled v-if="profile?.methods.accessCode" class="connected" />
        <a-button v-else-if="!setup" :loading="loading" @click="prepareTotp">{{ t('activation.connect') }}</a-button>
      </div>
      <div v-if="setup" class="totp-setup">
        <a-qrcode :value="setup.otpauthUri" :size="150" :bordered="false" />
        <div><p>{{ t('security.keepPrivate') }}</p><code>{{ setup.manualKey }}</code><a-input v-model:value="totpCode" class="otp-input" :maxlength="6" inputmode="numeric" /><a-button type="primary" :loading="loading" @click="verifyTotp">{{ t('security.verify') }}</a-button></div>
      </div>
      <div class="connection-card">
        <div><UserOutlined /><span><strong>{{ t('activation.google') }}</strong><small>{{ t('activation.googleHint') }}</small></span></div>
        <CheckCircleFilled v-if="profile?.methods.google" class="connected" />
        <GoogleIdentityButton v-else-if="googleEnabled" class="google-button" :client-id="googleClientId" :disabled="loading" @credential="linkGoogle" @error="message.error(t('login.googleLoadFailed'))" />
        <span v-else class="unavailable">{{ t('login.googleUnavailable') }}</span>
      </div>
      <a-alert v-if="!profile?.methods.accessCode" type="warning" show-icon :message="t('activation.noAuthenticatorWarning')" />
      <a-button class="primary-action finish" type="primary" size="large" block :loading="loading" @click="finishActivation">{{ t('activation.finish') }}</a-button>
    </div>

    <template #aside>
      <div class="journey-panel">
        <span class="journey-eyebrow">{{ t('activation.progress') }}</span>
        <ol>
          <li :class="{ active: step === 0, done: step > 0 }"><span>01</span><div><strong>{{ t('activation.steps.identity') }}</strong><small>{{ t('activation.steps.identityCopy') }}</small></div></li>
          <li :class="{ active: step === 1, done: step > 1 }"><span>02</span><div><strong>{{ t('activation.steps.contact') }}</strong><small>{{ t('activation.steps.contactCopy') }}</small></div></li>
          <li :class="{ active: step === 2 }"><span>03</span><div><strong>{{ t('activation.steps.methods') }}</strong><small>{{ t('activation.steps.methodsCopy') }}</small></div></li>
        </ol>
        <router-link to="/login">{{ t('activation.backToLogin') }}</router-link>
      </div>
    </template>
    <template #footer>{{ t('login.copyright', { year: currentYear }) }}</template>
  </PublicAuthLayout>
</template>

<style scoped lang="less">
.activation-section h2 { margin: 0 0 5px; font-size: 22px; }
.section-copy { margin: 0 0 24px; color: #64748b; font-size: 13px; line-height: 20px; }
.choice-row { display: grid; grid-template-columns: 1fr 1.25fr; gap: 10px; margin-bottom: 24px; button { display: flex; min-height: 62px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: #64748b; cursor: pointer; font-size: 12px; &.active { border-color: #2463eb; background: #eef4ff; color: #2463eb; box-shadow: inset 0 -2px #2463eb; } } }
.auth-form { :deep(.ant-form-item) { margin-bottom: 18px; } :deep(.ant-form-item-label > label) { color: #14213d; font-size: 13px; font-weight: 650; } :deep(.ant-input-affix-wrapper), :deep(.ant-input) { min-height: 46px; border-radius: 6px; } :deep(.ant-alert) { margin-bottom: 18px; } }
.primary-action { min-height: 46px; border-radius: 6px; background: #2463eb; font-weight: 650; }
.profile-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 16px; margin-bottom: 18px; padding: 14px 16px; border-radius: 8px; background: #f8fafc; color: #52637a; font-size: 12px; span { grid-column: 1 / -1; color: #14213d; font-size: 15px; font-weight: 700; } }
.channel-list { display: grid; gap: 10px; margin-bottom: 22px; label { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #dbe4f0; border-radius: 8px; cursor: pointer; &.disabled { opacity: .45; } span { display: flex; flex-direction: column; } small { margin-top: 3px; color: #64748b; } } }
.otp-input { text-align: center; letter-spacing: .25em; }
.connection-card { display: flex; min-height: 72px; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding: 13px 15px; border: 1px solid #dbe4f0; border-radius: 9px; > div:first-child { display: flex; align-items: center; gap: 12px; color: #2463eb; font-size: 21px; span { display: flex; flex-direction: column; color: #14213d; font-size: 13px; } small { margin-top: 3px; color: #64748b; font-size: 11px; font-weight: 400; } } }
.connected { color: #059669; font-size: 21px; }
.unavailable { max-width: 150px; color: #94a3b8; font-size: 11px; text-align: right; }
.google-button { width: 185px; }
.totp-setup { display: grid; grid-template-columns: 165px 1fr; gap: 18px; margin: -2px 0 12px; padding: 16px; border: 1px solid #b7d3ff; border-radius: 9px; background: #f8fbff; p { margin: 0 0 8px; color: #64748b; font-size: 11px; line-height: 17px; } code { display: block; margin-bottom: 10px; overflow-wrap: anywhere; color: #14213d; font-size: 11px; } :deep(.ant-input) { margin-bottom: 8px; } }
.finish { margin-top: 18px; }
.journey-panel { width: 100%; padding: 28px; border-radius: 10px; background: linear-gradient(160deg, #102b62, #1747b9 58%, #0b756f); color: #fff; .journey-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; } ol { margin: 28px 0 34px; padding: 0; list-style: none; } li { position: relative; display: flex; gap: 13px; padding-bottom: 27px; opacity: .55; &::after { position: absolute; top: 30px; bottom: 4px; left: 13px; width: 1px; background: rgba(255,255,255,.35); content: ''; } &:last-child::after { display: none; } &.active, &.done { opacity: 1; } > span { display: flex; z-index: 1; width: 28px; height: 28px; align-items: center; justify-content: center; flex: 0 0 28px; border: 1px solid rgba(255,255,255,.7); border-radius: 50%; background: #1747b9; font-size: 10px; } &.done > span { background: #0d9488; } div { display: flex; flex-direction: column; } strong { font-size: 13px; } small { margin-top: 4px; color: rgba(255,255,255,.72); font-size: 11px; line-height: 17px; } } a { color: #d8e7ff; font-size: 12px; } }
@media (max-width: 560px) { .choice-row, .profile-strip, .totp-setup { grid-template-columns: 1fr; } .profile-strip span { grid-column: auto; } .connection-card { align-items: flex-start; flex-direction: column; } .google-button { width: 100%; } }
</style>
