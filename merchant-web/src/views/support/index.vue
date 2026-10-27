<script setup lang="ts">
import './controls.less';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { BookOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, InboxOutlined, LoadingOutlined, PlusOutlined, QuestionCircleOutlined, SafetyCertificateOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useUserStore } from '@/stores/user';
import { supportAction, supportGet, supportRequestId, supportUpload, type SupportFile, type SupportOptions, type SupportPage, type SupportTicket } from '@/api/support';
import TicketDrawer from './components/TicketDrawer.vue';
import SupportResources from './components/SupportResources.vue';
const { t } = useI18n(); const user = useUserStore(); const route = useRoute(); const router = useRouter();
const options = ref<SupportOptions>(); const rows = ref<SupportTicket[]>([]); const total = ref(0); const loading = ref(false); const failed = ref(false);
const query = reactive({ keyword: '', category: undefined as string | undefined, priority: undefined as string | undefined, status: undefined as string | undefined, scope: '', propertyId: undefined as number | undefined, page: 1, pageSize: 20 });
const summary = ref<Record<string, number>>({});
const tab = computed({ get: () => ['faq', 'compliance'].includes(String(route.query.tab)) ? String(route.query.tab) : 'tickets', set: value => { void router.replace({ query: { ...route.query, tab: value } }); } });
const cards = [
  { key: 'open', states: 'open,in_progress', icon: InboxOutlined, tone: 'blue' },
  { key: 'waiting_merchant', states: 'waiting_merchant', icon: ClockCircleOutlined, tone: 'orange' },
  { key: 'waiting_support', states: 'waiting_support', icon: ClockCircleOutlined, tone: 'purple' },
  { key: 'completed', states: 'resolved,closed', icon: CheckCircleOutlined, tone: 'green' },
];
const columns = computed(() => [
  { title: t('support.number'), dataIndex: 'ticket_no', width: 175 }, { title: t('support.category'), dataIndex: 'category', width: 165 },
  { title: t('support.subject'), dataIndex: 'subject', width: 260 }, { title: t('support.priority'), dataIndex: 'priority', width: 90 },
  { title: t('support.status'), dataIndex: 'status', width: 185 }, { title: t('support.agent'), dataIndex: 'assignee_name', width: 125 },
  { title: t('support.updated'), dataIndex: 'updated_at', width: 160 }, { title: '', key: 'action', width: 50 },
]);
const statusColor = (value: string) => ({ open: 'blue', in_progress: 'purple', waiting_merchant: 'orange', waiting_support: 'gold', resolved: 'green' }[value] || 'default');
const drawer = ref(false); const ticketId = ref(0); const createOpen = ref(false); const saving = ref(false); const uploading = ref(false); const attachments = ref<SupportFile[]>([]);
const form = reactive({ merchantId: undefined as number | undefined, propertyId: undefined as number | undefined, category: undefined as string | undefined, priority: 'medium', subject: '', description: '', violationId: undefined as number | undefined });
const properties = computed(() => options.value?.properties.filter(row => row.merchant_id === form.merchantId) || []);
let pending: { fingerprint: string; requestId: string } | null = null;
let controller: AbortController | undefined; let epoch = 0; let scopeGeneration = 0; let poll: ReturnType<typeof setInterval> | undefined;
async function load(reset = false) {
  if (reset) query.page = 1;
  controller?.abort(); controller = new AbortController(); const signal = controller.signal; const current = ++epoch; loading.value = true;
  try {
    const [data, counts] = await Promise.all([supportGet<SupportPage<SupportTicket>>('tickets', { ...query }, signal), supportGet<Record<string, number>>('summary', { scope: query.scope, propertyId: query.propertyId }, signal)]);
    if (current !== epoch) return;
    rows.value = data.list; total.value = data.total; summary.value = counts; failed.value = false;
  } catch { if (current === epoch && !signal.aborted) { failed.value = true; rows.value = []; } }
  finally { if (current === epoch) loading.value = false; }
}
async function init(ignoreHint = false) {
  const current = ++scopeGeneration;
  try { const data = await supportGet<SupportOptions>('options'); if (current !== scopeGeneration) return; options.value = data;
    const hinted = user.selectedPropertyId || (ignoreHint ? undefined : Number(route.query.propertyId));
    query.propertyId = data.properties.some(row => row.id === hinted) ? hinted : undefined;
    await load(); }
  catch { if (current === scopeGeneration) failed.value = true; }
}
function showTicket(id: number) { ticketId.value = id; drawer.value = true; void router.replace({ query: { ...route.query, ticketId: id } }); }
watch(drawer, open => { if (!open && route.query.ticketId) void router.replace({ query: { ...route.query, ticketId: undefined } }); });
watch(() => route.query.ticketId, value => { const id = Number(value); if (Number.isSafeInteger(id) && id > 0) { ticketId.value = id; drawer.value = true; } }, { immediate: true });
watch(() => route.query.propertyId, value => {
  if (user.selectedPropertyId || !options.value) return;
  const hinted = Number(value);
  query.propertyId = options.value.properties.some(row => row.id === hinted) ? hinted : undefined;
  query.scope = ''; void load(true);
});
function selectCard(states: string) { query.status = states; tab.value = 'tickets'; void load(true); }
async function create(violation?: { id: number; merchantId: number; subject: string }) {
  if (!options.value?.capabilities.create) return;
  if (violation && user.selectedPropertyId) { user.selectProperty(null); await nextTick(); await init(); }
  const selected = options.value.properties.find(row => row.id === (query.propertyId || user.selectedPropertyId));
  Object.assign(form, { merchantId: violation?.merchantId ?? selected?.merchant_id ?? (options.value.merchants.length === 1 ? options.value.merchants[0].id : undefined), propertyId: violation ? 0 : selected?.id ?? (options.value.capabilities['merchant-scope'] ? 0 : undefined), category: violation ? 'other' : undefined, priority: 'medium', subject: violation?.subject || '', description: '', violationId: violation?.id });
  attachments.value = []; pending = null; createOpen.value = true;
}
function cancelCreate() {
  if (saving.value || uploading.value) return;
  if (form.subject || form.description || attachments.value.length) Modal.confirm({ title: t('support.unsaved'), okText: t('support.discard'), cancelText: t('support.stay'), onOk: () => { createOpen.value = false; } });
  else createOpen.value = false;
}
function changeMerchant() { form.propertyId = options.value?.capabilities['merchant-scope'] ? 0 : undefined; attachments.value = []; }
async function upload(file: File) {
  if (!form.merchantId || (!form.propertyId && !options.value?.capabilities['merchant-scope'])) { message.warning(t('support.required')); return false; }
  if (attachments.value.length >= (options.value?.maxAttachments || 5) || file.size > (options.value?.maxFileBytes || 10000000) || !/\.(pdf|jpe?g|png|xlsx)$/i.test(file.name)) { message.warning(t('support.invalidFile')); return false; }
  const scope = { merchantId: form.merchantId, propertyId: form.propertyId || null }; uploading.value = true;
  try { const row = await supportUpload(file, scope); if (createOpen.value && scope.merchantId === form.merchantId && scope.propertyId === (form.propertyId || null)) attachments.value.push(row); }
  catch { /* HTTP layer displays the error. */ } finally { uploading.value = false; }
  return false;
}
async function submit() {
  if (saving.value || uploading.value) return;
  if (!form.merchantId || !form.category || !form.priority || !form.subject.trim() || !form.description.trim() || (!form.propertyId && !options.value?.capabilities['merchant-scope'])) { message.warning(t('support.required')); return; }
  const data = { ...form, subject: form.subject.trim(), description: form.description.trim(), propertyId: form.propertyId || null, attachmentIds: attachments.value.map(row => row.id) };
  const fingerprint = JSON.stringify(data); if (pending?.fingerprint !== fingerprint) pending = { fingerprint, requestId: supportRequestId() };
  saving.value = true;
  try { const result = await supportAction('create', { ...data, requestId: pending.requestId }); createOpen.value = false; pending = null; message.success(t('support.saved')); showTicket(result.id); await load(true); }
  catch { /* Retain request ID and draft for retry after an uncertain outcome. */ } finally { saving.value = false; }
}
function showTotal(count: number, range: [number, number]) { return t('support.showingTickets', { shown: range[1] - range[0] + 1, total: count }); }
function changeScope() { if (query.scope === 'general') query.propertyId = undefined; void load(true); }
function changeResource() { query.scope = ''; void load(true); }
function pageChange(page: number, size: number) { query.page = page; query.pageSize = size; void load(); }
function foreground() { if (!document.hidden && route.path === '/support' && !drawer.value && !createOpen.value) void load(); }
watch(() => user.selectedPropertyId, () => { epoch++; controller?.abort(); drawer.value = false; createOpen.value = false; attachments.value = []; rows.value = []; summary.value = {}; query.page = 1; query.scope = ''; void router.replace({ query: { ...route.query, propertyId: undefined, ticketId: undefined } }); void init(true); });
onMounted(() => { void init(); poll = setInterval(foreground, 15000); window.addEventListener('focus', foreground); });
onBeforeUnmount(() => { epoch++; scopeGeneration++; controller?.abort(); clearInterval(poll); window.removeEventListener('focus', foreground); });
</script>

<template>
  <PageContainer class="support-controls">
    <header class="support-heading"><div><h1>{{ t('support.title') }}</h1><p>{{ t('support.subtitle') }}</p></div><a-button v-if="options?.capabilities.create" v-perm="'mch:support:create'" type="primary" size="large" @click="create()"><PlusOutlined />{{ t('support.create') }}</a-button></header>
    <div class="summary-grid"><button v-for="card in cards" :key="card.key" :class="['summary-card', card.tone]" @click="selectCard(card.states)"><div><span>{{ t('support.cards.' + card.key) }}</span><component :is="card.icon" /></div><strong>{{ failed ? '—' : summary[card.key] ?? 0 }}</strong></button></div>
    <div class="quick-grid"><button @click="tab = 'faq'"><QuestionCircleOutlined /><span><strong>{{ t('support.browseFaq') }}</strong><small>{{ t('support.faqHint') }}</small></span><span class="arrow">›</span></button><button @click="tab = 'compliance'"><SafetyCertificateOutlined /><span><strong>{{ t('support.compliance') }}</strong><small>{{ t('support.rulesHint') }}</small></span><span class="arrow">›</span></button></div>
    <a-tabs v-model:active-key="tab">
      <a-tab-pane key="tickets" :tab="t('support.tickets')">
        <div class="filters"><a-input-search v-model:value="query.keyword" allow-clear :placeholder="t('support.search')" class="ticket-search" @search="load(true)" /><a-select v-model:value="query.category" allow-clear :placeholder="t('support.allCategories')" @change="load(true)"><a-select-option v-for="value in options?.categories" :key="value" :value="value">{{ t('support.categories.' + value) }}</a-select-option></a-select><a-select v-model:value="query.priority" allow-clear :placeholder="t('support.allPriorities')" @change="load(true)"><a-select-option v-for="value in options?.priorities" :key="value" :value="value">{{ t('support.priorities.' + value) }}</a-select-option></a-select><a-select v-model:value="query.status" allow-clear :placeholder="t('support.allStates')" @change="load(true)"><a-select-option v-for="value in options?.states" :key="value" :value="value">{{ t('support.states.' + value) }}</a-select-option><a-select-option value="open,in_progress">{{ t('support.cards.open') }}</a-select-option><a-select-option value="resolved,closed">{{ t('support.cards.completed') }}</a-select-option></a-select><span class="ticket-count">{{ t('support.total', { count: total }) }}</span></div>
        <div v-if="!user.selectedPropertyId" class="scope-filter"><a-select v-model:value="query.propertyId" allow-clear :placeholder="t('support.allProperties')" style="min-width:220px;margin-right:12px;margin-bottom:8px" @change="changeResource"><a-select-option v-for="property in options?.properties" :key="property.id" :value="property.id">{{ property.store_name }}</a-select-option></a-select><a-radio-group v-if="options?.capabilities['merchant-scope']" v-model:value="query.scope" @change="changeScope"><a-radio-button value="">{{ t('support.allScope') }}</a-radio-button><a-radio-button value="general">{{ t('support.general') }}</a-radio-button></a-radio-group></div>
        <a-alert v-if="failed" type="error" show-icon :message="t('support.failed')"><template #action><a-button @click="init()">{{ t('support.retry') }}</a-button></template></a-alert>
        <a-table class="ticket-table" :columns="columns" :data-source="rows" :loading="loading" row-key="id" :scroll="{ x: 1230 }" :pagination="{ current: query.page, pageSize: query.pageSize, total, showSizeChanger: false, showQuickJumper: false, size: 'small', showTotal: showTotal, onChange: pageChange }" :locale="{ emptyText: t('support.empty') }"><template #bodyCell="{ column, record }"><a-button v-if="column.dataIndex === 'ticket_no'" type="link" class="ticket-number" @click="showTicket(record.id)">{{ record.ticket_no }}</a-button><span v-else-if="column.dataIndex === 'category'">{{ t('support.categories.' + record.category) }}</span><div v-else-if="column.dataIndex === 'subject'" class="ticket-subject">{{ record.subject }}<small>{{ record.property_name || t('support.general') }}</small></div><a-tag v-else-if="column.dataIndex === 'priority'" :color="record.priority === 'high' ? 'red' : record.priority === 'medium' ? 'orange' : 'default'">{{ t('support.priorities.' + record.priority) }}</a-tag><a-tag v-else-if="column.dataIndex === 'status'" :color="statusColor(record.status)">{{ t('support.states.' + record.status) }}</a-tag><span v-else-if="column.dataIndex === 'assignee_name'">{{ record.assignee_name || t('support.unassigned') }}</span><a-button v-else-if="column.key === 'action'" type="text" :aria-label="t('support.view')" @click="showTicket(record.id)"><EyeOutlined /></a-button></template></a-table>
      </a-tab-pane>
      <a-tab-pane key="faq" :tab="t('support.faq')"><SupportResources v-if="tab === 'faq' && options" kind="faq" :options="options" @create="create" /></a-tab-pane>
      <a-tab-pane key="compliance" :tab="t('support.compliance')"><SupportResources v-if="tab === 'compliance' && options" kind="compliance" :options="options" @create="create" @ticket="showTicket" /></a-tab-pane>
      <template #rightExtra><a-button v-if="options?.capabilities.guides" type="link" @click="router.push('/support/guides')"><BookOutlined />{{ t('support.guides') }}</a-button></template>
    </a-tabs>
    <a-modal wrap-class-name="support-controls" :open="createOpen" :width="540" :title="t('support.create')" :confirm-loading="saving" :mask-closable="false" :ok-button-props="{ disabled: uploading }" :ok-text="t('support.submit')" :cancel-text="t('support.cancel')" @cancel="cancelCreate" @ok="submit">
      <a-form layout="vertical" class="create-form" :disabled="saving">
        <template v-if="!user.selectedPropertyId || form.violationId"><a-form-item :label="t('support.merchant')" required><a-select v-model:value="form.merchantId" :disabled="!!form.violationId" @change="changeMerchant"><a-select-option v-for="merchant in options?.merchants" :key="merchant.id" :value="merchant.id">{{ merchant.merchant_name }}</a-select-option></a-select></a-form-item><a-form-item v-if="!form.violationId" :label="t('support.property')" required><a-select v-model:value="form.propertyId" :disabled="!form.merchantId" :placeholder="options?.capabilities['merchant-scope'] ? t('support.general') : t('support.property')" @change="attachments = []"><a-select-option v-if="options?.capabilities['merchant-scope']" :value="0">{{ t('support.general') }}</a-select-option><a-select-option v-for="property in properties" :key="property.id" :value="property.id">{{ property.store_name }}</a-select-option></a-select></a-form-item></template>
        <a-tag v-if="form.violationId">{{ t('support.relatedViolation', { id: form.violationId }) }}</a-tag>
        <div class="form-pair"><a-form-item :label="t('support.category')" required><a-select v-model:value="form.category"><a-select-option v-for="value in options?.categories" :key="value" :value="value">{{ t('support.categories.' + value) }}</a-select-option></a-select></a-form-item><a-form-item :label="t('support.priority')" required><a-select v-model:value="form.priority"><a-select-option v-for="value in options?.priorities" :key="value" :value="value">{{ t('support.priorities.' + value) }}</a-select-option></a-select></a-form-item></div>
        <a-form-item :label="t('support.subject')" required><a-input v-model:value="form.subject" :maxlength="200" :placeholder="t('support.subjectHint')" /></a-form-item><a-form-item :label="t('support.description')" required><a-textarea v-model:value="form.description" :maxlength="10000" :rows="5" :placeholder="t('support.descriptionHint')" /></a-form-item>
        <a-form-item>
          <template #label>{{ t('support.attachments') }} <span class="attachment-optional">{{ t('support.optional') }}</span></template>
          <a-upload-dragger class="ticket-upload" :before-upload="upload" :show-upload-list="false" accept=".pdf,.jpg,.jpeg,.png,.xlsx" :disabled="saving || uploading || attachments.length >= 5" :title="t('support.fileHint')">
            <div class="upload-content"><LoadingOutlined v-if="uploading" /><UploadOutlined v-else /><span>{{ t(uploading ? 'support.uploading' : 'support.uploadPrompt') }}</span><small>{{ t('support.uploadLimits') }}</small></div>
          </a-upload-dragger>
          <div v-if="attachments.length" class="create-attachments"><a-tag v-for="file in attachments" :key="file.id" closable @close.prevent="attachments = attachments.filter(item => item.id !== file.id)">{{ file.filename }}</a-tag></div>
        </a-form-item>
      </a-form>
    </a-modal>
    <TicketDrawer v-model:open="drawer" :ticket-id="ticketId" @changed="load()" />
  </PageContainer>
</template>

<style scoped lang="less">
.attachment-optional { margin-left: 4px; color: #8b8c96; font-weight: 400; }
.create-form :deep(.ticket-upload.ant-upload-drag) { height: 72px; border: 1.6px dashed #e2e8f0; border-radius: 8px; background: #fff; }
.create-form :deep(.ticket-upload.ant-upload-drag .ant-upload-btn) { display: flex; align-items: center; justify-content: center; height: 100%; padding: 12px; }
.create-form :deep(.ticket-upload.ant-upload-drag:not(.ant-upload-disabled):hover),
.create-form :deep(.ticket-upload.ant-upload-drag-hover),
.create-form :deep(.ticket-upload.ant-upload-drag:focus-within) { border-color: #4169ed; background: #f8fafc; }
.upload-content { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; color: #8b8c96; font-size: 12.5px; line-height: 20px; }
.upload-content .anticon { font-size: 15px; }
.upload-content small { font-size: 11px; }
.create-form :deep(.ticket-upload.ant-upload-disabled) { cursor: not-allowed; background: #f8fafc; }
.create-form :deep(.ticket-upload.ant-upload-disabled .upload-content) { opacity: .65; }
.create-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.create-attachments :deep(.ant-tag) { max-width: 100%; margin: 0; white-space: normal; overflow-wrap: anywhere; }
.ticket-table {
  :deep(.ant-pagination) {
    margin: 0;
    min-height: 52px;
    padding: 12px 16px;
    align-items: center;
    border-top: 1px solid #edf0f4;
  }
  :deep(.ant-pagination-total-text) {
    margin-right: auto;
    color: #7b8495;
    font-size: 11px;
  }
  :deep(.ant-pagination-item),
  :deep(.ant-pagination-prev .ant-pagination-item-link),
  :deep(.ant-pagination-next .ant-pagination-item-link) {
    border-radius: 5px;
  }
}
.support-heading { display:flex; justify-content:space-between; align-items:center; gap:20px; margin:12px 0 32px; } h1 { font-size:26px; font-weight:700; letter-spacing:-.5px; margin:0 0 8px; }.support-heading p { color:#8b8c96; margin:0; font-size:14px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-bottom:24px; }.summary-card { border:1px solid #e2e8f0; background:white; border-radius:12px; padding:20px 16px; text-align:left; cursor:pointer; box-shadow:0 1px 3px #0f172a05; }.summary-card div { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#8b8c96; font-size:12px; text-transform:uppercase; min-height:28px; }.summary-card .anticon { padding:7px; border-radius:7px; background:#f0f4ff; }.summary-card strong { display:block; margin-top:14px; font-size:30px; font-weight:600; }.blue strong,.blue .anticon { color:#4169ed; }.orange strong,.orange .anticon { color:#b45309; }.purple strong,.purple .anticon { color:#9333ea; }.green strong,.green .anticon { color:#22c55e; }
.quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }.quick-grid button { display:flex; align-items:center; gap:14px; padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:white; text-align:left; cursor:pointer; }.quick-grid .anticon { color:#9333ea; background:#faf0ff; padding:12px; border-radius:10px; font-size:19px; }.quick-grid button:nth-child(2) .anticon { color:#b45309; background:#fff7ed; }.quick-grid strong { display:block; color:#1e293b; font-size:14px; }.quick-grid small { display:block; color:#8b8c96; margin-top:5px; }.arrow { margin-left:auto; color:#cbd5e1; font-size:22px; }
.filters { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:8px 0 16px; }.filters .ant-select { min-width:150px; }.ticket-search { max-width:320px; flex:1 1 240px; }.ticket-count { margin-left:auto; color:#8b8c96; }.scope-filter { margin-bottom:14px; }.ticket-number { padding:0; font-size:12px; }.ticket-subject { overflow-wrap:anywhere; }.ticket-subject small { display:block; color:#94a3b8; font-size:11px; margin-top:3px; }:deep(.ant-tag) { border-radius:20px; font-size:11px; }:deep(.ant-table-thead > tr > th) { font-size:11px; text-transform:uppercase; font-weight:500; color:#8b8c96; background:#f8fafc; }.form-pair { display:grid; grid-template-columns:1fr 1fr; gap:16px; }.create-form { margin-top:22px; }
@media(max-width:1100px) { .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:600px) { :deep(.ant-tabs-extra-content) { display:none; } .support-heading { align-items:flex-start; flex-direction:column; margin-bottom:22px; } h1 { font-size:22px; }.summary-grid { gap:10px; }.summary-card { padding:14px; }.summary-card div { font-size:10px; }.quick-grid { grid-template-columns:1fr; }.filters>* { flex:1 1 140px; }.ticket-search { max-width:none; }.ticket-count { text-align:right; }.form-pair { grid-template-columns:1fr; gap:0; } }
</style>
