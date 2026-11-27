<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { useUserStore } from '@/stores/user';
import { apiSiteTree } from '@/api/site';
import type { SiteNode } from '@/api/types';
import type { TableRow } from '@/composables/useTable';
import { readMarket, readPreview, readHistory, writeMarket, type MarketScope, type MarketState } from '@/api/marketplace';

const { t } = useI18n();
const tr = (key: string) => t(`marketplace.${key}`);
const user = useUserStore();
const emit = defineEmits<{ (event: 'busy', value: boolean): void }>();
const scope = reactive<MarketScope>({ siteId: user.profile?.siteId || 0, entityType: 'destination', businessType: 'hotel', countryCode: '', cityKey: '', region: '' });
const sites = ref<{ value: number; label: string }[]>([]);
const rows = ref<TableRow[]>([]);
const market = ref<MarketState>({ version: 0, published_version: 0 });
const loading = ref(false);
const loadedScope = ref('');
const scopeKey = () => JSON.stringify(scope);
const ready = computed(() => scope.siteId > 0 && !!scope.region.trim());
const loaded = computed(() => ready.value && loadedScope.value === scopeKey());
const keyword = ref('');
const status = ref<number>();
const filtered = computed(() => rows.value.filter((r) => (!status.value || Number(r.status) === status.value)
  && `${r.name}`.toLowerCase().includes(keyword.value.trim().toLowerCase())));
const group = (r: TableRow) => Number(r.pinned) === 1 ? 0 : Number(r.featured) === 1 ? 1 : 2;
const draggable = computed(() => loaded.value && user.isSuper && user.hasPerm('merchant:ranking:save') && !loading.value && !keyword.value && !status.value);
let requestId = 0;
watch(scope, () => { requestId++; loading.value = false; loadedScope.value = ''; rows.value = []; });
async function load() {
  if (!ready.value) return;
  const id = ++requestId;
  const sent = { ...scope };
  loading.value = true;
  loadedScope.value = '';
  try {
    const data = await readMarket(sent);
    if (id !== requestId) return;
    rows.value = data.list;
    market.value = data.market;
    loadedScope.value = JSON.stringify(sent);
  } finally { if (id === requestId) loading.value = false; }
}

// Confirmed action captures its scope and version; changing filters cannot redirect a pending write.
const actionOpen = ref(false);
const saving = ref(false);
watch(saving, (busy) => emit('busy', busy), { flush: 'sync' });
const note = ref('');
const actionTitle = ref('');
let pending: (() => Promise<void>) | undefined;
function confirmAction(title: string, action: string, data: Record<string, unknown> = {}) {
  if (!loaded.value) return;
  const sent = { ...scope };
  const version = Number(market.value.version);
  note.value = '';
  actionTitle.value = title;
  pending = async () => { await writeMarket(action, sent, version, note.value.trim(), data); };
  actionOpen.value = true;
}
async function saveAction() {
  if (!note.value.trim() || !pending) return;
  saving.value = true;
  try {
    await pending();
    actionOpen.value = false;
    message.success(tr('saved'));
    await load();
  } catch {
    // Refresh optimistic version after conflicts; never replay a stale change automatically.
    actionOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
function flag(row: TableRow, field: string) {
  const value = field === 'status' ? (Number(row.status) === 1 ? 2 : 1) : (Number(row[field]) === 1 ? 0 : 1);
  confirmAction(tr(field), 'destination/pin', { id: Number(row.id), [field]: value });
}
let dragId = 0;
function rowProps(row: TableRow) {
  return {
    draggable: draggable.value,
    onDragstart: () => { dragId = Number(row.id); },
    onDragover: (event: DragEvent) => { if (draggable.value) event.preventDefault(); },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (!draggable.value) return;
      const source = rows.value.find((r) => Number(r.id) === dragId);
      if (dragId === Number(row.id)) return;
      if (!source || group(source) !== group(row)) { message.warning(tr('groupOnly')); return; }
      const ids = rows.value.filter((r) => group(r) === group(row)).map((r) => Number(r.id));
      ids.splice(ids.indexOf(dragId), 1);
      ids.splice(ids.indexOf(Number(row.id)), 0, dragId);
      confirmAction(tr('reorder'), 'save-order', { ids });
    },
  };
}
const columns = computed(() => [
  { title: tr('rank'), dataIndex: 'rank', width: 80 },
  { title: tr('name'), key: 'name', width: 220 },
  { title: tr('status'), key: 'status' }, { title: tr('group'), key: 'group' }, { title: t('common.action'), key: 'action', width: 320 },
]);
const detail = ref<TableRow>();
const detailOpen = ref(false);
function showDetail(row: TableRow) { detail.value = row; detailOpen.value = true; }
const destinationOpen = ref(false);
const destination = reactive({ id: 0, name: '', tagline: '', imageUrl: '', destinationCountry: '', destinationCity: '' });
function editDestination(row?: TableRow) {
  Object.assign(destination, { id: Number(row?.id || 0), name: row?.name || '', tagline: row?.tagline || '', imageUrl: row?.image_url || '', destinationCountry: row?.country_code || '', destinationCity: row?.city_key || '' });
  destinationOpen.value = true;
}
function saveDestination() {
  destinationOpen.value = false;
  confirmAction(tr('destination'), destination.id ? 'destination/update' : 'destination/add', { ...destination });
}
const previewOpen = ref(false);
const previewView = ref('draft');
const previewRows = ref<TableRow[]>([]);
const previewVersion = ref(0);
async function preview() {
  const data = await readPreview({ ...scope }, previewView.value);
  previewRows.value = data.list; previewVersion.value = data.version; previewOpen.value = true;
}
const historyOpen = ref(false);
const historyRows = ref<TableRow[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
async function history(page = 1) { const data = await readHistory({ ...scope }, page); historyRows.value = data.list; historyTotal.value = data.total; historyPage.value = page; historyOpen.value = true; }
onMounted(async () => {
  const walk = (nodes: SiteNode[]) => { for (const s of nodes) { if (user.isSuper || s.id === user.profile?.siteId) sites.value.push({ value: Number(s.id), label: s.site_name }); if (s.children) walk(s.children); } };
  walk(await apiSiteTree());
});
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div class="destination-actions">
      <a-space>
        <a-button :disabled="!loaded" @click="history(1)">{{ tr('history') }}</a-button>
        <a-button :disabled="!loaded" @click="preview">{{ tr('preview') }}</a-button>
        <a-button v-if="user.isSuper" v-perm="'merchant:ranking:publish'" type="primary" :disabled="!loaded" @click="confirmAction(tr('publishConfirm'), 'publish')">{{ tr('publish') }}</a-button>
      </a-space>
    </div>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-form layout="inline">
        <a-form-item :label="tr('site')"><a-select v-model:value="scope.siteId" :options="sites" style="width: 180px" /></a-form-item>
        <a-form-item :label="tr('region')"><a-input v-model:value="scope.region" :maxlength="80" /></a-form-item>
        <a-form-item><a-button type="primary" :disabled="!ready" :loading="loading" @click="load">{{ tr('load') }}</a-button></a-form-item>
      </a-form>
    </a-card>
    <a-alert v-if="!loaded" type="info" :message="tr('selectScope')" show-icon />
    <a-card v-else :bordered="false" class="mtrip-card-shadow">
      <p>{{ tr('draft') }} v{{ market.version }} · {{ tr('published') }} v{{ market.published_version }}</p>
      <p class="muted">{{ tr('updated') }}: {{ market.updated_by || '—' }} {{ market.updated_at || '' }} · {{ tr('published') }}: {{ market.published_by || '—' }} {{ market.published_at || '' }}</p>
      <a-space wrap style="margin-bottom: 16px">
        <a-input v-model:value="keyword" :placeholder="tr('search')" allow-clear />
        <a-select v-model:value="status" allow-clear :placeholder="tr('status')" style="width: 140px" :options="[{ value: 1, label: tr('visible') }, { value: 2, label: tr('hidden') }]" />
        <a-button @click="keyword = ''; status = undefined">{{ t('common.reset') }}</a-button>
        <a-button v-if="user.isSuper" v-perm="'merchant:ranking:add'" @click="editDestination()">{{ tr('addDestination') }}</a-button>
      </a-space>
      <a-table :columns="columns" :data-source="filtered" row-key="id" :pagination="false" :custom-row="rowProps" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'rank'">⠿ {{ record.rank }}</template>
          <template v-else-if="column.key === 'name'"><a @click="showDetail(record)">{{ record.name || `#${record.id}` }}</a></template>
          <template v-else-if="column.key === 'status'">{{ Number(record.status) === 1 ? tr('visible') : tr('hidden') }}</template>
          <template v-else-if="column.key === 'group'"><a-tag>{{ group(record) === 0 ? tr('pinned') : group(record) === 1 ? tr('featured') : tr('normal') }}</a-tag></template>
          <template v-else-if="column.key === 'action'">
            <a-space wrap v-if="user.isSuper">
              <a-button v-perm="'merchant:ranking:save'" type="link" @click="flag(record, 'featured')">{{ tr('featured') }} {{ Number(record.featured) === 1 ? '✓' : '+' }}</a-button>
              <a-button v-perm="'merchant:ranking:save'" type="link" @click="flag(record, 'status')">{{ Number(record.status) === 1 ? tr('hide') : tr('show') }}</a-button>
              <a-button v-perm="'merchant:ranking:add'" type="link" @click="editDestination(record)">{{ t('common.edit') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
      <p class="muted">{{ tr('dragHint') }}</p>
    </a-card>
  </a-space>
  <a-modal v-model:open="actionOpen" :title="actionTitle" :confirm-loading="saving" @ok="saveAction">
    <p>{{ tr('reason') }}</p><a-textarea v-model:value="note" :maxlength="255" show-count />
  </a-modal>
  <a-modal v-model:open="destinationOpen" :title="tr('destination')" @ok="saveDestination">
    <a-form layout="vertical">
      <a-form-item :label="tr('name')"><a-input v-model:value="destination.name" :maxlength="100" /></a-form-item>
      <a-form-item :label="tr('tagline')"><a-input v-model:value="destination.tagline" :maxlength="200" /></a-form-item>
      <a-form-item :label="tr('image')"><a-input v-model:value="destination.imageUrl" :maxlength="500" placeholder="https://…" /></a-form-item>
      <a-form-item :label="tr('country')"><a-input v-model:value="destination.destinationCountry" :maxlength="2" /></a-form-item>
      <a-form-item :label="tr('city')"><a-input v-model:value="destination.destinationCity" :maxlength="80" /></a-form-item>
    </a-form>
  </a-modal>
  <a-modal v-model:open="previewOpen" :title="tr('preview')" :footer="null" width="520">
    <a-radio-group v-model:value="previewView" @change="preview"><a-radio-button value="draft">{{ tr('draft') }}</a-radio-button><a-radio-button value="published">{{ tr('published') }}</a-radio-button></a-radio-group>
    <p>{{ scope.region }} · v{{ previewVersion }}</p>
    <a-list :data-source="previewRows"><template #renderItem="{ item }"><a-list-item><a-list-item-meta :title="item.name" :description="item.tagline"><template #avatar><a-avatar shape="square" :src="item.image_url" /></template></a-list-item-meta></a-list-item></template></a-list>
    <p class="muted">{{ tr('previewHint') }}</p>
  </a-modal>
  <a-drawer v-model:open="historyOpen" :title="tr('history')" :width="620">
    <a-timeline><a-timeline-item v-for="h in historyRows" :key="h.id"><p>v{{ h.version }} · {{ h.action }} · {{ h.operator_name }} · {{ h.created_at }}</p><p>{{ h.note }}</p><a-collapse><a-collapse-panel key="diff" :header="tr('changes')"><pre>{{ JSON.stringify({ before: h.before_json, after: h.after_json }, null, 2) }}</pre></a-collapse-panel></a-collapse></a-timeline-item></a-timeline>
    <a-pagination :current="historyPage" :total="historyTotal" :page-size="20" :show-size-changer="false" @change="history" />
  </a-drawer>
  <a-drawer v-model:open="detailOpen" :title="tr('details')" :width="500">
    <a-descriptions v-if="detail" :column="1" bordered>
      <a-descriptions-item :label="tr('name')">{{ detail.name }}</a-descriptions-item>
      <a-descriptions-item :label="tr('market')">{{ scope.siteId }} / {{ scope.region }}</a-descriptions-item>
      <a-descriptions-item :label="tr('rank')">{{ detail.rank }}</a-descriptions-item>
      <a-descriptions-item :label="tr('status')">{{ Number(detail.status) === 1 ? tr('visible') : tr('hidden') }}</a-descriptions-item>
    </a-descriptions>
  </a-drawer>
</template>

<style scoped>
.destination-actions { display: flex; justify-content: flex-end; }
.muted { color: var(--sap-muted, #64748b); font-size: 12px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
