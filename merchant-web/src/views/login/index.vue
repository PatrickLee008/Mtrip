<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { KeyOutlined, LockOutlined, LoginOutlined, MailOutlined, MobileOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  apiAuthChallenge, apiAuthChallengeVerify, apiAuthConfig, apiTwoFaSetup, apiTwoFaVerify,
  type AuthChallengeResult, type AuthConfig, type ChallengeResult, type LoginMethod, type SetupResult,
} from '@/api/auth';
import GoogleIdentityButton from '@/components/GoogleIdentityButton.vue';
import { useUserStore } from '@/stores/user';
import mtripLogo from '@/assets/login/mtrip-logo.png';
import worldMapBackground from '@/assets/login/world-map-background.jpeg';

const REMEMBER_KEY = 'mtrip_merchant_remember';
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useI18n();

const config = ref<AuthConfig | null>(null);
const method = ref<LoginMethod>('access_code');
const identifier = ref('');
const challenge = ref<AuthChallengeResult | null>(null);
const otp = ref('');
const loading = ref(false);
const legacyOpen = ref(false);
const legacyForm = ref({ username: '', password: '', remember: true });
const legacyChallenge = ref<ChallengeResult | null>(null);
const setup = ref<SetupResult | null>(null);
const currentYear = new Date().getFullYear();
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const googleEnabled = computed(() => Boolean(config.value?.googleAvailable && googleClientId));
const availableMethods = computed(() => new Set(config.value?.methods ?? ['access_code', 'email', 'sms']));
const methodItems = computed(() => [
  { key: 'access_code' as const, label: t('login.methods.accessCode'), icon: KeyOutlined },
  { key: 'email' as const, label: t('login.methods.email'), icon: MailOutlined },
  { key: 'sms' as const, label: t('login.methods.sms'), icon: MobileOutlined },
  { key: 'google' as const, label: t('login.methods.google'), icon: UserOutlined },
]);

function selectMethod(value: LoginMethod): void {
  if (!availableMethods.value.has(value) || (value === 'google' && !googleEnabled.value)) return;
  method.value = value;
  identifier.value = '';
  challenge.value = null;
  otp.value = '';
}

function resetChallenge(): void {
  challenge.value = null;
  otp.value = '';
}

async function acceptSession(result: Awaited<ReturnType<typeof apiAuthChallengeVerify>>): Promise<void> {
  userStore.acceptSession(result);
  message.success(t('login.success'));
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
}

async function startChallenge(googleIdToken = ''): Promise<void> {
  if (loading.value) return;
  if (method.value !== 'google' && !identifier.value.trim()) {
    message.warning(t(`login.identifierRequired.${method.value}`));
    return;
  }
  loading.value = true;
  try {
    challenge.value = await apiAuthChallenge({
      method: method.value,
      identifier: method.value === 'google' ? undefined : identifier.value.trim(),
      googleIdToken: method.value === 'google' ? googleIdToken : undefined,
    });
    otp.value = '';
  } finally {
    loading.value = false;
  }
}

async function verifyChallenge(): Promise<void> {
  if (loading.value || !challenge.value) return;
  if (!/^\d{6}$/.test(otp.value)) {
    message.warning(t('login.otpRequired'));
    return;
  }
  loading.value = true;
  try {
    await acceptSession(await apiAuthChallengeVerify(method.value, challenge.value.challengeToken, otp.value));
  } finally {
    otp.value = '';
    loading.value = false;
  }
}

async function onGoogleCredential(token: string): Promise<void> {
  method.value = 'google';
  await startChallenge(token);
}

function cancelLegacyTwoFa(): void {
  legacyChallenge.value = null;
  setup.value = null;
  otp.value = '';
  legacyForm.value.password = '';
}

async function submitLegacy(): Promise<void> {
  if (loading.value) return;
  if (!legacyForm.value.username.trim() || !legacyForm.value.password) {
    message.warning(t('login.legacyRequired'));
    return;
  }
  loading.value = true;
  try {
    const pending = await userStore.login(legacyForm.value.username.trim(), legacyForm.value.password);
    legacyForm.value.password = '';
    setup.value = pending.requiresEnrollment ? await apiTwoFaSetup(pending.challengeToken) : null;
    legacyChallenge.value = pending;
    if (legacyForm.value.remember) localStorage.setItem(REMEMBER_KEY, legacyForm.value.username.trim());
    else localStorage.removeItem(REMEMBER_KEY);
  } finally {
    loading.value = false;
  }
}

async function completeLegacyTwoFa(): Promise<void> {
  if (loading.value || !legacyChallenge.value) return;
  if (!/^\d{6}$/.test(otp.value)) {
    message.warning(t('security.codeRequired'));
    return;
  }
  loading.value = true;
  try {
    const result = await apiTwoFaVerify(legacyChallenge.value.challengeToken, otp.value);
    userStore.acceptSession(result);
    cancelLegacyTwoFa();
    message.success(t('login.success'));
    await router.replace('/');
  } finally {
    otp.value = '';
    loading.value = false;
  }
}

onMounted(async () => {
  legacyForm.value.username = localStorage.getItem(REMEMBER_KEY) ?? '';
  try {
    config.value = await apiAuthConfig();
  } catch {
    config.value = null;
  }
});
</script>

<template>
  <div class="login-page">
    <header class="login-header"><span class="login-logo"><img :src="mtripLogo" alt="mTrip" /></span></header>
    <main class="login-main" :style="{ backgroundImage: `url(${worldMapBackground})` }">
      <div class="login-card">
        <div class="login-card-header">
          <span>{{ t('login.eyebrow') }}</span>
          <h1>{{ t('login.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>
        <div class="login-card-body">
          <section class="login-form-column">
            <a-alert v-if="config?.testMode" type="warning" show-icon :message="t('login.testOtpHint')" style="margin-bottom: 16px" />
            <template v-if="!legacyOpen">
              <div class="method-grid" role="tablist" :aria-label="t('login.chooseMethod')">
                <button
                  v-for="item in methodItems" :key="item.key" type="button"
                  :class="['method-button', { active: method === item.key }]"
                  :disabled="!availableMethods.has(item.key) || (item.key === 'google' && !googleEnabled)"
                  @click="selectMethod(item.key)"
                ><component :is="item.icon" /><span>{{ item.label }}</span></button>
              </div>

              <a-form v-if="!challenge" class="login-form" layout="vertical" @keyup.enter="startChallenge()">
                <template v-if="method !== 'google'">
                  <a-form-item :label="t(`login.identifier.${method}`)">
                    <a-input
                      v-model:value="identifier" size="large" :placeholder="t(`login.identifierRequired.${method}`)"
                      :autocomplete="method === 'email' ? 'email' : method === 'sms' ? 'tel' : 'username'"
                    >
                      <template #prefix><MailOutlined v-if="method === 'email'" /><MobileOutlined v-else-if="method === 'sms'" /><KeyOutlined v-else /></template>
                    </a-input>
                  </a-form-item>
                  <p class="login-step-description">{{ t(`login.hints.${method}`) }}</p>
                  <a-button class="login-submit" type="primary" size="large" block :loading="loading" @click="startChallenge()"><LoginOutlined />{{ t('login.continue') }}</a-button>
                </template>
                <template v-else>
                  <p v-if="googleEnabled" class="login-step-description">{{ t('login.hints.google') }}</p>
                  <GoogleIdentityButton v-if="googleEnabled" :client-id="googleClientId" :disabled="loading" @credential="onGoogleCredential" @error="message.error(t('login.googleLoadFailed'))" />
                  <a-alert v-else type="info" show-icon :message="t('login.googleUnavailable')" />
                </template>
              </a-form>

              <a-form v-else class="login-form" layout="vertical" @keyup.enter="verifyChallenge">
                <div class="challenge-badge"><SafetyCertificateOutlined />{{ t(`login.verification.${challenge.verification}`) }}</div>
                <p class="login-step-description">{{ challenge.recipient ? t('login.sentTo', { recipient: challenge.recipient }) : t('login.authenticatorPrompt') }}</p>
                <a-form-item :label="t('login.otpCode')"><a-input v-model:value="otp" class="otp-input" size="large" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
                <a-button class="login-submit" type="primary" size="large" block :loading="loading" @click="verifyChallenge"><SafetyCertificateOutlined />{{ t('login.verifyAndSignIn') }}</a-button>
                <a-button class="login-back" type="link" block :disabled="loading" @click="resetChallenge">{{ t('security.back') }}</a-button>
              </a-form>

              <div class="login-links"><router-link to="/activate">{{ t('login.activateAccount') }}</router-link><router-link to="/recover">{{ t('login.recoverAccount') }}</router-link></div>
              <button class="legacy-toggle" type="button" @click="legacyOpen = true">{{ t('login.legacyOpen') }}</button>
            </template>

            <template v-else>
              <div class="section-heading"><div><span>{{ t('login.legacyEyebrow') }}</span><h2>{{ t('login.legacyTitle') }}</h2></div><button type="button" @click="legacyOpen = false; cancelLegacyTwoFa()">{{ t('security.back') }}</button></div>
              <a-form v-if="!legacyChallenge" class="login-form" layout="vertical" @keyup.enter="submitLegacy">
                <a-form-item :label="t('login.username')"><a-input v-model:value="legacyForm.username" size="large" autocomplete="username"><template #prefix><UserOutlined /></template></a-input></a-form-item>
                <a-form-item :label="t('login.password')"><a-input-password v-model:value="legacyForm.password" size="large" autocomplete="current-password"><template #prefix><LockOutlined /></template></a-input-password></a-form-item>
                <a-checkbox v-model:checked="legacyForm.remember">{{ t('login.remember') }}</a-checkbox>
                <a-button class="login-submit legacy-submit" type="primary" size="large" block :loading="loading" @click="submitLegacy">{{ t('login.submit') }}</a-button>
              </a-form>
              <a-form v-else class="login-form" layout="vertical" @keyup.enter="completeLegacyTwoFa">
                <p class="login-step-description">{{ t('login.otpDescription') }}</p>
                <a-form-item :label="t('security.code')"><a-input v-model:value="otp" class="otp-input" size="large" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
                <a-button class="login-submit" type="primary" size="large" block :loading="loading" @click="completeLegacyTwoFa">{{ t('security.verify') }}</a-button>
              </a-form>
            </template>
          </section>

          <aside class="login-security-panel">
            <template v-if="setup">
              <h2>{{ t('security.enroll') }}</h2>
              <div class="enrollment-qr"><a-qrcode :value="setup.otpauthUri" :size="166" :bordered="false" /></div>
              <p>{{ t('security.keepPrivate') }}</p>
              <div class="manual-key"><span>{{ t('security.manualKey') }}</span><code>{{ setup.manualKey }}</code></div>
            </template>
            <template v-else>
              <span class="panel-eyebrow">{{ t('login.securityEyebrow') }}</span>
              <h2>{{ t('login.securityTitle') }}</h2>
              <div class="security-icon"><SafetyCertificateOutlined /></div>
              <p>{{ t('login.securityDescription') }}</p>
              <ul><li>{{ t('login.securityPoints.otp') }}</li><li>{{ t('login.securityPoints.audit') }}</li><li>{{ t('login.securityPoints.noBiometric') }}</li></ul>
            </template>
          </aside>
        </div>
      </div>
    </main>
    <footer class="login-footer"><strong>{{ t('login.copyright', { year: currentYear }) }}</strong></footer>
  </div>
</template>

<style scoped lang="less">
.login-page { --login-primary: #2463eb; --login-ink: #14213d; --login-muted: #64748b; display: flex; min-height: 100%; flex-direction: column; background: #f7f8fa; color: var(--login-ink); }
.login-header { z-index: 1; display: flex; min-height: 55px; align-items: center; justify-content: center; border-bottom: 1px solid #bfc9de; background: linear-gradient(90deg, #1747b9, #2463eb 55%, #0d9488); }
.login-logo { position: relative; display: block; width: 68px; height: 42px; overflow: hidden; img { position: absolute; top: -72.73%; left: -40.3%; width: 180.6%; height: 245.45%; max-width: none; } }
.login-main { position: relative; display: flex; flex: 1 1 auto; align-items: center; justify-content: center; padding: 36px 32px; background-color: #f7f8fa; background-position: center; background-repeat: repeat; background-size: 512px 279px; &::before { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(247,248,250,.55), rgba(226,237,255,.68)); content: ''; } }
.login-card { position: relative; width: min(980px, 100%); overflow: hidden; border: 1px solid var(--mtrip-border); border-radius: 14px; background: #fff; box-shadow: 0 18px 50px rgba(21,44,91,.12); }
.login-card-header { padding: 22px 40px; border-bottom: 1px solid #dbe4f0; background: linear-gradient(105deg, #eef4ff, #effcf9); text-align: center; > span { color: #0d9488; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; } h1 { margin: 3px 0 2px; font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; font-size: 30px; line-height: 38px; } p { margin: 0; color: var(--login-muted); font-size: 14px; } }
.login-card-body { display: grid; min-height: 475px; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr); gap: 36px; padding: 36px 40px; }
.login-form-column { min-width: 0; }
.method-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 28px; }
.method-button { display: flex; min-height: 64px; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 8px 4px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: #64748b; cursor: pointer; font-size: 12px; transition: .18s ease; &:hover:not(:disabled) { border-color: #93b4f8; color: var(--login-primary); } &.active { border-color: var(--login-primary); background: #eef4ff; color: var(--login-primary); box-shadow: inset 0 -2px var(--login-primary); } &:disabled { cursor: not-allowed; opacity: .38; } :deep(.anticon) { font-size: 19px; } }
.login-form { :deep(.ant-form-item) { margin-bottom: 20px; } :deep(.ant-form-item-label) { padding-bottom: 4px; } :deep(.ant-form-item-label > label) { height: 18px; color: var(--login-ink); font-size: 13px; font-weight: 650; } :deep(.ant-input-affix-wrapper), :deep(.ant-input) { min-height: 46px; border-color: #dbe4f0; border-radius: 6px; box-shadow: none; } }
.login-step-description { min-height: 42px; margin: 0 0 18px; color: var(--login-muted); font-size: 13px; line-height: 20px; }
.login-submit { height: 46px; border-color: var(--login-primary); border-radius: 6px; background: var(--login-primary); font-weight: 650; &:hover, &:focus { border-color: #1747b9 !important; background: #1747b9 !important; } }
.legacy-submit { margin-top: 20px; }
.login-back { margin-top: 6px; color: var(--login-primary); }
.otp-input { text-align: center; letter-spacing: .3em; }
.challenge-badge { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 5px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 650; }
.login-links { display: flex; justify-content: space-between; margin-top: 20px; font-size: 13px; a { color: var(--login-primary); } }
.legacy-toggle { display: block; margin: 26px auto 0; border: 0; background: transparent; color: #94a3b8; cursor: pointer; font-size: 12px; text-decoration: underline; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; span { color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; } h2 { margin: 2px 0 0; font-size: 21px; } button { border: 0; background: transparent; color: var(--login-primary); cursor: pointer; } }
.login-security-panel { display: flex; min-width: 0; align-items: center; justify-content: center; flex-direction: column; padding: 28px; border: 1px solid #dbe4f0; border-radius: 10px; background: linear-gradient(160deg, #f8fbff, #f2fbf8); text-align: center; h2 { margin: 4px 0 22px; color: #1747b9; font-family: 'Space Grotesk', sans-serif; font-size: 20px; } p { max-width: 290px; margin: 16px auto 0; color: var(--login-muted); font-size: 13px; line-height: 20px; } ul { width: 100%; margin: 20px 0 0; padding: 16px 18px 16px 34px; border-top: 1px solid #dbe4f0; color: #52637a; font-size: 12px; line-height: 24px; text-align: left; } }
.panel-eyebrow { color: #0d9488; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.security-icon { display: flex; width: 106px; height: 106px; align-items: center; justify-content: center; border: 1px solid #cbdcf8; border-radius: 50%; background: #fff; color: var(--login-primary); font-size: 52px; box-shadow: 0 8px 24px rgba(36,99,235,.1); }
.enrollment-qr { display: flex; width: 192px; height: 192px; align-items: center; justify-content: center; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; }
.manual-key { width: 100%; margin-top: 14px; color: var(--login-muted); font-size: 12px; text-align: left; code { display: block; margin-top: 4px; overflow-wrap: anywhere; color: var(--login-ink); } }
.login-footer { display: flex; min-height: 64px; align-items: center; padding: 0 32px; border-top: 1px solid #dbe4f0; background: #eef4ff; strong { color: #52637a; font-size: 12px; } }
@media (max-width: 760px) { .login-main { align-items: flex-start; padding: 22px 14px; } .login-card-header { padding: 20px; h1 { font-size: 25px; } } .login-card-body { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px; } .method-grid { grid-template-columns: repeat(2, 1fr); } .login-security-panel { min-height: 300px; } .login-footer { min-height: 56px; justify-content: center; } }
</style>
