<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const notificationDetail = ref<MerchantPromotion | null>(null);
const notificationOpen = ref(false);
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
  TagOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import AmountText from '@/components/AmountText.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import { apiGoodsList, type MerchantGoods } from '@/api/goods';
import {
  apiPromotionAdd,
  apiPromotionDelete,
  apiPromotionDetail,
  apiPromotionList,
  apiPromotionPublish,
  apiPromotionSummary,
  apiPromotionToggleStatus,
  apiPromotionUpdate,
  type MerchantPromotion,
  type PromotionSummary,
} from '@/api/promotions';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const userStore = useUserStore();

const summary = ref<PromotionSummary>({ total: 0, draft: 0, active: 0, paused: 0, ended: 0, claimed: 0, used: 0, estimatedBudget: 0 });
const summaryLoading = ref(false);
const goodsLoading = ref(false);
const goodsOptions = ref<MerchantGoods[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable<MerchantPromotion>(apiPromotionList, {
  keyword: '',
  couponType: undefined,
  status: undefined,
});

const statusMap = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('promotions.status.draft'), color: 'default' },
  1: { text: t('promotions.status.active'), color: 'success' },
  2: { text: t('promotions.status.paused'), color: 'warning' },
  3: { text: t('promotions.status.ended'), color: 'error' },
}));

const columns = computed(() => [
  { title: t('promotions.name'), dataIndex: 'coupon_name', width: 240 },
  { title: t('promotions.type'), dataIndex: 'coupon_type', width: 130 },
  { title: t('promotions.discount'), dataIndex: 'discount_value', width: 140 },
  { title: t('promotions.claimedUsed'), dataIndex: 'received_count', width: 140 },
  { title: t('promotions.validity'), dataIndex: 'valid_start', width: 230 },
  { title: t('promotions.budget'), dataIndex: 'budget_estimate', width: 140 },
  { title: t('common.status'), dataIndex: 'status', width: 120 },
  { title: t('common.operation'), key: 'action', width: 240, fixed: 'right' as const },
]);

const cards = computed(() => [
  { key: 'active', label: t('promotions.cards.active'), value: summary.value.active, sub: t('promotions.cards.activeSub'), tone: 'blue' },
  { key: 'claimed', label: t('promotions.cards.claimed'), value: summary.value.claimed, sub: t('promotions.cards.claimedSub'), tone: 'green' },
  { key: 'used', label: t('promotions.cards.used'), value: summary.value.used, sub: t('promotions.cards.usedSub'), tone: 'orange' },
  { key: 'budget', label: t('promotions.cards.budget'), value: money(summary.value.estimatedBudget), sub: t('promotions.cards.budgetSub'), tone: 'red' },
]);

const formOpen = ref(false);
const formSaving = ref(false);
const editingId = ref(0);
const dateRange = ref<[Dayjs, Dayjs] | null>(null);
const form = reactive({
  couponName: '',
  couponType: 1,
  discountValue: 0,
  minAmount: 0,
  maxDiscount: 0,
  totalCount: 0,
  perUserLimit: 1,
  validType: 1,
  validDays: 30,
  goodsIds: [] as number[],
  remark: '',
});

const isGroupAccount = computed(() => userStore.profile?.accountType === 1);

async function loadSummary(): Promise<void> {
  summaryLoading.value = true;
  try {
    summary.value = await apiPromotionSummary();
  } finally {
    summaryLoading.value = false;
  }
}

async function loadGoodsOptions(): Promise<void> {
  goodsLoading.value = true;
  try {
    const data = await apiGoodsList({ page: 1, pageSize: 200, goodsType: 1 });
    goodsOptions.value = data.list;
  } finally {
    goodsLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadSummary(), load()]);
}

function resetForm(): void {
  editingId.value = 0;
  Object.assign(form, {
    couponName: '',
    couponType: 1,
    discountValue: 0,
    minAmount: 0,
    maxDiscount: 0,
    totalCount: 0,
    perUserLimit: 1,
    validType: 1,
    validDays: 30,
    goodsIds: [],
    remark: '',
  });
  dateRange.value = [dayjs(), dayjs().add(30, 'day')];
}

function openCreate(): void {
  resetForm();
  formOpen.value = true;
}

async function openEdit(row: MerchantPromotion): Promise<void> {
  const detail = await apiPromotionDetail(row.id);
  editingId.value = detail.id;
  Object.assign(form, {
    couponName: detail.coupon_name,
    couponType: detail.coupon_type,
    discountValue: Number(detail.discount_value || 0),
    minAmount: Number(detail.min_amount || 0),
    maxDiscount: Number(detail.max_discount || 0),
    totalCount: Number(detail.total_count || 0),
    perUserLimit: Number(detail.per_user_limit || 1),
    validType: detail.valid_type,
    validDays: Number(detail.valid_days || 30),
    goodsIds: detail.goods_ids || [],
    remark: detail.remark || '',
  });
  dateRange.value = detail.valid_type === 1 && detail.valid_start && detail.valid_end ? [dayjs(detail.valid_start), dayjs(detail.valid_end)] : null;
  formOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (!form.couponName.trim()) {
    message.warning(t('promotions.validation.name'));
    return;
  }
  if (form.goodsIds.length === 0) {
    message.warning(t('promotions.validation.goods'));
    return;
  }
  if (isGroupAccount.value && selectedMerchantIds().length !== 1) {
    message.warning(t('promotions.validation.oneMerchant'));
    return;
  }
  if (form.validType === 1 && (!dateRange.value || dateRange.value.length !== 2)) {
    message.warning(t('promotions.validation.date'));
    return;
  }

  const payload: Record<string, unknown> = {
    couponName: form.couponName.trim(),
    couponType: form.couponType,
    discountValue: form.discountValue,
    minAmount: form.minAmount,
    maxDiscount: form.maxDiscount,
    totalCount: form.totalCount,
    perUserLimit: form.perUserLimit,
    validType: form.validType,
    validDays: form.validDays,
    goodsIds: form.goodsIds,
    remark: form.remark.trim(),
  };
  if (form.validType === 1 && dateRange.value) {
    payload.validStart = dateRange.value[0].format('YYYY-MM-DD 00:00:00');
    payload.validEnd = dateRange.value[1].format('YYYY-MM-DD 23:59:59');
  }
  if (isGroupAccount.value) {
    payload.merchantId = selectedMerchantIds()[0];
  }
  if (editingId.value > 0) {
    payload.id = editingId.value;
  }

  formSaving.value = true;
  try {
    editingId.value > 0 ? await apiPromotionUpdate(payload) : await apiPromotionAdd(payload);
    message.success(t('common.saveSuccess'));
    formOpen.value = false;
    await refreshAll();
  } finally {
    formSaving.value = false;
  }
}

async function publish(row: MerchantPromotion): Promise<void> {
  await apiPromotionPublish(row.id);
  message.success(t('common.opSuccess'));
  await refreshAll();
}

async function toggle(row: MerchantPromotion): Promise<void> {
  await apiPromotionToggleStatus(row.id);
  message.success(t('common.opSuccess'));
  await refreshAll();
}

async function remove(row: MerchantPromotion): Promise<void> {
  await apiPromotionDelete(row.id);
  message.success(t('common.opSuccess'));
  await refreshAll();
}

function selectedMerchantIds(): number[] {
  const ids = goodsOptions.value.filter((item) => form.goodsIds.includes(item.id)).map((item) => item.merchant_id);
  return Array.from(new Set(ids));
}

function couponTypeText(type: number): string {
  return t(`promotions.typeMap.${type}`);
}

function discountText(row: MerchantPromotion): string {
  if (row.coupon_type === 2) {
    return `${row.discount_value}${t('promotions.discountUnit.percent')}`;
  }
  return money(Number(row.discount_value || 0));
}

function validityText(row: MerchantPromotion): string {
  if (row.valid_type === 2) {
    return t('promotions.validDaysText', { days: row.valid_days });
  }
  return `${row.valid_start || '-'} - ${row.valid_end || '-'}`;
}

function money(value: number): string {
  return `THB ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

watch(() => route.query.notificationTarget, async (value) => {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    notificationDetail.value = await apiPromotionDetail(Number(value));
    notificationOpen.value = true;
  }
}, { immediate: true });
onMounted(() => {
  void Promise.all([refreshAll(), loadGoodsOptions()]);
});
</script>

<template>
  <PageContainer>
    <div class="promotions-head">
      <div>
        <div class="eyebrow">{{ t('promotions.eyebrow') }}</div>
        <h1>{{ t('promotions.title') }}</h1>
        <p>{{ t('promotions.subtitle') }}</p>
      </div>
      <a-space>
        <a-button @click="refreshAll">
          <template #icon><ReloadOutlined /></template>{{ t('common.reset') }}
        </a-button>
        <a-button v-perm="'mch:promotions:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('promotions.create') }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="summaryLoading">
      <div class="promo-hero">
        <a-card class="promo-spotlight mtrip-card-shadow" :bordered="false">
          <div class="spotlight-icon"><TagOutlined /></div>
          <div class="spotlight-copy">
            <span>{{ t('promotions.spotlight.label') }}</span>
            <strong>{{ t('promotions.spotlight.title') }}</strong>
            <p>{{ t('promotions.spotlight.desc') }}</p>
          </div>
        </a-card>
        <a-card v-for="card in cards" :key="card.key" :bordered="false" class="mtrip-card-shadow promo-stat" :class="`tone-${card.tone}`">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-sub">{{ card.sub }}</div>
        </a-card>
      </div>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow filter-card">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('promotions.keywordPlaceholder')" style="width: 240px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('promotions.type')">
          <a-select v-model:value="query.couponType" allow-clear :placeholder="t('common.all')" style="width: 150px">
            <a-select-option :value="1">{{ t('promotions.typeMap.1') }}</a-select-option>
            <a-select-option :value="2">{{ t('promotions.typeMap.2') }}</a-select-option>
            <a-select-option :value="3">{{ t('promotions.typeMap.3') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 150px">
            <a-select-option :value="0">{{ t('promotions.status.draft') }}</a-select-option>
            <a-select-option :value="1">{{ t('promotions.status.active') }}</a-select-option>
            <a-select-option :value="2">{{ t('promotions.status.paused') }}</a-select-option>
            <a-select-option :value="3">{{ t('promotions.status.ended') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" :scroll="{ x: 1280 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'coupon_name'">
            <div class="promo-name">
              <strong>{{ record.coupon_name }}</strong>
              <span>{{ record.merchant_name || '-' }}</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'coupon_type'">
            <a-tag color="blue">{{ couponTypeText(record.coupon_type) }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'discount_value'">
            <div class="discount-text">{{ discountText(record as MerchantPromotion) }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'received_count'">
            <span>{{ record.received_count }} / {{ record.used_count }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'valid_start'">
            <span class="muted">{{ validityText(record as MerchantPromotion) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'budget_estimate'">
            <AmountText :value="record.budget_estimate" type="expense" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="statusMap" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-if="[0, 2].includes(record.status)" v-perm="'mch:promotions:edit'" type="link" size="small" @click="openEdit(record as MerchantPromotion)">
                <template #icon><EditOutlined /></template>{{ t('common.edit') }}
              </a-button>
              <a-button v-if="record.status === 0" v-perm="'mch:promotions:status'" type="link" size="small" @click="publish(record as MerchantPromotion)">
                <template #icon><RocketOutlined /></template>{{ t('promotions.publish') }}
              </a-button>
              <a-button v-if="[1, 2].includes(record.status)" v-perm="'mch:promotions:status'" type="link" size="small" @click="toggle(record as MerchantPromotion)">
                <template #icon><PauseCircleOutlined /></template>{{ record.status === 1 ? t('promotions.pause') : t('promotions.resume') }}
              </a-button>
              <a-popconfirm v-if="[0, 3].includes(record.status)" :title="t('common.deleteConfirm')" @confirm="remove(record as MerchantPromotion)">
                <a-button v-perm="'mch:promotions:delete'" type="link" size="small" danger>
                  <template #icon><DeleteOutlined /></template>{{ t('common.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="formOpen" :title="editingId > 0 ? t('promotions.editTitle') : t('promotions.addTitle')" :confirm-loading="formSaving" width="720px" @ok="submitForm">
      <a-form layout="vertical" class="promo-form">
        <a-form-item :label="t('promotions.name')" required>
          <a-input v-model:value="form.couponName" :placeholder="t('promotions.namePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('promotions.applyGoods')" required>
          <a-select
            v-model:value="form.goodsIds"
            mode="multiple"
            show-search
            :loading="goodsLoading"
            :placeholder="t('promotions.goodsPlaceholder')"
            option-filter-prop="label"
          >
            <a-select-option
              v-for="item in goodsOptions"
              :key="item.id"
              :value="item.id"
              :label="`${item.goods_name} ${item.merchant_name || ''}`"
            >
              {{ item.goods_name }}<span class="option-sub"> / {{ item.merchant_name || `#${item.merchant_id}` }}</span>
            </a-select-option>
          </a-select>
        </a-form-item>
        <div class="form-grid">
          <a-form-item :label="t('promotions.type')" required>
            <a-select v-model:value="form.couponType">
              <a-select-option :value="1">{{ t('promotions.typeMap.1') }}</a-select-option>
              <a-select-option :value="2">{{ t('promotions.typeMap.2') }}</a-select-option>
              <a-select-option :value="3">{{ t('promotions.typeMap.3') }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('promotions.discount')" required>
            <a-input-number v-model:value="form.discountValue" :min="0" :precision="2" style="width: 100%" />
          </a-form-item>
          <a-form-item :label="t('promotions.minAmount')">
            <a-input-number v-model:value="form.minAmount" :min="0" :precision="2" style="width: 100%" />
          </a-form-item>
          <a-form-item :label="t('promotions.maxDiscount')">
            <a-input-number v-model:value="form.maxDiscount" :min="0" :precision="2" style="width: 100%" />
          </a-form-item>
          <a-form-item :label="t('promotions.totalCount')">
            <a-input-number v-model:value="form.totalCount" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item :label="t('promotions.perUserLimit')">
            <a-input-number v-model:value="form.perUserLimit" :min="1" style="width: 100%" />
          </a-form-item>
        </div>
        <a-form-item :label="t('promotions.validityType')">
          <a-radio-group v-model:value="form.validType">
            <a-radio :value="1">{{ t('promotions.validType.fixed') }}</a-radio>
            <a-radio :value="2">{{ t('promotions.validType.relative') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="form.validType === 1" :label="t('promotions.validity')" required>
          <a-range-picker v-model:value="dateRange" style="width: 100%" />
        </a-form-item>
        <a-form-item v-else :label="t('promotions.validDays')" required>
          <a-input-number v-model:value="form.validDays" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="3" :placeholder="t('promotions.remarkPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:open="notificationOpen" :title="notificationDetail?.coupon_name" :footer="null">
      <p>{{ notificationDetail?.remark }}</p>
      <p>{{ notificationDetail?.valid_start }} — {{ notificationDetail?.valid_end }}</p>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.promotions-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  .eyebrow {
    margin-bottom: 4px;
    color: var(--mtrip-primary);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: var(--mtrip-text-main);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.05em;
  }

  p {
    max-width: 680px;
    margin: 5px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.promo-hero {
  display: grid;
  grid-template-columns: 1.2fr repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.promo-spotlight {
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, #38bdf8 100%);
  color: #fff;

  :deep(.ant-card-body) {
    position: relative;
    display: flex;
    min-height: 132px;
    align-items: flex-end;
    padding: 18px;
  }
}

.spotlight-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 20px;
}

.spotlight-copy {
  span {
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 8px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  p {
    max-width: 360px;
    margin: 6px 0 0;
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    line-height: 1.5;
  }
}

.promo-stat :deep(.ant-card-body) {
  padding: 16px;
}

.stat-label {
  color: var(--mtrip-text-aux);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stat-value {
  margin-top: 14px;
  color: var(--mtrip-text-main);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

.stat-sub {
  margin-top: 8px;
  color: var(--mtrip-text-secondary);
  font-size: 11px;
}

.tone-blue {
  border-top: 3px solid #2563eb;
}

.tone-green {
  border-top: 3px solid #059669;
}

.tone-orange {
  border-top: 3px solid #d97706;
}

.tone-red {
  border-top: 3px solid #dc2626;
}

.filter-card {
  margin-bottom: 16px;
}

.promo-name {
  strong {
    display: block;
    color: var(--mtrip-text-main);
    font-size: 13px;
    font-weight: 800;
  }

  span {
    color: var(--mtrip-text-aux);
    font-size: 11px;
  }
}

.discount-text {
  color: var(--mtrip-primary);
  font-weight: 800;
}

.muted,
.option-sub {
  color: var(--mtrip-text-secondary);
  font-size: 12px;
}

.promo-form {
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
  }
}

@media (max-width: 1180px) {
  .promo-hero {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .promotions-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .promo-hero,
  .promo-form .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
