<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiMerchantImpersonateStart } from '@/api/merchant';
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

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.reason = '';
      form.otherReason = '';
    }
  },
);

async function start(): Promise<void> {
  if (!props.merchant) {
    return;
  }
  const reason = form.reason === 'other' ? `other:${form.otherReason}` : form.reason;
  if (!reason) {
    message.warning(t('merchant.impersonate.reasonRequired'));
    return;
  }
  starting.value = true;
  try {
    const session = await apiMerchantImpersonateStart(props.merchant.id, reason);
    impersonationStore.start({
      sessionId: session.session_id,
      sessionKey: session.session_key,
      merchantId: props.merchant.id,
      merchantName: props.merchant.merchant_name,
      reason,
    });
    message.success(t('merchant.impersonate.started'));
    emit('update:open', false);
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
    <a-form layout="vertical">
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
