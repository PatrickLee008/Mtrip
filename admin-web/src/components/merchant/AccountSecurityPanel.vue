<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import MerchantLoginControls from './MerchantLoginControls.vue';
import { useUserStore } from '@/stores/user';
import { apiMerchantSecurityAccounts, apiMerchantReset2Fa, apiMerchantCorrectContacts, type SecurityAccount } from '@/api/merchant';

const props = defineProps<{ merchantId: number; accessConfigured: boolean }>();
const { t } = useI18n();
const user = useUserStore();
const rows = ref<SecurityAccount[]>([]);
const selectedId = ref<number>();
const selectedAccount = computed(() => rows.value.find(row => row.id === selectedId.value));
const loading = ref(false);
const target = ref<SecurityAccount | null>(null);
const reason = ref('');
const busy = ref(false);
const correctionOpen = ref(false);
const correction = reactive({ phone: '', email: '', reason: '' });
function openCorrection(): void {
  Object.assign(correction, { phone: '', email: '', reason: '' });
  correctionOpen.value = true;
}
function correctContacts(): void {
  if (!correction.phone || !correction.email || correction.reason.trim().length < 10) { message.warning(t('common.required')); return; }
  Modal.confirm({
    title: t('merchantContactRecovery.confirm'), content: t('merchantContactRecovery.hint'), okType: 'danger',
    async onOk() {
      busy.value = true;
      try {
        await apiMerchantCorrectContacts(props.merchantId, correction.phone, correction.email, correction.reason);
        correctionOpen.value = false;
        message.success(t('merchantContactRecovery.done'));
        await load();
      } finally { busy.value = false; }
    },
  });
}
let loadRequest = 0;
async function load(): Promise<void> {
  const request = ++loadRequest;
  rows.value = [];
  loading.value = true;
  try {
    if (props.merchantId && user.profile?.isSuper) {
      const accounts = await apiMerchantSecurityAccounts(props.merchantId);
      if (request !== loadRequest) return;
      rows.value = accounts;
      if (!accounts.some(row => row.id === selectedId.value)) selectedId.value = accounts[0]?.id;
    }
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}
watch(() => props.merchantId, load, { immediate: true });
function openReset(account: SecurityAccount): void {
  if (account.account_type === 1) return;
  target.value = account;
  reason.value = '';
}

function confirm(): void {
  const account = target.value;
  if (!account || !reason.value.trim()) { message.warning(t('merchantSecurity.reasonRequired')); return; }
  const request = { merchantId: props.merchantId, accountId: account.id, expectedVersion: account.auth_version, reason: reason.value.trim() };
  Modal.confirm({
    title: t('merchant.profile.reset2Fa'), content: t('merchantSecurity.resetConfirm', { name: account.username }), okType: 'danger',
    async onOk() {
      busy.value = true;
      try {
        await apiMerchantReset2Fa(request);
        target.value = null;
        message.success(t('merchant.profile.reset2FaSuccess'));
        await load();
      } finally { busy.value = false; }
    },
  });
}
</script>

<template>
  <section class="security-section">
    <h4>{{ t('merchant.profile.accountSecurity') }}</h4>
    <div class="security-card">
      <div class="security-access">
        <div class="security-access-status">
          <span>{{ t('merchant.profile.merchantAccessCode') }}</span>
          <strong>{{ accessConfigured ? t('merchantDirectory.configured') : t('merchantDirectory.notConfigured') }}</strong>
        </div>
        <MerchantLoginControls v-if="user.profile?.isSuper" :merchant-id="merchantId" />
      </div>
      <a-spin v-if="user.profile?.isSuper" :spinning="loading">
        <div class="security-account">
          <label v-if="rows.length > 1" for="merchant-security-account">{{ t('merchantSecurity.account') }}</label>
          <a-select v-if="rows.length > 1" id="merchant-security-account" v-model:value="selectedId" :aria-label="t('merchantSecurity.account')"
            :options="rows.map(row => ({ value: row.id, label: `${row.username} · ${t(`merchantSecurity.type${row.account_type}`)}` }))" />
          <div v-else-if="selectedAccount" class="security-account-name">{{ selectedAccount.username }} · {{ t(`merchantSecurity.type${selectedAccount.account_type}`) }}</div>
        </div>
        <template v-if="selectedAccount">
          <dl class="security-grid">
            <div><dt>{{ t('merchant.profile.twoFaStatus') }}</dt><dd><a-tag :color="selectedAccount.two_fa_status === 1 ? 'success' : 'warning'">{{ t(`merchantSecurity.status${selectedAccount.two_fa_status}`) }}</a-tag></dd></div>
            <div><dt>{{ t('merchant.profile.twoFaMethod') }}</dt><dd>{{ selectedAccount.two_fa_method === 'google_authenticator' ? 'Google Authenticator' : selectedAccount.two_fa_method || '—' }}</dd></div>
            <div><dt>{{ t('merchant.profile.twoFaEnrolled') }}</dt><dd class="security-mono">{{ selectedAccount.two_fa_enrolled_at || '—' }}</dd></div>
            <div><dt>{{ t('merchant.profile.twoFaLastReset') }}</dt><dd class="security-mono">{{ selectedAccount.two_fa_last_reset_at || '—' }}</dd></div>
          </dl>
          <div v-if="selectedAccount.account_type !== 1" class="security-reset">
            <p>{{ t('merchant.profile.reset2FaHint') }}</p>
            <a-button v-perm="'merchant:list:2fa'" size="small" danger @click="openReset(selectedAccount)">{{ t('merchant.profile.reset2Fa') }}</a-button>
          </div>
        </template>
        <a-empty v-else-if="!loading" :image="null" :description="t('common.noData')" />
      </a-spin>
      <p v-else class="security-hint">{{ t('merchantSecurity.superOnly') }}</p>
    </div>
    <a-button v-if="user.profile?.isSuper" v-perm="'merchant:list:contacts'" type="link" danger class="security-correct" @click="openCorrection">{{ t('merchantContactRecovery.title') }}</a-button>
  </section>
  <a-modal v-model:open="correctionOpen" :title="t('merchantContactRecovery.title')" :confirm-loading="busy" @ok="correctContacts">
    <a-alert type="warning" show-icon :message="t('merchantContactRecovery.hint')" />
    <a-form layout="vertical" style="margin-top: 12px">
      <a-form-item :label="t('merchantContactRecovery.phone')" required><a-input v-model:value="correction.phone" placeholder="+959…" /></a-form-item>
      <a-form-item :label="t('merchantContactRecovery.email')" required><a-input v-model:value="correction.email" :maxlength="100" /></a-form-item>
      <a-form-item :label="t('merchantContactRecovery.reason')" required><a-textarea v-model:value="correction.reason" :maxlength="500" /></a-form-item>
    </a-form>
  </a-modal>
  <a-modal :open="!!target" :title="t('merchant.profile.reset2Fa')" :confirm-loading="busy" @cancel="target = null" @ok="confirm">
    <p>{{ target?.username }}</p>
    <a-alert :message="t('merchantSecurity.resetEnrollmentHint')" type="warning" show-icon style="margin-bottom: 12px" />
    <a-form layout="vertical"><a-form-item :label="t('merchantSecurity.reason')" required><a-textarea v-model:value="reason" :maxlength="200" /></a-form-item></a-form>
  </a-modal>

</template>

<style scoped>
.security-section h4 { margin: 0 0 10px; font-size: 12px; line-height: 18px; font-weight: 600; letter-spacing: .06em; color: #64748b; text-transform: uppercase; }
.security-card { border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; }
.security-access { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; padding: 12px 14px; background: #f8fafc; }
.security-access-status { display: flex; flex-direction: column; gap: 3px; }
.security-access-status > span, .security-grid dt, .security-account label { color: #94a3b8; font-size: 11px; line-height: 17px; }
.security-access strong { font-size: 13px; line-height: 20px; color: #1a2332; font-weight: 600; }
.security-account { padding: 10px 14px; border-top: 1px solid #f1f5f9; }
.security-account:empty { display: none; }
.security-account label { display: block; margin-bottom: 4px; }
.security-account :deep(.ant-select) { width: 100%; }
.security-account-name { color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
.security-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
.security-grid > div { min-width: 0; padding: 10px 14px; border-top: 1px solid #f1f5f9; }
.security-grid > div:nth-child(even) { border-left: 1px solid #f1f5f9; }
.security-grid dd { margin: 4px 0 0; color: #1a2332; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.security-grid :deep(.ant-tag) { margin: 0; font-size: 11px; line-height: 19px; border: 0; border-radius: 12px; }
.security-mono { font-family: monospace; }
.security-reset { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-top: 1px solid #f1f5f9; }
.security-reset p, .security-hint { margin: 0; color: #94a3b8; font-size: 11px; line-height: 17px; }
.security-reset .ant-btn { flex-shrink: 0; font-size: 12px; }
.security-hint { padding: 12px 14px; }
.security-correct { height: auto; padding: 8px 0 0; font-size: 11px; }
</style>
