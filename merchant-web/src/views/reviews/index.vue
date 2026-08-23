<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { FlagOutlined, MessageOutlined, ReloadOutlined, SearchOutlined, StarFilled } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import {
  apiReviewFlag,
  apiReviewList,
  apiReviewReply,
  apiReviewSummary,
  type MerchantReview,
  type ReviewSummary,
} from '@/api/reviews';

const { t } = useI18n();

const summary = ref<ReviewSummary>({ total: 0, avgRating: 0, replied: 0, flagged: 0, pending: 0, published: 0, hidden: 0 });
const summaryLoading = ref(false);
const { loading, list, query, load, search, reset, pagination } = useTable<MerchantReview>(apiReviewList, {
  keyword: '',
  status: undefined,
  rating: undefined,
  replied: undefined,
  flagged: undefined,
});

const statusMap = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('reviews.status.pending'), color: 'warning' },
  1: { text: t('reviews.status.published'), color: 'success' },
  2: { text: t('reviews.status.hidden'), color: 'default' },
}));

const columns = computed(() => [
  { title: t('reviews.review'), dataIndex: 'content', width: 360 },
  { title: t('reviews.rating'), dataIndex: 'rating', width: 120 },
  { title: t('reviews.property'), dataIndex: 'goods_name', width: 220 },
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 170 },
  { title: t('common.status'), dataIndex: 'status', width: 120 },
  { title: t('reviews.reply'), dataIndex: 'reply_content', width: 220 },
  { title: t('common.operation'), key: 'action', width: 180, fixed: 'right' as const },
]);

const cards = computed(() => [
  { key: 'avg', label: t('reviews.cards.avgRating'), value: summary.value.avgRating.toFixed(1), icon: 'star', tone: 'orange' },
  { key: 'total', label: t('reviews.cards.total'), value: summary.value.total, icon: 'total', tone: 'blue' },
  { key: 'replied', label: t('reviews.cards.replied'), value: summary.value.replied, icon: 'reply', tone: 'green' },
  { key: 'flagged', label: t('reviews.cards.flagged'), value: summary.value.flagged, icon: 'flag', tone: 'red' },
]);

const replyOpen = ref(false);
const replySaving = ref(false);
const replyTarget = ref<MerchantReview | null>(null);
const replyForm = reactive({ content: '' });

const flagOpen = ref(false);
const flagSaving = ref(false);
const flagTarget = ref<MerchantReview | null>(null);
const flagForm = reactive({ reason: '' });

async function loadSummary(): Promise<void> {
  summaryLoading.value = true;
  try {
    summary.value = await apiReviewSummary();
  } finally {
    summaryLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadSummary(), load()]);
}

function openReply(row: MerchantReview): void {
  replyTarget.value = row;
  replyForm.content = row.reply_content || '';
  replyOpen.value = true;
}

async function submitReply(): Promise<void> {
  if (!replyForm.content.trim()) {
    message.warning(t('reviews.replyRequired'));
    return;
  }
  replySaving.value = true;
  try {
    await apiReviewReply({ id: replyTarget.value!.id, content: replyForm.content.trim() });
    message.success(t('common.opSuccess'));
    replyOpen.value = false;
    await refreshAll();
  } finally {
    replySaving.value = false;
  }
}

function openFlag(row: MerchantReview): void {
  flagTarget.value = row;
  flagForm.reason = row.merchant_flag_reason || '';
  flagOpen.value = true;
}

async function submitFlag(): Promise<void> {
  if (!flagForm.reason.trim()) {
    message.warning(t('reviews.flagRequired'));
    return;
  }
  flagSaving.value = true;
  try {
    await apiReviewFlag({ id: flagTarget.value!.id, reason: flagForm.reason.trim() });
    message.success(t('common.opSuccess'));
    flagOpen.value = false;
    await refreshAll();
  } finally {
    flagSaving.value = false;
  }
}

function reviewerName(row: MerchantReview): string {
  return row.nickname || `#${row.user_id}`;
}

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <PageContainer>
    <div class="page-head">
      <div>
        <h1>{{ t('reviews.title') }}</h1>
        <p>{{ t('reviews.subtitle') }}</p>
      </div>
      <a-button @click="refreshAll">
        <template #icon><ReloadOutlined /></template>{{ t('common.reset') }}
      </a-button>
    </div>

    <a-spin :spinning="summaryLoading">
      <div class="review-grid">
        <a-card v-for="card in cards" :key="card.key" :bordered="false" class="mtrip-card-shadow review-card" :class="`tone-${card.tone}`">
          <div class="review-icon">
            <StarFilled v-if="card.icon === 'star'" />
            <MessageOutlined v-else-if="card.icon === 'reply'" />
            <FlagOutlined v-else-if="card.icon === 'flag'" />
            <span v-else>#</span>
          </div>
          <div class="review-label">{{ card.label }}</div>
          <div class="review-value">{{ card.value }}</div>
        </a-card>
      </div>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow filter-card">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('reviews.keywordPlaceholder')" style="width: 240px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 140px">
            <a-select-option :value="0">{{ t('reviews.status.pending') }}</a-select-option>
            <a-select-option :value="1">{{ t('reviews.status.published') }}</a-select-option>
            <a-select-option :value="2">{{ t('reviews.status.hidden') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('reviews.rating')">
          <a-select v-model:value="query.rating" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option v-for="rate in [5, 4, 3, 2, 1]" :key="rate" :value="rate">{{ rate }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('reviews.replyStatus')">
          <a-select v-model:value="query.replied" allow-clear :placeholder="t('common.all')" style="width: 140px">
            <a-select-option :value="1">{{ t('reviews.replied') }}</a-select-option>
            <a-select-option :value="0">{{ t('reviews.notReplied') }}</a-select-option>
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" :scroll="{ x: 1250 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'content'">
            <div class="review-content">
              <div class="reviewer">{{ reviewerName(record) }}</div>
              <p>{{ record.content || '-' }}</p>
              <a-tag v-if="record.is_flagged" color="red">{{ t('reviews.flagged') }}</a-tag>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'rating'">
            <a-rate :value="record.rating" disabled allow-half />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="statusMap" />
          </template>
          <template v-else-if="column.dataIndex === 'reply_content'">
            <span class="reply-text">{{ record.reply_content || t('reviews.notReplied') }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button v-perm="'mch:reviews:reply'" type="link" size="small" @click="openReply(record)">
                {{ record.reply_content ? t('reviews.editReply') : t('reviews.reply') }}
              </a-button>
              <a-button v-if="!record.is_flagged" v-perm="'mch:reviews:flag'" type="link" size="small" danger @click="openFlag(record)">
                {{ t('reviews.flag') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="replyOpen" :title="t('reviews.replyTitle')" :confirm-loading="replySaving" width="560px" @ok="submitReply">
      <a-form layout="vertical">
        <a-form-item :label="t('reviews.replyContent')" required>
          <a-textarea v-model:value="replyForm.content" :rows="5" :placeholder="t('reviews.replyPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="flagOpen" :title="t('reviews.flagTitle')" :confirm-loading="flagSaving" width="560px" @ok="submitFlag">
      <a-alert type="warning" show-icon :message="t('reviews.flagTip')" style="margin-bottom: 12px" />
      <a-form layout="vertical">
        <a-form-item :label="t('reviews.flagReason')" required>
          <a-textarea v-model:value="flagForm.reason" :rows="4" :placeholder="t('reviews.flagPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  h1 {
    margin: 0;
    color: var(--mtrip-text-main);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  p {
    margin: 4px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.review-card :deep(.ant-card-body) {
  position: relative;
  padding: 16px;
}

.review-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eff6ff;
  color: var(--mtrip-primary);
  font-size: 13px;
  font-weight: 800;
}

.review-label {
  color: var(--mtrip-text-aux);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.review-value {
  margin-top: 10px;
  color: var(--mtrip-text-main);
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.tone-orange .review-icon {
  background: #fffbeb;
  color: #d97706;
}

.tone-green .review-icon {
  background: #ecfdf3;
  color: #059669;
}

.tone-red .review-icon {
  background: #fff1f2;
  color: #dc2626;
}

.filter-card {
  margin-bottom: 16px;
}

.review-content {
  .reviewer {
    color: var(--mtrip-text-main);
    font-size: 12px;
    font-weight: 700;
  }

  p {
    max-width: 460px;
    margin: 4px 0 6px;
    color: var(--mtrip-text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
}

.reply-text {
  display: inline-block;
  max-width: 260px;
  overflow: hidden;
  color: var(--mtrip-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
