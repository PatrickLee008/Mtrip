<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiReviewAudit, apiReviewList, apiReviewReply } from '@/api/cops';

/** 评价审核:显示/隐藏 + 回复;详情里能看分项评分、出行类型和住客上传的图片 / 视频 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiReviewList, {
  propertyId: undefined,
  status: undefined,
  rating: undefined,
  siteId: 0,
});

const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待审', color: 'warning' },
  1: { text: '显示', color: 'success' },
  2: { text: '隐藏', color: 'default' },
};

const TRAVELER: Record<string, string> = {
  solo: '独自出行',
  couple: '情侣',
  family: '家庭',
  friends: '朋友',
  business: '商务',
};

const SUB_RATINGS = [
  { key: 'rating_cleanliness', label: '清洁度' },
  { key: 'rating_location', label: '位置' },
  { key: 'rating_service', label: '服务' },
  { key: 'rating_amenities', label: '设施' },
];

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '订单ID', dataIndex: 'order_id', width: 90 },
  { title: '物业ID', dataIndex: 'property_id', width: 90 },
  { title: '物业名称', dataIndex: 'property_name', width: 180 },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '总体评分', dataIndex: 'rating', width: 130 },
  { title: '出行类型', dataIndex: 'traveler_type', width: 100 },
  { title: '内容', dataIndex: 'content', ellipsis: true },
  { title: '图片 / 视频', key: 'media_col', width: 110 },
  { title: '回复', dataIndex: 'reply_content', width: 160, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 220, fixed: 'right' as const },
];

function mediaCount(row: TableRow, key: 'images' | 'videos'): number {
  return Array.isArray(row[key]) ? row[key].length : 0;
}

const detailOpen = ref(false);
const detail = ref<TableRow | null>(null);

function openDetail(row: TableRow): void {
  detail.value = row;
  detailOpen.value = true;
}

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
        <a-form-item label="物业ID">
          <a-input-number v-model:value="query.propertyId" placeholder="物业ID" style="width: 120px" />
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1500 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'rating'">
            <a-rate :value="record.rating" disabled style="font-size: 14px" />
          </template>
          <template v-else-if="column.dataIndex === 'traveler_type'">{{ TRAVELER[record.traveler_type] || '-' }}</template>
          <template v-else-if="column.key === 'media_col'">
            {{ mediaCount(record, 'images') }} 图 / {{ mediaCount(record, 'videos') }} 视频
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="STATUS[record.status]?.color">{{ STATUS[record.status]?.text ?? record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button v-if="record.status !== 1" v-perm="'goods:review:audit'" type="link" size="small" @click="toggle(record, 1)">显示</a-button>
              <a-button v-else v-perm="'goods:review:audit'" type="link" size="small" danger @click="toggle(record, 2)">隐藏</a-button>
              <a-button v-perm="'goods:review:reply'" type="link" size="small" @click="openReply(record)">回复</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="detailOpen" title="评价详情" width="720px" :footer="null">
      <template v-if="detail">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="物业">{{ detail.property_name }}(#{{ detail.property_id }})</a-descriptions-item>
          <a-descriptions-item label="订单 / 用户">#{{ detail.order_id }} / #{{ detail.user_id }}</a-descriptions-item>
          <a-descriptions-item label="总体评分">
            <a-rate :value="detail.rating" disabled style="font-size: 14px" />
          </a-descriptions-item>
          <a-descriptions-item label="出行类型">{{ TRAVELER[detail.traveler_type] || '-' }}</a-descriptions-item>
          <a-descriptions-item v-for="item in SUB_RATINGS" :key="item.key" :label="item.label">
            <template v-if="detail[item.key] > 0">
              <a-rate :value="detail[item.key]" disabled style="font-size: 14px" />
            </template>
            <span v-else class="muted">未评</span>
          </a-descriptions-item>
          <a-descriptions-item label="内容" :span="2">
            <span style="white-space: pre-wrap">{{ detail.content || '(无文字)' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="提交时间" :span="2">{{ detail.created_at }}</a-descriptions-item>
        </a-descriptions>

        <div class="media-title">图片({{ mediaCount(detail, 'images') }})</div>
        <a-image-preview-group v-if="mediaCount(detail, 'images') > 0">
          <div class="media-grid">
            <a-image v-for="url in detail.images" :key="url" :src="url" :width="88" :height="88" class="media-img" />
          </div>
        </a-image-preview-group>
        <div v-else class="muted">无</div>

        <div class="media-title">视频({{ mediaCount(detail, 'videos') }})</div>
        <div v-if="mediaCount(detail, 'videos') > 0" class="video-grid">
          <video v-for="url in detail.videos" :key="url" :src="url" controls preload="metadata" class="video-item"></video>
        </div>
        <div v-else class="muted">无</div>
      </template>
    </a-modal>

    <a-modal v-model:open="replyOpen" title="回复评价" :confirm-loading="submitting" @ok="submitReply">
      <a-form :label-col="{ span: 4 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="回复内容" required>
          <a-textarea v-model:value="form.content" :rows="4" placeholder="回复将展示在 C 端评价下方" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped>
.muted {
  color: #94a3b8;
}

.media-title {
  margin: 16px 0 8px;
  font-weight: 600;
}

.media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.media-img {
  object-fit: cover;
  border-radius: 6px;
}

.video-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.video-item {
  width: 220px;
  height: 130px;
  border-radius: 6px;
  background: #000;
}
</style>
