<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import AmountText from '@/components/AmountText.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiGoodsAdd,
  apiGoodsDelete,
  apiGoodsToggleStatus,
  apiGoodsList,
  apiGoodsUpdate,
} from '@/api/goods';

/** 供货商品自助维护:列表筛选 / 新增编辑 / 停供恢复 / 删除;数据范围恒为本供应商 */
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiGoodsList, {
  goodsName: '',
  goodsType: undefined,
  status: undefined,
});

/** 供货状态:1供货中 2已停供 */
const GOODS_STATUS_MAP: Record<number, StatusItem> = {
  1: { text: t('supply.statusOn'), color: 'success' },
  2: { text: t('supply.statusOff'), color: 'warning' },
};

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('supply.goodsName'), dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: t('supply.goodsType'), dataIndex: 'goods_type', width: 100 },
  { title: t('supply.supplyPrice'), dataIndex: 'supply_price', width: 120 },
  { title: t('supply.retailPrice'), dataIndex: 'retail_price', width: 120 },
  { title: t('supply.syncType'), dataIndex: 'sync_type', width: 120 },
  { title: t('common.status'), dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action', width: 200, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  goodsType: 1,
  goodsName: '',
  goodsId: undefined as number | undefined,
  supplyPrice: 0,
  retailPrice: 0,
  syncType: 2,
  remark: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    goodsType: 1,
    goodsName: '',
    goodsId: undefined,
    supplyPrice: 0,
    retailPrice: 0,
    syncType: 2,
    remark: '',
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    goodsType: row.goods_type,
    goodsName: row.goods_name,
    goodsId: row.goods_id || undefined,
    supplyPrice: Number(row.supply_price),
    retailPrice: Number(row.retail_price),
    syncType: row.sync_type,
    remark: row.remark,
  });
  modalOpen.value = true;
}

async function saveGoods(): Promise<void> {
  if (!form.goodsName.trim()) {
    message.warning(t('supply.goodsName') + t('common.required'));
    return;
  }
  if (form.retailPrice > 0 && form.supplyPrice > form.retailPrice) {
    message.warning(t('supply.priceRule'));
    return;
  }
  modalSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      goodsType: form.goodsType,
      goodsName: form.goodsName.trim(),
      goodsId: form.goodsId ?? 0,
      supplyPrice: form.supplyPrice,
      retailPrice: form.retailPrice,
      syncType: form.syncType,
      remark: form.remark,
    };
    if (editingId.value === 0) {
      await apiGoodsAdd(payload);
    } else {
      await apiGoodsUpdate({ ...payload, id: editingId.value });
    }
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 停供恢复 / 删除 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  await apiGoodsToggleStatus(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

async function removeGoods(row: TableRow): Promise<void> {
  await apiGoodsDelete(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('supply.goodsName')">
          <a-input v-model:value="query.goodsName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('supply.goodsType')">
          <a-select v-model:value="query.goodsType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ t('supply.hotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('supply.ticket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option :value="1">{{ t('supply.statusOn') }}</a-select-option>
            <a-select-option :value="2">{{ t('supply.statusOff') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('menu.supply') }}</template>
      <template #extra>
        <a-button v-perm="'sup:goods:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('supply.addTitle') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'goods_type'">
            <a-tag :color="record.goods_type === 1 ? 'blue' : 'cyan'">{{ record.goods_type === 1 ? t('supply.hotel') : t('supply.ticket') }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'supply_price'">
            <AmountText :value="record.supply_price" />
          </template>
          <template v-else-if="column.dataIndex === 'retail_price'">
            <AmountText :value="record.retail_price" />
          </template>
          <template v-else-if="column.dataIndex === 'sync_type'">
            {{ t(`supply.sync.${record.sync_type}`) }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="GOODS_STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'sup:goods:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm
                :title="record.status === 1 ? t('supply.offConfirm') : t('supply.onConfirm')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'sup:goods:status'" type="link" size="small">
                  {{ record.status === 1 ? t('supply.stopSupply') : t('supply.resumeSupply') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('common.deleteConfirm')" @confirm="removeGoods(record)">
                <a-button v-perm="'sup:goods:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('supply.addTitle') : t('supply.editTitle')"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveGoods"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 17 }" style="margin-top: 16px">
        <a-form-item :label="t('supply.goodsType')" required>
          <a-select v-model:value="form.goodsType" style="width: 160px">
            <a-select-option :value="1">{{ t('supply.hotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('supply.ticket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('supply.goodsName')" required>
          <a-input v-model:value="form.goodsName" />
        </a-form-item>
        <a-form-item :label="t('supply.linkGoods')">
          <a-input-number v-model:value="form.goodsId" :placeholder="t('supply.linkGoodsTip')" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('supply.supplyPrice')" required>
          <a-input-number v-model:value="form.supplyPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('supply.retailPrice')" required>
          <a-input-number v-model:value="form.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('supply.syncType')">
          <a-select v-model:value="form.syncType" style="width: 200px">
            <a-select-option :value="1">{{ t('supply.sync.1') }}</a-select-option>
            <a-select-option :value="2">{{ t('supply.sync.2') }}</a-select-option>
            <a-select-option :value="3">{{ t('supply.sync.3') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="3" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
