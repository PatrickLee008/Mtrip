<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { apiOnboardingPropertyKycTemplates, apiOnboardingPropertyKycConfigure } from '@/api/merchant';
import type { TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { genUUID } from '@/utils/uuid';

const props = defineProps<{ applicationId: number; property: TableRow; busy?: boolean }>();
const emit = defineEmits<{ saved: [applicationId: number, businessId: number] }>();
const { t } = useI18n();
const user = useUserStore();
const key = (name: string) => t(`merchant.onboardingPage.${name}`);
const options = ref<TableRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref(false);
const open = ref(false);
type Requirement = { docType: string; name: string; required: boolean };
const form = reactive({ templateId: 0, expectedTemplateId: 0, name: '', reason: '', amendment: false, documents: [] as Requirement[] });
const editable = computed(() => props.property.templateEditable === true);
const changeable = computed(() => props.property.templateChangeable === true);
const permitted = computed(() => user.hasPerm('merchant:onboarding:kyc'));
const selectOptions = computed(() => {
  const rows = options.value.map(row => ({ value: Number(row.id), label: String(row.name) }));
  const current = props.property.template;
  if (current?.id && !rows.some(row => row.value === Number(current.id))) rows.unshift({ value: Number(current.id), label: String(current.name) });
  return rows;
});
let requestVersion = 0;
onBeforeUnmount(() => { requestVersion++; });
async function loadOptions(): Promise<void> {
  const version = ++requestVersion;
  options.value = [];
  loadError.value = false;
  if (!changeable.value) { loading.value = false; return; }
  loading.value = true;
  try {
    const rows = await apiOnboardingPropertyKycTemplates(props.applicationId, Number(props.property.applicationBusinessId));
    if (version === requestVersion) options.value = rows;
  } catch {
    if (version === requestVersion) loadError.value = true;
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}
watch(() => [props.applicationId, props.property.applicationBusinessId], () => {
  open.value = false;
  void loadOptions();
}, { immediate: true });

function copyDocuments(rows: TableRow[]): Requirement[] {
  return rows.map(doc => ({ docType: String(doc.docType), name: String(doc.name), required: doc.required === true }));
}
function editRequirements(templateId?: number): void {
  if (!permitted.value || !changeable.value || props.busy || saving.value || loading.value || loadError.value) return;
  const current = props.property.template;
  if (!current?.id) return;
  const chosen = templateId && templateId !== Number(current.id) ? options.value.find(row => Number(row.id) === templateId) : null;
  if (templateId && templateId !== Number(current.id) && !chosen) return;
  Object.assign(form, {
    templateId: Number(chosen?.id || current.id), expectedTemplateId: Number(current.id),
    name: String(chosen?.name || current.name), reason: '', amendment: !editable.value,
    documents: copyDocuments(chosen?.documents || props.property.documents || []),
  });
  open.value = true;
}
function chooseTemplate(id: number): void {
  const chosen = options.value.find(row => Number(row.id) === id);
  if (!chosen) {
    if (id === Number(props.property.template?.id)) {
      form.templateId = id;
      form.name = String(props.property.template.name);
      form.documents = copyDocuments(props.property.documents || []);
    }
    return;
  }
  form.templateId = id;
  form.name = String(chosen.name);
  form.documents = copyDocuments(chosen.documents || []);
}
function addRequirement(): void {
  // The document identifier is internal; administrators edit the document name and required flag.
  form.documents.push({ docType: `custom_${genUUID().replace(/-/g, '').slice(0, 24)}`, name: '', required: true });
}
function removeRequirement(index: number): void { form.documents.splice(index, 1); }
async function saveRequirements(): Promise<void> {
  if (!permitted.value || saving.value || props.busy || !changeable.value || !open.value) return;
  if (Number(props.property.template?.id) !== form.expectedTemplateId) {
    message.warning(key('propertyTemplateStale')); return;
  }
  const docs = form.documents.map(doc => ({ ...doc, name: doc.name.trim() }));
  if (!form.name.trim() || !docs.length || !docs.some(doc => doc.required) || docs.some(doc => !doc.name) || (form.amendment && !form.reason.trim())) {
    message.warning(key('propertyTemplateRequired')); return;
  }
  const applicationId = props.applicationId;
  const businessId = Number(props.property.applicationBusinessId);
  saving.value = true;
  try {
    await apiOnboardingPropertyKycConfigure({ id: applicationId, applicationBusinessId: businessId,
      expectedTemplateId: form.expectedTemplateId, templateId: form.templateId, name: form.name.trim(),
      documents: docs, amendment: form.amendment, reason: form.reason.trim() });
    if (props.applicationId === applicationId && Number(props.property.applicationBusinessId) === businessId) {
      open.value = false;
      message.success(key('propertyTemplateSaved'));
    }
    emit('saved', applicationId, businessId);
  } catch {
    // The HTTP interceptor displays the server error; keep the draft open for correction/retry.
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="property-template">
    <div class="kyc-label">{{ key('verificationTemplate') }}</div>
    <a-select :value="Number(property.template?.id) || undefined" :options="selectOptions" :loading="loading" :disabled="!permitted || !editable || busy || saving || loading || loadError" class="property-template__select" @change="editRequirements" />
    <div v-if="loadError" class="property-template__hint">{{ key('propertyTemplateLoadFailed') }} <a-button type="link" size="small" @click="loadOptions">{{ key('propertyTemplateRetry') }}</a-button></div>
    <slot />
    <div class="property-template__actions">
      <slot name="actions" />
      <a-button v-if="changeable" v-perm="'merchant:onboarding:kyc'" class="property-template__edit" :disabled="busy || saving || loading || loadError" @click="editRequirements()"><EditOutlined />{{ key(editable ? 'editTemplate' : 'propertyTemplateAmend') }}</a-button>
    </div>
    <p class="property-template__hint property-template__scope-hint">{{ key(editable ? 'propertyTemplateLocalHint' : changeable ? 'propertyTemplateLockedHint' : 'propertyTemplateFinalHint') }}</p>
    <a-modal v-model:open="open" :title="key(form.amendment ? 'propertyTemplateAmend' : 'editTemplateTitle')" :width="640" :confirm-loading="saving" :closable="!saving" :mask-closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" :ok-text="key(form.amendment ? 'propertyTemplateAmendSave' : 'propertyTemplateSave')" @ok="saveRequirements">
      <div class="property-template__business">{{ property.businessName }}</div>
      <a-alert :type="form.amendment ? 'warning' : 'info'" show-icon :message="key(form.amendment ? 'propertyTemplateAmendWarning' : 'propertyTemplateLocalHint')" class="property-template__notice" />
      <a-form layout="vertical" :disabled="saving">
        <a-form-item :label="key('verificationTemplate')">
          <a-select :value="form.templateId" :options="selectOptions" @change="chooseTemplate" />
        </a-form-item>
        <a-form-item :label="key('tplName')" required><a-input v-model:value="form.name" :maxlength="100" /></a-form-item>
        <div class="property-template__documents-label">{{ key('requiredDocuments') }}</div>
        <div v-for="(doc, index) in form.documents" :key="index" class="property-template__document">
          <a-input v-model:value="doc.name" :maxlength="100" :placeholder="key('tplDocName')" :aria-label="key('tplDocName')" />
          <a-checkbox v-model:checked="doc.required">{{ key('tplDocRequiredLabel') }}</a-checkbox>
          <a-button type="text" danger :aria-label="key('propertyTemplateRemoveDoc')" @click="removeRequirement(index)"><DeleteOutlined /></a-button>
        </div>
        <a-button type="dashed" block :disabled="form.documents.length >= 50" @click="addRequirement"><PlusOutlined />{{ key('tplAddDoc') }}</a-button>
        <a-form-item v-if="form.amendment" :label="key('propertyTemplateChangeReason')" required class="property-template__reason"><a-textarea v-model:value="form.reason" :maxlength="300" :rows="3" show-count /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="less">
.property-template { margin: 0 0 16px; }
.property-template > .kyc-label { font-size: 11px; font-weight: 600; color: #475569; letter-spacing: .05em; margin-bottom: 4px; }
.property-template__select { width: 100%; margin-bottom: 12px; }
.property-template__select :deep(.ant-select-selector) { min-height: 37px; border-color: #e3e8f0; border-radius: 6px; font-size: 13px; }
.property-template__select :deep(.ant-select-selection-item) { line-height: 35px; }
.property-template__actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.property-template__actions :deep(.ob-preview-requirements) { margin: 0; height: 32px; font-size: 12px; }
.property-template__scope-hint { margin: 8px 0 0; }
.property-template__edit { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; font-size: 12px; height: 32px; }
.property-template__hint { font-size: 12px; color: #64748b; line-height: 1.6; }
.property-template__business { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.property-template__notice { margin-bottom: 16px; }
.property-template__documents-label { margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.property-template__document { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.property-template__document .ant-input { flex: 1; min-width: 0; }
.property-template__document .ant-checkbox-wrapper { white-space: nowrap; font-size: 12px; }
.property-template__reason { margin-top: 20px; }
@media (max-width: 480px) {
  .property-template__document { gap: 6px; }
}
</style>
