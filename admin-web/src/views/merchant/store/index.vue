<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiMerchantList,
  apiStoreAdd,
  apiStoreDelete,
  apiStoreDetail,
  apiStoreList,
  apiStoreSetMain,
  apiStoreToggleStatus,
  apiStoreUpdate,
} from '@/api/merchant';

const { t } = useI18n();

/** 门店管理:履约/核销单元(参考美团POI),商户审核通过自动建主门店,结算主体仍在商户(计划 11) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.storePage.statusOpen'), color: 'success' },
  2: { text: t('merchant.storePage.statusClosed'), color: 'default' },
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiStoreList, {
  merchantId: undefined,
  storeName: '',
  status: undefined,
  siteId: 0,
});

// 商户搜索选择(筛选与新增共用)
const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantSearching = ref(false);

async function searchMerchant(keyword: string): Promise<void> {
  merchantSearching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    merchantSearching.value = false;
  }
}

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('merchant.storePage.name'), dataIndex: 'store_name', width: 180, ellipsis: true },
  { title: t('merchant.storePage.merchant'), dataIndex: 'merchant_name', width: 180, ellipsis: true },
  { title: t('merchant.storePage.isMain'), dataIndex: 'is_main', width: 80 },
  { title: t('merchant.storePage.contact'), dataIndex: 'contact_name', width: 100 },
  { title: t('merchant.storePage.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('merchant.storePage.address'), dataIndex: 'address', ellipsis: true },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 260, fixed: 'right' as const },
]);

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    detail.value = await apiStoreDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

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
  longitude: undefined as number | undefined,
  latitude: undefined as number | undefined,
  businessLicense: '',
  businessHours: '',
  remark: '',
});

function resetForm(): void {
  Object.assign(form, {
    merchantId: undefined,
    storeName: '',
    contactName: '',
    contactPhone: '',
    address: '',
    longitude: undefined,
    latitude: undefined,
    businessLicense: '',
    businessHours: '',
    remark: '',
  });
}

function openCreate(): void {
  editingId.value = 0;
  resetForm();
  void searchMerchant('');
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    merchantId: row.merchant_id,
    storeName: row.store_name ?? '',
    contactName: row.contact_name ?? '',
    // 联系电话列表为脱敏值,留空保留原值
    contactPhone: '',
    address: row.address ?? '',
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    businessLicense: row.business_license ?? '',
    businessHours: row.business_hours ?? '',
    remark: row.remark ?? '',
  });
  modalOpen.value = true;
}

async function saveStore(): Promise<void> {
  if (!form.storeName.trim()) {
    message.warning(t('merchant.storePage.name'));
    return;
  }
  if (!editingId.value && !form.merchantId) {
    message.warning(t('merchant.storePage.selectMerchant'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiStoreUpdate({ id: editingId.value, ...form, merchantId: undefined });
    } else {
      await apiStoreAdd({ ...form });
    }
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 设主门店 / 启停 / 删除 ----------
async function setMain(row: TableRow): Promise<void> {
  await apiStoreSetMain(row.id);
  message.success(t('merchant.storePage.setMainSuccess'));
  await load();
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiStoreToggleStatus(row.id);
  message.success(result.status === 1 ? t('merchant.storePage.statusOpen') : t('merchant.storePage.statusClosed'));
  await load();
}

async function doDelete(row: TableRow): Promise<void> {
  await apiStoreDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

onMounted(() => {
  void load();
  void searchMerchant('');
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.storePage.merchant')">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            :placeholder="t('common.all')"
            style="width: 220px"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('merchant.storePage.name')">
          <a-input v-model:value="query.storeName" allow-clear :placeholder="t('common.pleaseInput')" style="width: 160px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ STATUS_MAP[1].text }}</a-select-option>
            <a-select-option :value="2">{{ STATUS_MAP[2].text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
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
      <template #title>{{ t('merchant.storePage.title') }}</template>
      <template #extra>
        <a-button v-perm="'merchant:store:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('common.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'is_main'">
            <a-tag v-if="record.is_main === 1" color="processing">{{ t('merchant.storePage.isMain') }}</a-tag>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button v-perm="'merchant:store:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm
                v-if="record.is_main !== 1"
                :title="t('merchant.storePage.setMainConfirm')"
                @confirm="setMain(record)"
              >
                <a-button v-perm="'merchant:store:edit'" type="link" size="small">{{ t('merchant.storePage.setMain') }}</a-button>
              </a-popconfirm>
              <a-popconfirm
                :title="record.status === 1 ? t('merchant.storePage.statusClosed') : t('merchant.storePage.statusOpen')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'merchant:store:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('merchant.storePage.statusClosed') : t('merchant.storePage.statusOpen') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.is_main !== 1"
                :title="t('merchant.storePage.deleteConfirm')"
                @confirm="doDelete(record)"
              >
                <a-button v-perm="'merchant:store:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('common.detail')" width="560">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('merchant.storePage.name')" :span="2">{{ detail.store_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.merchant')" :span="2">{{ detail.merchant_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.isMain')">{{ detail.is_main === 1 ? t('common.yes') : t('common.no') }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.contact')">{{ detail.contact_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.phone')">{{ detail.contact_phone || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.address')" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.longitude')">{{ detail.longitude ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.latitude')">{{ detail.latitude ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.businessHours')" :span="2">{{ detail.business_hours || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.storePage.businessLicense')" :span="2">
              <a-image v-if="detail.business_license" :src="detail.business_license" :width="96" />
              <span v-else>-</span>
            </a-descriptions-item>
            <a-descriptions-item :label="t('common.remark')" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
          </a-descriptions>

          <template v-if="detail.images?.length">
            <a-divider orientation="left">{{ t('goods.common.images') }}</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="96" />
              </a-space>
            </a-image-preview-group>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') : t('common.add')"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="saveStore"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="24">
            <a-form-item :label="t('merchant.storePage.merchant')" :required="!editingId">
              <a-select
                v-model:value="form.merchantId"
                show-search
                :filter-option="false"
                :options="merchantOptions"
                :loading="merchantSearching"
                :disabled="!!editingId"
                :placeholder="t('merchant.storePage.selectMerchant')"
                @search="searchMerchant"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.name')" required>
              <a-input v-model:value="form.storeName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.businessHours')">
              <a-input v-model:value="form.businessHours" placeholder="09:00-22:00" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.contact')">
              <a-input v-model:value="form.contactName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.phone')">
              <a-input v-model:value="form.contactPhone" :placeholder="editingId ? t('common.optional') : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('merchant.storePage.address')">
              <a-input v-model:value="form.address" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.longitude')">
              <a-input-number v-model:value="form.longitude" :precision="7" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.storePage.latitude')">
              <a-input-number v-model:value="form.latitude" :precision="7" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('merchant.storePage.businessLicense')">
              <a-input v-model:value="form.businessLicense" :placeholder="t('common.pleaseInput')" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.remark')">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
