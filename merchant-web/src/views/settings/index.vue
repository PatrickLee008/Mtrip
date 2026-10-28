<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { BellOutlined, CheckCircleOutlined, DesktopOutlined, GlobalOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { clearAuth } from '@/utils/auth';
import PageContainer from '@/components/PageContainer.vue';
import { apiUpdatePassword, apiContacts, apiContactSend, apiContactVerify, apiRebindStart, apiRebindNew, apiRebindFinish, type ContactStates } from '@/api/auth';
import { useUserStore } from '@/stores/user';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/locales';
import { LOCALE_KEY } from '@/locales/preferences';

const userStore = useUserStore();
const { t, locale } = useI18n();
const contacts = ref<ContactStates>({ contacts: [], testMode: false });
const contactBusy = ref(false);
const contactDialog = ref(false);
const contactForm = reactive({ mode: 'verify', channel: 'email' as 'email' | 'sms', verifiedChannel: 'email' as 'email' | 'sms', step: 0, value: '', code: '', totp: '', token: '' });
const verifiedContacts = computed(() => contacts.value.contacts.filter(item => item.status === 'verified'));
const canManageContacts = computed(() => userStore.isOwner && userStore.accountType === 2 && !userStore.profile?.impersonation);
const contactsLoading = ref(false);
const contactsFailed = ref(false);
async function loadContacts(): Promise<void> {
  if (!canManageContacts.value) return;
  contactsLoading.value = true;
  contactsFailed.value = false;
  try { contacts.value = await apiContacts(); }
  catch { contactsFailed.value = true; }
  finally { contactsLoading.value = false; }
}
onMounted(loadContacts);

async function openContact(channel: 'email' | 'sms', mode: 'verify' | 'rebind'): Promise<void> {
  if (contactBusy.value) return;
  Object.assign(contactForm, { channel, mode, step: 0, value: '', code: '', totp: '', token: '', verifiedChannel: verifiedContacts.value[0]?.channel || 'email' });
  if (mode === 'verify') {
    contactBusy.value = true;
    try {
      const result = await apiContactSend(channel);
      contactForm.token = result.challengeToken;
      contactDialog.value = true;
    } finally { contactBusy.value = false; }
  } else contactDialog.value = true;
}

async function submitContact(): Promise<void> {
  if (contactBusy.value) return;
  const code = contactForm.mode === 'rebind' && contactForm.step === 0 ? contactForm.totp : contactForm.code;
  if (!/^\d{6}$/.test(code) || (contactForm.mode === 'rebind' && contactForm.step === 1 && !contactForm.value.trim())) {
    message.warning(t('settings.security.contactRequired'));
    return;
  }
  contactBusy.value = true;
  try {
    if (contactForm.mode === 'verify') {
      contacts.value = await apiContactVerify(contactForm.token, contactForm.code);
      message.success(t(contacts.value.testMode ? 'contactSecurity.testVerified' : 'contactSecurity.success'));
      contactDialog.value = false;
    } else if (contactForm.step === 0) {
      const result = await apiRebindStart(contactForm.verifiedChannel, contactForm.totp);
      contactForm.token = result.challengeToken;
      contactForm.step = 1;
    } else if (contactForm.step === 1) {
      const result = await apiRebindNew(contactForm.token, contactForm.code, contactForm.channel, contactForm.value);
      contactForm.token = result.challengeToken;
      contactForm.code = '';
      contactForm.step = 2;
    } else {
      await apiRebindFinish(contactForm.token, contactForm.code);
      message.success(t('contactSecurity.rebound'));
      clearAuth();
      window.location.href = '/login';
    }
  } finally { contactBusy.value = false; }
}

const passwordSaving = ref(false);
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
type SettingsTab = 'profile' | 'notifications' | 'security' | 'preferences';
const activeTab = ref<SettingsTab>('profile');
const tabs = [
  { key: 'profile', icon: UserOutlined },
  { key: 'notifications', icon: BellOutlined },
  { key: 'security', icon: SafetyCertificateOutlined },
  { key: 'preferences', icon: GlobalOutlined },
] as const;
const notificationPrefs = reactive<Record<string, boolean>>({
  booking: true,
  cancellation: true,
  settlement: false,
  system: true,
});
const languageDraft = ref(locale.value as SupportedLocale);
watch(locale, value => { languageDraft.value = value as SupportedLocale; });
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const profileName = computed(() => userStore.profile?.subjectName || '-');
const contactValue = (channel: 'email' | 'sms'): string => contacts.value.contacts.find(item => item.channel === channel)?.recipient || '';

const profileRows = computed(() => [
  { label: t('settings.profile.username'), value: userStore.profile?.username || '-' },
  { label: t('settings.profile.realName'), value: userStore.profile?.realName || '-' },
  { label: t('settings.profile.accountType'), value: accountTypeLabel.value },
  { label: t('settings.profile.subject'), value: userStore.profile?.subjectName || '-' },
]);

const accountTypeLabel = computed(() => {
  const type = userStore.accountType;
  if (type === 1) return t('accountType.group');
  if (type === 2) return t('accountType.merchant');
  if (type === 3) return t('accountType.store');
  return '-';
});

function saveLanguage(): void {
  localStorage.setItem(LOCALE_KEY, languageDraft.value);
  locale.value = languageDraft.value;
  message.success(t('settings.preferences.saved'));
}

function resetLanguage(): void {
  languageDraft.value = locale.value as SupportedLocale;
}

function confirmLogout(): void {
  Modal.confirm({
    title: t('header.logoutConfirm'),
    okText: t('header.logout'),
    cancelText: t('common.cancel'),
    async onOk() {
      await userStore.logout();
      window.location.href = '/login';
    },
  });
}

async function submitPassword(): Promise<void> {
  if (passwordSaving.value) return;
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    message.warning(t('common.required'));
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.warning(t('header.passwordMismatch'));
    return;
  }
  if (passwordForm.newPassword.length < 8 || !/[A-Za-z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
    message.warning(t('settings.security.passwordRule'));
    return;
  }
  passwordSaving.value = true;
  try {
    await apiUpdatePassword(passwordForm.oldPassword, passwordForm.newPassword);
    message.success(t('header.changeSuccess'));
    await userStore.logout();
    window.location.href = '/login';
  } finally {
    passwordSaving.value = false;
  }
}
</script>

<template>
  <PageContainer class="settings-page">
    <div class="settings-shell">
      <nav class="settings-nav" :aria-label="t('settings.navigation')">
        <p class="nav-caption">{{ t('settings.navigation') }}</p>
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" :aria-pressed="activeTab === tab.key" @click="activeTab = tab.key">
          <component :is="tab.icon" /><span>{{ t(`settings.${tab.key}.title`) }}</span>
        </button>
      </nav>

      <main class="settings-content">
        <header class="page-head">
          <h1>{{ t(`settings.${activeTab}.title`) }}</h1>
          <p>{{ t(`settings.${activeTab}.description`) }}</p>
        </header>

        <section v-show="activeTab === 'profile'" :aria-label="t('settings.profile.title')">
          <div class="settings-card">
            <div class="logo-row">
              <span class="company-avatar"><UserOutlined /></span>
              <div>
                <a-space><a-button disabled>{{ t('settings.profile.changeLogo') }}</a-button><a-button type="text" danger disabled>{{ t('settings.profile.removeLogo') }}</a-button></a-space>
                <p class="muted">{{ t('settings.profile.logoHint') }}</p>
              </div>
            </div>
            <a-form layout="vertical" class="profile-form">
              <div class="form-grid">
                <a-form-item :label="t('settings.profile.companyName')"><a-input :value="profileName" :aria-label="t('settings.profile.companyName')" readonly /></a-form-item>
                <a-form-item :label="t('settings.profile.registrationNumber')"><a-input :placeholder="t('settings.unavailableValue')" :aria-label="t('settings.profile.registrationNumber')" readonly /></a-form-item>
                <a-form-item :label="t('contactSecurity.email')"><a-input :value="contactValue('email')" :placeholder="t('settings.unavailableValue')" :aria-label="t('contactSecurity.email')" readonly /></a-form-item>
                <a-form-item :label="t('contactSecurity.sms')"><a-input :value="contactValue('sms')" :placeholder="t('settings.unavailableValue')" :aria-label="t('contactSecurity.sms')" readonly /></a-form-item>
              </div>
              <a-form-item :label="t('settings.profile.address')"><a-textarea :rows="3" :placeholder="t('settings.unavailableValue')" :aria-label="t('settings.profile.address')" readonly /></a-form-item>
            </a-form>
            <div v-if="canManageContacts" class="contact-shortcut">
              <a-button type="link" @click="activeTab = 'security'">{{ t('settings.profile.manageContacts') }}</a-button>
            </div>
            <footer class="card-footer"><p>{{ t('settings.profile.readOnly') }}</p><a-button type="primary" disabled>{{ t('settings.saveChanges') }}</a-button></footer>
          </div>
          <div class="account-summary">
            <div v-for="item in profileRows" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
          </div>
        </section>

        <section v-show="activeTab === 'notifications'" :aria-label="t('settings.notifications.title')">
          <div class="settings-card">
            <p class="group-caption">{{ t('settings.notifications.emailAlerts') }}</p>
            <div v-for="key in ['booking', 'cancellation', 'settlement']" :key="key" class="toggle-row">
              <div><label :id="`notification-${key}`">{{ t(`settings.notifications.${key}`) }}</label><p>{{ t(`settings.notifications.${key}Hint`) }}</p></div>
              <a-switch v-model:checked="notificationPrefs[key]" :aria-labelledby="`notification-${key}`" />
            </div>
            <p class="group-caption sms-caption">{{ t('settings.notifications.smsAlerts') }}</p>
            <div class="toggle-row">
              <div><label id="notification-system">{{ t('settings.notifications.system') }}</label><p>{{ t('settings.notifications.systemHint') }}</p></div>
              <a-switch v-model:checked="notificationPrefs.system" aria-labelledby="notification-system" />
            </div>
            <footer class="card-footer"><p>{{ t('settings.notifications.previewHint') }}</p><a-button type="primary" disabled>{{ t('settings.savePreferences') }}</a-button></footer>
          </div>
        </section>

        <section v-show="activeTab === 'security'" :aria-label="t('settings.security.title')">
          <div class="settings-card">
            <div class="security-heading">
              <span class="section-icon"><SafetyCertificateOutlined /></span>
              <div><h2>{{ t('settings.security.twoFa') }}</h2><p>{{ t('settings.security.twoFaHint') }}</p></div>
              <span class="enforced">{{ t('settings.security.required') }}</span>
            </div>
            <div class="two-fa-footer"><span><CheckCircleOutlined /> {{ t('settings.security.twoFaPolicy') }}</span><a-button type="link" disabled>{{ t('settings.security.resetTwoFa') }}</a-button></div>
            <p class="muted">{{ t('settings.security.recoveryHint') }}</p>
          </div>

          <div v-if="canManageContacts" class="settings-card contact-security">
            <h2>{{ t('contactSecurity.title') }}</h2>
            <p class="section-description">{{ t('contactSecurity.help') }}</p>
            <a-alert v-if="contacts.testMode" type="warning" show-icon :message="t('contactSecurity.testHint')" />
            <div v-if="contactsFailed" class="load-error" role="status"><span>{{ t('settings.security.contactsFailed') }}</span><a-button @click="loadContacts">{{ t('settings.retry') }}</a-button></div>
            <a-spin :spinning="contactsLoading">
              <div v-for="contact in contacts.contacts" :key="contact.channel" class="toggle-row">
                <div><strong>{{ t(`contactSecurity.${contact.channel}`) }} · {{ contact.recipient || '-' }}</strong><p>{{ t(`contactSecurity.${contact.status}`) }}</p></div>
                <a-space wrap>
                  <a-button v-if="contact.canVerify" :loading="contactBusy" @click="openContact(contact.channel, 'verify')">{{ t('contactSecurity.verify') }}</a-button>
                  <a-button v-if="verifiedContacts.length && !contacts.testMode" :disabled="contactBusy" @click="openContact(contact.channel, 'rebind')">{{ t('contactSecurity.rebind') }}</a-button>
                </a-space>
              </div>
            </a-spin>
          </div>

          <div class="settings-card">
            <div class="security-heading"><span class="section-icon"><DesktopOutlined /></span><div><h2>{{ t('settings.security.sessions') }}</h2><p>{{ t('settings.security.sessionsHint') }}</p></div></div>
            <div class="session-row"><DesktopOutlined /><div><strong>{{ t('settings.security.thisBrowser') }}</strong><p>{{ t('settings.security.lastLogin') }}: {{ userStore.profile?.lastLoginAt || '-' }}</p></div><span class="current-session">{{ t('settings.security.currentSession') }}</span></div>
            <p class="muted">{{ t('settings.security.sessionsUnavailable') }}</p>
            <div class="session-actions"><a-button danger disabled>{{ t('settings.security.logoutOthers') }}</a-button><a-button danger @click="confirmLogout">{{ t('header.logout') }}</a-button></div>
          </div>

          <div v-if="!userStore.profile?.impersonation" class="settings-card">
            <div class="security-heading"><span class="section-icon"><LockOutlined /></span><div><h2>{{ t('settings.security.passwordTitle') }}</h2><p>{{ t('settings.security.passwordHint') }}</p></div></div>
            <a-form :model="passwordForm" layout="vertical" class="password-form" @finish="submitPassword">
              <a-form-item :label="t('header.oldPassword')" name="oldPassword" required><a-input-password v-model:value="passwordForm.oldPassword" :aria-label="t('header.oldPassword')" autocomplete="current-password" /></a-form-item>
              <div class="form-grid">
                <a-form-item :label="t('header.newPassword')" name="newPassword" required><a-input-password v-model:value="passwordForm.newPassword" :aria-label="t('header.newPassword')" autocomplete="new-password" /></a-form-item>
                <a-form-item :label="t('header.confirmPassword')" name="confirmPassword" required><a-input-password v-model:value="passwordForm.confirmPassword" :aria-label="t('header.confirmPassword')" autocomplete="new-password" /></a-form-item>
              </div>
              <a-button type="primary" html-type="submit" :loading="passwordSaving">{{ t('settings.security.updatePassword') }}</a-button>
            </a-form>
          </div>
        </section>

        <section v-show="activeTab === 'preferences'" :aria-label="t('settings.preferences.title')">
          <div class="settings-card">
            <a-form layout="vertical" class="localization-form">
              <a-form-item :label="t('settings.preferences.language')">
                <p class="field-hint">{{ t('settings.preferences.languageHint') }}</p>
                <a-select v-model:value="languageDraft" :aria-label="t('settings.preferences.language')" :options="SUPPORTED_LOCALES.map(item => ({ value: item.key, label: item.label }))"><template #suffixIcon><GlobalOutlined /></template></a-select>
              </a-form-item>
              <a-form-item :label="t('settings.preferences.timezone')"><p class="field-hint">{{ t('settings.preferences.timezoneHint') }}</p><a-input :value="deviceTimezone" readonly><template #prefix><GlobalOutlined /></template></a-input></a-form-item>
              <a-form-item :label="t('settings.preferences.currency')"><p class="field-hint">{{ t('settings.preferences.currencyHint') }}</p><a-input :value="t('settings.preferences.currencyValue')" readonly /></a-form-item>
            </a-form>
          </div>
          <div class="settings-card">
            <h2>{{ t('settings.preferences.dateTime') }}</h2><p class="section-description">{{ t('settings.preferences.formatHint') }}</p>
            <div class="form-grid format-grid">
              <div><h3>{{ t('settings.preferences.dateFormat') }}</h3><a-radio-group disabled class="format-options"><a-radio value="DD/MM/YYYY">DD/MM/YYYY</a-radio><a-radio value="MM/DD/YYYY">MM/DD/YYYY</a-radio><a-radio value="YYYY-MM-DD">YYYY-MM-DD</a-radio></a-radio-group></div>
              <div><h3>{{ t('settings.preferences.timeFormat') }}</h3><a-radio-group disabled class="format-options"><a-radio value="24">{{ t('settings.preferences.hour24') }}</a-radio><a-radio value="12">{{ t('settings.preferences.hour12') }}</a-radio></a-radio-group></div>
            </div>
          </div>
          <footer class="preferences-footer"><p>{{ t('settings.preferences.localHint') }}</p><a-space wrap><a-button :disabled="languageDraft === locale" @click="resetLanguage">{{ t('settings.resetChanges') }}</a-button><a-button type="primary" :disabled="languageDraft === locale" @click="saveLanguage">{{ t('settings.savePreferences') }}</a-button></a-space></footer>
        </section>
      </main>
    </div>
    <a-modal v-model:open="contactDialog" :title="t(contactForm.mode === 'verify' ? 'contactSecurity.verify' : 'contactSecurity.rebind')" :confirm-loading="contactBusy" :ok-text="t(contactForm.mode === 'rebind' && contactForm.step < 2 ? 'contactSecurity.next' : 'contactSecurity.confirm')" @ok="submitContact">
      <a-form layout="vertical">
        <template v-if="contactForm.mode === 'rebind' && contactForm.step === 0">
          <a-alert type="info" show-icon :message="t('contactSecurity.rebindHint')" />
          <a-form-item :label="t('contactSecurity.verifiedChannel')">
            <a-select v-model:value="contactForm.verifiedChannel">
              <a-select-option v-for="contact in verifiedContacts" :key="contact.channel" :value="contact.channel">{{ contact.recipient }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('contactSecurity.totp')"><a-input v-model:value="contactForm.totp" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
        </template>
        <template v-else>
          <a-form-item v-if="contactForm.mode === 'rebind' && contactForm.step === 1" :label="t(contactForm.channel === 'email' ? 'contactSecurity.newEmail' : 'contactSecurity.newPhone')"><a-input v-model:value="contactForm.value" :placeholder="contactForm.channel === 'sms' ? '+959…' : 'name@example.com'" /></a-form-item>
          <a-form-item :label="t(contactForm.mode === 'rebind' && contactForm.step === 1 ? 'contactSecurity.oldCode' : 'contactSecurity.code')"><a-input v-model:value="contactForm.code" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
        </template>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.settings-page :deep(.page-body) {
  padding: 0;
  background: #f6f7f9;
}

.settings-shell {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: calc(100vh - 56px);
}

.settings-nav {
  padding: 32px 16px;
  border-right: 1px solid var(--mtrip-border);

  .nav-caption {
    margin: 0 0 12px;
    color: var(--mtrip-text-aux);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    margin-bottom: 4px;
    padding: 10px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--mtrip-text-secondary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    .anticon { font-size: 16px; }
    &:hover { background: #edf0f6; }
    &.active { background: #e9edfc; color: #4169ed; font-weight: 600; }
    &:focus-visible { outline: 2px solid #4169ed; outline-offset: 2px; }
  }
}

.settings-content { min-width: 0; padding: 28px; }
.page-head {
  margin-bottom: 24px;
  h1 { margin: 0; font-size: 20px; font-weight: 700; color: var(--mtrip-text-main); }
  p { margin: 6px 0 0; color: var(--mtrip-text-secondary); font-size: 12px; }
}

.settings-card {
  margin-bottom: 20px;
  padding: 24px;
  border: 1px solid var(--mtrip-border);
  border-radius: 12px;
  background: white;
  box-shadow: var(--mtrip-shadow-card);

  h2 { margin: 0; font-size: 13px; font-weight: 600; }
  p { line-height: 1.6; }
  :deep(.ant-input), :deep(.ant-input-affix-wrapper) { min-height: 40px !important; border-radius: 6px; }
  :deep(.ant-input-affix-wrapper > .ant-input) { min-height: 0 !important; }
  :deep(.ant-select-single), :deep(.ant-select-single .ant-select-selector) { height: 40px !important; }
  :deep(.ant-btn:not(.ant-btn-link):not(.ant-btn-text)) { min-height: 40px; border-radius: 6px; }
  :deep(.ant-form-item-label > label) { height: auto; color: var(--mtrip-text-main); font-size: 12px; font-weight: 600; }
  :deep(.ant-input[readonly]) { color: var(--mtrip-text-secondary); background: #fcfcfd; }
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--mtrip-border);
}
.company-avatar { display: grid; place-items: center; flex: 0 0 64px; height: 64px; border-radius: 50%; background: #f0f2ff; color: #4169ed; font-size: 26px; }
.muted, .section-description { margin: 8px 0 0; color: var(--mtrip-text-aux); font-size: 11px; }
.section-description { margin-bottom: 16px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
.profile-form :deep(.ant-form-item) { margin-bottom: 20px; }
.contact-shortcut { margin: -8px 0 8px; :deep(.ant-btn) { padding-left: 0; white-space: normal; height: auto; } }
.card-footer, .preferences-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 20px; border-top: 1px solid var(--mtrip-border); }
.card-footer p, .preferences-footer p { flex: 1; margin: 0; font-size: 11px; color: var(--mtrip-text-aux); }
.account-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 0 4px; font-size: 11px; span { display: block; margin-bottom: 4px; color: var(--mtrip-text-aux); } strong { font-weight: 500; overflow-wrap: anywhere; } }
.group-caption { margin: 0; padding-bottom: 12px; border-bottom: 1px solid var(--mtrip-border); color: var(--mtrip-text-secondary); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.sms-caption { margin-top: 24px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 0; border-bottom: 1px solid #f1f5f9; label, strong { font-size: 12px; font-weight: 600; } p { margin: 4px 0 0; font-size: 11px; color: var(--mtrip-text-aux); } :deep(.ant-switch) { flex-shrink: 0; } }
.security-heading { display: flex; align-items: flex-start; gap: 12px; p { margin: 4px 0 0; color: var(--mtrip-text-aux); font-size: 11px; } }
.section-icon { display: grid; place-items: center; flex: 0 0 32px; height: 32px; border-radius: 8px; color: #4169ed; background: #eef1ff; font-size: 17px; }
.enforced { margin-left: auto; color: #4169ed; font-size: 11px; white-space: nowrap; }
.two-fa-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 24px; font-size: 11px; color: var(--mtrip-text-secondary); > span .anticon { color: #22a06b; } :deep(.ant-btn) { padding-right: 0; font-size: 11px; } }
.load-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #b45309; font-size: 12px; }
.contact-security .toggle-row { flex-wrap: wrap; padding: 16px 0; }
.session-row { display: flex; align-items: center; gap: 12px; margin: 24px 0 16px; font-size: 12px; > .anticon { color: var(--mtrip-text-aux); font-size: 22px; } strong { font-weight: 600; } p { margin: 4px 0 0; font-size: 11px; color: var(--mtrip-text-aux); } }
.current-session { margin-left: auto; padding: 3px 8px; border: 1px solid #c7d2fe; border-radius: 20px; background: #f2f5ff; color: #4169ed; font-size: 10px; white-space: nowrap; }
.session-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
.password-form { margin-top: 24px; max-width: 680px; }
.localization-form { :deep(.ant-form-item:last-child) { margin-bottom: 0; } :deep(.ant-select) { width: 100%; } }
.field-hint { margin: 0 0 8px; color: var(--mtrip-text-aux); font-size: 11px; }
.format-grid h3 { margin: 0 0 10px; font-size: 12px; font-weight: 600; }
.format-options { display: flex; flex-direction: column; gap: 8px; :deep(.ant-radio-wrapper) { margin: 0; padding: 10px 12px; border: 1px solid var(--mtrip-border); border-radius: 6px; font-size: 12px; } }
.preferences-footer { padding-top: 0; border: 0; :deep(.ant-btn) { min-height: 40px; } }

@media (max-width: 1150px) {
  .settings-shell { grid-template-columns: 200px minmax(0, 1fr); }
  .settings-content { padding: 24px 20px; }
  .settings-nav { padding: 28px 12px; }
}
@media (max-width: 900px) {
  .settings-shell { grid-template-columns: minmax(0, 1fr); }
  .settings-nav { padding: 16px; border-right: 0; border-bottom: 1px solid var(--mtrip-border); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; .nav-caption { grid-column: 1 / -1; margin-bottom: 8px; } button { margin: 0; } }
  .settings-content { padding: 20px 16px; }
  .settings-card { padding: 20px; }
  .account-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 580px) {
  .settings-nav { grid-template-columns: minmax(0, 1fr); }
  .form-grid { grid-template-columns: minmax(0, 1fr); }
  .format-grid { gap: 20px; }
  .card-footer, .preferences-footer { align-items: flex-start; flex-direction: column; }
  .logo-row { align-items: flex-start; gap: 12px; }
  .logo-row :deep(.ant-space) { flex-wrap: wrap; }
  .session-row { flex-wrap: wrap; }
  .current-session { margin-left: 34px; }
  .security-heading { flex-wrap: wrap; }
}
</style>
