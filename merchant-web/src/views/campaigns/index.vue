<script setup lang="ts">
/**
 * M8 平台活动参与页(功能需求「参与平台活动」)。
 *
 * Figma SECTION `2285:21516` 只画了 Promotions 页,本页沿用同一套设计令牌与卡片形状新设计:
 * 概览卡 + 参与状态筛选 + 活动卡网格 + 详情抽屉(资格/出资/条款 + 接受或拒绝邀请)。
 * 可见性与响应规则全在 `Merchant/CampaignController`(定向邀请 vs 公开报名)。
 */
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import PromoIcon from '@/views/promotions/components/PromoIcon.vue';
import CampaignCard from './components/CampaignCard.vue';
import CampaignDrawer from './components/CampaignDrawer.vue';
import { useTable } from '@/composables/useTable';
import {
  apiCampaignDetail,
  apiCampaignList,
  apiCampaignRespond,
  apiCampaignSummary,
  type CampaignSummary,
  type MerchantCampaign,
} from '@/api/campaigns';
import { apiPromotionOptions } from '@/api/promotions';

const { t } = useI18n();

const FILTERS = ['all', 'pending', 'accepted', 'declined'] as const;

const summary = ref<CampaignSummary>({ total: 0, pending: 0, accepted: 0, declined: 0, withdrawn: 0 });
const activeFilter = ref<string>('all');
const currency = ref<string>('THB');
const merchantOptions = ref<{ value: number; label: string }[]>([]);
/** 集团账号可见商户不止一家时,响应邀请必须显式指定「以哪家商户响应」 */
const activeMerchantId = ref(0);
const drawerOpen = ref(false);
const drawerDetail = ref<MerchantCampaign | null>(null);
const drawerCoupons = ref<{ id: number; coupon_name: string; coupon_type: number; discount_value: number }[]>([]);
const saving = ref(false);

const { loading, list, query, load, search, pagination } = useTable<MerchantCampaign>(apiCampaignList, {
  participation: undefined,
});

/** a-pagination 需要的非空分页值(TablePaginationConfig 的字段都是可选的) */
const pager = computed(() => ({
  current: pagination.value.current ?? 1,
  pageSize: pagination.value.pageSize ?? 20,
  total: pagination.value.total ?? 0,
  onChange: pagination.value.onChange,
}));

const cards = computed(() => [
  { key: 'total', icon: 'megaphone', tone: 'primary', value: summary.value.total, label: t('campaigns.summary.total'), sub: '' },
  { key: 'pending', icon: 'info', tone: 'warn', value: summary.value.pending, label: t('campaigns.summary.pending'), sub: t('campaigns.summary.pendingSub') },
  { key: 'accepted', icon: 'check-circle', tone: 'success', value: summary.value.accepted, label: t('campaigns.summary.accepted'), sub: t('campaigns.summary.acceptedSub') },
  { key: 'declined', icon: 'x-circle', tone: 'warn', value: summary.value.declined, label: t('campaigns.summary.declined'), sub: t('campaigns.summary.declinedSub') },
]);

async function loadSummary(): Promise<void> {
  summary.value = await apiCampaignSummary();
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadSummary(), load()]);
}

function pickFilter(filter: string): void {
  activeFilter.value = filter;
  query.participation = filter === 'all' ? undefined : filter;
  search();
}

async function openDetail(row: MerchantCampaign): Promise<void> {
  const detail = await apiCampaignDetail(row.id);
  drawerDetail.value = detail;
  drawerCoupons.value = detail.coupons ?? [];
  drawerOpen.value = true;
}

function merchantIdForRespond(): number {
  return activeMerchantId.value;
}

function closeDrawer(): void {
  drawerOpen.value = false;
  drawerDetail.value = null;
  drawerCoupons.value = [];
}

async function respond(row: MerchantCampaign, action: 'accept' | 'decline'): Promise<void> {
  if (action === 'decline') {
    // 拒绝原因是可选的业务备注,抽屉里有输入框;卡片上的快速拒绝直接提交空备注
    saving.value = true;
    try {
      await apiCampaignRespond(row.id, 'decline', '', merchantIdForRespond());
      message.success(t('common.opSuccess'));
      await refreshAll();
    } finally {
      saving.value = false;
    }
    return;
  }
  await acceptFrom(row.id);
}

async function acceptFrom(id: number): Promise<void> {
  saving.value = true;
  try {
    await apiCampaignRespond(id, 'accept', '', merchantIdForRespond());
    message.success(t('common.opSuccess'));
    closeDrawer();
    await refreshAll();
  } finally {
    saving.value = false;
  }
}

async function respondFromDrawer(id: number, action: 'accept' | 'decline', remark: string): Promise<void> {
  if (action === 'accept') {
    await acceptFrom(id);
    return;
  }
  saving.value = true;
  try {
    await apiCampaignRespond(id, 'decline', remark, merchantIdForRespond());
    message.success(t('common.opSuccess'));
    closeDrawer();
    await refreshAll();
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const options = await apiPromotionOptions();
  currency.value = options.currency || 'THB';
  const seen = new Map<number, string>();
  options.properties.forEach((item) => {
    if (!seen.has(item.merchant_id)) seen.set(item.merchant_id, item.merchant_name || `#${item.merchant_id}`);
  });
  merchantOptions.value = Array.from(seen, ([value, label]) => ({ value, label }));
  // 只有一家商户(商户/门店账号)时自动选中,选择器不出现
  activeMerchantId.value = merchantOptions.value.length > 0 ? merchantOptions.value[0].value : 0;
  await refreshAll();
});
</script>

<template>
  <PageContainer>
    <div class="campaigns-page">
      <header class="page-head">
        <div class="titles">
          <h1>{{ t('campaigns.title') }}</h1>
          <p>{{ t('campaigns.subtitle') }}</p>
        </div>
        <div class="page-actions">
          <a-select
            v-if="merchantOptions.length > 1"
            v-model:value="activeMerchantId"
            class="merchant-select"
            :options="merchantOptions"
          />
          <div class="filter-switch">
            <button
              v-for="item in FILTERS"
              :key="item"
              type="button"
              class="filter-btn"
              :class="{ active: activeFilter === item }"
              @click="pickFilter(item)"
            >
              {{ t(`campaigns.filters.${item}`) }}
            </button>
          </div>
        </div>
      </header>

      <section class="summary-row">
        <article v-for="card in cards" :key="card.key" class="summary-card">
          <div class="summary-head">
            <span class="summary-label">{{ card.label }}</span>
            <span class="summary-icon" :class="`tone-${card.tone}`">
              <PromoIcon :name="card.icon" :size="14" />
            </span>
          </div>
          <div class="summary-value">{{ card.value }}</div>
          <div v-if="card.sub" class="summary-sub">{{ card.sub }}</div>
        </article>
      </section>

      <a-spin :spinning="loading">
        <div v-if="list.length === 0" class="empty">{{ t('campaigns.empty') }}</div>
        <div v-else class="campaign-grid">
          <CampaignCard
            v-for="row in list"
            :key="row.id"
            :campaign="row"
            @detail="openDetail"
            @respond="respond"
          />
        </div>
      </a-spin>

      <div v-if="pager.total > pager.pageSize" class="pager">
        <a-pagination
          :current="pager.current"
          :page-size="pager.pageSize"
          :total="pager.total"
          :show-size-changer="false"
          @change="pager.onChange"
        />
      </div>
    </div>

    <CampaignDrawer
      :open="drawerOpen"
      :campaign="drawerDetail"
      :coupons="drawerCoupons"
      :currency="currency"
      :saving="saving"
      @close="closeDrawer"
      @respond="respondFromDrawer"
    />
  </PageContainer>
</template>

<style scoped lang="less">
@import '@/views/promotions/tokens.less';

.campaigns-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  color: @pr-ink;
}

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
    line-height: 1.5;
  }
}

.page-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}

.merchant-select {
  min-width: 200px;
}

.filter-switch {
  display: flex;
  flex: none;
  gap: 8px;
  padding: 4px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
}

.filter-btn {
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &.active {
    background: @pr-primary-soft;
    color: @pr-primary;
  }
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: @pr-card-bg;
  box-shadow: @pr-shadow-card;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-label {
  color: @pr-ink-sub;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 500;
}

.summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: @pr-radius-control;

  &.tone-primary {
    background: @pr-primary-soft;
    color: @pr-primary;
  }

  &.tone-warn {
    background: @pr-warn-soft;
    color: @pr-warn;
  }

  &.tone-success {
    background: @pr-success-faint;
    color: @pr-success;
  }
}

.summary-value {
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.summary-sub {
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
}

.campaign-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.empty {
  padding: 64px 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  text-align: center;
}

.pager {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1180px) {
  .summary-row,
  .campaign-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .campaigns-page {
    padding: 16px;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-row,
  .campaign-grid {
    grid-template-columns: 1fr;
  }
}
</style>
