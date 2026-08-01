<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiReviewAudit, apiReviewList, apiReviewReply } from '@/api/cops';

/** 评价审核:显示/隐藏 + 回复 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiReviewList, {
  goodsId: undefined,
  status: undefined,
  rating: undefined,
  siteId: 0,
});

const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待审', color: 'warning' },
  1: { text: '显示', color: 'success' },
  2: { text: '隐藏', color: 'default' },
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '酒店ID', dataIndex: 'goods_id', width: 90 },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '评分', dataIndex: 'rating', width: 80 },
  { title: '内容', dataIndex: 'content', ellipsis: true },
  { title: '回复', dataIndex: 'reply_content', width: 160, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 170, fixed: 'right' as const },
];

async function toggle(row: TableRow, status: number): Promise<void> {
  await apiReviewAudit({ id: row.id, status });
  message.success('已更新');
  void load();
}

const replyOpen = ref(false);
const submitting = ref(false);
const current = ref<TableRow | null>(null);
const form = reactive<{ content: string }>({ content: '' });

function openReply(row: TableRow): void {
  current.value = row;
  form.content = row.reply_content || '';
  replyOpen.value = true;
}

async function submitReply(): Promise<void> {
  if (!current.value) return;
  submitting.value = true;
  try {
    await apiReviewReply({ id: current.value.id, content: form.content });
    message.success('已回复');
    replyOpen.value = false;
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
        <a-form-item label="酒店ID">
          <a-input-number v-model:value="query.goodsId" placeholder="酒店ID" style="width: 120px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" placeholder="全部" allow-clear style="width: 120px">
            <a-select-option :value="0">待审</a-select-option>
            <a-select-option :value="1">显示</a-select-option>
            <a-select-option :value="2">隐藏</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="评分">
          <a-select v-model:value="query.rating" placeholder="全部" allow-clear style="width: 100px">
            <a-select-option v-for="n in 5" :key="n" :value="n">{{ n }}分</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="评价列表">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'rating'">
            <a-rate :value="record.rating" disabled style="font-size: 14px" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="STATUS[record.status]?.color">{{ STATUS[record.status]?.text ?? record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-if="record.status !== 1" v-perm="'goods:review:audit'" type="link" size="small" @click="toggle(record, 1)">显示</a-button>
              <a-button v-else v-perm="'goods:review:audit'" type="link" size="small" danger @click="toggle(record, 2)">隐藏</a-button>
              <a-button v-perm="'goods:review:reply'" type="link" size="small" @click="openReply(record)">回复</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="replyOpen" title="回复评价" :confirm-loading="submitting" @ok="submitReply">
      <a-form :label-col="{ span: 4 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="回复内容" required>
          <a-textarea v-model:value="form.content" :rows="4" placeholder="回复将展示在 C 端评价下方" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
