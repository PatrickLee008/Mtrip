<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('supplier.goodsPage.statusSupplying'), color: 'success' },
  2: { text: t('supplier.goodsPage.statusOffSupply'), color: 'default' },
}));
const SYNC_TEXT = computed<Record<number, string>>(() => ({
  1: t('supplier.goodsPage.syncApi'),
  2: t('supplier.goodsPage.syncManual'),
  3: t('supplier.goodsPage.syncScheduled'),
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('supplier.goodsPage.typeHotel'),
  2: t('supplier.goodsPage.typeTicket'),
}));

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

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('supplier.goodsPage.goodsName'), dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: t('supplier.goodsPage.goodsType'), dataIndex: 'goods_type', width: 80 },
  { title: t('supplier.goodsPage.supplyPrice'), dataIndex: 'supply_price', width: 100 },
  { title: t('supplier.goodsPage.retailPrice'), dataIndex: 'retail_price', width: 100 },
  { title: t('supplier.goodsPage.syncType'), dataIndex: 'sync_type', width: 100 },
  { title: t('supplier.goodsPage.relatedGoods'), dataIndex: 'goods_id', width: 110 },
  { title: t('supplier.goodsPage.status'), dataIndex: 'status', width: 90 },
  { title: t('supplier.goodsPage.remark'), dataIndex: 'remark', width: 160, ellipsis: true },
  { title: t('common.action'), key: 'action_col', width: 160, fixed: 'right' as const },
]);

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
    message.warning(t('supplier.goodsPage.warnName'));
    return;
  }
  if (form.retailPrice > 0 && form.supplyPrice > form.retailPrice) {
    message.warning(t('supplier.goodsPage.warnSupplyExceedRetail'));
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
      message.success(t('supplier.goodsPage.addSuccess'));
    } else {
      payload.id = editingId.value;
      payload.status = form.status;
      await apiSupplierGoodsUpdate(payload);
      message.success(t('supplier.goodsPage.updateSuccess'));
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
  message.success(target === 2 ? t('supplier.goodsPage.offSupplySuccess') : t('supplier.goodsPage.resumeSupplySuccess'));
  void load();
}

async function removeGoods(row: TableRow): Promise<void> {
  await apiSupplierGoodsDelete(row.id);
  message.success(t('supplier.goodsPage.deleteSuccess'));
  void load();
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('supplier.goodsPage.supplier')" required>
          <a-select
            v-model:value="supplierId"
            show-search
            allow-clear
            :placeholder="t('supplier.goodsPage.searchSupplierPlaceholder')"
            style="width: 260px"
            :filter-option="false"
            :options="supplierOptions"
            :loading="supplierSearching"
            @search="searchSupplier"
            @change="onSupplierChange"
          />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.goodsName')">
          <a-input v-model:value="query.goodsName" allow-clear :placeholder="t('supplier.goodsPage.fuzzyMatch')" style="width: 170px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.goodsType')">
          <a-select v-model:value="query.goodsType" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('supplier.goodsPage.typeHotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('supplier.goodsPage.typeTicket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('supplier.goodsPage.statusSupplying') }}</a-select-option>
            <a-select-option :value="2">{{ t('supplier.goodsPage.statusOffSupply') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :disabled="!supplierId" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('supplier.goodsPage.title')">
      <template #extra>
        <a-tooltip :title="!supplierId ? t('supplier.goodsPage.tipSelectSupplier') : selectedSupplier && selectedSupplier.status !== 1 ? t('supplier.goodsPage.tipOnlyActive') : ''">
          <a-button
            v-perm="'supplier:goods:list'"
            type="primary"
            :disabled="!supplierId || (selectedSupplier !== null && selectedSupplier.status !== 1)"
            @click="openCreate"
          >
            <template #icon><PlusOutlined /></template>{{ t('supplier.goodsPage.addGoods') }}
          </a-button>
        </a-tooltip>
      </template>
      <a-empty v-if="!supplierId" :description="t('supplier.goodsPage.emptySelectSupplier')" />
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
            <a-tag :color="record.goods_type === 1 ? 'blue' : 'green'">{{ TYPE_TEXT[record.goods_type] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'supply_price'">{{ formatAmount(record.supply_price) }}</template>
          <template v-else-if="column.dataIndex === 'retail_price'">{{ formatAmount(record.retail_price) }}</template>
          <template v-else-if="column.dataIndex === 'sync_type'">{{ SYNC_TEXT[record.sync_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'goods_id'">{{ record.goods_id > 0 ? `#${record.goods_id}` : t('supplier.goodsPage.notRelated') }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'supplier:goods:list'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm :title="record.status === 1 ? t('supplier.goodsPage.confirmOffSupply') : t('supplier.goodsPage.confirmResumeSupply')" @confirm="toggleStatus(record)">
                <a-button v-perm="'supplier:goods:list'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('supplier.goodsPage.offSupply') : t('supplier.goodsPage.resume') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('supplier.goodsPage.confirmDelete')" :ok-button-props="{ danger: true }" @confirm="removeGoods(record)">
                <a-button v-perm="'supplier:goods:list'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="editOpen"
      :title="editingId === 0 ? t('supplier.goodsPage.addGoods') : t('supplier.goodsPage.editGoods')"
      :confirm-loading="editSubmitting"
      @ok="submitEdit"
    >
      <a-form :label-col="{ span: 7 }">
        <a-form-item :label="t('supplier.goodsPage.goodsName')" required>
          <a-input v-model:value="form.goodsName" :maxlength="100" />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.goodsType')">
          <a-radio-group v-model:value="form.goodsType">
            <a-radio :value="1">{{ t('supplier.goodsPage.typeHotel') }}</a-radio>
            <a-radio :value="2">{{ t('supplier.goodsPage.typeTicket') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.supplyPriceLabel')" required>
          <a-input-number v-model:value="form.supplyPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.retailPriceLabel')" required>
          <a-input-number v-model:value="form.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.syncTypeLabel')">
          <a-select v-model:value="form.syncType">
            <a-select-option :value="1">{{ t('supplier.goodsPage.syncApi') }}</a-select-option>
            <a-select-option :value="2">{{ t('supplier.goodsPage.syncManual') }}</a-select-option>
            <a-select-option :value="3">{{ t('supplier.goodsPage.syncScheduled') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.relatedGoodsId')">
          <a-input-number v-model:value="form.goodsId" :min="0" :precision="0" style="width: 100%" :placeholder="t('supplier.goodsPage.unrelatedHint')" />
        </a-form-item>
        <a-form-item :label="t('supplier.goodsPage.remark')">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
