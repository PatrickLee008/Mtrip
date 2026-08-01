<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiAppealHandle, apiAppealList } from '@/api/cops';

/** 申诉处理:队列 + 处置(通过解冻/驳回维持/升级封禁) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiAppealList, {
  status: undefined,
  siteId: 0,
});

const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待处理', color: 'warning' },
  1: { text: '通过解除', color: 'success' },
  2: { text: '驳回维持', color: 'default' },
  3: { text: '升级封禁', color: 'error' },
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '申诉说明', dataIndex: 'content', ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '处理备注', dataIndex: 'handle_remark', width: 180, ellipsis: true },
  { title: '提交时间', dataIndex: 'created_at', width: 170 },
  { title: '操作', key: 'action_col', width: 90, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const current = ref<TableRow | null>(null);
const form = reactive<{ action: number; remark: string }>({ action: 1, remark: '' });

function openHandle(row: TableRow): void {
  current.value = row;
  form.action = 1;
  form.remark = '';
  modalOpen.value = true;
}

async function submit(): Promise<void> {
  if (!current.value) return;
  submitting.value = true;
  try {
    await apiAppealHandle({ id: current.value.id, action: form.action, remark: form.remark });
    message.success('已处理');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="状态">
          <a-select v-model:value="query.status" placeholder="全部" allow-clear style="width: 140px">
            <a-select-option :value="0">待处理</a-select-option>
            <a-select-option :value="1">通过解除</a-select-option>
            <a-select-option :value="2">驳回维持</a-select-option>
            <a-select-option :value="3">升级封禁</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="申诉队列">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="STATUS[record.status]?.color">{{ STATUS[record.status]?.text ?? record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'user:appeal:handle'" type="link" size="small" :disabled="record.status !== 0" @click="openHandle(record)">处理</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" title="处理申诉" :confirm-loading="submitting" @ok="submit">
      <a-descriptions v-if="current" :column="1" size="small" bordered style="margin-bottom: 16px">
        <a-descriptions-item label="用户ID">{{ current.user_id }}</a-descriptions-item>
        <a-descriptions-item label="申诉说明">{{ current.content }}</a-descriptions-item>
      </a-descriptions>
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="处理动作" required>
          <a-radio-group v-model:value="form.action">
            <a-radio :value="1">通过解冻</a-radio>
            <a-radio :value="2">驳回维持</a-radio>
            <a-radio :value="3">升级封禁</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="处理备注">
          <a-textarea v-model:value="form.remark" :rows="3" placeholder="选填,记录处理依据" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
