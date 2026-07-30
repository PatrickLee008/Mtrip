<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiGoodsAdd,
  apiGoodsDetail,
  apiGoodsList,
  apiGoodsSubmit,
  apiGoodsToggleStatus,
  apiGoodsUpdate,
} from '@/api/goods';

/** 商品管理:列表筛选 / 新增编辑 / 提交审核 / 上下架;数据范围由后端按主体裁剪 */
const { t } = useI18n();
const userStore = useUserStore();
/** 集团账号可跨商户,新增须显式指定所属商户 */
const isGroup = computed(() => userStore.accountType === 1);

const { loading, list, query, load, search, reset, pagination } = useTable(apiGoodsList, {
  goodsName: '',
  goodsType: undefined,
  status: undefined,
});

/** 商品状态机:0草稿 1待审核 2驳回 3已上架 4已下架 5删除 */
const GOODS_STATUS_MAP: Record<number, StatusItem> = {
  0: { text: t('goods.goodsStatus.draft'), color: 'default' },
  1: { text: t('goods.goodsStatus.pending'), color: 'processing' },
  2: { text: t('goods.goodsStatus.rejected'), color: 'error' },
  3: { text: t('goods.goodsStatus.onSale'), color: 'success' },
  4: { text: t('goods.goodsStatus.offSale'), color: 'warning' },
};

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.goodsName'), dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: t('goods.goodsType'), dataIndex: 'goods_type', width: 100 },
  { title: t('goods.category'), dataIndex: 'category_name', width: 130 },
  { title: t('store.merchant'), dataIndex: 'merchant_name', width: 150 },
  { title: t('goods.salesCount'), dataIndex: 'sales_count', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action', width: 240, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  goodsType: 2,
  goodsName: '',
  merchantId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  categoryId: undefined as number | undefined,
  coverImage: '',
  goodsBrief: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    goodsType: 2,
    goodsName: '',
    merchantId: undefined,
    supplierId: undefined,
    categoryId: undefined,
    coverImage: '',
    goodsBrief: '',
  });
  modalOpen.value = true;
}

async function openEdit(row: TableRow): Promise<void> {
  editingId.value = row.id;
  const detail = await apiGoodsDetail(row.id);
  const goods = (detail.goods ?? {}) as TableRow;
  Object.assign(form, {
    goodsType: goods.goods_type,
    goodsName: goods.goods_name,
    merchantId: goods.merchant_id,
    supplierId: goods.supplier_id,
    categoryId: goods.category_id,
    coverImage: goods.cover_image,
    goodsBrief: goods.goods_brief,
  });
  modalOpen.value = true;
}

async function saveGoods(): Promise<void> {
  if (!form.goodsName.trim()) {
    message.warning(t('goods.goodsName') + t('common.required'));
    return;
  }
  if (isGroup.value && editingId.value === 0 && !form.merchantId) {
    message.warning(t('store.merchant') + t('common.required'));
    return;
  }
  modalSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      goodsType: form.goodsType,
      goodsName: form.goodsName.trim(),
      supplierId: form.supplierId,
      categoryId: form.categoryId,
      coverImage: form.coverImage,
      goodsBrief: form.goodsBrief,
    };
    if (editingId.value === 0) {
      await apiGoodsAdd({ ...payload, merchantId: form.merchantId });
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

// ---------- 提交审核 / 上下架 ----------
async function submitAudit(row: TableRow): Promise<void> {
  await apiGoodsSubmit(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

async function toggleStatus(row: TableRow): Promise<void> {
  await apiGoodsToggleStatus(row.id);
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
        <a-form-item :label="t('goods.goodsName')">
          <a-input v-model:value="query.goodsName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('goods.goodsType')">
          <a-select v-model:value="query.goodsType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ t('goods.hotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('goods.ticket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option :value="0">{{ t('goods.goodsStatus.draft') }}</a-select-option>
            <a-select-option :value="1">{{ t('goods.goodsStatus.pending') }}</a-select-option>
            <a-select-option :value="2">{{ t('goods.goodsStatus.rejected') }}</a-select-option>
            <a-select-option :value="3">{{ t('goods.goodsStatus.onSale') }}</a-select-option>
            <a-select-option :value="4">{{ t('goods.goodsStatus.offSale') }}</a-select-option>
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
      <template #title>{{ t('menu.goods') }}</template>
      <template #extra>
        <a-button v-perm="'mch:goods:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('goods.addTitle') }}
        </a-button>
      </template>
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
          <template v-if="column.dataIndex === 'goods_type'">
            <a-tag :color="record.goods_type === 1 ? 'blue' : 'cyan'">{{ record.goods_type === 1 ? t('goods.hotel') : t('goods.ticket') }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="GOODS_STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'mch:goods:edit'" type="link" size="small" :disabled="[1, 3, 5].includes(record.status)" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm v-if="[0, 2].includes(record.status)" :title="t('goods.submitConfirm')" @confirm="submitAudit(record)">
                <a-button v-perm="'mch:goods:edit'" type="link" size="small">{{ t('goods.submitAudit') }}</a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="[3, 4].includes(record.status)"
                :title="record.status === 3 ? t('goods.offShelf') + '?' : t('goods.onShelf') + '?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'mch:goods:status'" type="link" size="small">
                  {{ record.status === 3 ? t('goods.offShelf') : t('goods.onShelf') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('goods.addTitle') : t('goods.editTitle')"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveGoods"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 17 }" style="margin-top: 16px">
        <a-form-item :label="t('goods.goodsType')" required>
          <a-select v-model:value="form.goodsType" :disabled="editingId !== 0" style="width: 160px">
            <a-select-option :value="1">{{ t('goods.hotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('goods.ticket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('goods.goodsName')" required>
          <a-input v-model:value="form.goodsName" />
        </a-form-item>
        <a-form-item v-if="isGroup && editingId === 0" :label="t('store.merchant')" required>
          <a-input-number v-model:value="form.merchantId" :placeholder="'ID'" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.supplier')">
          <a-input-number v-model:value="form.supplierId" :placeholder="'ID'" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.category')">
          <a-input-number v-model:value="form.categoryId" :placeholder="'ID'" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.cover')">
          <a-input v-model:value="form.coverImage" :placeholder="t('common.pleaseInput')" />
        </a-form-item>
        <a-form-item :label="t('goods.brief')">
          <a-textarea v-model:value="form.goodsBrief" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
