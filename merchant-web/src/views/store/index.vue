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
  apiStoreAdd,
  apiStoreDetail,
  apiStoreList,
  apiStoreSetMain,
  apiStoreToggleStatus,
  apiStoreUpdate,
} from '@/api/store';

/** 门店管理:列表筛选 / 新增编辑 / 详情 / 设主 / 启停(1营业 2停业);数据范围由后端按主体裁剪 */
const { t } = useI18n();
const userStore = useUserStore();
/** 集团账号(account_type=1)可跨商户,需显式选择所属商户 */
const isGroup = computed(() => userStore.accountType === 1);

const { loading, list, query, load, search, reset, pagination } = useTable(apiStoreList, {
  merchantId: undefined,
  storeName: '',
  status: undefined,
});

const STORE_STATUS_MAP: Record<number, StatusItem> = {
  1: { text: t('store.open'), color: 'success' },
  2: { text: t('store.closed'), color: 'default' },
};

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('store.storeName'), dataIndex: 'store_name', width: 180 },
  { title: t('store.merchant'), dataIndex: 'merchant_name', width: 160 },
  { title: t('store.contact'), dataIndex: 'contact_name', width: 110 },
  { title: t('store.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('store.isMain'), dataIndex: 'is_main', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 90 },
  { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
  { title: t('common.operation'), key: 'action', width: 240, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  merchantId: undefined as number | undefined,
  storeName: '',
  contactName: '',
  contactPhone: '',
  address: '',
  businessLicense: '',
  businessHours: '',
  remark: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    merchantId: undefined,
    storeName: '',
    contactName: '',
    contactPhone: '',
    address: '',
    businessLicense: '',
    businessHours: '',
    remark: '',
  });
  modalOpen.value = true;
}

async function openEdit(row: TableRow): Promise<void> {
  editingId.value = row.id;
  const detail = await apiStoreDetail(row.id);
  Object.assign(form, {
    merchantId: detail.merchant_id,
    storeName: detail.store_name,
    contactName: detail.contact_name,
    contactPhone: detail.contact_phone,
    address: detail.address,
    businessLicense: detail.business_license,
    businessHours: detail.business_hours,
    remark: detail.remark,
  });
  modalOpen.value = true;
}

async function saveStore(): Promise<void> {
  if (!form.storeName.trim()) {
    message.warning(t('store.storeName') + t('common.required'));
    return;
  }
  if (isGroup.value && editingId.value === 0 && !form.merchantId) {
    message.warning(t('store.merchant') + t('common.required'));
    return;
  }
  modalSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      storeName: form.storeName.trim(),
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      address: form.address,
      businessLicense: form.businessLicense,
      businessHours: form.businessHours,
      remark: form.remark,
    };
    if (editingId.value === 0) {
      await apiStoreAdd({ ...payload, merchantId: form.merchantId });
    } else {
      await apiStoreUpdate({ ...payload, id: editingId.value });
    }
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 详情 ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailData = ref<TableRow | null>(null);

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    detailData.value = await apiStoreDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 设主 / 启停 ----------
async function setMain(row: TableRow): Promise<void> {
  await apiStoreSetMain(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

async function toggleStatus(row: TableRow): Promise<void> {
  await apiStoreToggleStatus(row.id);
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
        <a-form-item v-if="isGroup" :label="t('store.merchant')">
          <a-input-number v-model:value="query.merchantId" :placeholder="'ID'" style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('store.storeName')">
          <a-input v-model:value="query.storeName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ t('store.open') }}</a-select-option>
            <a-select-option :value="2">{{ t('store.closed') }}</a-select-option>
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
      <template #title>{{ t('menu.store') }}</template>
      <template #extra>
        <a-button v-perm="'mch:store:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('store.addTitle') }}
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
          <template v-if="column.dataIndex === 'is_main'">
            <a-tag v-if="record.is_main === 1" color="gold">{{ t('common.yes') }}</a-tag>
            <span v-else>{{ t('common.no') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STORE_STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button v-perm="'mch:store:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm v-if="record.is_main !== 1" :title="t('store.setMainConfirm')" @confirm="setMain(record)">
                <a-button v-perm="'mch:store:set-main'" type="link" size="small">{{ t('store.setMain') }}</a-button>
              </a-popconfirm>
              <a-popconfirm
                :title="record.status === 1 ? t('store.closed') + '?' : t('store.open') + '?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'mch:store:status'" type="link" size="small">
                  {{ record.status === 1 ? t('store.closed') : t('store.open') }}
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
      :title="editingId === 0 ? t('store.addTitle') : t('store.editTitle')"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveStore"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 17 }" style="margin-top: 16px">
        <a-form-item v-if="isGroup && editingId === 0" :label="t('store.merchant')" required>
          <a-input-number v-model:value="form.merchantId" :placeholder="'ID'" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('store.storeName')" required>
          <a-input v-model:value="form.storeName" />
        </a-form-item>
        <a-form-item :label="t('store.contact')">
          <a-input v-model:value="form.contactName" />
        </a-form-item>
        <a-form-item :label="t('store.phone')">
          <a-input v-model:value="form.contactPhone" />
        </a-form-item>
        <a-form-item :label="t('store.address')">
          <a-input v-model:value="form.address" />
        </a-form-item>
        <a-form-item :label="t('store.businessLicense')">
          <a-input v-model:value="form.businessLicense" />
        </a-form-item>
        <a-form-item :label="t('store.businessHours')">
          <a-input v-model:value="form.businessHours" />
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情 -->
    <a-drawer v-model:open="detailOpen" :title="t('common.detail')" width="480">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detailData" :column="1" bordered size="small">
          <a-descriptions-item :label="t('store.storeName')">{{ detailData.store_name }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.merchant')">{{ detailData.merchant_name }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.contact')">{{ detailData.contact_name }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.phone')">{{ detailData.contact_phone }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.address')">{{ detailData.address }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.businessLicense')">{{ detailData.business_license }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.businessHours')">{{ detailData.business_hours }}</a-descriptions-item>
          <a-descriptions-item :label="t('store.isMain')">{{ detailData.is_main === 1 ? t('common.yes') : t('common.no') }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">
            <StatusTag :value="detailData.status" :map="STORE_STATUS_MAP" />
          </a-descriptions-item>
          <a-descriptions-item :label="t('common.remark')">{{ detailData.remark }}</a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>
