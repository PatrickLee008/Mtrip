<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { HolderOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import SearchFilterBar from '@/components/SearchFilterBar.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiSiteTree } from '@/api/site';
import type { SiteNode } from '@/api/types';
import { readMarkets, readMarket, readCandidates, writeMarket, type MarketScope, type MarketState } from '@/api/marketplace';
import HotelRankingReview from './HotelRankingReview.vue';
import { messages, myanmarCitiesZh } from './hotelRankingMessages';

const emit = defineEmits<{ (e: 'busy', value: boolean): void }>();
const { t } = useI18n({ useScope: 'global' });
const { t: h, locale } = useI18n({ useScope: 'local', messages });
const m = (key: string) => t('marketplace.' + key);
const user = useUserStore();
const router = useRouter();
const canEdit = computed(() => user.isSuper && user.hasPerm('merchant:ranking:save'));
const canBind = computed(() => user.isSuper && user.hasPerm('merchant:property:bind'));
const sites = ref<Record<number, SiteNode>>({});
const markets = ref<Awaited<ReturnType<typeof readMarkets>>['list']>([]);
const optionLoading = ref(false);
const optionError = ref(false);
const selected = ref<string>();
const storageKey = 'hotel-ranking:market:' + user.profile?.id;
const options = computed(() => markets.value.map(item => {
  const readableKey = item.city_key.replace(/-/g, ' ').replace(/(^|\s)\S/g, char => char.toLocaleUpperCase(locale.value));
  const city = locale.value === 'zh-CN' && item.country_code === 'MM' ? myanmarCitiesZh[item.city_key] || readableKey : readableKey;
  const site = sites.value[item.site_id]?.site_name || h('site', { id: item.site_id });
  return { value: JSON.stringify([Number(item.site_id), item.country_code, item.city_key]),
    label: [city, item.country_code, site].join(' · '), city, item };
}));
function matchMarket(input: string, option?: { label?: unknown; value?: unknown }) {
  return [option?.label, option?.value].join(' ').toLowerCase().includes(input.trim().toLowerCase());
}
const choice = computed(() => options.value.find(item => item.value === selected.value));
const scope = computed<MarketScope | undefined>(() => choice.value && ({
  entityType: 'listing', businessType: 'hotel', siteId: Number(choice.value.item.site_id),
  countryCode: choice.value.item.country_code, cityKey: choice.value.item.city_key, region: '',
}));
const rows = ref<TableRow[]>([]);
const market = ref<MarketState>({ version: 0, published_version: 0 });
const publishedConfig = ref<TableRow[]>([]);
const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const reviewSaving = ref(false);
const writing = computed(() => saving.value || reviewSaving.value);
const busy = computed(() => writing.value || loading.value);
watch(writing, value => emit('busy', value), { flush: 'sync' });
let marketRequest = 0;
let candidateRequest = 0;
let active = true;
onBeforeUnmount(() => { active = false; marketRequest++; candidateRequest++; });

async function loadMarkets() {
  optionLoading.value = true;
  optionError.value = false;
  try {
    markets.value = (await readMarkets()).list;
    if (!active) return;
    const previous = localStorage.getItem(storageKey);
    const saved = options.value.find(item => item.value === previous);
    const initial = saved ?? (options.value.length === 1 ? options.value[0] : undefined);
    if (initial) await selectMarket(initial.value);
  } catch { optionError.value = true; }
  finally { optionLoading.value = false; }
}
async function loadSites() {
  const walk = (nodes: SiteNode[]) => {
    for (const node of nodes) { sites.value[node.id] = node; if (node.children) walk(node.children); }
  };
  try { walk(await apiSiteTree()); } catch { /* Market options still identify their site by ID. */ }
}
onMounted(() => { void loadSites(); void loadMarkets(); });

async function loadCurrentMarket() {
  const sent = scope.value;
  if (!sent) return;
  const key = selected.value;
  const request = ++marketRequest;
  loading.value = true;
  try {
    const data = await readMarket({ ...sent });
    if (request !== marketRequest) return;
    let rank = 0;
    rows.value = data.list.map(row => ({ ...row, cityRank: row.eligible && Number(row.status) === 1 ? ++rank : null }));
    market.value = data.market;
    publishedConfig.value = data.published_config;
    loaded.value = true;
    if (key) localStorage.setItem(storageKey, key);
  } catch {
    if (request === marketRequest) { loaded.value = false; rows.value = []; }
  } finally { if (request === marketRequest) loading.value = false; }
}
async function selectMarket(key: string) {
  if (writing.value || !options.value.some(option => option.value === key)) return;
  selected.value = key;
  loaded.value = false;
  rows.value = [];
  detailId.value = undefined;
  closeProperties();
  resetFilters();
  await loadCurrentMarket();
}

const keyword = ref('');
const filters = ref<Record<string, string | number | undefined>>({});
const filterKey = ref(0);
const fullList = ref(false);
const focusId = ref<number>();
const tableWrap = ref<HTMLElement>();
const filterOptions = computed(() => [
  { key: 'status', label: h('membership'), options: [{ value: 1, label: h('included') }, { value: 2, label: h('removed') }] },
  { key: 'eligibility', label: h('display'), options: [{ value: 1, label: h('eligible') }, { value: 2, label: h('ineligible') }] },
]);
const isFiltered = computed(() => Boolean(keyword.value.trim() || filters.value.status || filters.value.eligibility));
const filtered = computed(() => rows.value.filter(row =>
  (!filters.value.status || Number(row.status) === filters.value.status)
  && (!filters.value.eligibility || (row.eligible ? 1 : 2) === filters.value.eligibility)
  && [row.property_name, row.merchant_name].join(' ').toLowerCase().includes(keyword.value.trim().toLowerCase())));
const { list: paged, page, pageSize, pagination, load: loadPage } = useTable(async params => {
  const page = Number(params.page), pageSize = Number(params.pageSize);
  return { list: filtered.value.slice((page - 1) * pageSize, page * pageSize), total: filtered.value.length, page, pageSize };
});
watch(filtered, () => {
  page.value = Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));
  void loadPage();
}, { flush: 'sync' });
const tablePagination = computed(() => ({
  ...pagination.value, showQuickJumper: false, showSizeChanger: false,
  showTotal: (total: number, range: [number, number]) => t('merchant.verifyPage.paginationInfo', { from: range[0], to: range[1], total }),
}));
const partial = computed(() => isFiltered.value || (!fullList.value && rows.value.length > pageSize.value));
const canDrag = computed(() => canEdit.value && loaded.value && !busy.value && !partial.value);
function search() { fullList.value = false; focusId.value = undefined; page.value = 1; void loadPage(); }
function resetFilters() { keyword.value = ''; filters.value = {}; filterKey.value++; search(); }
async function focusHotel(row: TableRow) {
  resetFilters();
  fullList.value = true;
  focusId.value = Number(row.id);
  await nextTick();
  const element = tableWrap.value?.querySelector<HTMLElement>('[data-row-key="' + focusId.value + '"]');
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: 'center' });
}

async function save(action: string, payload: Record<string, unknown>, note = '') {
  if (!loaded.value || busy.value || !scope.value) return;
  const sent = { ...scope.value };
  saving.value = true;
  try {
    await writeMarket(action, sent, Number(market.value.version), note, payload);
    if (active) message.success(action === 'property-display' ? m('saved') : h('savedDraft'));
  } catch { /* Request errors are shown by the global API interceptor. Reload before another edit. */ }
  finally {
    if (active) await loadCurrentMarket();
    saving.value = false;
  }
}
function flag(row: TableRow, field: 'status' | 'featured' | 'pinned') {
  if (!canEdit.value || (!row.eligible && field === 'status' && Number(row.status) !== 1)) return;
  const enabled = Number(row[field]) === 1;
  return save('pin', { id: Number(row.id), [field]: enabled ? (field === 'status' ? 2 : 0) : 1 });
}
const group = (r: TableRow) => Number(r.pinned) === 1 ? 0 : Number(r.featured) === 1 ? 1 : 2;
function reorder(from: number, to: number) {
  if (!canDrag.value || from === to) return;
  const source = rows.value.find(row => Number(row.id) === from);
  const target = rows.value.find(row => Number(row.id) === to);
  if (!source || !target) return;
  if (group(source) !== group(target)) { message.warning(m('groupOnly')); return; }
  const ids = rows.value.filter(row => group(row) === group(source)).map(row => Number(row.id));
  // Insert at the target's original position, so the last position can be reached as well.
  const targetIndex = ids.indexOf(to);
  ids.splice(ids.indexOf(from), 1);
  ids.splice(targetIndex, 0, from);
  return save('save-order', { ids });
}
let dragId: number | undefined;
function startDrag(event: DragEvent, row: TableRow) {
  if (!canDrag.value) { event.preventDefault(); return; }
  dragId = Number(row.id);
  event.dataTransfer?.setData('text/plain', String(dragId));
}
function rowProps(row: TableRow) {
  return {
    tabindex: -1,
    class: Number(row.id) === focusId.value ? 'rank-focus' : undefined,
    onDragover: (event: DragEvent) => { if (dragId && canDrag.value) event.preventDefault(); },
    onDrop: (event: DragEvent) => { event.preventDefault(); if (dragId) void reorder(dragId, Number(row.id)); dragId = undefined; },
  };
}

const columns = computed(() => [
  { title: h('cityRank'), key: 'rank', width: 85 }, { title: h('hotel'), key: 'hotel', width: 180 },
  { title: h('price'), key: 'price', width: 100 }, { title: m('rating'), key: 'rating', width: 65 },
  { title: m('group'), key: 'group', width: 104 }, { title: h('membership'), key: 'status', width: 105 },
  { title: t('common.action'), key: 'actions', width: 200 },
]);
function price(row: TableRow) {
  if (row.min_price == null) return '—';
  return [row.min_price_currency, Number(row.min_price).toLocaleString(locale.value)].filter(Boolean).join(' ');
}
function score(row: TableRow) {
  return Number(row.review_count) ? (Number(row.rating) * 2).toFixed(1) + ' / 10' : '—';
}
const detailId = ref<number>();
const detail = computed(() => rows.value.find(row => Number(row.id) === detailId.value));
function merchantProfile(row: TableRow) {
  void router.push({ path: '/merchant/list', query: { merchantId: String(row.merchant_id) } });
}
function reasons(row: TableRow): string {
  return (row.qualification_reasons || []).map((code: string) => h('reasons.' + code)).join(' · ');
}

type PropertyMode = 'add' | 'eligibility';
const propertyMode = ref<PropertyMode>();
const properties = ref<TableRow[]>([]);
const candidatesLoading = ref(false);
const propertyId = ref<number>();
const reason = ref('');
watch(propertyId, () => { reason.value = ''; }, { flush: 'sync' });
const available = computed(() => propertyMode.value === 'add' ? properties.value.filter(p => p.eligible && !p.already_ranked) : properties.value);
const propertyOptions = computed(() => available.value.map(p => ({
  value: Number(p.id), label: [p.store_name || '#' + p.id, p.merchant_name].filter(Boolean).join(' · '),
})));
const property = computed(() => available.value.find(p => Number(p.id) === propertyId.value));
const turningOff = computed(() => Number(property.value?.display_enabled) === 1);
const readyProperty = computed(() => {
  if (!property.value || busy.value || candidatesLoading.value) return false;
  if (propertyMode.value === 'add') return true;
  return !!reason.value.trim() && (turningOff.value || property.value.qualification_reasons?.every((code: string) => code === 'display_disabled'));
});
function closeProperties() {
  candidateRequest++;
  propertyMode.value = undefined; propertyId.value = undefined; properties.value = []; reason.value = ''; candidatesLoading.value = false;
}
async function openProperties(mode: PropertyMode) {
  if (!canBind.value || busy.value || !loaded.value || !scope.value) return;
  closeProperties();
  propertyMode.value = mode;
  const request = ++candidateRequest;
  candidatesLoading.value = true;
  try {
    const data = await readCandidates({ ...scope.value });
    if (request === candidateRequest) properties.value = data.properties;
  } catch { if (request === candidateRequest) closeProperties(); }
  finally { if (request === candidateRequest) candidatesLoading.value = false; }
}
async function submitProperty() {
  if (!canBind.value || !readyProperty.value || !property.value) return;
  const propertyId = Number(property.value.id);
  if (propertyMode.value === 'add') await save('listing/add', { propertyId });
  else await save('property-display', { propertyId, expectedPropertyVersion: Number(property.value.mapping_version), displayEnabled: turningOff.value ? 0 : 1 }, reason.value.trim());
  closeProperties();
}
</script>

<template>
  <div class="hotel-ranking">
    <div class="ranking-toolbar">
      <a-select :value="selected" show-search :filter-option="matchMarket" :loading="optionLoading" :options="options"
        :disabled="writing" class="market-select" :aria-label="h('choose')" :placeholder="h('choose')" @change="selectMarket" />
      <a-button v-if="optionError" @click="loadMarkets">{{ h('retry') }}</a-button>
      <span v-if="!optionLoading && !optionError && !markets.length" class="muted">{{ h('noMarkets') }}</span>
      <HotelRankingReview v-if="loaded && scope && choice" :key="selected" :scope="scope" :market="market" :rows="rows"
        :published-config="publishedConfig" :city-label="choice.city"
        :busy="saving || loading" @busy-change="reviewSaving = $event" @refresh="loadCurrentMarket" />
    </div>
    <a-spin v-if="loading && !loaded" />
    <a-button v-if="selected && !loaded && !loading" @click="loadCurrentMarket">{{ h('retry') }}</a-button>
    <template v-if="loaded">
      <div class="filter-row">
        <SearchFilterBar :key="filterKey" v-model="keyword" v-model:filter-values="filters" :filters="filterOptions"
          :placeholder="h('search')" :total="filtered.length" :result-label="t('merchant.verifyPage.resultCount')" @search="search">
          <template #filters>
            <a-button type="text" size="small" class="module-list-reset" @click="resetFilters">{{ t('common.reset') }}</a-button>
          </template>
        </SearchFilterBar>
        <a-space v-if="canBind" class="ranking-management-actions" :size="8">
          <a-button v-perm="'merchant:property:bind'" :disabled="busy" @click="openProperties('eligibility')">{{ h('manage') }}</a-button>
          <a-button v-perm="'merchant:property:bind'" :type="rows.length ? 'default' : 'primary'" :disabled="busy" @click="openProperties('add')">
            <template #icon><PlusOutlined /></template>{{ h('add') }}
          </a-button>
        </a-space>
      </div>
      <div v-if="fullList" class="full-toolbar">
        <span>{{ h('drag') }}</span><a-button size="small" @click="search">{{ h('paged') }}</a-button>
      </div>
      <div ref="tableWrap">
        <a-table class="module-list-table" :columns="columns" :data-source="fullList ? filtered : paged" :loading="loading || saving"
          :pagination="fullList ? false : tablePagination" row-key="id" size="middle" :custom-row="rowProps" :scroll="{ x: 840 }">
          <template #emptyText><a-empty :description="rows.length ? h('noMatch') : h('emptyRanking')" /></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'rank'">
              <span v-if="canDrag" class="drag-handle" draggable="true" :title="h('drag')" @dragstart="startDrag($event, record)" @dragend="dragId = undefined">
                <HolderOutlined />
              </span>
              {{ record.cityRank ?? '—' }}
            </template>
            <template v-else-if="column.key === 'hotel'">
              <a-button type="link" class="hotel-name" @click="detailId = Number(record.id)">{{ record.property_name || '#' + record.property_id }}</a-button>
              <div class="muted">{{ record.merchant_name }}</div>
            </template>
            <template v-else-if="column.key === 'price'">{{ price(record) }}</template>
            <template v-else-if="column.key === 'rating'">{{ score(record) }}</template>
            <template v-else-if="column.key === 'group'">
              <a-tag v-if="Number(record.pinned) === 1" color="blue">{{ m('pinned') }}</a-tag>
              <a-tag v-if="Number(record.featured) === 1" color="gold">{{ m('featured') }}</a-tag>
              <span v-if="group(record) === 2" class="muted">{{ m('normal') }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="Number(record.status) === 1 ? 'green' : undefined">{{ Number(record.status) === 1 ? h('included') : h('removed') }}</a-tag>
              <div v-if="!record.eligible" class="qualification">{{ h('ineligible') }}</div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space v-if="canEdit" :size="4" wrap>
                <a-button v-perm="'merchant:ranking:save'" type="link" size="small" :disabled="busy" @click="flag(record, 'pinned')">
                  {{ Number(record.pinned) === 1 ? h('unpin') : h('pin') }}
                </a-button>
                <a-button v-if="partial" v-perm="'merchant:ranking:save'" type="link" size="small" :disabled="busy" @click="focusHotel(record)">{{ h('full') }}</a-button>
                <a-dropdown :trigger="['click']" :disabled="busy">
                  <a-button v-perm="'merchant:ranking:save'" type="link" size="small" :disabled="busy">{{ h('more') }} <DownOutlined /></a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item v-perm="'merchant:ranking:save'" @click="flag(record, 'featured')">
                        {{ Number(record.featured) === 1 ? h('unfeature') : h('feature') }}
                      </a-menu-item>
                      <a-menu-item v-perm="'merchant:ranking:save'" :disabled="!record.eligible && Number(record.status) !== 1" @click="flag(record, 'status')">
                        {{ Number(record.status) === 1 ? h('remove') : h('restore') }}
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
              <a-button v-else type="link" size="small" @click="detailId = Number(record.id)">{{ m('details') }}</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <a-modal :open="!!propertyMode" :title="propertyMode === 'add' ? h('add') : h('manage')" :confirm-loading="saving"
      :ok-text="propertyMode === 'add' ? h('add') : turningOff ? h('turnOff') : h('turnOn')"
      :ok-button-props="{ disabled: !readyProperty, danger: propertyMode === 'eligibility' && turningOff }"
      :closable="!saving" :mask-closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }"
      @cancel="closeProperties" @ok="submitProperty">
      <a-form layout="vertical">
        <a-form-item :label="h('hotel')">
          <a-select v-model:value="propertyId" show-search option-filter-prop="label" :loading="candidatesLoading" :disabled="saving"
            :options="propertyOptions" :placeholder="h('chooseHotel')" :not-found-content="propertyMode === 'add' ? h('addEmpty') : h('noProperties')" />
        </a-form-item>
        <template v-if="property && propertyMode === 'eligibility'">
          <p>{{ property.eligible ? h('eligible') : reasons(property) || h('ineligible') }}</p>
          <a-alert :message="turningOff ? h('impactOff') : h('impactOn')" :type="turningOff ? 'warning' : 'info'" show-icon />
          <a-form-item class="reason-field" :label="h('reason')" required>
            <a-textarea v-model:value="reason" :maxlength="500" :rows="3" :disabled="saving" show-count />
          </a-form-item>
        </template>
      </a-form>
    </a-modal>

    <a-drawer :open="!!detail" :title="m('details')" :width="450" @close="detailId = undefined">
      <a-descriptions v-if="detail" :column="1" bordered>
        <a-descriptions-item :label="h('hotel')">{{ detail.property_name || '#' + detail.property_id }}</a-descriptions-item>
        <a-descriptions-item :label="m('market')">{{ choice?.label }}</a-descriptions-item>
        <a-descriptions-item :label="h('cityRank')">{{ detail.cityRank ?? '—' }}</a-descriptions-item>
        <a-descriptions-item :label="m('merchant')">
          <a v-if="detail.merchant_id && user.hasPerm('merchant:list:list')" v-perm="'merchant:list:list'" @click="merchantProfile(detail)">{{ detail.merchant_name || detail.merchant_id }}</a>
          <span v-else>{{ detail.merchant_name || '—' }}</span>
        </a-descriptions-item>
        <a-descriptions-item :label="h('price')">{{ price(detail) }}</a-descriptions-item>
        <a-descriptions-item :label="m('rating')">{{ score(detail) }}</a-descriptions-item>
        <a-descriptions-item :label="h('membership')">{{ Number(detail.status) === 1 ? h('included') : h('removed') }}</a-descriptions-item>
        <a-descriptions-item :label="h('display')">{{ detail.eligible ? h('eligible') : reasons(detail) || h('ineligible') }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<style scoped lang="less">
@import '@/styles/module-list.less';
.ranking-toolbar, .full-toolbar, .filter-row { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.market-select { width: min(320px, 100%); }
.filter-row { align-items: stretch; }
.filter-row :deep(.sfb-bar) { flex: 1 1 370px; margin: 0; }
.ranking-management-actions { height: 50px; align-self: stretch; align-items: center; }
.ranking-management-actions :deep(.ant-btn) { height: 50px; padding: 0 16px; border-radius: 6px; }
.muted, .full-toolbar { color: var(--mtrip-text-secondary); font-size: 12px; }
.drag-handle { display: inline-flex; align-items: center; justify-content: center; width: 24px; color: var(--mtrip-text-secondary); cursor: grab; }
.hotel-name { padding: 0; height: auto; white-space: normal; text-align: start; }
.qualification { color: #ad6800; font-size: 12px; }
.reason-field { margin-top: 16px; }
.module-list-table :deep(.rank-focus > td) { background: var(--sap-brand-light); }
</style>
