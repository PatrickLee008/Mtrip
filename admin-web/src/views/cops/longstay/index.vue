<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiLongstayDelete, apiLongstayList, apiLongstayProposals, apiLongstayReview, apiLongstaySave } from '@/api/cops';

/** 长住折扣梯度:按住宿夜数配置折扣率(PRD 模块2.1) */
const { t } = useI18n();
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiLongstayList, { siteId: 0 });

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '站点', dataIndex: 'site_id', width: 90 },
  { title: '酒店', dataIndex: 'property_id', width: 105 },
  { title: '最低夜数', dataIndex: 'min_nights', width: 120 },
  { title: '折扣率(%)', dataIndex: 'discount_rate', width: 120 },
  { title: '优先级', dataIndex: 'priority', width: 95 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const form = reactive({ siteId: 0, propertyId: 0, maxNights: 30, offerSource: 'platform', platformFundingPct: 0, minNights: 7, discountRate: null as number | null, status: 2,
  priority: 0, startsAt: '', endsAt: '' });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { siteId: query.siteId, propertyId: 0, minNights: 7, maxNights: 30, offerSource: 'platform', platformFundingPct: 0, discountRate: null, status: 2,
    priority: 0, startsAt: '', endsAt: '' });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, { siteId: Number(row.site_id), propertyId: Number(row.property_id), minNights: row.min_nights, maxNights: row.max_nights, offerSource: row.offer_source, platformFundingPct: Number(row.platform_funding_pct),
    discountRate: Number(row.discount_rate), status: row.status, priority: Number(row.priority),
    startsAt: row.starts_at ?? '', endsAt: row.ends_at ?? '' });
  modalOpen.value = true;
}

async function submit(): Promise<void> {
  if (form.discountRate === null || (isSuper && !editingId.value && !form.siteId)) {
    message.warning('请选择站点并填写折扣率');
    return;
  }
  submitting.value = true;
  try {
    await apiLongstaySave({ ...form, id: editingId.value || undefined });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiLongstayDelete({ id: row.id });
  message.success('已删除');
  void load();
}

const queue = useTable(apiLongstayProposals, { siteId: 0 });
const { list: requests, pagination: requestPager } = queue;
const reason = ref('');
const reviewing = ref<TableRow | null>(null);
const reviewAction = ref('');
const savingReview = ref(false);
function openDecision(row: TableRow, action: string) {
  reviewing.value = row;
  reviewAction.value = action;
  reason.value = '';
}
async function decide() {
  if (!reviewing.value || savingReview.value) return;
  savingReview.value = true;
  try {
    await apiLongstayReview({ id: reviewing.value.id, action: reviewAction.value, reason: reason.value });
    reviewing.value = null;
    await Promise.all([queue.load(), load()]);
  } finally { savingReview.value = false; }
}
onMounted(() => {
  void load();
  if (userStore.hasPerm('marketing:longstay:save')) void queue.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="长住梯度">
      <template #extra>
        <a-button v-perm="'marketing:longstay:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增梯度</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'property_id'">{{ record.property_id || '全站酒店' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '禁用' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'marketing:longstay:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除该梯度?" @confirm="remove(record)">
                <a-button v-perm="'marketing:longstay:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card v-perm="'marketing:longstay:save'" :title="t('stayProposal.title')">
      <a-table :data-source="requests" :pagination="requestPager" row-key="id" size="middle">
        <a-table-column title="ID" data-index="id" />
        <a-table-column :title="t('stayProposal.hotel')" data-index="property_id" />
        <a-table-column :title="t('stayProposal.merchant')" data-index="merchant_id" />
        <a-table-column :title="t('stayProposal.terms')"><template #default="{ record }">{{ record.min_nights }}–{{ record.max_nights }} {{ t('stayProposal.nights') }} · {{ record.discount_rate }}% · {{ record.details }}</template></a-table-column>
        <a-table-column :title="t('stayProposal.schedule')"><template #default="{ record }">{{ record.starts_at || '—' }} / {{ record.ends_at || '—' }}</template></a-table-column>
        <a-table-column :title="t('stayProposal.submittedOn')" data-index="created_at" />
        <a-table-column :title="t('stayProposal.status')" data-index="state"><template #default="{ record }">{{ t('stayProposal.' + record.state) }}</template></a-table-column>
        <a-table-column :title="t('stayProposal.decision')" data-index="reason" />
        <a-table-column :title="t('stayProposal.review')"><template #default="{ record }"><a-space>
          <a-button v-if="record.state === 'submitted'" v-perm="'marketing:longstay:save'" @click="openDecision(record, 'reviewing')">{{ t('stayProposal.review') }}</a-button>
          <template v-if="record.state === 'reviewing'"><a-button v-for="action in ['approved','returned','rejected']" :key="action" v-perm="'marketing:longstay:save'" @click="openDecision(record, action)">{{ t('stayProposal.' + action) }}</a-button></template>
        </a-space></template></a-table-column>
      </a-table>
    </a-card>
    <a-modal :open="!!reviewing" :title="reviewAction ? t('stayProposal.' + reviewAction) : ''" :confirm-loading="savingReview" @ok="decide" @cancel="reviewing = null">
      <a-textarea v-model:value="reason" :placeholder="t('stayProposal.reason')" :maxlength="500" />
    </a-modal>
    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑梯度' : '新增梯度'" :confirm-loading="submitting" @ok="submit">
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 15 }">
        <a-form-item v-if="isSuper && !editingId" label="站点" required>
          <SiteTreeSelect v-model:value="form.siteId" />
        </a-form-item>
        <a-form-item label="酒店 ID">
          <a-input-number v-model:value="form.propertyId" :min="0" :precision="0" style="width: 100%" />

        </a-form-item>
        <a-form-item label="最低夜数" required>
          <a-input-number v-model:value="form.minNights" :min="1" :precision="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="折扣率(%)" required>
          <a-input-number v-model:value="form.discountRate" :min="0.01" :max="99.99" :precision="2" style="width: 100%" />
          <div class="tip">立减百分比,如 30 表示满足夜数后减 30%</div>
        </a-form-item>
        <a-form-item label="优先级">
          <a-input-number v-model:value="form.priority" :precision="0" style="width: 100%" />
          <div class="tip">数值高的优先，同优先级取满足的最高夜数档</div>
        </a-form-item>
        <a-form-item label="开始时间 UTC">
          <a-date-picker v-model:value="form.startsAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item label="结束时间 UTC">
          <a-date-picker v-model:value="form.endsAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('stayProposal.max')" required><a-input-number v-model:value="form.maxNights" :min="form.minNights" :precision="0" /></a-form-item>
        <a-form-item :label="t('stayProposal.source')"><a-radio-group v-model:value="form.offerSource"><a-radio value="platform">{{ t('stayProposal.platform') }}</a-radio><a-radio value="merchant">{{ t('stayProposal.merchant') }}</a-radio></a-radio-group></a-form-item>
        <a-form-item :label="t('stayProposal.share')"><a-input-number v-model:value="form.platformFundingPct" :min="0" :max="100" :precision="2" /><div class="tip">{{ t('stayProposal.remainder') }}</div></a-form-item>
        <a-form-item :label="t('stayProposal.status')">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="2">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.tip {
  font-size: 12px;
  color: var(--mtrip-text-aux);
  margin-top: 4px;
}
</style>
