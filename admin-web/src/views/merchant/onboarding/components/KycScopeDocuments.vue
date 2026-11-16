<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons-vue';
import type { TableRow } from '@/composables/useTable';
import StatusTag from '@/components/StatusTag.vue';
import type { StatusItem } from '@/components/StatusTag.vue';

const props = defineProps<{
  title: string;
  subtitle: string;
  status: string;
  documents: TableRow[];
  scopeType: 'merchant' | 'property';
  businessId: number;
  busy?: boolean;
  canUpload?: (status: string, doc: TableRow) => boolean;
  canReview?: (status: string, doc: TableRow) => boolean;
  formalMerchant?: boolean;
}>();
const emit = defineEmits<{ upload: [file: File, scope: string, businessId: number, doc: TableRow]; preview: [docId: number]; review: [doc: TableRow, action: 'verify' | 'reject'] }>();
const { t } = useI18n();
const uploaded = computed(() => props.documents.filter((doc) => doc.hasFile).length);

function viewDocument(doc: TableRow): void {
  emit('preview', doc.id);
}

function statusLabel(status: string): string {
  const key = status.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
  return t(`merchant.onboardingPage.kycDoc${key}`);
}
const documentStatuses = computed<Record<string, StatusItem>>(() => ({
  missing: { text: statusLabel('missing'), color: 'default' },
  approved: { text: statusLabel('approved'), color: 'success' },
  pending_review: { text: statusLabel('pending_review'), color: 'warning' },
  rejected: { text: statusLabel('rejected'), color: 'error' },
  expired: { text: statusLabel('expired'), color: 'error' },
  resubmit_required: { text: statusLabel('resubmit_required'), color: 'error' },
}));

function upload(file: File, doc: TableRow): false {
  if (!props.busy && props.canUpload?.(props.status, doc)) {
    emit('upload', file, props.scopeType, props.businessId, doc);
  }
  return false;
}

function uploadHandler(doc: TableRow): (file: File) => false {
  return (file) => upload(file, doc);
}
</script>

<template>
  <section class="scope-documents">
    <div class="scope-documents__head">
      <div><strong>{{ title }}</strong><span>{{ subtitle }}</span></div>
      <span class="scope-documents__count">{{ t('merchant.onboardingPage.uploadedCount', { done: uploaded, total: documents.length }) }}</span>
    </div>
    <div v-for="doc in documents" :key="doc.docType" class="scope-document">
      <span class="sap-document-icon"><FileTextOutlined /></span>
      <div class="scope-document__body">
        <div class="scope-document__name">{{ doc.name }} <span v-if="doc.required" class="scope-document__required">{{ t('merchant.onboardingPage.tplDocRequiredLabel') }}</span></div>
        <div class="scope-document__file">{{ doc.hasFile ? doc.fileName : t('merchant.onboardingPage.kycDocMissing') }}<template v-if="doc.documentVersion"> · v{{ doc.documentVersion }}</template></div>
        <div v-if="doc.rejectReason" class="scope-document__reason">{{ doc.rejectReason }}</div>
      </div>
      <StatusTag class="scope-document__status" :value="doc.status" :map="documentStatuses" variant="pill" />
      <a-button
        v-if="doc.hasFile && doc.id"
        :key="`${doc.id}-${formalMerchant}`"
        v-perm="formalMerchant ? 'merchant:document:download' : ['merchant:onboarding:kyc', 'merchant:verify:doc', 'merchant:document:download']"
        class="scope-document__action" type="link" size="small" @click="viewDocument(doc)"
      >{{ t('merchant.onboardingPage.docView') }}</a-button>
      <div v-if="canReview?.(status, doc)" v-perm="'merchant:onboarding:kyc'" class="scope-document__review">
        <a-button class="scope-document__action scope-document__approve" size="small" :disabled="busy" @click="emit('review', doc, 'verify')">{{ t('merchant.documentsPage.verify') }}</a-button>
        <a-button class="scope-document__action" danger size="small" :disabled="busy" @click="emit('review', doc, 'reject')">{{ t('merchant.onboardingPage.reviewReject') }}</a-button>
      </div>
      <a-upload
        v-if="canUpload?.(status, doc)" v-perm="'merchant:onboarding:kyc'"
        accept=".pdf,.jpg,.jpeg,.png,.webp" :show-upload-list="false" :disabled="busy" :before-upload="uploadHandler(doc)"
      ><a-button class="scope-document__action" size="small" :disabled="busy"><UploadOutlined />{{ t(doc.hasFile ? 'merchant.onboardingPage.replaceDocument' : 'merchant.onboardingPage.assistUploadDocument') }}</a-button></a-upload>
    </div>
    <div v-if="!documents.length" class="scope-documents__empty">{{ t('merchant.onboardingPage.noRequiredDocuments') }}</div>
  </section>
</template>

<style scoped>
.scope-documents { border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; }
.scope-documents__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; background: #f8fafc; border-bottom: 1px solid #e3e8f0; }
.scope-documents__head strong { display: block; font-size: 12px; font-weight: 600; color: #334155; }
.scope-documents__head span { display: block; margin-top: 2px; font-size: 11px; color: #64748b; overflow-wrap: anywhere; }
.scope-documents__count { flex-shrink: 0; }
.scope-document { display: flex; align-items: center; gap: 10px; padding: 12px; border-top: 1px solid #f1f5f9; background: #fff; }
.scope-document:first-of-type { border-top: 0; }
.scope-document__body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.scope-document__name { font-size: 12px; font-weight: 500; color: #1a2332; }
.scope-document__required { color: #94a3b8; font-size: 10px; margin-left: 4px; }
.scope-document__file { font-size: 11px; color: #94a3b8; margin-top: 3px; }
.scope-document__reason { color: #b42318; font-size: 11px; margin-top: 4px; }
.scope-document__action { height: 26px; padding: 0 8px; font-size: 11px; border-radius: 5px; }
.scope-document__review { display: flex; gap: 6px; flex-shrink: 0; }
.scope-document__approve { color: #059669; border-color: #a7f3d0; background: #ecfdf5; }
.scope-document__status { flex-shrink: 0; }
.scope-documents__empty { padding: 12px; font-size: 12px; color: #94a3b8; }
@media (max-width: 560px) {
  .scope-document { flex-wrap: wrap; gap: 8px; }
  .scope-document__body { flex-basis: calc(100% - 36px); }
  .scope-documents__head { align-items: flex-start; }
}
</style>
