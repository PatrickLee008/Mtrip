<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiRankingDestinationAdd,
  apiRankingDestinationPin,
  apiRankingDestinationUpdate,
  apiRankingDestinations,
  apiRankingHistory,
  apiRankingListings,
  apiRankingPin,
  apiRankingPublish,
  apiRankingSaveOrder,
} from '@/api/merchant';
import type { TableRow } from '@/composables/useTable';
import { formatCurrency } from '@/utils/format';

/**
 * Marketplace Ranking(Super Admin Portal 模块 03,整改 Phase C)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.9
 * Listing Ranking / Popular Destinations 双 Tab + 拖拽排序 + Pin/Featured + 消费者预览 + 历史 + 发布
 */
const { t } = useI18n();

const activeTab = ref<'listing' | 'destination'>('listing');

// ---------- Listing Ranking ----------
const listingQuery = reactive({ businessType: '', city: '', status: undefined as number | undefined, keyword: '' });
const listings = ref<TableRow[]>([]);
const listingCities = ref<string[]>([]);
const listingLoading = ref(false);

async function loadListings(): Promise<void> {
  listingLoading.value = true;
  try {
    const data = await apiRankingListings({
      businessType: listingQuery.businessType || undefined,
      city: listingQuery.city || undefined,
      status: listingQuery.status,
      keyword: listingQuery.keyword || undefined,
    });
    listings.value = data.list;
    listingCities.value = data.cities;
  } finally {
    listingLoading.value = false;
  }
}

// ---------- Popular Destinations ----------
const destQuery = reactive({ region: '', status: undefined as number | undefined });
const destinations = ref<TableRow[]>([]);
const destRegions = ref<string[]>([]);
const destLoading = ref(false);

async function loadDestinations(): Promise<void> {
  destLoading.value = true;
  try {
    const data = await apiRankingDestinations({
      region: destQuery.region || undefined,
      status: destQuery.status,
    });
    destinations.value = data.list;
    destRegions.value = data.regions;
  } finally {
    destLoading.value = false;
  }
}

function switchTab(tab: 'listing' | 'destination'): void {
  activeTab.value = tab;
  void (tab === 'listing' ? loadListings() : loadDestinations());
}

// ---------- 拖拽排序 ----------
const dragIndex = ref<number | null>(null);

function listingRowProps(_record: TableRow, index: number): Record<string, unknown> {
  return {
    draggable: true,
    onDragstart: (e: DragEvent) => {
      dragIndex.value = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    },
    onDragover: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      handleListingDrop(index);
    },
  };
}

async function handleListingDrop(targetIndex: number): Promise<void> {
  if (dragIndex.value === null || dragIndex.value === targetIndex) {
    dragIndex.value = null;
    return;
  }
  const next = [...listings.value];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(targetIndex, 0, moved);
  dragIndex.value = null;
  listings.value = next.map((row, idx) => ({ ...row, rank: idx + 1 }));
  try {
    await apiRankingSaveOrder(next.map((row, idx) => ({ id: row.id, rank: idx + 1, featured: row.featured })));
    message.success(t('merchant.rankingPage.saved'));
  } catch {
    await loadListings();
  }
}

function destRowProps(_record: TableRow, index: number): Record<string, unknown> {
  return {
    draggable: true,
    onDragstart: (e: DragEvent) => {
      dragIndex.value = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    },
    onDragover: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      void handleDestDrop(index);
    },
  };
}

async function handleDestDrop(targetIndex: number): Promise<void> {
  if (dragIndex.value === null || dragIndex.value === targetIndex) {
    dragIndex.value = null;
    return;
  }
  const next = [...destinations.value];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(targetIndex, 0, moved);
  dragIndex.value = null;
  destinations.value = next.map((row, idx) => ({ ...row, rank: idx + 1 }));
  try {
    for (let i = 0; i < next.length; i += 1) {
      if (next[i].rank !== i + 1) {
        await apiRankingDestinationUpdate({ id: next[i].id, rank: i + 1 });
      }
    }
    message.success(t('merchant.rankingPage.saved'));
  } catch {
    await loadDestinations();
  }
}

// ---------- Pin / Featured ----------
async function toggleListingPin(row: TableRow): Promise<void> {
  await apiRankingPin(row.id, row.featured === 1 ? 0 : 1);
  await loadListings();
}

async function toggleDestPin(row: TableRow): Promise<void> {
  await apiRankingDestinationPin(row.id, row.featured === 1 ? 0 : 1);
  await loadDestinations();
}

// ---------- 发布(C5) ----------
function confirmPublish(): void {
  Modal.confirm({
    title: t('merchant.rankingPage.publish'),
    content: t('merchant.rankingPage.publishConfirm'),
    okText: t('merchant.rankingPage.publish'),
    async onOk() {
      await apiRankingPublish();
      message.success(t('merchant.rankingPage.publishSuccess'));
      await loadListings();
      await loadDestinations();
    },
  });
}

// ---------- 预览 / 历史 ----------
const previewOpen = ref(false);
const historyOpen = ref(false);
const historyRows = ref<TableRow[]>([]);
const historyLoading = ref(false);
const historyType = ref<'listing' | 'destination'>('listing');

function openPreview(): void {
  previewOpen.value = true;
}

async function openHistory(): Promise<void> {
  historyType.value = activeTab.value;
  historyOpen.value = true;
  historyLoading.value = true;
  try {
    const data = await apiRankingHistory({ entityType: historyType.value, page: 1, pageSize: 50 });
    historyRows.value = data.list;
  } finally {
    historyLoading.value = false;
  }
}

// ---------- 新增目的地 ----------
const addOpen = ref(false);
const addSaving = ref(false);
const addForm = reactive({ name: '', region: '', tagline: '', imageUrl: '' });

function openAdd(): void {
  Object.assign(addForm, { name: '', region: '', tagline: '', imageUrl: '' });
  addOpen.value = true;
}

async function doAdd(): Promise<void> {
  if (!addForm.name.trim() || !addForm.region.trim()) {
    message.warning(t('merchant.rankingPage.addRequired'));
    return;
  }
  addSaving.value = true;
  try {
    await apiRankingDestinationAdd({ ...addForm });
    message.success(t('merchant.rankingPage.addSuccess'));
    addOpen.value = false;
    await loadDestinations();
  } finally {
    addSaving.value = false;
  }
}

const LISTING_STATUS = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.rankingPage.active'), color: 'success' },
  2: { text: t('merchant.rankingPage.inactive'), color: 'default' },
}));

const DEST_STATUS = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.rankingPage.active'), color: 'success' },
  2: { text: t('merchant.rankingPage.hidden'), color: 'default' },
}));

function money(value: number | string | null | undefined): string {
  const formatted = formatCurrency(value);
  return formatted ? `${formatted} / night` : '';
}

const listingColumns = computed(() => [
  { title: t('merchant.rankingPage.colRank'), dataIndex: 'rank', width: 70 },
  { title: t('merchant.rankingPage.colBusiness'), dataIndex: 'business_name', width: 240 },
  { title: t('merchant.rankingPage.colMerchant'), dataIndex: 'merchant_name', width: 160 },
  { title: t('merchant.rankingPage.colType'), dataIndex: 'business_type', width: 100 },
  { title: t('merchant.rankingPage.colCity'), dataIndex: 'city', width: 110 },
  { title: t('merchant.rankingPage.colRating'), dataIndex: 'rating', width: 80 },
  { title: t('merchant.rankingPage.colStatus'), dataIndex: 'status', width: 100 },
  { title: t('merchant.rankingPage.colFeatured'), dataIndex: 'featured', width: 120 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
]);

const destColumns = computed(() => [
  { title: t('merchant.rankingPage.colRank'), dataIndex: 'rank', width: 70 },
  { title: t('merchant.rankingPage.colDestination'), dataIndex: 'name', width: 240 },
  { title: t('merchant.rankingPage.colRegion'), dataIndex: 'region', width: 170 },
  { title: t('merchant.rankingPage.colStatus'), dataIndex: 'status', width: 100 },
  { title: t('merchant.rankingPage.colFeatured'), dataIndex: 'featured', width: 120 },
  { title: t('merchant.rankingPage.colLastUpdated'), dataIndex: 'updated_at', width: 170 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
]);

onMounted(() => {
  void loadListings();
  void loadDestinations();
});
</script>

<template>
  <PageContainer>
    <div style="font-size: 12px; color: var(--sap-muted, #94a3b8); margin-bottom: 4px">
      {{ t('merchant.rankingPage.subtitle') }}
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
      <div>
        <div style="font-size: 18px; font-weight: 700; color: #1a2332">{{ t('merchant.rankingPage.title') }}</div>
        <div style="font-size: 12px; color: #64748b">{{ t('merchant.rankingPage.pageDesc') }}</div>
      </div>
      <a-space>
        <a-button @click="openHistory"><template #icon><ReloadOutlined /></template>{{ t('merchant.rankingPage.rankingHistory') }}</a-button>
        <a-button @click="openPreview">{{ t('merchant.rankingPage.previewConsumerView') }}</a-button>
        <a-button v-perm="'merchant:ranking:publish'" type="primary" @click="confirmPublish">{{ t('merchant.rankingPage.publish') }}</a-button>
      </a-space>
    </div>

    <a-tabs v-model:activeKey="activeTab" @change="switchTab">
      <a-tab-pane key="listing" :tab="t('merchant.rankingPage.tabListing')">
        <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
          <a-form layout="inline">
            <a-form-item :label="t('merchant.rankingPage.businessType')">
              <a-select v-model:value="listingQuery.businessType" allow-clear :placeholder="t('common.all')" style="width: 130px" @change="loadListings">
                <a-select-option value="hotel">{{ t('merchant.rankingPage.hotel') }}</a-select-option>
                <a-select-option value="restaurant">{{ t('merchant.rankingPage.restaurant') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('merchant.rankingPage.city')">
              <a-select v-model:value="listingQuery.city" allow-clear :placeholder="t('common.all')" style="width: 140px" @change="loadListings">
                <a-select-option v-for="c in listingCities" :key="c" :value="c">{{ c }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('merchant.rankingPage.status')">
              <a-select v-model:value="listingQuery.status" allow-clear :placeholder="t('common.all')" style="width: 120px" @change="loadListings">
                <a-select-option :value="1">{{ t('merchant.rankingPage.active') }}</a-select-option>
                <a-select-option :value="2">{{ t('merchant.rankingPage.inactive') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-input v-model:value="listingQuery.keyword" allow-clear :placeholder="t('merchant.rankingPage.searchPlaceholder')" style="width: 200px" @press-enter="loadListings" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadListings"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button @click="loadListings"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>

        <a-card :bordered="false" class="mtrip-card-shadow">
          <a-table
            :columns="listingColumns"
            :data-source="listings"
            :loading="listingLoading"
            :custom-row="listingRowProps"
            row-key="id"
            size="middle"
            :pagination="false"
            :scroll="{ x: 1100 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'rank'">
                <span style="color: #94a3b8; cursor: grab">⠿</span> {{ record.rank }}
              </template>
              <template v-else-if="column.dataIndex === 'business_name'">
                <div style="display: flex; align-items: center; gap: 8px">
                  <span style="font-weight: 600">{{ record.business_name }}</span>
                  <a-tag v-if="record.featured === 1" color="gold" style="margin: 0">{{ t('merchant.rankingPage.featured') }}</a-tag>
                </div>
                <div v-if="money(record.price_from)" style="font-size: 11px; color: #64748b">{{ money(record.price_from) }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'business_type'">{{ record.business_type }}</template>
              <template v-else-if="column.dataIndex === 'rating'">{{ Number(record.rating).toFixed(1) }}</template>
              <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="LISTING_STATUS" /></template>
              <template v-else-if="column.dataIndex === 'featured'">
                <a-tag v-if="record.featured === 1" color="gold">{{ t('merchant.rankingPage.pinned') }}</a-tag>
                <span v-else style="color: #94a3b8">—</span>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-button v-perm="'merchant:ranking:save'" type="link" size="small" @click="toggleListingPin(record)">
                  {{ record.featured === 1 ? t('merchant.rankingPage.unpin') : t('merchant.rankingPage.pin') }}
                </a-button>
              </template>
            </template>
          </a-table>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 10px">{{ t('merchant.rankingPage.dragHint') }}</div>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="destination" :tab="t('merchant.rankingPage.tabDestinations')">
        <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
          <a-form layout="inline">
            <a-form-item :label="t('merchant.rankingPage.region')">
              <a-select v-model:value="destQuery.region" allow-clear :placeholder="t('common.all')" style="width: 180px" @change="loadDestinations">
                <a-select-option v-for="r in destRegions" :key="r" :value="r">{{ r }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('merchant.rankingPage.status')">
              <a-select v-model:value="destQuery.status" allow-clear :placeholder="t('common.all')" style="width: 120px" @change="loadDestinations">
                <a-select-option :value="1">{{ t('merchant.rankingPage.active') }}</a-select-option>
                <a-select-option :value="2">{{ t('merchant.rankingPage.hidden') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadDestinations"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button @click="loadDestinations"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
              </a-space>
            </a-form-item>
            <a-form-item style="margin-left: auto">
              <a-button v-perm="'merchant:ranking:add'" type="primary" ghost @click="openAdd">
                <template #icon><PlusOutlined /></template>{{ t('merchant.rankingPage.addDestination') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>

        <a-card :bordered="false" class="mtrip-card-shadow">
          <a-table
            :columns="destColumns"
            :data-source="destinations"
            :loading="destLoading"
            :custom-row="destRowProps"
            row-key="id"
            size="middle"
            :pagination="false"
            :scroll="{ x: 950 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'rank'">
                <span style="color: #94a3b8; cursor: grab">⠿</span> {{ record.rank }}
              </template>
              <template v-else-if="column.dataIndex === 'name'">
                <div style="display: flex; align-items: center; gap: 8px">
                  <span style="font-weight: 600">{{ record.name }}</span>
                  <a-tag v-if="record.featured === 1" color="gold" style="margin: 0">{{ t('merchant.rankingPage.featured') }}</a-tag>
                </div>
                <div v-if="record.tagline" style="font-size: 11px; color: #64748b">{{ record.tagline }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="DEST_STATUS" /></template>
              <template v-else-if="column.dataIndex === 'featured'">
                <a-tag v-if="record.featured === 1" color="gold">{{ t('merchant.rankingPage.pinned') }}</a-tag>
                <span v-else style="color: #94a3b8">—</span>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-button v-perm="'merchant:ranking:save'" type="link" size="small" @click="toggleDestPin(record)">
                  {{ record.featured === 1 ? t('merchant.rankingPage.unpin') : t('merchant.rankingPage.pin') }}
                </a-button>
              </template>
            </template>
          </a-table>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 10px">{{ t('merchant.rankingPage.destDragHint') }}</div>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- 消费者预览 -->
    <a-modal v-model:open="previewOpen" :title="t('merchant.rankingPage.previewConsumerView')" :footer="null" width="420">
      <div style="border: 2px solid #1a2332; border-radius: 24px; padding: 12px; width: 300px; margin: 0 auto; background: #fff">
        <div style="text-align: center; font-size: 12px; color: #94a3b8; padding: 4px 0 8px">09:41 · mTrip</div>
        <div v-if="activeTab === 'listing'" style="font-weight: 700; margin-bottom: 8px">{{ t('merchant.rankingPage.previewHotelsIn') }} Yangon</div>
        <div v-else style="font-weight: 700; margin-bottom: 8px">{{ t('merchant.rankingPage.previewPopularDest') }}</div>
        <div
          v-for="(row, idx) in (activeTab === 'listing' ? listings : destinations).slice(0, 8)"
          :key="row.id"
          style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9"
        >
          <div style="width: 24px; height: 24px; border-radius: 50%; background: #1664ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0">
            {{ idx + 1 }}
          </div>
          <div style="flex: 1; min-width: 0">
            <div style="font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ row.business_name || row.name }}
            </div>
            <div style="font-size: 11px; color: #94a3b8">
              {{ activeTab === 'listing' ? `${Number(row.rating).toFixed(1)} · ${money(row.price_from)}` : (row.region || '') }}
            </div>
          </div>
        </div>
        <div style="font-size: 11px; color: #94a3b8; text-align: center; padding-top: 8px">{{ t('merchant.rankingPage.previewOnly') }}</div>
      </div>
    </a-modal>

    <!-- 排名历史 -->
    <a-drawer v-model:open="historyOpen" :width="520" :title="t('merchant.rankingPage.rankingHistory')">
      <a-spin :spinning="historyLoading">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 12px">
          {{ t('merchant.rankingPage.historyDesc', { filter: historyType === 'listing' ? t('merchant.rankingPage.tabListing') : t('merchant.rankingPage.tabDestinations') }) }}
        </div>
        <a-timeline>
          <a-timeline-item v-for="h in historyRows" :key="h.id">
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-weight: 600">{{ h.entity_name }}</span>
              <span style="font-size: 11px; color: #64748b">{{ h.action }}</span>
            </div>
            <div v-if="h.from_rank || h.to_rank" style="font-size: 12px; color: #64748b">
              {{ h.from_rank ? `#${h.from_rank}` : '—' }} → {{ h.to_rank ? `#${h.to_rank}` : '—' }}
            </div>
            <div v-if="h.note" style="font-size: 12px; color: #64748b">{{ h.note }}</div>
            <div style="font-size: 11px; color: #94a3b8">{{ h.created_at }} · {{ t('merchant.rankingPage.by') }} {{ h.operator_name }}</div>
          </a-timeline-item>
        </a-timeline>
      </a-spin>
    </a-drawer>

    <!-- 新增目的地 -->
    <a-modal
      v-model:open="addOpen"
      :title="t('merchant.rankingPage.addDestination')"
      :confirm-loading="addSaving"
      :ok-text="t('merchant.rankingPage.addDestination')"
      @ok="doAdd"
    >
      <p style="font-size: 12px; color: #64748b; margin: 8px 0 12px">{{ t('merchant.rankingPage.addDesc') }}</p>
      <a-form layout="vertical">
        <a-form-item :label="`${t('merchant.rankingPage.destName')} *`" required>
          <a-input v-model:value="addForm.name" :placeholder="t('merchant.rankingPage.destNamePlaceholder')" />
        </a-form-item>
        <a-form-item :label="`${t('merchant.rankingPage.region')} *`" required>
          <a-input v-model:value="addForm.region" :placeholder="t('merchant.rankingPage.regionPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('merchant.rankingPage.tagline')">
          <a-input v-model:value="addForm.tagline" :placeholder="t('merchant.rankingPage.taglinePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('merchant.rankingPage.imageUrl')">
          <a-input v-model:value="addForm.imageUrl" placeholder="https://…" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
