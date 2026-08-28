<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useUserStore } from '@/stores/user';
import { apiSiteTree } from '@/api/site';
import type { SiteNode } from '@/api/types';
import type { TableRow } from '@/composables/useTable';
import { readMarket, readCandidates, readPreview, readHistory, writeMarket, type MarketScope, type MarketState } from '@/api/marketplace';

const { t } = useI18n();
const tr = (key: string) => t(`marketplace.${key}`);
const user = useUserStore();
const router = useRouter();
const scope = reactive<MarketScope>({ siteId: user.profile?.siteId || 0, entityType: 'listing', businessType: 'hotel', countryCode: '', cityKey: '', region: '' });
const sites = ref<{ value: number; label: string }[]>([]);
const rows = ref<TableRow[]>([]);
const market = ref<MarketState>({ version: 0, published_version: 0 });
const loading = ref(false);
const loadedScope = ref('');
const scopeKey = () => JSON.stringify(scope);
const ready = computed(() => scope.siteId > 0 && (scope.entityType === 'listing' ? /^[a-zA-Z]{2}$/.test(scope.countryCode) && !!scope.cityKey.trim() : !!scope.region.trim()));
const loaded = computed(() => ready.value && loadedScope.value === scopeKey());
const keyword = ref('');
const status = ref<number>();
const eligibility = ref<string>();
const filtered = computed(() => rows.value.filter((r) => (!status.value || Number(r.status) === status.value)
  && (!eligibility.value || String(Boolean(r.eligible)) === eligibility.value)
  && `${r.business_name || r.name} ${r.merchant_name || ''}`.toLowerCase().includes(keyword.value.trim().toLowerCase())));
const group = (r: TableRow) => Number(r.pinned) === 1 ? 0 : Number(r.featured) === 1 ? 1 : 2;
const draggable = computed(() => loaded.value && user.isSuper && user.hasPerm('merchant:ranking:save') && !loading.value && !keyword.value && !status.value && !eligibility.value);
let requestId = 0;
watch(scope, () => { requestId++; loading.value = false; loadedScope.value = ''; rows.value = []; eligibility.value = undefined; });
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
    if (bindOpen.value) await candidates();
  } catch {
    // Refresh optimistic version after conflicts; never replay a stale change automatically.
    actionOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
function flag(row: TableRow, field: string) {
  const value = field === 'status' ? (Number(row.status) === 1 ? 2 : 1) : (Number(row[field]) === 1 ? 0 : 1);
  confirmAction(tr(field), scope.entityType === 'listing' ? 'pin' : 'destination/pin', { id: Number(row.id), [field]: value });
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
  ...(scope.entityType === 'listing' ? [{ title: tr('merchant'), dataIndex: 'merchant_name' }, { title: tr('rating'), dataIndex: 'rating' }, { title: tr('eligibility'), key: 'eligible' }] : []),
  { title: tr('status'), key: 'status' }, { title: tr('group'), key: 'group' }, { title: t('common.action'), key: 'action', width: 320 },
]);
const detail = ref<TableRow>();
const detailOpen = ref(false);
function showDetail(row: TableRow) { detail.value = row; detailOpen.value = true; }
function merchantProfile(row: TableRow) { void router.push({ path: '/merchant/list', query: { merchantId: row.merchant_id } }); }

const bindOpen = ref(false);
const properties = ref<TableRow[]>([]);
const goods = ref<TableRow[]>([]);
const propertyId = ref<number>();
const goodsId = ref<number>();
const selectedProperty = computed(() => properties.value.find((p) => Number(p.id) === propertyId.value));
const goodsOptions = computed(() => goods.value.filter((g) => Number(g.merchant_id) === Number(selectedProperty.value?.merchant_id)).map((g) => ({ value: Number(g.id), label: `#${g.id} ${g.goods_name}` })));
async function candidates() { const data = await readCandidates({ ...scope }); properties.value = data.properties; goods.value = data.goods; }
async function openBind() { propertyId.value = undefined; goodsId.value = undefined; await candidates(); bindOpen.value = true; }
function changeProperty() { goodsId.value = undefined; }
function displayProperty() {
  const p = selectedProperty.value;
  if (!p) return;
  confirmAction(tr('liveWarning'), 'property-display', { propertyId: Number(p.id), expectedPropertyVersion: Number(p.mapping_version), displayEnabled: Number(p.display_enabled) === 1 ? 0 : 1 });
}

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
  <PageContainer>
    <a-space direction="vertical" style="width: 100%" :size="16">
      <div class="market-header"><div><h2>{{ tr('title') }}</h2><span class="muted">{{ tr('rule') }}</span></div>
        <a-space>
          <a-button :disabled="!loaded" @click="history(1)">{{ tr('history') }}</a-button>
          <a-button :disabled="!loaded" @click="preview">{{ tr('preview') }}</a-button>
          <a-button v-if="user.isSuper" v-perm="'merchant:ranking:publish'" type="primary" :disabled="!loaded" @click="confirmAction(tr('publishConfirm'), 'publish')">{{ tr('publish') }}</a-button>
        </a-space>
      </div>
      <a-card :bordered="false" class="mtrip-card-shadow">
        <a-tabs v-model:activeKey="scope.entityType"><a-tab-pane key="listing" :tab="tr('hotels')" /><a-tab-pane key="destination" :tab="tr('destinations')" /></a-tabs>
        <a-form layout="inline">
          <a-form-item :label="tr('site')"><a-select v-model:value="scope.siteId" :options="sites" style="width: 180px" /></a-form-item>
          <template v-if="scope.entityType === 'listing'">
            <a-form-item :label="tr('country')"><a-input v-model:value="scope.countryCode" :maxlength="2" style="width: 90px" placeholder="MM" /></a-form-item>
            <a-form-item :label="tr('city')"><a-input v-model:value="scope.cityKey" :maxlength="80" placeholder="yangon" /></a-form-item>
          </template>
          <a-form-item v-else :label="tr('region')"><a-input v-model:value="scope.region" :maxlength="80" /></a-form-item>
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
          <a-select v-if="scope.entityType === 'listing'" v-model:value="eligibility" allow-clear :placeholder="tr('eligibility')" style="width: 140px" :options="[{ value: 'true', label: tr('eligible') }, { value: 'false', label: tr('ineligible') }]" />
          <a-button @click="keyword = ''; status = undefined; eligibility = undefined">{{ t('common.reset') }}</a-button>
          <a-button v-if="user.isSuper && scope.entityType === 'listing'" v-perm="'merchant:property:bind'" @click="openBind">{{ tr('bind') }}</a-button>
          <a-button v-if="user.isSuper && scope.entityType === 'destination'" v-perm="'merchant:ranking:add'" @click="editDestination()">{{ tr('addDestination') }}</a-button>
        </a-space>
        <a-table :columns="columns" :data-source="filtered" row-key="id" :pagination="false" :custom-row="rowProps" :scroll="{ x: 1100 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'rank'">⠿ {{ record.rank }}</template>
            <template v-else-if="column.key === 'name'"><a @click="showDetail(record)">{{ record.business_name || record.name || `#${record.id}` }}</a></template>
            <template v-else-if="column.key === 'eligible'"><a-tag :color="record.eligible ? 'green' : 'red'">{{ record.eligible ? tr('eligible') : tr('ineligible') }}</a-tag></template>
            <template v-else-if="column.key === 'status'">{{ Number(record.status) === 1 ? tr('visible') : tr('hidden') }}</template>
            <template v-else-if="column.key === 'group'"><a-tag>{{ group(record) === 0 ? tr('pinned') : group(record) === 1 ? tr('featured') : tr('normal') }}</a-tag></template>
            <template v-else-if="column.key === 'action'">
              <a-space wrap v-if="user.isSuper">
                <a-button v-if="scope.entityType === 'listing'" v-perm="'merchant:ranking:save'" type="link" @click="flag(record, 'pinned')">{{ tr('pinned') }} {{ Number(record.pinned) === 1 ? '✓' : '+' }}</a-button>
                <a-button v-perm="'merchant:ranking:save'" type="link" @click="flag(record, 'featured')">{{ tr('featured') }} {{ Number(record.featured) === 1 ? '✓' : '+' }}</a-button>
                <a-button v-perm="'merchant:ranking:save'" type="link" @click="flag(record, 'status')">{{ Number(record.status) === 1 ? tr('hide') : tr('show') }}</a-button>
                <a-button v-if="scope.entityType === 'destination'" v-perm="'merchant:ranking:add'" type="link" @click="editDestination(record)">{{ t('common.edit') }}</a-button>
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
    <a-modal v-model:open="bindOpen" :title="tr('bind')" :footer="null" width="650">
      <a-alert :message="tr('bindingHint')" type="info" />
      <a-form layout="vertical">
        <a-form-item :label="tr('property')"><a-select v-model:value="propertyId" show-search option-filter-prop="label" @change="changeProperty"><a-select-option v-for="p in properties" :key="p.id" :value="Number(p.id)" :label="`#${p.id} ${p.store_name}`">#{{ p.id }} {{ p.store_name }} · {{ p.merchant_name }}</a-select-option></a-select></a-form-item>
        <p v-if="selectedProperty">{{ tr('eligibility') }}: {{ Number(selectedProperty.display_enabled) === 1 ? tr('visible') : tr('hidden') }} · KYC {{ selectedProperty.kyc_status }} · {{ tr('merchantStatus') }} {{ selectedProperty.merchant_status }}</p>
        <a-button v-perm="'merchant:property:bind'" :disabled="!selectedProperty" @click="displayProperty">{{ tr('toggleEligibility') }}</a-button>
        <a-form-item :label="tr('goods')"><a-select v-model:value="goodsId" :options="goodsOptions" show-search option-filter-prop="label" /></a-form-item>
        <a-button v-perm="'merchant:property:bind'" type="primary" :disabled="!propertyId || !goodsId" @click="confirmAction(tr('bind'), 'listing/add', { propertyId, goodsId })">{{ tr('bind') }}</a-button>
      </a-form>
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
      <p>{{ scope.entityType === 'listing' ? `${scope.countryCode} / ${scope.cityKey}` : scope.region }} · v{{ previewVersion }}</p>
      <a-list :data-source="previewRows"><template #renderItem="{ item }"><a-list-item><a-list-item-meta :title="item.goods_name || item.name" :description="item.address || item.tagline"><template #avatar><a-avatar shape="square" :src="item.cover_image || item.image_url" /></template></a-list-item-meta><span>{{ item.rating ?? '' }}</span></a-list-item></template></a-list>
      <p class="muted">{{ tr('previewHint') }}</p>
    </a-modal>
    <a-drawer v-model:open="historyOpen" :title="tr('history')" :width="620">
      <a-timeline><a-timeline-item v-for="h in historyRows" :key="h.id"><p>v{{ h.version }} · {{ h.action }} · {{ h.operator_name }} · {{ h.created_at }}</p><p>{{ h.note }}</p><a-collapse><a-collapse-panel key="diff" :header="tr('changes')"><pre>{{ JSON.stringify({ before: h.before_json, after: h.after_json }, null, 2) }}</pre></a-collapse-panel></a-collapse></a-timeline-item></a-timeline>
      <a-pagination :current="historyPage" :total="historyTotal" :page-size="20" :show-size-changer="false" @change="history" />
    </a-drawer>
    <a-drawer v-model:open="detailOpen" :title="tr('details')" :width="500">
      <a-descriptions v-if="detail" :column="1" bordered>
        <a-descriptions-item :label="tr('name')">{{ detail.business_name || detail.name }}</a-descriptions-item>
        <a-descriptions-item :label="tr('market')">{{ scope.siteId }} / {{ scope.countryCode }} / {{ scope.cityKey || scope.region }}</a-descriptions-item>
        <a-descriptions-item :label="tr('rank')">{{ detail.rank }}</a-descriptions-item>
        <a-descriptions-item :label="tr('rating')">{{ detail.rating ?? '—' }}</a-descriptions-item>
        <a-descriptions-item :label="tr('status')">{{ Number(detail.status) === 1 ? tr('visible') : tr('hidden') }}</a-descriptions-item>
        <a-descriptions-item v-if="scope.entityType === 'listing'" :label="tr('merchant')"><a v-perm="'merchant:list:list'" @click="merchantProfile(detail)">{{ detail.merchant_name }}</a></a-descriptions-item>
        <a-descriptions-item v-if="scope.entityType === 'listing'" :label="tr('property')">#{{ detail.property_id }} {{ detail.property_name }} / {{ tr('goods') }} #{{ detail.goods_id }}</a-descriptions-item>
        <a-descriptions-item v-if="scope.entityType === 'listing'" :label="tr('eligibility')">{{ detail.eligible ? tr('eligible') : tr('ineligible') }} / KYC {{ detail.kyc_status }} / {{ tr('merchantStatus') }} {{ detail.merchant_status }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </PageContainer>
</template>

<style scoped>
.market-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.market-header h2 { margin: 0 0 4px; }
.muted { color: var(--sap-muted, #64748b); font-size: 12px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
