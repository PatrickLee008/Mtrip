<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CheckCircleOutlined, GlobalOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { clearAuth } from '@/utils/auth';
import PageContainer from '@/components/PageContainer.vue';
import { apiUpdatePassword, apiContacts, apiContactSend, apiContactVerify, apiRebindStart, apiRebindNew, apiRebindFinish, type ContactStates } from '@/api/auth';
import { useUserStore } from '@/stores/user';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/locales';

const userStore = useUserStore();
const { t, locale } = useI18n();
const contacts = ref<ContactStates>({ contacts: [], testMode: false });
const contactBusy = ref(false);
const contactDialog = ref(false);
const contactForm = reactive({ mode: 'verify', channel: 'email' as 'email' | 'sms', verifiedChannel: 'email' as 'email' | 'sms', step: 0, value: '', code: '', totp: '', token: '' });
const verifiedContacts = computed(() => contacts.value.contacts.filter(item => item.status === 'verified'));
const canManageContacts = computed(() => userStore.isOwner && userStore.accountType === 2 && !userStore.profile?.impersonation);
onMounted(async () => { if (canManageContacts.value) contacts.value = await apiContacts(); });

async function openContact(channel: 'email' | 'sms', mode: 'verify' | 'rebind'): Promise<void> {
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
const notificationPrefs = reactive<Record<string, boolean>>({
  booking: true,
  cancellation: true,
  settlement: true,
  reviews: true,
  system: true,
  marketing: false,
});
const preferences = reactive({
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  dateFormat: 'YYYY-MM-DD',
  refreshRate: '5',
});

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

function switchLanguage(key: SupportedLocale): void {
  locale.value = key;
  localStorage.setItem('mtrip_merchant_locale', key);
}

async function submitPassword(): Promise<void> {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    message.warning(t('common.required'));
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.warning(t('header.passwordMismatch'));
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
  <PageContainer>
    <div class="page-head">
      <div>
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
    </div>

    <div class="settings-shell">
      <a-card :bordered="false" class="mtrip-card-shadow settings-card">
        <template #title>
          <span class="section-title"><UserOutlined />{{ t('settings.profile.title') }}</span>
        </template>
        <div class="profile-grid">
          <div v-for="item in profileRows" :key="item.label" class="profile-cell">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </a-card>

      <a-card :bordered="false" class="mtrip-card-shadow settings-card">
        <template #title>
          <span class="section-title"><SafetyCertificateOutlined />{{ t('settings.notifications.title') }}</span>
        </template>
        <div class="toggle-list">
          <div v-for="key in Object.keys(notificationPrefs)" :key="key" class="toggle-row">
            <div>
              <strong>{{ t(`settings.notifications.${key}`) }}</strong>
              <p>{{ t(`settings.notifications.${key}Hint`) }}</p>
            </div>
            <a-switch v-model:checked="notificationPrefs[key]" />
          </div>
        </div>
        <a-alert type="info" show-icon :message="t('settings.notifications.localTip')" />
      </a-card>

      <a-card :bordered="false" class="mtrip-card-shadow settings-card">
        <template #title>
          <span class="section-title"><LockOutlined />{{ t('settings.security.title') }}</span>
        </template>
        <a-alert class="security-alert" type="success" show-icon :message="t('settings.security.twoFaTip')" />
        <div v-if="canManageContacts" class="contact-security">
          <h3>{{ t('contactSecurity.title') }}</h3>
          <a-alert v-if="contacts.testMode" type="warning" show-icon :message="t('contactSecurity.testHint')" />
          <div v-for="contact in contacts.contacts" :key="contact.channel" class="toggle-row">
            <div>
              <strong>{{ t(`contactSecurity.${contact.channel}`) }} · {{ contact.recipient || '-' }}</strong>
              <p>{{ t(`contactSecurity.${contact.status}`) }}</p>
            </div>
            <a-space>
              <a-button v-if="contact.canVerify" :loading="contactBusy" @click="openContact(contact.channel, 'verify')">{{ t('contactSecurity.verify') }}</a-button>
              <a-button v-if="verifiedContacts.length && !contacts.testMode" @click="openContact(contact.channel, 'rebind')">{{ t('contactSecurity.rebind') }}</a-button>
            </a-space>
          </div>
          <p>{{ t('contactSecurity.help') }}</p>
        </div>
        <a-form layout="vertical" class="password-form">
          <a-form-item :label="t('header.oldPassword')" required>
            <a-input-password v-model:value="passwordForm.oldPassword" autocomplete="current-password" />
          </a-form-item>
          <a-form-item :label="t('header.newPassword')" required>
            <a-input-password v-model:value="passwordForm.newPassword" autocomplete="new-password" />
          </a-form-item>
          <a-form-item :label="t('header.confirmPassword')" required>
            <a-input-password v-model:value="passwordForm.confirmPassword" autocomplete="new-password" />
          </a-form-item>
          <a-button type="primary" :loading="passwordSaving" @click="submitPassword">
            <template #icon><CheckCircleOutlined /></template>{{ t('settings.security.updatePassword') }}
          </a-button>
        </a-form>
      </a-card>

      <a-card :bordered="false" class="mtrip-card-shadow settings-card">
        <template #title>
          <span class="section-title"><GlobalOutlined />{{ t('settings.preferences.title') }}</span>
        </template>
        <a-form layout="vertical">
          <a-form-item :label="t('settings.preferences.language')">
            <a-radio-group :value="locale" @change="switchLanguage($event.target.value)">
              <a-radio-button v-for="item in SUPPORTED_LOCALES" :key="item.key" :value="item.key">{{ item.label }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item :label="t('settings.preferences.timezone')">
                <a-select v-model:value="preferences.timezone">
                  <a-select-option value="Asia/Bangkok">Asia/Bangkok</a-select-option>
                  <a-select-option value="Asia/Singapore">Asia/Singapore</a-select-option>
                  <a-select-option value="Asia/Shanghai">Asia/Shanghai</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('settings.preferences.currency')">
                <a-select v-model:value="preferences.currency">
                  <a-select-option value="THB">THB</a-select-option>
                  <a-select-option value="USD">USD</a-select-option>
                  <a-select-option value="MMK">MMK</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-alert type="warning" show-icon :message="t('settings.preferences.localTip')" />
        </a-form>
      </a-card>
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
.page-head {
  margin-bottom: 18px;

  h1 {
    margin: 0;
    color: var(--mtrip-text-main);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  p {
    margin: 4px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.settings-shell {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-card :deep(.ant-card-head-title) {
  padding: 14px 0;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--mtrip-text-main);
  font-size: 13px;
  font-weight: 800;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.profile-cell {
  padding: 12px;
  border: 1px solid var(--mtrip-border-light);
  border-radius: 8px;
  background: var(--mtrip-bg-soft);

  span {
    display: block;
    color: var(--mtrip-text-aux);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 6px;
    color: var(--mtrip-text-main);
    font-size: 13px;
    font-weight: 700;
  }
}

.toggle-list {
  margin-bottom: 12px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--mtrip-border-light);

  &:last-child {
    border-bottom: 0;
  }

  strong {
    color: var(--mtrip-text-main);
    font-size: 13px;
    font-weight: 700;
  }

  p {
    margin: 2px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 12px;
  }
}

.security-alert {
  margin-bottom: 14px;
}

.password-form {
  max-width: 420px;
}

@media (max-width: 1000px) {
  .settings-shell,
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
