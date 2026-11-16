<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { fetchMerchantDocument } from '@/utils/merchantDocument';

const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const failed = ref(false);
const url = ref('');
const name = ref('');
const mime = ref('');
let requestId = 0;

function clearFile(): void {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
  name.value = '';
  mime.value = '';
}

function close(): void {
  requestId++;
  open.value = false;
  loading.value = false;
  clearFile();
}

async function show(docId: number): Promise<void> {
  const currentRequest = ++requestId;
  clearFile();
  failed.value = false;
  loading.value = true;
  open.value = true;
  try {
    const file = await fetchMerchantDocument(docId);
    // Closing or selecting another file invalidates the pending response.
    if (currentRequest !== requestId) return;
    url.value = URL.createObjectURL(file.blob);
    name.value = file.name || `document-${docId}`;
    mime.value = file.blob.type;
  } catch {
    if (currentRequest === requestId) failed.value = true;
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function download(): void {
  if (!url.value) return;
  const link = document.createElement('a');
  link.href = url.value;
  link.download = name.value;
  link.click();
}

onBeforeUnmount(close);
defineExpose({ show });
</script>

<template>
  <a-modal :open="open" :z-index="1300" :width="960" :title="t('merchant.documentsPage.previewTitle')" @cancel="close">
    <div class="document-preview">
      <div v-if="name" class="document-preview__name">{{ name }}</div>
      <div v-if="loading" class="document-preview__empty"><a-spin /></div>
      <a-result v-else-if="failed" status="warning" :title="t('common.loadFailed')" />
      <iframe v-else-if="url && mime === 'application/pdf'" :src="url" :title="name" class="document-preview__pdf" />
      <div v-else-if="url && mime.startsWith('image/')" class="document-preview__image"><img :src="url" :alt="name" /></div>
      <a-empty v-else-if="url" :description="t('merchant.onboardingPage.previewUnavailable')" />
    </div>
    <template #footer>
      <a-button @click="close">{{ t('common.close') }}</a-button>
      <a-button type="primary" :disabled="!url || loading" @click="download"><DownloadOutlined />{{ t('common.download') }}</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.document-preview__name { margin-bottom: 12px; font-size: 12px; color: #64748b; overflow-wrap: anywhere; }
.document-preview__empty { display: grid; place-items: center; min-height: 240px; }
.document-preview__pdf { display: block; width: 100%; height: 65vh; border: 1px solid #e3e8f0; border-radius: 6px; }
.document-preview__image { display: flex; justify-content: center; max-height: 65vh; overflow: auto; padding: 12px; background: #f8fafc; border: 1px solid #e3e8f0; border-radius: 6px; }
.document-preview__image img { max-width: 100%; object-fit: contain; }
</style>
