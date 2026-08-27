<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message, Modal } from 'ant-design-vue';
import { post } from '@/utils/http';
import type { TableRow } from '@/composables/useTable';
const props = defineProps<{ open: boolean; document: TableRow | null }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'saved'): void }>();
const { t } = useI18n();
const reason = ref('');
const expiry = ref('');
const file = ref<File | null>(null);
const saving = ref(false);
watch(() => props.open, () => { reason.value = ''; expiry.value = ''; file.value = null; });
function choose(event: Event): void { file.value = (event.target as HTMLInputElement).files?.[0] ?? null; }
function save(): void {
  if (!file.value || !reason.value.trim()) { message.warning(t('merchant.s3.replaceRequired')); return; }
  if (file.value.size > 10 * 1024 * 1024) { message.warning(t('merchant.s3.maxFile')); return; }
  Modal.confirm({ title: t('merchant.s3.replaceConfirm'), content: t('merchant.s3.pendingNotice'), async onOk() {
    if (!props.document || !file.value) return;
    saving.value = true;
    try {
      const data = new FormData();
      data.append('docId', String(props.document.id));
      data.append('expectedVersion', String(props.document.document_version));
      data.append('reason', reason.value.trim());
      data.append('expiryDate', expiry.value || '');
      data.append('file', file.value);
      await post('/admin/merchant/document/replace', data);
      message.success(t('merchant.s3.replaced'));
      emit('update:open', false); emit('saved');
    } finally { saving.value = false; }
  } });
}
</script>
<template>
  <a-modal :open="open" :title="t('merchant.s3.replace')" :confirm-loading="saving" destroy-on-close @cancel="emit('update:open', false)" @ok="save">
    <a-alert type="info" show-icon :message="t('merchant.s3.pendingNotice')" style="margin-bottom: 16px" />
    <a-form layout="vertical">
      <a-form-item :label="t('merchant.s3.file')" required><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" @change="choose" /></a-form-item>
      <a-form-item :label="t('merchant.s3.reason')" required><a-textarea v-model:value="reason" :maxlength="500" :rows="3" /></a-form-item>
      <a-form-item :label="t('merchant.documentsPage.expiryDate')"><a-date-picker v-model:value="expiry" value-format="YYYY-MM-DD" /></a-form-item>
    </a-form>
  </a-modal>
</template>
