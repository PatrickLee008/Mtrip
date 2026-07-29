<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiSupplierGoodsAdd,
  apiSupplierGoodsDelete,
  apiSupplierGoodsList,
  apiSupplierGoodsUpdate,
  apiSupplierList,
} from '@/api/merchant';

/**
 * 供货商品:先远程搜索选定供应商,再维护其供货商品(名称/供货价/零售价/同步方式/供货状态)
 * 仅已合作供应商可添加;供货底价不得高于建议零售价
 */
const STATUS_MAP: Record<number, StatusItem> = {
  1: { text: '供货中', color: 'success' },
  2: { text: '已停供', color: 'default' },
};
const SYNC_TEXT: Record<number, string> = { 1: 'API实时', 2: '手动导入', 3: '定时同步' };

// ---------- 供应商远程搜索 ----------
const supplierId = ref<number>();
const supplierOptions = ref<{ label: string; value: number; status: number }[]>([]);
const supplierSearching = ref(false);
const selectedSupplier = ref<TableRow | null>(null);

async function searchSupplier(keyword: string): Promise<void> {
  supplierSearching.value = true;
  try {
    const data = await apiSupplierList({ supplierName: keyword, page: 1, pageSize: 20 });
    supplierOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.supplier_name}`,
      value: row.id,
      status: row.status,
    }));
  } finally {
    supplierSearching.value = false;
  }
}

function onSupplierChange(): void {
  selectedSupplier.value = supplierOptions.value.find((opt) => opt.value === supplierId.value) ?? null;
  if (supplierId.value) {
    void search();
  }
}

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => {
    if (!supplierId.value) {
      return Promise.resolve({ list: [], total: 0, page: 1, pageSize: 20 });
    }
    return apiSupplierGoodsList({ ...params, supplierId: supplierId.value });
  },
  { goodsName: '', goodsType: undefined, status: undefined },
);

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '商品名称', dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: '类型', dataIndex: 'goods_type', width: 80 },
  { title: '供货价', dataIndex: 'supply_price', width: 100 },
  { title: '零售价', dataIndex: 'retail_price', width: 100 },
  { title: '同步方式', dataIndex: 'sync_type', width: 100 },
  { title: '关联平台商品', dataIndex: 'goods_id', width: 110 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true },
  { title: '操作', key: 'action_col', width: 160, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const editOpen = ref(false);
const editSubmitting = ref(false);
const editingId = ref(0);
const form = reactive({
  goodsName: '',
  goodsType: 1,
  supplyPrice: 0,
  retailPrice: 0,
  syncType: 2,
  goodsId: 0,
  status: 1,
  remark: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { goodsName: '', goodsType: 1, supplyPrice: 0, retailPrice: 0, syncType: 2, goodsId: 0, status: 1, remark: '' });
  editOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    goodsName: row.goods_name,
    goodsType: row.goods_type,
    supplyPrice: Number(row.supply_price),
    retailPrice: Number(row.retail_price),
    syncType: row.sync_type,
    goodsId: row.goods_id,
    status: row.status,
    remark: row.remark,
  });
  editOpen.value = true;
}

async function submitEdit(): Promise<void> {
  if (!form.goodsName.trim()) {
    message.warning('请填写商品名称');
    return;
  }
  if (form.retailPrice > 0 && form.supplyPrice > form.retailPrice) {
    message.warning('供货底价不能高于建议零售价');
    return;
  }
  editSubmitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      goodsName: form.goodsName.trim(),
      goodsType: form.goodsType,
      supplyPrice: form.supplyPrice,
      retailPrice: form.retailPrice,
      syncType: form.syncType,
      goodsId: form.goodsId,
      remark: form.remark.trim(),
    };
    if (editingId.value === 0) {
      payload.supplierId = supplierId.value;
      await apiSupplierGoodsAdd(payload);
      message.success('供货商品已添加');
    } else {
      payload.id = editingId.value;
      payload.status = form.status;
      await apiSupplierGoodsUpdate(payload);
      message.success('供货商品已更新');
    }
    editOpen.value = false;
    void load();
  } finally {
    editSubmitting.value = false;
  }
}

// ---------- 停供/恢复、删除 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  const target = row.status === 1 ? 2 : 1;
  await apiSupplierGoodsUpdate({ id: row.id, status: target });
  message.success(target === 2 ? '已停供' : '已恢复供货');
  void load();
}

async function removeGoods(row: TableRow): Promise<void> {
  await apiSupplierGoodsDelete(row.id);
  message.success('供货商品已删除');
  void load();
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="供应商" required>
          <a-select
            v-model:value="supplierId"
            show-search
            allow-clear
            placeholder="输入名称搜索并选择"
            style="width: 260px"
            :filter-option="false"
            :options="supplierOptions"
            :loading="supplierSearching"
            @search="searchSupplier"
            @change="onSupplierChange"
          />
        </a-form-item>
        <a-form-item label="商品名称">
          <a-input v-model:value="query.goodsName" allow-clear placeholder="模糊匹配" style="width: 170px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.goodsType" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">酒店</a-select-option>
            <a-select-option :value="2">门票</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">供货中</a-select-option>
            <a-select-option :value="2">已停供</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :disabled="!supplierId" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="供货商品">
      <template #extra>
        <a-tooltip :title="!supplierId ? '请先选择供应商' : selectedSupplier && selectedSupplier.status !== 1 ? '仅已合作供应商可添加' : ''">
          <a-button
            v-perm="'supplier:goods:list'"
            type="primary"
            :disabled="!supplierId || (selectedSupplier !== null && selectedSupplier.status !== 1)"
            @click="openCreate"
          >
            <template #icon><PlusOutlined /></template>新增供货商品
          </a-button>
        </a-tooltip>
      </template>
      <a-empty v-if="!supplierId" description="请先在上方选择供应商" />
      <a-table
        v-else
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'goods_type'">
            <a-tag :color="record.goods_type === 1 ? 'blue' : 'green'">{{ record.goods_type === 1 ? '酒店' : '门票' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'supply_price'">{{ formatAmount(record.supply_price) }}</template>
          <template v-else-if="column.dataIndex === 'retail_price'">{{ formatAmount(record.retail_price) }}</template>
          <template v-else-if="column.dataIndex === 'sync_type'">{{ SYNC_TEXT[record.sync_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'goods_id'">{{ record.goods_id > 0 ? `#${record.goods_id}` : '未关联' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'supplier:goods:list'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm :title="record.status === 1 ? '确认停供?' : '确认恢复供货?'" @confirm="toggleStatus(record)">
                <a-button v-perm="'supplier:goods:list'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? '停供' : '恢复' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm title="确认删除该供货商品?" :ok-button-props="{ danger: true }" @confirm="removeGoods(record)">
                <a-button v-perm="'supplier:goods:list'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="editOpen"
      :title="editingId === 0 ? '新增供货商品' : '编辑供货商品'"
      :confirm-loading="editSubmitting"
      @ok="submitEdit"
    >
      <a-form :label-col="{ span: 7 }">
        <a-form-item label="商品名称" required>
          <a-input v-model:value="form.goodsName" :maxlength="100" />
        </a-form-item>
        <a-form-item label="类型">
          <a-radio-group v-model:value="form.goodsType">
            <a-radio :value="1">酒店</a-radio>
            <a-radio :value="2">门票</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="供货底价" required>
          <a-input-number v-model:value="form.supplyPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item label="建议零售价" required>
          <a-input-number v-model:value="form.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item label="库存同步方式">
          <a-select v-model:value="form.syncType">
            <a-select-option :value="1">API实时</a-select-option>
            <a-select-option :value="2">手动导入</a-select-option>
            <a-select-option :value="3">定时同步</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关联平台商品ID">
          <a-input-number v-model:value="form.goodsId" :min="0" :precision="0" style="width: 100%" placeholder="0=未关联" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
