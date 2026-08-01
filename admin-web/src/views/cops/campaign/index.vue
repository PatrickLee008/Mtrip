<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiCampaignDelete, apiCampaignList, apiCampaignSave, apiCampaignToggle } from '@/api/cops';

/** 促销中心活动:内嵌落地页 + 关联可领券(PRD 模块6.1) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiCampaignList, {
  title: '',
  status: undefined,
  siteId: 0,
});

const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '上架', color: 'success' },
  2: { text: '下架', color: 'warning' },
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '标题', dataIndex: 'title', ellipsis: true },
  { title: '副标题', dataIndex: 'subtitle', width: 200, ellipsis: true },
  { title: '排序', dataIndex: 'sort', width: 70 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action_col', width: 180, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const couponIdsText = ref('');
const form = reactive<{ title: string; subtitle: string; banner: string; landingUrl: string; startTime: string; endTime: string; sort: number; status: number }>({
  title: '',
  subtitle: '',
  banner: '',
  landingUrl: '',
  startTime: '',
  endTime: '',
  sort: 0,
  status: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { title: '', subtitle: '', banner: '', landingUrl: '', startTime: '', endTime: '', sort: 0, status: 0 });
  couponIdsText.value = '';
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    title: row.title,
    subtitle: row.subtitle,
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

onMounted(() => void load());
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
          <template v-if="column.dataIndex === 'status'">
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

    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑活动' : '新增活动'" width="640px" :confirm-loading="submitting" @ok="submit">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="标题" required><a-input v-model:value="form.title" /></a-form-item>
        <a-form-item label="副标题"><a-input v-model:value="form.subtitle" /></a-form-item>
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
