<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiSiteTree } from '@/api/site';
import type { MenuNode, SiteNode } from '@/api/types';
import { apiKycTemplateList, apiKycTemplateCreate, apiKycTemplateUpdate, apiKycTemplateHistory, apiKycTemplateStatus } from '@/api/kyc-template';
import type { KycTemplate, KycDocument, KycScope, KycBusiness } from '@/api/kyc-template';
import { genUUID } from '@/utils/uuid';

const { t } = useI18n();
const text = (key: string, params?: Record<string, unknown>) => t(`kycTemplate.${key}`, params ?? {});
const user = useUserStore();
const isSuper = computed(() => user.profile?.isSuper === true);
const readable = computed(() => {
  const contains = (nodes: MenuNode[]): boolean => nodes.some(node => (node.menu_type === 2 && node.perm_key === 'config:kyc:list') || contains(node.children ?? []));
  return user.hasPerm('config:kyc:list') || contains(user.menus ?? []);
});
const failed = ref(false);
const { list, loading, query, load, search, reset, pagination } = useTable<KycTemplate>(async params => {
  if (!readable.value) return { list: [], total: 0, page: 1, pageSize: 20 };
  const filters = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  failed.value = false;
  try { return await apiKycTemplateList(filters); }
  catch {
    failed.value = true;
    return { list: [], total: 0, page: Number(params.page), pageSize: Number(params.pageSize) };
  }
}, { keyword: '', scopeType: undefined, businessType: undefined, status: undefined, siteId: undefined });
const tablePagination = computed(() => ({ ...pagination.value, showTotal: (total: number) => text('total', { total }) }));
const scopes = computed(() => ['merchant', 'property'].map(value => ({ value, label: text(value) })));
const businesses: KycBusiness[] = ['hotel', 'restaurant', 'airline', 'car_rental', 'attraction'];
const businessOptions = computed(() => ['unified', ...businesses].map(value => ({ value, label: text(value) })));
const statuses = computed(() => [{ value: 1, label: text('enabled') }, { value: 2, label: text('disabled') }]);
const sites = ref<{ value: number; label: string }[]>([]);
const siteFailed = ref(false);
const siteLoading = ref(false);
const siteOptions = computed(() => [{ value: 0, label: text('publicSite') }, ...(isSuper.value ? sites.value : [{ value: Number(user.profile?.siteId), label: siteName(Number(user.profile?.siteId)) }])]);
function siteName(id: number): string { return id === 0 ? text('publicSite') : sites.value.find(site => site.value === id)?.label ?? text('siteNumber', { id }); }
async function loadSites(): Promise<void> {
  if (!readable.value) return;
  siteLoading.value = true; siteFailed.value = false;
  try {
    const flatten = (nodes: SiteNode[]): { value: number; label: string }[] => nodes.flatMap(node => [{ value: node.id, label: node.site_name }, ...flatten(node.children ?? [])]);
    sites.value = flatten(await apiSiteTree());
  } catch { siteFailed.value = true; }
  finally { siteLoading.value = false; }
}
const columns = computed(() => [
  { title: text('name'), key: 'name', width: 240 }, { title: text('site'), key: 'site', width: 140 },
  { title: text('scope'), key: 'scope', width: 130 }, { title: text('business'), key: 'business', width: 120 },
  { title: text('version'), dataIndex: 'template_version', width: 85 }, { title: text('status'), key: 'status', width: 90 },
  { title: text('sort'), dataIndex: 'sort', width: 90 }, { title: text('actions'), key: 'actions', width: 270, fixed: 'right' as const },
]);
function canManage(row: KycTemplate, permission: string): boolean {
  return readable.value && row.can_manage === true && user.hasPerm(permission) && (isSuper.value || (row.site_id > 0 && row.site_id === user.profile?.siteId));
}
const editorOpen = ref(false);
const saving = ref(false);
const mode = ref<'create' | 'copy' | 'edit'>('create');
const editingRow = ref<KycTemplate | null>(null);
const form = reactive({ name: '', siteId: 0, scopeType: 'merchant' as KycScope, businessType: 'unified' as KycBusiness, status: 1 as 1 | 2, sort: 0, reason: '', documents: [] as KycDocument[] });
const editorTitle = computed(() => text(mode.value === 'edit' ? 'editTitle' : mode.value === 'copy' ? 'copyTitle' : 'create'));
const formBusinessOptions = computed(() => businessOptions.value.filter(option => form.scopeType === 'merchant' ? option.value === 'unified' : option.value !== 'unified'));
function openEditor(nextMode: 'create' | 'copy' | 'edit', row?: KycTemplate): void {
  if (!readable.value || failed.value || loading.value || saving.value || statusSaving.value) return;
  if (nextMode === 'edit' ? !row || !canManage(row, 'config:kyc:edit') : !user.hasPerm('config:kyc:add')) return;
  mode.value = nextMode;
  editingRow.value = row ? { ...row, documents: row.documents.map(doc => ({ ...doc })) } : null;
  Object.assign(form, {
    name: row ? nextMode === 'copy' ? text('copyName', { name: row.name }) : row.name : '',
    siteId: nextMode === 'edit' ? row!.site_id : isSuper.value ? row?.site_id ?? 0 : Number(user.profile?.siteId),
    scopeType: row?.scope_type ?? 'merchant', businessType: row?.business_type ?? 'unified',
    status: row?.status ?? 1, sort: row?.sort ?? 0, reason: '', documents: row ? row.documents.map(doc => ({ ...doc })) : [],
  });
  if (nextMode === 'copy' && row?.is_legacy && form.scopeType === 'merchant') form.businessType = 'unified';
  editorOpen.value = true;
}
function openCreate(): void { openEditor('create'); }
function openCopy(row: KycTemplate): void { openEditor('copy', row); }
function openEdit(row: KycTemplate): void { openEditor('edit', row); }
function cancelEditor(): void { if (!saving.value) editorOpen.value = false; }
function changeScope(): void { if (mode.value !== 'edit') form.businessType = form.scopeType === 'merchant' ? 'unified' : 'hotel'; }
function addDocument(): void {
  form.documents.push({ docType: `custom_${genUUID().replace(/-/g, '').slice(0, 24)}`, name: '', required: true });
}
function removeDocument(index: number): void { form.documents.splice(index, 1); }
function moveDocument(index: number, direction: number): void {
  const target = index + direction;
  if (target < 0 || target >= form.documents.length) return;
  const [doc] = form.documents.splice(index, 1); form.documents.splice(target, 0, doc);
}
async function save(): Promise<void> {
  if (!editorOpen.value || saving.value || !readable.value || failed.value) return;
  const source = editingRow.value;
  if (mode.value === 'edit' ? !source || !canManage(source, 'config:kyc:edit') : !user.hasPerm('config:kyc:add')) return;
  const documents = form.documents.map(doc => ({ docType: doc.docType, name: doc.name.trim(), required: doc.required === true }));
  const validScope = form.scopeType === 'merchant' ? form.businessType === 'unified' : form.scopeType === 'property' && businesses.includes(form.businessType);
  const validSite = Number.isInteger(form.siteId) && form.siteId >= 0 && (isSuper.value || (form.siteId > 0 && form.siteId === user.profile?.siteId));
  if (!form.name.trim() || !validScope || !validSite || !Number.isInteger(form.sort) || form.sort < 0 || form.sort > 9999 || ![1, 2].includes(form.status) ||
    !documents.length || documents.length > 50 || !documents.some(doc => doc.required) || documents.some(doc => !doc.name || !doc.docType) || new Set(documents.map(doc => doc.docType)).size !== documents.length) {
    message.warning(text('invalid')); return;
  }
  const draft = { name: form.name.trim(), sort: form.sort, documents, reason: form.reason.trim() };
  saving.value = true;
  try {
    if (mode.value === 'edit' && source) await apiKycTemplateUpdate({ ...draft, id: source.id, expectedVersion: source.template_version });
    else await apiKycTemplateCreate({ ...draft, siteId: form.siteId, scopeType: form.scopeType, businessType: form.businessType, status: form.status,
      ...(mode.value === 'copy' && source ? { copyFromId: source.id } : {}) });
    editorOpen.value = false; message.success(text('saved')); await load();
  } catch { /* The HTTP interceptor reports errors; retain the draft for retry. */ }
  finally { saving.value = false; }
}

const statusOpen = ref(false);
const statusRow = ref<KycTemplate | null>(null);
const statusReason = ref('');
const statusSaving = ref(false);
function requestStatus(row: KycTemplate): void {
  if (!canManage(row, 'config:kyc:status') || saving.value || statusSaving.value || loading.value || failed.value) return;
  statusRow.value = { ...row }; statusReason.value = ''; statusOpen.value = true;
}
function cancelStatus(): void { if (!statusSaving.value) statusOpen.value = false; }
async function confirmStatus(): Promise<void> {
  const row = statusRow.value;
  if (!statusOpen.value || !row || statusSaving.value || failed.value || !canManage(row, 'config:kyc:status')) return;
  statusSaving.value = true;
  try {
    await apiKycTemplateStatus({ id: row.id, expectedVersion: row.template_version, status: row.status === 1 ? 2 : 1, reason: statusReason.value.trim() });
    statusOpen.value = false; message.success(text('statusSaved')); await load();
  } catch { /* Keep the confirmation available after a rejected version or request. */ }
  finally { statusSaving.value = false; }
}

const historyOpen = ref(false);
const historySource = ref<KycTemplate | null>(null);
const historyRows = ref<KycTemplate[]>([]);
const historyLoading = ref(false);
const historyFailed = ref(false);
const historyPage = ref(1);
const historyTotal = ref(0);
let historyRequest = 0;
onBeforeUnmount(() => { historyRequest++; });
async function openHistory(row: KycTemplate): Promise<void> {
  if (!readable.value) return;
  historySource.value = row; historyOpen.value = true; await loadHistory(1);
}
async function loadHistory(page = historyPage.value): Promise<void> {
  const row = historySource.value;
  if (!historyOpen.value || !row || !readable.value) return;
  const request = ++historyRequest;
  historyPage.value = page; historyLoading.value = true; historyFailed.value = false; historyRows.value = []; historyTotal.value = 0;
  try {
    const data = await apiKycTemplateHistory({ id: row.id, page, pageSize: 10 });
    if (request === historyRequest) { historyRows.value = data.list; historyTotal.value = data.total; }
  } catch { if (request === historyRequest) historyFailed.value = true; }
  finally { if (request === historyRequest) historyLoading.value = false; }
}
function closeHistory(): void { historyOpen.value = false; historyRequest++; historyLoading.value = false; }
function actionName(action: KycTemplate['change_action']): string {
  const keys = { create: 'actionCreate', copy: 'actionCopy', edit: 'actionEdit', enable: 'actionEnable', disable: 'actionDisable', baseline: 'actionBaseline' };
  return text(keys[action]);
}
function historyCount(total: number): string { return text('historyTotal', { total }); }
onMounted(() => { void load(); void loadSites(); });
</script>

<template>
  <PageContainer>
    <a-result v-if="!readable" status="403" :title="text('noPermission')" />
    <div v-else class="kyc-templates">
      <a-alert type="info" show-icon :message="text('policyHint')" class="kyc-notice" />
      <a-card :bordered="false" class="mtrip-card-shadow kyc-filters">
        <a-form layout="inline" @submit="search">
          <a-form-item><a-input v-model:value="query.keyword" allow-clear :placeholder="text('keyword')" :aria-label="text('keyword')" /></a-form-item>
          <a-form-item :label="text('scope')"><a-select v-model:value="query.scopeType" allow-clear :options="scopes" :placeholder="text('all')" /></a-form-item>
          <a-form-item :label="text('business')"><a-select v-model:value="query.businessType" allow-clear :options="businessOptions" :placeholder="text('all')" /></a-form-item>
          <a-form-item :label="text('status')"><a-select v-model:value="query.status" allow-clear :options="statuses" :placeholder="text('all')" /></a-form-item>
          <a-form-item :label="text('site')"><a-select v-model:value="query.siteId" allow-clear :options="siteOptions" :loading="siteLoading" :placeholder="text('allSites')" /></a-form-item>
          <a-form-item><a-space><a-button type="primary" html-type="submit">{{ text('search') }}</a-button><a-button @click="reset">{{ text('reset') }}</a-button></a-space></a-form-item>
        </a-form>
      </a-card>
      <a-alert v-if="siteFailed" type="warning" :message="text('siteLoadFailed')" class="kyc-notice"><template #action><a-button size="small" @click="loadSites">{{ text('retry') }}</a-button></template></a-alert>
      <a-card :title="text('title')" :bordered="false" class="mtrip-card-shadow">
        <template #extra><a-button v-perm="'config:kyc:add'" type="primary" :disabled="failed || loading || saving || statusSaving" @click="openCreate"><PlusOutlined />{{ text('create') }}</a-button></template>
        <p v-if="!isSuper" class="kyc-hint">{{ text('publicHint') }}</p>
        <a-alert v-if="failed" type="error" show-icon :message="text('loadFailed')"><template #action><a-button size="small" @click="load">{{ text('retry') }}</a-button></template></a-alert>
        <a-table v-else :columns="columns" :data-source="list" :loading="loading" :pagination="tablePagination" row-key="id" :scroll="{ x: 1265 }" :locale="{ emptyText: text('empty') }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'"><strong>{{ record.name }}</strong><a-tooltip v-if="record.is_legacy" :title="text('legacyHint')"><a-tag class="kyc-legacy">{{ text('legacy') }}</a-tag></a-tooltip><div v-if="!record.can_manage && !record.is_legacy" class="kyc-hint">{{ text('readOnly') }}</div></template>
            <template v-else-if="column.key === 'site'">{{ siteName(record.site_id) }}</template>
            <template v-else-if="column.key === 'scope'">{{ text(record.scope_type) }}</template>
            <template v-else-if="column.key === 'business'">{{ text(record.business_type) }}</template>
            <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 1 ? 'green' : 'default'">{{ text(record.status === 1 ? 'enabled' : 'disabled') }}</a-tag></template>
            <template v-else-if="column.key === 'actions'">
              <a-space wrap size="small">
                <a-button type="link" size="small" @click="openHistory(record)">{{ text('history') }}</a-button>
                <a-button v-perm="'config:kyc:add'" type="link" size="small" :disabled="saving || statusSaving || loading" @click="openCopy(record)">{{ text('copy') }}</a-button>
                <a-button v-if="canManage(record, 'config:kyc:edit')" v-perm="'config:kyc:edit'" type="link" size="small" :disabled="saving || statusSaving || loading" @click="openEdit(record)">{{ text('edit') }}</a-button>
                <a-button v-if="canManage(record, 'config:kyc:status')" v-perm="'config:kyc:status'" type="link" size="small" :danger="record.status === 1" :disabled="saving || statusSaving || loading" @click="requestStatus(record)">{{ text(record.status === 1 ? 'disable' : 'enable') }}</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>

      <a-modal :open="editorOpen" :title="editorTitle" :width="720" :confirm-loading="saving" :closable="!saving" :mask-closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" :ok-text="text('save')" :cancel-text="text('cancel')" @ok="save" @cancel="cancelEditor">
        <a-alert v-if="mode === 'edit'" type="info" show-icon :message="text('editHint')" class="kyc-notice" />
        <a-alert v-if="mode === 'copy' && editingRow?.is_legacy" type="info" show-icon :message="text('legacyHint')" class="kyc-notice" />
        <a-form layout="vertical" :disabled="saving" class="kyc-editor">
          <a-form-item :label="text('name')" required><a-input v-model:value="form.name" :maxlength="100" /></a-form-item>
          <div class="kyc-form-grid">
            <a-form-item :label="text('site')" required><a-select v-if="mode !== 'edit' && isSuper" v-model:value="form.siteId" :options="siteOptions" :loading="siteLoading" /><a-input v-else :value="siteName(form.siteId)" disabled /></a-form-item>
            <a-form-item :label="text('scope')" required><a-select v-model:value="form.scopeType" :options="scopes" :disabled="mode === 'edit' || saving" @change="changeScope" /></a-form-item>
            <a-form-item :label="text('business')" required><a-select v-model:value="form.businessType" :options="formBusinessOptions" :disabled="mode === 'edit' || saving" /></a-form-item>
            <a-form-item :label="text('sort')"><a-input-number v-model:value="form.sort" :min="0" :max="9999" :precision="0" /></a-form-item>
            <a-form-item v-if="mode !== 'edit'" :label="text('initialStatus')"><a-select v-model:value="form.status" :options="statuses" /></a-form-item>
          </div>
          <div class="kyc-document-heading">{{ text('documents') }} <span class="kyc-hint">{{ text('required') }} ≥ 1</span></div>
          <div v-for="(doc, index) in form.documents" :key="index" class="kyc-document">
            <a-input v-model:value="doc.name" :maxlength="100" :placeholder="text('documentName')" :aria-label="text('documentName')" />
            <a-checkbox v-model:checked="doc.required">{{ text('required') }}</a-checkbox>
            <div class="kyc-document-actions">
              <a-button type="text" size="small" :disabled="saving || index === 0" :aria-label="text('moveUp')" @click="moveDocument(index, -1)"><ArrowUpOutlined /></a-button>
              <a-button type="text" size="small" :disabled="saving || index === form.documents.length - 1" :aria-label="text('moveDown')" @click="moveDocument(index, 1)"><ArrowDownOutlined /></a-button>
              <a-button type="text" size="small" danger :aria-label="text('removeDocument')" @click="removeDocument(index)"><DeleteOutlined /></a-button>
            </div>
          </div>
          <a-button type="dashed" block :disabled="saving || form.documents.length >= 50" @click="addDocument"><PlusOutlined />{{ text('addDocument') }}</a-button>
          <a-form-item :label="text('reason')" class="kyc-reason"><a-textarea v-model:value="form.reason" :rows="2" :maxlength="300" show-count /></a-form-item>
        </a-form>
      </a-modal>

      <a-modal :open="statusOpen" :title="text('statusTitle')" :confirm-loading="statusSaving" :closable="!statusSaving" :mask-closable="!statusSaving" :keyboard="!statusSaving" :cancel-button-props="{ disabled: statusSaving }" :ok-text="text('statusConfirm')" :cancel-text="text('cancel')" @ok="confirmStatus" @cancel="cancelStatus">
        <p>{{ text('statusHint', { action: text(statusRow?.status === 1 ? 'disable' : 'enable'), name: statusRow?.name ?? '' }) }}</p>
        <a-form layout="vertical"><a-form-item :label="text('reason')"><a-textarea v-model:value="statusReason" :disabled="statusSaving" :maxlength="300" :rows="3" /></a-form-item></a-form>
      </a-modal>

      <a-drawer :open="historyOpen" :title="text('historyTitle', { name: historySource?.name ?? '' })" :width="640" class="kyc-history" @close="closeHistory">
        <a-alert v-if="historyFailed" type="error" show-icon :message="text('historyFailed')"><template #action><a-button size="small" @click="loadHistory()">{{ text('retry') }}</a-button></template></a-alert>
        <a-spin :spinning="historyLoading">
          <a-empty v-if="!historyFailed && !historyLoading && !historyRows.length" :description="text('empty')" />
          <article v-for="version in historyRows" :key="version.id" class="kyc-version">
            <div class="kyc-version-heading"><strong>{{ text('version') }} {{ version.template_version }} · {{ version.name }}</strong><a-tag v-if="version.is_current" color="blue">{{ text('current') }}</a-tag><a-tag>{{ text(version.status === 1 ? 'enabled' : 'disabled') }}</a-tag></div>
            <dl><dt>{{ text('site') }}</dt><dd>{{ siteName(version.site_id) }}</dd><dt>{{ text('scope') }}</dt><dd>{{ text(version.scope_type) }} · {{ text(version.business_type) }}</dd>
              <dt>{{ text('action') }}</dt><dd>{{ actionName(version.change_action) }}</dd><dt>{{ text('operator') }}</dt><dd>{{ version.created_by_name || (version.created_by ? `#${version.created_by}` : text('system')) }}</dd>
              <dt>{{ text('time') }}</dt><dd>{{ version.created_at }}</dd><dt>{{ text('reasonLabel') }}</dt><dd>{{ version.change_reason || text('noReason') }}</dd></dl>
            <h4>{{ text('documents') }}</h4><ol><li v-for="doc in version.documents" :key="doc.docType">{{ doc.name }} <a-tag :color="doc.required ? 'blue' : 'default'">{{ text(doc.required ? 'required' : 'optional') }}</a-tag></li></ol>
          </article>
        </a-spin>
        <a-pagination v-if="historyTotal > 0" :current="historyPage" :total="historyTotal" :page-size="10" :show-total="historyCount" :disabled="historyLoading" size="small" @change="loadHistory" />
      </a-drawer>
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
.kyc-notice, .kyc-filters { margin-bottom: 16px; }
.kyc-filters :deep(.ant-form) { gap: 12px 0; }
.kyc-filters :deep(.ant-select) { min-width: 140px; }
.kyc-hint { margin: 4px 0 12px; font-size: 12px; color: var(--mtrip-text-aux); }
.kyc-legacy { margin-left: 8px; }
.kyc-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.kyc-form-grid :deep(.ant-input-number) { width: 100%; }
.kyc-document-heading { margin-bottom: 10px; font-weight: 600; display: flex; justify-content: space-between; }
.kyc-document-heading .kyc-hint { margin: 0; font-weight: 400; }
.kyc-document { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.kyc-document > .ant-input { min-width: 0; flex: 1; }
.kyc-document :deep(.ant-checkbox-wrapper) { white-space: nowrap; }
.kyc-document-actions { display: flex; flex-shrink: 0; }
.kyc-reason { margin-top: 20px; }
.kyc-version { padding: 16px 0; border-bottom: 1px solid var(--mtrip-border-color, #e7e9ef); overflow-wrap: anywhere; }
.kyc-version:first-child { padding-top: 0; }
.kyc-version-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.kyc-version dl { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; font-size: 13px; }
.kyc-version dt { color: var(--mtrip-text-aux); }
.kyc-version dd { margin: 0; white-space: pre-wrap; }
.kyc-version li { padding: 4px 0; }
.kyc-history :deep(.ant-pagination) { margin-top: 16px; }
@media (max-width: 600px) {
  .kyc-filters :deep(.ant-form-item) { width: 100%; margin-inline-end: 0; }
  .kyc-filters :deep(.ant-form-item-control), .kyc-filters :deep(.ant-select) { width: 100%; }
  .kyc-templates :deep(.ant-card-head) { padding-inline: 16px; }
  .kyc-templates :deep(.ant-card-head-wrapper) { flex-wrap: wrap; gap: 8px; padding-block: 12px; }
  .kyc-templates :deep(.ant-card-body) { padding: 16px; }
  .kyc-form-grid { grid-template-columns: 1fr; gap: 0; }
  .kyc-document { flex-wrap: wrap; }
  .kyc-document > .ant-input { flex-basis: 100%; }
  .kyc-document-actions { margin-left: auto; }
}
</style>
