<script setup lang="ts">
/**
 * M8 促销管理页(Figma `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`「Promotion tables」)。
 *
 * 稿面是同一页的两种呈现:
 * - Percentage / Fixed Amount(以及功能需求新增的 Long Stay)→ **卡片网格**;
 * - Coupon Code → **表格**。
 * 两者共用页面壳:H1 + 副标题 + `Add New Promotion`,五张统计卡,
 * Tab 条,以及同一个新建/编辑抽屉。稿面没画的筛选卡、聚光灯卡、状态条均已移除。
 */
import { computed, onMounted, ref } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import PromoIcon from './components/PromoIcon.vue';
import StatCards from './components/StatCards.vue';
import PromoGrid from './components/PromoGrid.vue';
import PromoTable from './components/PromoTable.vue';
import PromoDrawer from './components/PromoDrawer.vue';
import { useTable } from '@/composables/useTable';
import {
  PROMOTION_KIND,
  apiPromotionAdd,
  apiPromotionDelete,
  apiPromotionDetail,
  apiPromotionDuplicate,
  apiPromotionEnd,
  apiPromotionList,
  apiPromotionOptions,
  apiPromotionPublish,
  apiPromotionSummary,
  apiPromotionToggleStatus,
  apiPromotionUpdate,
  type MerchantPromotion,
  type PromotionOptions,
  type PromotionPayload,
  type PromotionSummary,
} from '@/api/promotions';
import { KIND_TABS } from './helpers';

const { t } = useI18n();

const summary = ref<PromotionSummary>({
  total: 0,
  percentage: 0,
  fixedAmount: 0,
  promoCode: 0,
  longStay: 0,
  draft: 0,
  active: 0,
  paused: 0,
  ended: 0,
  claimed: 0,
  used: 0,
  impressions: 0,
});
const optionsLoading = ref(false);
const optionsFailed = ref(false);
const loadFailed = ref(false);
const busyId = ref<number | null>(null);
const options = ref<PromotionOptions>({ properties: [], roomTypes: [], currency: 'THB' });
/** 新建时抽屉的初始形态(跟随当前 Tab) */
const activeKind = ref<number>(PROMOTION_KIND.percentage);
const drawerOpen = ref(false);
const drawerDetail = ref<MerchantPromotion | null>(null);
const saving = ref(false);

const { loading, list, query, page, load, pagination } = useTable<MerchantPromotion>(apiPromotionList, {
  promotionKind: PROMOTION_KIND.percentage,
});

/** 稿面 Tab:Percentage / Fixed Amount / Coupon Code + 功能需求新增的 Long Stay */
const tabs = computed(() => KIND_TABS.map((kind) => ({
  kind,
  label: t(`promotions.kind.${kind}`),
})));

/** 优惠码 Tab 用表格,其余用卡片网格(照稿:两种呈现并存) */
const isTableMode = computed(() => activeKind.value === PROMOTION_KIND.promoCode);

/** a-pagination 需要的非空分页值(TablePaginationConfig 的字段都是可选的) */
const pager = computed(() => ({
  current: pagination.value.current ?? 1,
  pageSize: pagination.value.pageSize ?? 20,
  total: pagination.value.total ?? 0,
}));

const currency = computed(() => options.value.currency || 'THB');

const propertyNames = computed(() => {
  const map: Record<number, string> = {};
  options.value.properties.forEach((item) => {
    map[item.id] = item.property_name;
  });
  return map;
});

const roomNames = computed(() => {
  const map: Record<number, string> = {};
  options.value.roomTypes.forEach((item) => {
    map[item.id] = item.room_name;
  });
  return map;
});

async function loadSummary(): Promise<void> {
  summary.value = await apiPromotionSummary();
}

async function loadOptions(): Promise<void> {
  optionsLoading.value = true;
  optionsFailed.value = false;
  try {
    options.value = await apiPromotionOptions();
  } catch {
    optionsFailed.value = true;
  } finally {
    optionsLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  loadFailed.value = false;
  try {
    await Promise.all([loadSummary(), load()]);
  } catch {
    loadFailed.value = true;
  }
}

function pickTab(kind: number): void {
  if (activeKind.value === kind || loading.value || saving.value || busyId.value !== null) return;
  activeKind.value = kind;
  query.promotionKind = kind;
  query.promotionCondition = kind === 0 ? 'standard' : '';
  page.value = 1;
  void refreshAll();
}

function changePage(next: number): void {
  if (loading.value || busyId.value !== null) return;
  page.value = next;
  void refreshAll();
}

function openCreate(): void {
  if (optionsLoading.value || optionsFailed.value) return;
  drawerDetail.value = null;
  drawerOpen.value = true;
}

async function openEdit(row: MerchantPromotion): Promise<void> {
  if (busyId.value !== null || optionsFailed.value || optionsLoading.value) return;
  busyId.value = row.id;
  try {
    drawerDetail.value = await apiPromotionDetail(row.id);
    drawerOpen.value = true;
  } finally { busyId.value = null; }
}

function closeDrawer(): void {
  drawerOpen.value = false;
  drawerDetail.value = null;
}

function save(payload: PromotionPayload): void {
  if (drawerDetail.value) {
    Modal.confirm({ title: t('promotions.confirm.edit'), content: t('promotions.drawer.claimProtection'),
      okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => persist(payload) });
  } else void persist(payload);
}

async function persist(payload: PromotionPayload): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    if (drawerDetail.value) {
      await apiPromotionUpdate(payload);
    } else {
      await apiPromotionAdd(payload);
    }
    message.success(t('common.saveSuccess'));
    // Editing can move a promotion to another type; follow it after saving.
    activeKind.value = payload.promotionKind;
    query.promotionKind = payload.promotionKind;
    query.promotionCondition = '';
    page.value = 1;
    closeDrawer();
    await refreshAll();
  } finally {
    saving.value = false;
  }
}

async function duplicate(row: MerchantPromotion): Promise<void> {
  if (busyId.value !== null) return;
  busyId.value = row.id;
  try {
    await apiPromotionDuplicate(row.id);
    message.success(t('common.opSuccess'));
    page.value = 1;
    await refreshAll();
  } finally { busyId.value = null; }
}

async function toggle(row: MerchantPromotion): Promise<void> {
  if (busyId.value !== null) return;
  Modal.confirm({
    title: t(Number(row.status) === 1 ? 'promotions.confirm.pause' : 'promotions.confirm.resume'),
    content: `${row.coupon_name}\n${t(Number(row.status) === 1 ? 'promotions.confirm.claimImpact' : 'promotions.drawer.claimProtection')}`,
    okText: t('common.confirm'), cancelText: t('common.cancel'),
    onOk: async () => {
      if (busyId.value !== null) return;
      busyId.value = row.id;
      try {
        await apiPromotionToggleStatus(row.id);
        message.success(t('common.opSuccess'));
        await refreshAll();
      } finally { busyId.value = null; }
    },
  });
}

function publish(row: MerchantPromotion): void {
  Modal.confirm({ title: t('promotions.confirm.resume'), content: t('promotions.drawer.claimProtection'),
    okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: async () => {
      if (busyId.value !== null) return;
      busyId.value = row.id;
      try { await apiPromotionPublish(row.id); await refreshAll(); }
      finally { busyId.value = null; }
    } });
}

function endPromotion(row: MerchantPromotion): void {
  Modal.confirm({
    title: t('promotions.confirm.end'), content: `${row.coupon_name}\n${t('promotions.confirm.claimImpact')}`,
    okText: t('common.confirm'), cancelText: t('common.cancel'),
    onOk: async () => {
      if (busyId.value !== null) return;
      busyId.value = row.id;
      try {
        await apiPromotionEnd(row.id);
        message.success(t('common.opSuccess'));
        await refreshAll();
      } finally { busyId.value = null; }
    },
  });
}

function remove(row: MerchantPromotion): void {
  Modal.confirm({
    title: t('promotions.confirm.archive'),
    content: t('promotions.confirm.claimImpact'),
    okText: t('common.confirm'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      if (busyId.value !== null) return;
      busyId.value = row.id;
      try {
        await apiPromotionDelete(row.id);
        message.success(t('common.opSuccess'));
        page.value = 1;
        await refreshAll();
      } finally { busyId.value = null; }
    },
  });
}

onMounted(async () => {
  await Promise.all([refreshAll(), loadOptions()]);
});
</script>

<template>
  <PageContainer>
    <div class="promotions-page">
      <header class="page-head">
        <div class="titles">
          <h1>{{ t('promotions.title') }}</h1>
          <p>{{ t('promotions.subtitle') }}</p>
        </div>
        <button v-perm="'mch:promotions:add'" type="button" class="add-btn" :disabled="optionsLoading || optionsFailed" @click="openCreate">
          <PromoIcon name="plus" :size="16" />
          <span>{{ t('promotions.create') }}</span>
        </button>
      </header>

      <StatCards :summary="summary" @pick="pickTab" />

      <section class="budget-overview">
        <h2>{{ t('promotions.budget.title') }}</h2>
        <div class="budget-values">
          <div v-for="key in ['total', 'utilized', 'available']" :key="key"><span>{{ t(`promotions.budget.${key}`) }}</span><strong>--</strong></div>
        </div>
        <p>{{ t('promotions.budget.unavailable') }}</p>
      </section>

      <a-alert v-if="optionsFailed" type="error" :message="t('promotions.optionsFailed')" show-icon><template #action><a-button size="small" @click="loadOptions">{{ t('promotions.retry') }}</a-button></template></a-alert>
      <a-alert v-if="loadFailed" type="error" :message="t('promotions.loadFailed')" show-icon><template #action><a-button size="small" @click="refreshAll">{{ t('promotions.retry') }}</a-button></template></a-alert>

      <nav class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.kind"
          type="button"
          class="tab"
          :class="{ active: activeKind === tab.kind }"
          @click="pickTab(tab.kind)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <a-spin v-if="!loadFailed" :spinning="loading || optionsLoading || busyId !== null">
        <PromoTable
          v-if="isTableMode"
          :list="list"
          :currency="currency"
          :loading="loading"
          @edit="openEdit"
          @duplicate="duplicate"
          @toggle="toggle"
          @publish="publish"
          @remove="remove"
          @end="endPromotion"
        />
        <PromoGrid
          v-else
          :list="list"
          :currency="currency"
          :property-names="propertyNames"
          :room-names="roomNames"
          @edit="openEdit"
          @duplicate="duplicate"
          @toggle="toggle"
          @publish="publish"
          @remove="remove"
          @end="endPromotion"
        />
      </a-spin>

      <div v-if="!loadFailed && pager.total > pager.pageSize" class="pager">
        <a-pagination
          :current="pager.current"
          :page-size="pager.pageSize"
          :total="pager.total"
          :show-size-changer="false"
          @change="changePage"
        />
      </div>
    </div>

    <PromoDrawer
      :open="drawerOpen"
      :detail="drawerDetail"
      :kind="activeKind || PROMOTION_KIND.percentage"
      :options="options"
      :saving="saving"
      @close="closeDrawer"
      @save="save"
    />
  </PageContainer>
</template>

<style scoped lang="less">
@import './tokens.less';

.promotions-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: @pr-ink;
}

.budget-overview {
  padding: 16px;
  border: 1px solid #238f87;
  border-radius: @pr-radius-card;
  background: #fff;
  h2 { margin: 0 0 16px; font: 700 16px @pr-font-display; }
  p { margin: 12px 0 0; color: @pr-ink-sub; font-size: 12px; }
}
.budget-values {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  div { display: flex; flex-direction: column; gap: 12px; padding: 0 16px; border-left: 1px solid @pr-line; }
  div:first-child { padding-left: 0; border: 0; }
  span { color: @pr-ink-sub; font-size: 12px; text-transform: uppercase; }
  strong { color: @pr-ink-sub; font: 700 24px @pr-font-display; }
}
.add-btn:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 620px) { .page-head { align-items: flex-start; flex-direction: column; } .tab-bar { overflow-x: auto; flex-shrink: 0; } .tab { white-space: nowrap; } }

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.titles {
  h1 {
    margin: 0;
    color: @pr-ink;
    font-family: @pr-font-display;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.5;
  }

  p {
    margin: 4px 0 0;
    color: @pr-ink-muted;
    font-family: @pr-font-body;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
  }
}

.add-btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 0;
  border-radius: @pr-radius-control;
  background: @pr-primary;
  color: #fff;
  font-family: @pr-font-button;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    background: #3559d8;
  }
}

.tab-bar {
  display: flex;
  align-items: stretch;
  gap: 24px;
  height: @pr-tab-height;
  padding: 0 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: #fff;
}

.tab {
  display: flex;
  width: @pr-tab-width;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-bottom: 4px solid transparent;
  background: transparent;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;

  &.active {
    border-bottom-color: @pr-primary;
    color: @pr-primary;
  }
}

.pager {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .tab-bar {
    overflow-x: auto;
  }

  .tab {
    width: auto;
    white-space: nowrap;
  }
}
</style>
