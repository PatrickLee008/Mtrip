<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiCampaignDelete, apiCampaignList, apiCampaignSave, apiCampaignToggle, apiCampaignWithdrawals, apiCampaignWithdrawalDecision } from '@/api/cops';

const { t } = useI18n();
const withdrawals = useTable(apiCampaignWithdrawals, { siteId: 0 });
const review = ref<TableRow | null>(null);
const reviewAction = ref('approve');
const reviewReason = ref('');
const reviewSaving = ref(false);
const withdrawalColumns = computed(() => [
  { title: t('marketing.campaignWithdrawal.campaign'), dataIndex: 'campaign_title' },
  { title: t('marketing.campaignWithdrawal.merchant'), dataIndex: 'merchant_name' },
  { title: t('marketing.campaignWithdrawal.reason'), dataIndex: 'reason' },
  { title: t('marketing.campaignWithdrawal.requestedAt'), dataIndex: 'created_at' },
  { title: t('marketing.campaignWithdrawal.status'), key: 'state' },
  { title: t('marketing.campaignWithdrawal.decision'), dataIndex: 'decision_reason' },
  { title: t('common.action'), key: 'actions' },
]);
function openReview(row: TableRow, action: string): void { review.value = row; reviewAction.value = action; reviewReason.value = ''; }
async function submitReview(): Promise<void> {
  if (!review.value || reviewSaving.value) return;
  if (!reviewReason.value.trim()) { message.warning(t('marketing.campaignWithdrawal.reasonRequired')); return; }
  reviewSaving.value = true;
  try {
    await apiCampaignWithdrawalDecision({ id: review.value.id, action: reviewAction.value, reason: reviewReason.value.trim() });
    review.value = null; await withdrawals.load(); message.success(t('common.opSuccess'));
  } finally { reviewSaving.value = false; }
}

/** 促销中心活动:内嵌落地页 + 关联可领券(PRD 模块6.1) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiCampaignList, {
  title: '',
  status: undefined,
  campaignType: undefined,
  siteId: 0,
});

const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '上架', color: 'success' },
  2: { text: '下架', color: 'warning' },
};

/** 活动类型(App 促销中心按它分页签,PRD 6.1 季节 / 每周 / 每月 / 节日特别活动) */
const CAMPAIGN_TYPES: Record<number, string> = {
  0: '常规',
  1: '季节活动',
  2: '每周活动',
  3: '每月活动',
  4: '节日/特别活动',
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '标题', dataIndex: 'title', ellipsis: true },
  { title: '副标题', dataIndex: 'subtitle', width: 200, ellipsis: true },
  { title: '类型', dataIndex: 'campaign_type', width: 120 },
  { title: '排序', dataIndex: 'sort', width: 70 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action_col', width: 180, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const couponIdsText = ref('');
const form = reactive<{ title: string; subtitle: string; campaignType: number; banner: string; landingUrl: string; startTime: string; endTime: string; sort: number; status: number }>({
  title: '',
  subtitle: '',
  campaignType: 0,
  banner: '',
  landingUrl: '',
  startTime: '',
  endTime: '',
  sort: 0,
  status: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { title: '', subtitle: '', campaignType: 0, banner: '', landingUrl: '', startTime: '', endTime: '', sort: 0, status: 0 });
  couponIdsText.value = '';
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    title: row.title,
    subtitle: row.subtitle,
    campaignType: row.campaign_type ?? 0,
    banner: row.banner,
    landingUrl: row.landing_url,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    sort: row.sort,
    status: row.status,
  });
  couponIdsText.value = Array.isArray(row.coupon_ids) ? row.coupon_ids.join(',') : '';
  modalOpen.value = true;
}
async function submit(): Promise<void> {
  const couponIds = couponIdsText.value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  submitting.value = true;
  try {
    await apiCampaignSave({ id: editingId.value || undefined, ...form, couponIds });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}
async function toggle(row: TableRow): Promise<void> {
  await apiCampaignToggle({ id: row.id, status: row.status === 1 ? 2 : 1 });
  message.success('已更新');
  void load();
}
async function remove(row: TableRow): Promise<void> {
  await apiCampaignDelete({ id: row.id });
  message.success('已删除');
  void load();
}

onMounted(() => { void load(); void withdrawals.load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="标题">
          <a-input v-model:value="query.title" placeholder="活动标题" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" placeholder="全部" allow-clear style="width: 120px">
            <a-select-option :value="0">草稿</a-select-option>
            <a-select-option :value="1">上架</a-select-option>
            <a-select-option :value="2">下架</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.campaignType" placeholder="全部" allow-clear style="width: 140px">
            <a-select-option v-for="(text, key) in CAMPAIGN_TYPES" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="促销活动">
      <template #extra>
        <a-button v-perm="'marketing:campaign:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增活动</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'campaign_type'">{{ CAMPAIGN_TYPES[record.campaign_type] ?? '常规' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="STATUS[record.status]?.color">{{ STATUS[record.status]?.text ?? record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'marketing:campaign:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-perm="'marketing:campaign:save'" type="link" size="small" @click="toggle(record)">{{ record.status === 1 ? '下架' : '上架' }}</a-button>
              <a-popconfirm title="确认删除该活动?" @confirm="remove(record)">
                <a-button v-perm="'marketing:campaign:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card :title="t('marketing.campaignWithdrawal.title')" style="margin-top:16px">
      <template #extra><a-button @click="withdrawals.load">{{ t('common.refresh') }}</a-button></template>
      <a-table :columns="withdrawalColumns" :data-source="withdrawals.list.value" :loading="withdrawals.loading.value" :pagination="withdrawals.pagination.value" row-key="id" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'state'">{{ t(`marketing.campaignWithdrawal.state${record.status}`) }}</template>
          <template v-else-if="column.key === 'actions' && record.status === 0">
            <a-button v-perm="'marketing:campaign:withdrawal-review'" type="link" @click="openReview(record, 'approve')">{{ t('marketing.campaignWithdrawal.approve') }}</a-button>
            <a-button v-perm="'marketing:campaign:withdrawal-review'" type="link" danger @click="openReview(record, 'reject')">{{ t('marketing.campaignWithdrawal.reject') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal :open="review !== null" :title="t(`marketing.campaignWithdrawal.${reviewAction}`)" :confirm-loading="reviewSaving" @cancel="review = null" @ok="submitReview">
      <p>{{ t('marketing.campaignWithdrawal.impact') }}</p>
      <a-textarea v-model:value="reviewReason" :rows="3" :maxlength="500" :placeholder="t('marketing.campaignWithdrawal.reasonRequired')" :disabled="reviewSaving" />
    </a-modal>
    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑活动' : '新增活动'" width="640px" :confirm-loading="submitting" @ok="submit">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="标题" required><a-input v-model:value="form.title" /></a-form-item>
        <a-form-item label="副标题"><a-input v-model:value="form.subtitle" /></a-form-item>
        <a-form-item label="活动类型">
          <a-select v-model:value="form.campaignType" style="width: 200px">
            <a-select-option v-for="(text, key) in CAMPAIGN_TYPES" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="头图URL"><a-input v-model:value="form.banner" /></a-form-item>
        <a-form-item label="落地页URL"><a-input v-model:value="form.landingUrl" placeholder="内嵌 Web 促销落地页" /></a-form-item>
        <a-form-item label="关联券ID"><a-input v-model:value="couponIdsText" placeholder="优惠券模板ID,逗号分隔" /></a-form-item>
        <a-form-item label="展示开始"><a-input v-model:value="form.startTime" placeholder="YYYY-MM-DD HH:mm:ss,留空即刻" /></a-form-item>
        <a-form-item label="展示结束"><a-input v-model:value="form.endTime" placeholder="YYYY-MM-DD HH:mm:ss,留空长期" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="form.sort" :min="0" style="width: 120px" /></a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="0">草稿</a-radio>
            <a-radio :value="1">上架</a-radio>
            <a-radio :value="2">下架</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
