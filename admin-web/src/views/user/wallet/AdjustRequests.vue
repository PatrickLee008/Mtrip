<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import { apiWalletAdjustList, apiWalletAdjustReverse, apiWalletAdjustReview } from '@/api/user';

/**
 * 钱包人工调账申请(经办 + 复核,Super Admin PRD v1.0.14 客户 360「客户钱包人工结算」)
 * 「用户列表 → 余额调整」只生成申请;这里由**另一位**有 user:wallet:approve 的管理员通过(立即记账)或驳回(须填意见);
 * 已入账的可冲正(生成反向金额的新申请,同样走复核)。status:0待复核 1已入账 2已驳回 3记账失败。
 */
const { t } = useI18n();
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const myId = computed(() => userStore.profile?.id ?? 0);

const STATUS_COLORS: Record<number, string> = { 0: 'processing', 1: 'success', 2: 'default', 3: 'error' };

const { loading, list, query, search, reset, pagination, load } = useTable(
  (params) => apiWalletAdjustList(params),
  { status: 0, userId: undefined, requestNo: '', siteId: 0 },
);

const columns = computed(() => [
  { title: t('user.walletPage.requestNo'), dataIndex: 'request_no', width: 190 },
  { title: t('user.walletPage.user'), dataIndex: 'user_id', width: 190 },
  { title: t('user.walletPage.amount'), dataIndex: 'amount', width: 130, align: 'right' as const },
  { title: t('user.walletPage.remark'), dataIndex: 'reason', ellipsis: true },
  { title: t('user.walletPage.relatedNo'), dataIndex: 'related_no', width: 170 },
  { title: t('user.walletPage.requestedBy'), dataIndex: 'requested_name', width: 110 },
  { title: t('user.walletPage.requestStatus'), dataIndex: 'status', width: 110 },
  { title: t('user.walletPage.reviewedBy'), dataIndex: 'reviewed_name', width: 110 },
  { title: t('user.walletPage.reviewRemark'), dataIndex: 'review_remark', ellipsis: true },
  { title: t('user.walletPage.time'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 200, fixed: 'right' as const },
]);

// ---------- 复核(通过 / 驳回) ----------
const reviewOpen = ref(false);
const reviewSubmitting = ref(false);
const reviewForm = reactive({ id: 0, approve: 1 as 0 | 1, remark: '', row: null as TableRow | null });

function openReview(row: TableRow, approve: 0 | 1): void {
  Object.assign(reviewForm, { id: row.id, approve, remark: '', row });
  reviewOpen.value = true;
}

async function submitReview(): Promise<void> {
  if (reviewSubmitting.value) return;
  if (reviewForm.approve === 0 && !reviewForm.remark.trim()) {
    message.warning(t('user.walletPage.remarkRequired'));
    return;
  }
  reviewSubmitting.value = true;
  try {
    const res = await apiWalletAdjustReview({ id: reviewForm.id, approve: reviewForm.approve, remark: reviewForm.remark.trim() });
    reviewOpen.value = false;
    if (res.status === 3) message.error(res.message);
    else message.success(res.message);
    void load();
  } finally {
    reviewSubmitting.value = false;
  }
}

// ---------- 冲正 ----------
const reverseOpen = ref(false);
const reverseSubmitting = ref(false);
const reverseForm = reactive({ id: 0, reason: '', row: null as TableRow | null });

function openReverse(row: TableRow): void {
  Object.assign(reverseForm, { id: row.id, reason: '', row });
  reverseOpen.value = true;
}

async function submitReverse(): Promise<void> {
  if (reverseSubmitting.value) return;
  if (!reverseForm.reason.trim()) {
    message.warning(t('common.required'));
    return;
  }
  reverseSubmitting.value = true;
  try {
    await apiWalletAdjustReverse({ id: reverseForm.id, reason: reverseForm.reason.trim() });
    reverseOpen.value = false;
    message.success(t('user.listPage.balanceAdjust.success'));
    void load();
  } finally {
    reverseSubmitting.value = false;
  }
}

defineExpose({ load });
void load();
</script>

<template>
  <div>
    <a-form layout="inline" style="margin-bottom: 16px">
      <a-form-item :label="t('user.walletPage.requestStatus')">
        <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 140px">
          <a-select-option v-for="k in [0, 1, 2, 3]" :key="k" :value="k">{{ t(`user.walletPage.requestStatuses.${k}`) }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="t('user.walletPage.userId')">
        <a-input-number v-model:value="query.userId" :min="1" :precision="0" :placeholder="t('common.pleaseInput')" style="width: 120px" @press-enter="search" />
      </a-form-item>
      <a-form-item :label="t('user.walletPage.requestNo')">
        <a-input v-model:value="query.requestNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 200px" @press-enter="search" />
      </a-form-item>
      <a-form-item v-if="isSuper" :label="t('common.site')">
        <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
          <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1650 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'request_no'">
          <div>{{ record.request_no }}</div>
          <div v-if="record.reversal_of > 0" class="sub">{{ t('user.walletPage.reversalOf') }} #{{ record.reversal_of }}</div>
        </template>
        <template v-else-if="column.dataIndex === 'user_id'">
          <div>#{{ record.user_id }} {{ record.nickname || '-' }}</div>
          <div class="sub">{{ record.mobile || '-' }}</div>
        </template>
        <template v-else-if="column.dataIndex === 'amount'">
          <span :class="Number(record.amount) >= 0 ? 'credit' : 'debit'">
            {{ Number(record.amount) >= 0 ? '+' : '' }}{{ formatAmount(record.amount) }}
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'related_no'">{{ record.related_no || '-' }}</template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag :color="STATUS_COLORS[record.status] || 'default'">{{ t(`user.walletPage.requestStatuses.${record.status}`) }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'reviewed_name'">{{ record.reviewed_name || '-' }}</template>
        <template v-else-if="column.dataIndex === 'review_remark'">{{ record.review_remark || '-' }}</template>
        <template v-else-if="column.key === 'action_col'">
          <a-space :size="0">
            <template v-if="record.status === 0">
              <a-tooltip v-if="record.requested_by === myId" :title="t('user.walletPage.selfReviewHint')">
                <a-button type="link" size="small" disabled>{{ t('user.walletPage.approve') }}</a-button>
              </a-tooltip>
              <template v-else>
                <a-button v-perm="'user:wallet:approve'" type="link" size="small" @click="openReview(record, 1)">{{ t('user.walletPage.approve') }}</a-button>
                <a-button v-perm="'user:wallet:approve'" type="link" size="small" danger @click="openReview(record, 0)">{{ t('user.walletPage.reject') }}</a-button>
              </template>
            </template>
            <a-button
              v-else-if="record.status === 1 && record.reversal_of === 0"
              v-perm="'user:list:adjust-balance'"
              type="link"
              size="small"
              @click="openReverse(record)"
            >{{ t('user.walletPage.reverse') }}</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="reviewOpen" :title="t('user.walletPage.reviewTitle')" :confirm-loading="reviewSubmitting" @ok="submitReview">
      <template v-if="reviewForm.row">
        <a-descriptions :column="1" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item :label="t('user.walletPage.requestNo')">{{ reviewForm.row.request_no }}</a-descriptions-item>
          <a-descriptions-item :label="t('user.walletPage.user')">#{{ reviewForm.row.user_id }} {{ reviewForm.row.nickname }}</a-descriptions-item>
          <a-descriptions-item :label="t('user.walletPage.amount')">{{ formatAmount(reviewForm.row.amount) }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.accountPage.balance')">{{ formatAmount(reviewForm.row.balance) }}</a-descriptions-item>
          <a-descriptions-item :label="t('user.walletPage.remark')">{{ reviewForm.row.reason }}</a-descriptions-item>
          <a-descriptions-item :label="t('user.walletPage.requestedBy')">{{ reviewForm.row.requested_name }}</a-descriptions-item>
        </a-descriptions>
      </template>
      <a-alert v-if="reviewForm.approve === 1" type="info" show-icon :message="t('user.walletPage.approveConfirm')" style="margin-bottom: 12px" />
      <a-textarea v-model:value="reviewForm.remark" :rows="3" :maxlength="255" show-count :placeholder="t('user.walletPage.reviewRemark')" />
    </a-modal>

    <a-modal v-model:open="reverseOpen" :title="t('user.walletPage.reverseTitle')" :confirm-loading="reverseSubmitting" @ok="submitReverse">
      <p v-if="reverseForm.row">
        {{ reverseForm.row.request_no }} · #{{ reverseForm.row.user_id }} · {{ formatAmount(-Number(reverseForm.row.amount)) }}
      </p>
      <a-textarea v-model:value="reverseForm.reason" :rows="3" :maxlength="150" show-count :placeholder="t('user.walletPage.reverseReason')" />
    </a-modal>
  </div>
</template>

<style scoped lang="less">
.sub {
  font-size: 12px;
  color: var(--mtrip-text-secondary, #8c8c8c);
}

.credit {
  color: #00a66f;
  font-weight: 600;
}

.debit {
  color: #e53935;
  font-weight: 600;
}
</style>
