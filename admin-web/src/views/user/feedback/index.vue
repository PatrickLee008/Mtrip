<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiFeedbackHandle, apiFeedbackList } from '@/api/user';

/**
 * 用户反馈与投诉(文档 6.4.5)
 * 状态机:0待处理 → 1处理中 → 2已处理;0/1 → 3已关闭(终态)
 * 流转规则:{0:[1,2,3], 1:[2,3]};标记已处理必填回复内容
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const FEEDBACK_TYPE_TEXT: Record<number, string> = {
  1: '功能建议',
  2: '订单投诉',
  3: '商户投诉',
  4: '其他',
};

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待处理', color: 'warning' },
  1: { text: '处理中', color: 'processing' },
  2: { text: '已处理', color: 'success' },
  3: { text: '已关闭', color: 'default' },
};

/** 状态流转规则:当前状态 → 可流转目标 */
const STATUS_FLOW: Record<number, number[]> = { 0: [1, 2, 3], 1: [2, 3] };

// 提交日期区间
const createdRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiFeedbackList({
    ...params,
    startDate: createdRange.value?.[0],
    endDate: createdRange.value?.[1],
  }),
  { userId: undefined, feedbackType: undefined, status: undefined, siteId: 0 },
);

function doReset(): void {
  createdRange.value = [];
  reset();
}

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '类型', dataIndex: 'feedback_type', width: 100 },
  { title: '内容', dataIndex: 'content', ellipsis: true },
  { title: '关联订单', dataIndex: 'order_id', width: 100 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '提交时间', dataIndex: 'created_at', width: 165 },
  { title: '处理时间', dataIndex: 'handled_at', width: 165 },
  { title: '操作', key: 'action_col', width: 130, fixed: 'right' as const },
];

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detail = ref<TableRow | null>(null);

function openDetail(row: TableRow): void {
  detail.value = row;
  drawerOpen.value = true;
}

// ---------- 处理 Modal ----------
const handleOpen = ref(false);
const handleSubmitting = ref(false);
const handleForm = reactive({ id: 0, currentStatus: 0, targetStatus: 1, replyContent: '' });

const targetOptions = computed(() =>
  (STATUS_FLOW[handleForm.currentStatus] ?? []).map((s) => ({ value: s, label: STATUS_MAP[s].text })),
);

function openHandle(row: TableRow): void {
  handleForm.id = row.id;
  handleForm.currentStatus = row.status;
  handleForm.targetStatus = STATUS_FLOW[row.status]?.[0] ?? 2;
  handleForm.replyContent = row.reply_content || '';
  handleOpen.value = true;
}

async function submitHandle(): Promise<void> {
  if (handleForm.targetStatus === 2 && !handleForm.replyContent.trim()) {
    message.warning('标记已处理必须填写回复内容');
    return;
  }
  handleSubmitting.value = true;
  try {
    await apiFeedbackHandle({
      id: handleForm.id,
      targetStatus: handleForm.targetStatus,
      replyContent: handleForm.replyContent.trim() || undefined,
    });
    message.success('处理成功');
    handleOpen.value = false;
    void load();
  } finally {
    handleSubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="用户ID">
          <a-input-number v-model:value="query.userId" :min="1" placeholder="精确匹配" style="width: 120px" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.feedbackType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option v-for="(text, key) in FEEDBACK_TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="提交日期">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="反馈投诉">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'feedback_type'">
            {{ FEEDBACK_TYPE_TEXT[record.feedback_type] ?? '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'order_id'">{{ record.order_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'handled_at'">{{ record.handled_at || '-' }}</template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.status === 0 || record.status === 1"
                v-perm="'user:feedback:handle'"
                type="link"
                size="small"
                @click="openHandle(record)"
              >处理</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="反馈详情" width="600">
      <template v-if="detail">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="ID">{{ detail.id }}</a-descriptions-item>
          <a-descriptions-item label="用户ID">{{ detail.user_id }}</a-descriptions-item>
          <a-descriptions-item label="类型">{{ FEEDBACK_TYPE_TEXT[detail.feedback_type] ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="状态"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
          <a-descriptions-item label="关联订单">{{ detail.order_id || '-' }}</a-descriptions-item>
          <a-descriptions-item label="提交时间">{{ detail.created_at }}</a-descriptions-item>
          <a-descriptions-item label="反馈内容" :span="2">{{ detail.content }}</a-descriptions-item>
        </a-descriptions>
        <template v-if="Array.isArray(detail.images) && detail.images.length > 0">
          <a-divider orientation="left">附件图片</a-divider>
          <a-image-preview-group>
            <a-space wrap>
              <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="96" />
            </a-space>
          </a-image-preview-group>
        </template>
        <template v-if="detail.reply_content">
          <a-divider orientation="left">处理回复</a-divider>
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item label="回复内容">{{ detail.reply_content }}</a-descriptions-item>
            <a-descriptions-item label="处理人ID">{{ detail.handler_id || '-' }}</a-descriptions-item>
            <a-descriptions-item label="处理时间">{{ detail.handled_at || '-' }}</a-descriptions-item>
          </a-descriptions>
        </template>
      </template>
    </a-drawer>

    <!-- 处理 Modal -->
    <a-modal v-model:open="handleOpen" title="处理反馈" :confirm-loading="handleSubmitting" @ok="submitHandle">
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="当前状态">
          <StatusTag :value="handleForm.currentStatus" :map="STATUS_MAP" />
        </a-form-item>
        <a-form-item label="流转至" required>
          <a-radio-group v-model:value="handleForm.targetStatus">
            <a-radio v-for="opt in targetOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="回复内容" :required="handleForm.targetStatus === 2">
          <a-textarea
            v-model:value="handleForm.replyContent"
            :rows="4"
            :maxlength="1000"
            placeholder="标记已处理时必填,将展示给用户"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
