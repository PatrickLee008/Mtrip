<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiMerchantImpersonateStart, apiMerchantSecurityAccounts, type SecurityAccount } from '@/api/merchant';
import { useImpersonationStore } from '@/stores/impersonation';
import type { TableRow } from '@/composables/useTable';

/**
 * 开始代入会话弹窗(整改 B2,原型 Start Impersonation Session)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.6
 */
const props = defineProps<{
  open: boolean;
  merchant: TableRow | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const { t } = useI18n();
const impersonationStore = useImpersonationStore();

const REASONS = ['technical_support', 'booking_investigation', 'payment_investigation', 'customer_complaint', 'other'] as const;

const form = reactive({ reason: '', otherReason: '' });
const starting = ref(false);
const accounts = ref<SecurityAccount[]>([]);
const accountId = ref<number>();
const portalUrl = (): string => {
  const configured = import.meta.env.VITE_MERCHANT_PORTAL_URL as string | undefined;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:')) throw new Error(t('merchantSecurity.portalMissing'));
    return url.origin;
  }
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:5174`;
  throw new Error(t('merchantSecurity.portalMissing'));
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      form.reason = '';
      form.otherReason = '';
      accountId.value = undefined;
      accounts.value = [];
      if (props.merchant) accounts.value = (await apiMerchantSecurityAccounts(props.merchant.id)).filter((row) => row.account_type !== 1 && row.status === 1);
    }
  },
);

async function start(): Promise<void> {
  if (!props.merchant || !accountId.value) {
    return;
  }
  const reason = form.reason === 'other' ? `other:${form.otherReason}` : form.reason;
  if (!reason || (form.reason === 'other' && !form.otherReason.trim())) {
    message.warning(t('merchant.impersonate.reasonRequired'));
    return;
  }
  let origin: string;
  try { origin = portalUrl(); } catch { message.error(t('merchantSecurity.portalMissing')); return; }
  const popup = window.open('about:blank', '_blank');
  if (!popup) { message.warning(t('merchantSecurity.popupBlocked')); return; }
  popup.opener = null;
  starting.value = true;
  try {
    const session = await apiMerchantImpersonateStart(props.merchant.id, accountId.value, reason);
    popup.location.replace(`${origin}/support-session#${session.exchangeCode}`);
    impersonationStore.start({
      sessionId: session.session_id,
      sessionKey: session.session_key,
      merchantId: props.merchant.id,
      merchantName: props.merchant.merchant_name,
      reason,
    });
    message.success(t('merchant.impersonate.started'));
    emit('update:open', false);
  } catch (error) {
    popup.close();
    throw error;
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="t('merchant.impersonate.title')"
    :confirm-loading="starting"
    :ok-text="t('merchant.impersonate.start')"
    @update:open="emit('update:open', $event)"
    @ok="start"
  >
    <p style="margin: 8px 0 12px">
      {{ t('merchant.impersonate.desc', { name: merchant?.merchant_name ?? '' }) }}
    </p>
    <a-alert :message="t('merchantSecurity.supportHint')" type="warning" show-icon />
    <a-form layout="vertical">
      <a-form-item :label="t('merchantSecurity.account')" required>
        <a-select v-model:value="accountId" :options="accounts.map((row) => ({ value: row.id, label: row.username }))" />
      </a-form-item>
      <a-form-item :label="`${t('merchant.impersonate.reason')} *`">
        <a-select v-model:value="form.reason" :placeholder="t('merchant.impersonate.selectPlaceholder')">
          <a-select-option v-for="r in REASONS" :key="r" :value="r">{{ t(`merchant.impersonate.reasonOption.${r}`) }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="form.reason === 'other'">
        <a-input v-model:value="form.otherReason" :placeholder="t('merchant.impersonate.otherPlaceholder')" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
