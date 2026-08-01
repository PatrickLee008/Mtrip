<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import type { TableRow } from '@/composables/useTable';
import PageContainer from '@/components/PageContainer.vue';
import { apiFilterDelete, apiFilterList, apiFilterSave, apiSortDelete, apiSortList, apiSortSave } from '@/api/cops';

/** 筛选/排序项配置(PRD 模块3):键受后端白名单约束,C 端 /app/goods/filters 读取渲染 */
const activeTab = ref('filter');

const FILTER_KEYS = [
  { value: 'price', label: '价格区间' },
  { value: 'star', label: '星级' },
  { value: 'amenity', label: '设施' },
  { value: 'breakfast', label: '含早餐' },
  { value: 'free_cancel', label: '免费取消' },
  { value: 'review_score', label: '评分' },
];
const SORT_KEYS = [
  { value: 'default', label: '综合推荐' },
  { value: 'price_asc', label: '低价优先' },
  { value: 'price_desc', label: '高价优先' },
  { value: 'star', label: '星级高到低' },
  { value: 'rating', label: '好评优先' },
  { value: 'distance', label: '距离最近' },
  { value: 'sales', label: '销量优先' },
];
const FILTER_TYPE: Record<number, string> = { 1: '范围', 2: '多选', 3: '布尔' };

// ---------- 筛选项 ----------
const filterLoading = ref(false);
const filters = ref<TableRow[]>([]);
async function loadFilters(): Promise<void> {
  filterLoading.value = true;
  try {
    filters.value = await apiFilterList({});
  } finally {
    filterLoading.value = false;
  }
}

const filterColumns = [
  { title: '筛选键', dataIndex: 'filter_key', width: 130 },
  { title: '名称', dataIndex: 'filter_name', width: 140 },
  { title: '英文名', dataIndex: 'filter_name_en', width: 140 },
  { title: '类型', dataIndex: 'filter_type', width: 90 },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const fModalOpen = ref(false);
const fSubmitting = ref(false);
const fEditingId = ref(0);
const optionsText = ref('');
const fForm = reactive<{ filterKey: string; filterName: string; filterNameEn: string; filterType: number; sort: number; status: number }>({
  filterKey: 'amenity',
  filterName: '',
  filterNameEn: '',
  filterType: 2,
  sort: 0,
  status: 1,
});

function openFilterCreate(): void {
  fEditingId.value = 0;
  Object.assign(fForm, { filterKey: 'amenity', filterName: '', filterNameEn: '', filterType: 2, sort: 0, status: 1 });
  optionsText.value = '';
  fModalOpen.value = true;
}
function openFilterEdit(row: TableRow): void {
  fEditingId.value = row.id;
  Object.assign(fForm, {
    filterKey: row.filter_key,
    filterName: row.filter_name,
    filterNameEn: row.filter_name_en,
    filterType: row.filter_type,
    sort: row.sort,
    status: row.status,
  });
  optionsText.value = row.options && row.options.length ? JSON.stringify(row.options, null, 2) : '';
  fModalOpen.value = true;
}
async function submitFilter(): Promise<void> {
  let options: unknown = undefined;
  if (fForm.filterType === 2 && optionsText.value.trim()) {
    try {
      options = JSON.parse(optionsText.value);
    } catch {
      message.error('可选项必须是合法 JSON');
      return;
    }
  }
  fSubmitting.value = true;
  try {
    await apiFilterSave({ id: fEditingId.value || undefined, ...fForm, options });
    message.success('已保存');
    fModalOpen.value = false;
    void loadFilters();
  } finally {
    fSubmitting.value = false;
  }
}
async function removeFilter(row: TableRow): Promise<void> {
  await apiFilterDelete({ id: row.id });
  message.success('已删除');
  void loadFilters();
}

// ---------- 排序项 ----------
const sortLoading = ref(false);
const sorts = ref<TableRow[]>([]);
async function loadSorts(): Promise<void> {
  sortLoading.value = true;
  try {
    sorts.value = await apiSortList({});
  } finally {
    sortLoading.value = false;
  }
}

const sortColumns = [
  { title: '排序键', dataIndex: 'sort_key', width: 130 },
  { title: '名称', dataIndex: 'sort_name', width: 140 },
  { title: '英文名', dataIndex: 'sort_name_en', width: 140 },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const sModalOpen = ref(false);
const sSubmitting = ref(false);
const sEditingId = ref(0);
const sForm = reactive<{ sortKey: string; sortName: string; sortNameEn: string; sort: number; status: number }>({
  sortKey: 'default',
  sortName: '',
  sortNameEn: '',
  sort: 0,
  status: 1,
});

function openSortCreate(): void {
  sEditingId.value = 0;
  Object.assign(sForm, { sortKey: 'default', sortName: '', sortNameEn: '', sort: 0, status: 1 });
  sModalOpen.value = true;
}
function openSortEdit(row: TableRow): void {
  sEditingId.value = row.id;
  Object.assign(sForm, {
    sortKey: row.sort_key,
    sortName: row.sort_name,
    sortNameEn: row.sort_name_en,
    sort: row.sort,
    status: row.status,
  });
  sModalOpen.value = true;
}
async function submitSort(): Promise<void> {
  sSubmitting.value = true;
  try {
    await apiSortSave({ id: sEditingId.value || undefined, ...sForm });
    message.success('已保存');
    sModalOpen.value = false;
    void loadSorts();
  } finally {
    sSubmitting.value = false;
  }
}
async function removeSort(row: TableRow): Promise<void> {
  await apiSortDelete({ id: row.id });
  message.success('已删除');
  void loadSorts();
}

onMounted(() => {
  void loadFilters();
  void loadSorts();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="filter" tab="筛选项">
          <div class="tab-toolbar">
            <a-button v-perm="'goods:filter:save'" type="primary" @click="openFilterCreate"><template #icon><PlusOutlined /></template>新增筛选项</a-button>
          </div>
          <a-table :columns="filterColumns" :data-source="filters" :loading="filterLoading" row-key="id" size="middle" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'filter_type'">
                <a-tag>{{ FILTER_TYPE[record.filter_type] ?? record.filter_type }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '禁用' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space>
                  <a-button v-perm="'goods:filter:save'" type="link" size="small" @click="openFilterEdit(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该筛选项?" @confirm="removeFilter(record)">
                    <a-button v-perm="'goods:filter:delete'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="sort" tab="排序项">
          <div class="tab-toolbar">
            <a-button v-perm="'goods:filter:save'" type="primary" @click="openSortCreate"><template #icon><PlusOutlined /></template>新增排序项</a-button>
          </div>
          <a-table :columns="sortColumns" :data-source="sorts" :loading="sortLoading" row-key="id" size="middle" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '禁用' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space>
                  <a-button v-perm="'goods:filter:save'" type="link" size="small" @click="openSortEdit(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该排序项?" @confirm="removeSort(record)">
                    <a-button v-perm="'goods:filter:delete'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal v-model:open="fModalOpen" :title="fEditingId ? '编辑筛选项' : '新增筛选项'" :confirm-loading="fSubmitting" @ok="submitFilter">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="筛选键" required>
          <a-select v-model:value="fForm.filterKey" :disabled="fEditingId > 0">
            <a-select-option v-for="k in FILTER_KEYS" :key="k.value" :value="k.value">{{ k.label }}（{{ k.value }}）</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="名称" required><a-input v-model:value="fForm.filterName" /></a-form-item>
        <a-form-item label="英文名"><a-input v-model:value="fForm.filterNameEn" /></a-form-item>
        <a-form-item label="类型">
          <a-radio-group v-model:value="fForm.filterType">
            <a-radio :value="1">范围</a-radio>
            <a-radio :value="2">多选</a-radio>
            <a-radio :value="3">布尔</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="fForm.filterType === 2" label="可选项">
          <a-textarea v-model:value="optionsText" :rows="4" placeholder='JSON:[{"value":"wifi","label":"WiFi"}]' />
        </a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="fForm.sort" :min="0" style="width: 120px" /></a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="fForm.status"><a-radio :value="1">启用</a-radio><a-radio :value="2">禁用</a-radio></a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="sModalOpen" :title="sEditingId ? '编辑排序项' : '新增排序项'" :confirm-loading="sSubmitting" @ok="submitSort">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="排序键" required>
          <a-select v-model:value="sForm.sortKey" :disabled="sEditingId > 0">
            <a-select-option v-for="k in SORT_KEYS" :key="k.value" :value="k.value">{{ k.label }}（{{ k.value }}）</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="名称" required><a-input v-model:value="sForm.sortName" /></a-form-item>
        <a-form-item label="英文名"><a-input v-model:value="sForm.sortNameEn" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="sForm.sort" :min="0" style="width: 120px" /></a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="sForm.status"><a-radio :value="1">启用</a-radio><a-radio :value="2">禁用</a-radio></a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.tab-toolbar {
  margin-bottom: 12px;
}
</style>
