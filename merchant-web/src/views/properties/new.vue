<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { CheckCircleFilled, CloseOutlined, FileImageOutlined, FilePdfOutlined, LeftOutlined, RightOutlined, UploadOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { apiPropertyKyc, apiPropertyKycSubmit, apiPropertyKycUpload, apiPropertySave, type PropertyKycDocument } from '@/api/properties';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();
const step = ref<1 | 2>(1);
const saving = ref(false);
const submitting = ref(false);
const uploading = ref<string[]>([]);
const propertyId = ref(Number(route.query.propertyId) || 0);
const propertyName = ref('');
const propertyType = ref('hotel');
const merchantId = ref(userStore.profile?.merchantId ?? 0);
const roomTypes = ref(0);
const location = ref('');
const imageInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref('');
const kycStatus = ref(0);
const rejectReason = ref('');
const documents = ref<PropertyKycDocument[]>([]);

const merchantOptions = computed(() => {
  const seen = new Set<number>();
  return userStore.properties.filter((item) => {
    if (seen.has(item.merchant_id)) return false;
    seen.add(item.merchant_id);
    return true;
  });
});
const lockedKyc = computed(() => [1, 2, 3].includes(kycStatus.value));
const canSubmit = computed(() => !lockedKyc.value && documents.value.filter((item) => item.required).every((item) => item.uploaded));

function setImage(file?: File): void {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    message.warning(t('properties.new.invalidImage'));
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = URL.createObjectURL(file);
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  setImage(input.files?.[0]);
  input.value = '';
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  setImage(event.dataTransfer?.files?.[0]);
}

function removeImage(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

async function loadKyc(): Promise<void> {
  if (!propertyId.value) return;
  const data = await apiPropertyKyc(propertyId.value);
  propertyName.value = data.propertyName;
  propertyType.value = data.businessType;
  merchantId.value = data.merchantId;
  location.value = data.location;
  kycStatus.value = data.kycStatus;
  rejectReason.value = data.rejectReason;
  documents.value = data.documents;
}

async function next(): Promise<void> {
  const name = propertyName.value.trim();
  if (!name) {
    message.warning(t('properties.new.nameRequired'));
    return;
  }
  if (userStore.accountType === 1 && merchantId.value <= 0) {
    message.warning(t('properties.new.merchantRequired'));
    return;
  }
  saving.value = true;
  try {
    const result = await apiPropertySave({
      propertyId: propertyId.value || undefined,
      merchantId: merchantId.value || undefined,
      propertyName: name,
      businessType: propertyType.value,
      location: location.value.trim(),
    });
    propertyId.value = result.propertyId;
    await router.replace({ path: route.path, query: { propertyId: result.propertyId } });
    await loadKyc();
    step.value = 2;
  } finally {
    saving.value = false;
  }
}

async function uploadDocument(doc: PropertyKycDocument, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !propertyId.value) return;
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    message.warning(t('properties.new.invalidDocument'));
    return;
  }
  uploading.value = [...uploading.value, doc.docType];
  try {
    await apiPropertyKycUpload(propertyId.value, doc.docType, file);
    await loadKyc();
    message.success(t('properties.new.uploaded'));
  } finally {
    uploading.value = uploading.value.filter((item) => item !== doc.docType);
  }
}

async function submitReview(): Promise<void> {
  if (!propertyId.value || !canSubmit.value) return;
  submitting.value = true;
  try {
    await apiPropertyKycSubmit(propertyId.value);
    message.success(t('properties.new.submitted'));
    await router.push('/properties');
  } finally {
    submitting.value = false;
  }
}

function documentIcon(doc: PropertyKycDocument) {
  return doc.fileName.toLowerCase().endsWith('.pdf') ? FilePdfOutlined : FileImageOutlined;
}

onMounted(async () => {
  if (propertyId.value) {
    await loadKyc();
    step.value = 2;
  }
});
onBeforeUnmount(removeImage);
</script>

<template>
  <main class="new-property-page">
    <div class="page-content">
      <nav class="breadcrumb" :aria-label="t('sidebar.addProperty')">
        <button type="button" @click="router.push('/properties')"><LeftOutlined />{{ t('sidebar.allProperties') }}</button>
        <RightOutlined class="breadcrumb-separator" />
        <strong>{{ t('sidebar.addProperty') }}</strong>
      </nav>

      <div class="step-card" :aria-label="step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'">
        <div :class="['step', { active: step === 1, complete: step === 2 }]">
          <span class="step-number"><CheckCircleFilled v-if="step === 2" /><template v-else>1</template></span>
          <span>{{ t('properties.new.basic') }}</span>
        </div>
        <span :class="['step-line', { complete: step === 2 }]" />
        <div :class="['step', { active: step === 2 }]">
          <span class="step-number">2</span><span>{{ t('properties.new.documents') }}</span>
        </div>
      </div>

      <section v-if="step === 1" class="information-card">
        <h1>{{ t('properties.new.basic') }}</h1>
        <div class="field-grid">
          <label v-if="userStore.accountType === 1" class="field">
            <span>{{ t('properties.new.merchant') }}</span>
            <select v-model="merchantId" :class="{ placeholder: !merchantId }">
              <option :value="0" disabled>{{ t('properties.new.merchantPlaceholder') }}</option>
              <option v-for="merchant in merchantOptions" :key="merchant.merchant_id" :value="merchant.merchant_id">{{ merchant.merchant_name }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t('properties.new.name') }}</span>
            <input v-model="propertyName" type="text" :placeholder="t('properties.new.namePlaceholder')" maxlength="100" />
          </label>
          <label class="field">
            <span>{{ t('properties.new.type') }}</span>
            <select v-model="propertyType">
              <option value="hotel">{{ t('sidebar.hotel') }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t('properties.new.roomTypes') }}</span>
            <input v-model.number="roomTypes" type="number" min="0" step="1" />
          </label>
          <label class="field">
            <span>{{ t('properties.new.location') }}</span>
            <input v-model="location" type="text" :placeholder="t('properties.new.locationPlaceholder')" maxlength="255" />
          </label>
          <div class="field image-field">
            <span>{{ t('properties.new.image') }}</span>
            <div class="upload-zone" @dragover.prevent @drop="onDrop">
              <template v-if="previewUrl">
                <img :src="previewUrl" :alt="t('properties.new.image')" />
                <button class="remove-image" type="button" :aria-label="t('common.delete')" @click="removeImage"><CloseOutlined /></button>
              </template>
              <button v-else class="upload-button" type="button" @click="imageInput?.click()">
                <UploadOutlined />
                <strong>{{ t('properties.new.upload') }}</strong>
                <small>{{ t('properties.new.uploadHint') }}</small>
              </button>
            </div>
            <input ref="imageInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/gif" @change="onFileChange" />
          </div>
        </div>
      </section>

      <section v-else class="kyc-card">
        <div class="kyc-heading">
          <div><h1>{{ t('properties.new.documents') }}</h1><p>{{ t('properties.new.documentsSubtitle') }}</p></div>
          <span v-if="kycStatus > 0" class="kyc-state">{{ t(`properties.kycStatus.${kycStatus}`) }}</span>
        </div>
        <div class="review-warning"><WarningOutlined /><span>{{ t('properties.new.reviewWarning') }}</span></div>
        <div v-if="rejectReason" class="reject-warning"><strong>{{ t('properties.new.reviewReason') }}</strong>{{ rejectReason }}</div>
        <div class="document-list">
          <article v-for="doc in documents" :key="doc.docType" class="document-row">
            <span class="document-icon"><component :is="documentIcon(doc)" /></span>
            <div class="document-copy">
              <strong>{{ doc.name }} <em v-if="doc.required">*</em></strong>
              <small>{{ doc.uploaded ? doc.fileName : t('properties.new.documentFormats') }}</small>
              <span v-if="doc.rejectReason" class="doc-reason">{{ doc.rejectReason }}</span>
            </div>
            <span v-if="doc.uploaded" class="uploaded-mark"><CheckCircleFilled /> {{ t('properties.new.uploaded') }}</span>
            <label v-if="!lockedKyc" v-perm="'mch:properties:kyc-upload'" :class="['document-upload', { disabled: uploading.includes(doc.docType) }]">
              <UploadOutlined /> {{ uploading.includes(doc.docType) ? t('common.loading') : t(doc.uploaded ? 'properties.new.replace' : 'properties.new.chooseFile') }}
              <input type="file" accept="application/pdf,image/jpeg,image/png" :disabled="uploading.includes(doc.docType)" @change="uploadDocument(doc, $event)" />
            </label>
          </article>
        </div>
      </section>
    </div>

    <footer class="page-footer">
      <span>{{ t(step === 1 ? 'properties.new.step' : 'properties.new.stepTwo') }}</span>
      <div class="footer-actions">
        <button v-if="step === 1" class="cancel-button" type="button" @click="router.push('/properties')">{{ t('common.cancel') }}</button>
        <button v-else class="cancel-button" type="button" @click="step = 1"><LeftOutlined /> {{ t('properties.new.previous') }}</button>
        <button v-if="step === 1" v-perm="'mch:properties:add'" class="next-button" type="button" :disabled="saving" @click="next">{{ t('properties.new.next') }} <RightOutlined /></button>
        <button v-else-if="!lockedKyc" v-perm="'mch:properties:kyc-submit'" class="next-button" type="button" :disabled="!canSubmit || submitting" @click="submitReview">{{ t('properties.new.submitReview') }}</button>
        <button v-else class="next-button" type="button" @click="router.push('/properties')">{{ t('properties.new.backToProperties') }}</button>
      </div>
    </footer>
  </main>
</template>

<style scoped lang="less">
.new-property-page { min-height: calc(100vh - 56px); padding: 24px 28px 92px; background: #f7f8fa; color: #0f172a; }
.breadcrumb { display: flex; align-items: center; gap: 12px; height: 44px; margin-bottom: 12px; font-size: 12px; }
.breadcrumb button { display: flex; align-items: center; gap: 7px; height: 44px; padding: 0 12px; border: 0; background: none; color: #64748b; font: inherit; cursor: pointer; }
.breadcrumb strong { font-size: 14px; }
.breadcrumb-separator { color: #cbd5e1; font-size: 11px; }
.step-card, .information-card, .kyc-card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.step-card { display: flex; align-items: center; height: 87px; padding: 16px 24px; margin-bottom: 14px; }
.step { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 80px; color: #94a3b8; font-size: 10px; font-weight: 500; }
.step-number { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9; font-size: 12px; font-weight: 700; }
.step.active { color: #1447e6; }
.step.active .step-number { background: #155dfc; color: #fff; }
.step.complete { color: #16a34a; }
.step.complete .step-number { background: #dcfce7; color: #16a34a; font-size: 16px; }
.step-line { align-self: flex-start; width: 32px; height: 2px; margin: 15px 4px 0; background: #e2e8f0; }
.step-line.complete { background: #86efac; }
.information-card { min-height: 482px; padding: 16px 24px 24px; }
.information-card h1, .kyc-card h1 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 700; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: #334155; font-size: 12px; font-weight: 600; }
.field input, .field select { width: 100%; height: 44px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 8px; outline: none; background: #fff; color: #0f172a; font: inherit; font-size: 14px; font-weight: 400; }
.field input::placeholder, .field select.placeholder { color: #94a3b8; }
.field input:focus, .field select:focus { border-color: #4169ed; box-shadow: 0 0 0 3px rgba(65, 105, 237, .12); }
.image-field { grid-column: 1 / -1; gap: 12px; }
.upload-zone { position: relative; display: grid; place-items: center; height: 180px; overflow: hidden; border: 1px dashed #e2e8f0; border-radius: 8px; }
.upload-zone > img { width: 100%; height: 100%; object-fit: contain; }
.upload-button { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; height: 100%; justify-content: center; border: 0; background: transparent; color: #334155; font: inherit; cursor: pointer; }
.upload-button > :first-child { font-size: 24px; }
.upload-button strong { font-size: 14px; font-weight: 600; }
.upload-button small { color: #94a3b8; font-size: 12px; }
.remove-image { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer; }
.visually-hidden, .document-upload input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.kyc-card { min-height: 430px; padding: 24px; }
.kyc-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.kyc-heading p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
.kyc-state { padding: 5px 10px; border-radius: 999px; background: #fff7e6; color: #c26a00; font-size: 12px; font-weight: 600; }
.review-warning, .reject-warning { display: flex; gap: 10px; margin-top: 20px; padding: 13px 16px; border: 1px solid #facc15; border-radius: 8px; background: #fffbeb; color: #854d0e; font-size: 12px; line-height: 18px; }
.reject-warning { flex-direction: column; gap: 3px; border-color: #fda4af; background: #fff1f3; color: #9f1239; }
.document-list { margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.document-row { display: flex; align-items: center; gap: 14px; min-height: 82px; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; }
.document-row:last-child { border-bottom: 0; }
.document-icon { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; border-radius: 8px; background: #eef3ff; color: #4169ed; font-size: 19px; }
.document-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.document-copy strong { color: #1e293b; font-size: 13px; }
.document-copy em { color: #e11d48; font-style: normal; }
.document-copy small { overflow: hidden; color: #94a3b8; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.doc-reason { margin-top: 3px; color: #be123c; font-size: 11px; }
.uploaded-mark { flex-shrink: 0; color: #16a34a; font-size: 12px; }
.document-upload { position: relative; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 34px; padding: 0 12px; border: 1px solid #d8e1f3; border-radius: 6px; color: #4169ed; font-size: 12px; font-weight: 600; cursor: pointer; }
.document-upload.disabled { opacity: .55; pointer-events: none; }
.page-footer { position: fixed; right: 0; bottom: 0; left: 228px; z-index: 5; display: flex; align-items: center; justify-content: space-between; min-height: 62px; padding: 12px 28px; border-top: 1px solid #e2e8f0; background: #fff; }
.page-footer > span { color: #94a3b8; font-size: 12px; }
.footer-actions { display: flex; align-items: center; gap: 32px; }
.footer-actions button { display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.footer-actions button:disabled { opacity: .45; cursor: not-allowed; }
.cancel-button { border: 1px solid #94a3b8; background: #fff; color: #64748b; }
.next-button { border: 1px solid #2563eb; background: #2563eb; color: #fff; }
@media (max-width: 900px) { .new-property-page { padding: 16px 16px 88px; } .field-grid { grid-template-columns: 1fr; gap: 16px; } .page-footer { left: 0; padding: 10px 16px; } .footer-actions { gap: 8px; } }
@media (max-width: 640px) { .document-row { align-items: flex-start; flex-wrap: wrap; } .document-copy { flex-basis: calc(100% - 58px); } .uploaded-mark { margin-left: 54px; } .document-upload { margin-left: auto; } }
</style>
