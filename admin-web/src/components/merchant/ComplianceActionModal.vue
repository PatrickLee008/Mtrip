<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import { apiViolationHandle, apiWarningIssue, apiWarningRevoke } from '@/api/compliance';
const props = defineProps<{ open: boolean; action: string; row: Record<string, any> }>();
const emit = defineEmits<{ 'update:open': [boolean]; changed: [] }>();
const { t } = useI18n();
const saving = ref(false);
const deadline = ref<Dayjs>();
const form = reactive({ note: '', reason: '', level: 1, expiresAt: '', confirmed: false, requestId: '' });
const changesState = computed(() => ['suspend', 'restore'].includes(props.action));
watch(() => props.open, (open) => {
  if (open) { Object.assign(form, { note: '', reason: '', level: 1, expiresAt: '', confirmed: false, requestId: crypto.randomUUID() }); deadline.value = undefined; }
});
async function submit(): Promise<void> {
  if (!form.note.trim() || (props.action === 'warn' && !form.reason.trim()) || (changesState.value && !form.confirmed)) { message.warning(t('common.required')); return; }
  saving.value = true;
  try {
    const data = { ...form, id: props.row.id, expectedVersion: Number(props.row.version), action: props.action,
      expectedMerchantVersion: Number(props.row.merchant_status_version), suspendedUntil: deadline.value?.toISOString() };
    if (props.action === 'warn') await apiWarningIssue(data);
    else if (props.action === 'revoke') await apiWarningRevoke(data);
    else await apiViolationHandle(data);
    message.success(t('tip.saveSuccess')); emit('update:open', false); emit('changed');
  } finally { saving.value = false; }
}
</script>
<template>
  <a-modal :open="open" :title="t(`complianceS6.actions.${action}`)" :confirm-loading="saving" :mask-closable="false" @cancel="emit('update:open', false)" @ok="submit">
    <a-alert :message="`${row.merchant_name} (#${row.merchant_id}) · #${row.id}`" type="info" style="margin-bottom: 16px" />
    <a-alert v-if="changesState" :message="t('complianceS6.stateNotice')" type="warning" style="margin-bottom: 16px" />
    <a-form layout="vertical">
      <template v-if="action === 'warn'">
        <a-form-item :label="t('complianceS6.reason')" required><a-textarea v-model:value="form.reason" :maxlength="255" /></a-form-item>
        <a-form-item :label="t('complianceS6.level')"><a-select v-model:value="form.level"><a-select-option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ n }}</a-select-option></a-select></a-form-item>
        <a-form-item :label="t('complianceS6.expires')"><a-date-picker v-model:value="form.expiresAt" value-format="YYYY-MM-DD" /></a-form-item>
      </template>
      <a-form-item v-if="action === 'suspend'" :label="t('complianceS6.until')"><a-date-picker v-model:value="deadline" show-time /></a-form-item>
      <a-form-item :label="t('complianceS6.note')" required><a-textarea v-model:value="form.note" :rows="3" :maxlength="500" /></a-form-item>
      <a-checkbox v-if="changesState" v-model:checked="form.confirmed">{{ t('complianceS6.confirmState') }}</a-checkbox>
    </a-form>
  </a-modal>
</template>
