<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiGroupAccountReset,
  apiGroupAdd,
  apiGroupBind,
  apiGroupDelete,
  apiGroupDetail,
  apiGroupList,
  apiGroupToggleStatus,
  apiGroupUnbind,
  apiGroupUpdate,
  apiMerchantList,
} from '@/api/merchant';

const { t } = useI18n();

/** 集团管理:管理/授权实体(参考美团品牌总部),商户经 group_id 排他授权绑定(计划 11) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('status.enabled'), color: 'success' },
  2: { text: t('status.disabled'), color: 'default' },
}));
const MERCHANT_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('status.pending'), color: 'warning' },
  2: { text: t('common.failed'), color: 'error' },
  3: { text: t('status.enabled'), color: 'success' },
  4: { text: t('status.disabled'), color: 'default' },
  5: { text: t('common.delete'), color: 'default' },
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.typeHotel'),
  2: t('goods.common.typeTicket'),
  3: t('merchant.groupPage.typeComprehensive'),
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiGroupList, {
  groupName: '',
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('merchant.groupPage.name'), dataIndex: 'group_name', width: 200, ellipsis: true },
  { title: t('merchant.groupPage.shortName'), dataIndex: 'group_short_name', width: 120, ellipsis: true },
  { title: t('merchant.groupPage.contact'), dataIndex: 'contact_name', width: 100 },
  { title: t('merchant.groupPage.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('merchant.groupPage.merchantCount'), dataIndex: 'merchant_count', width: 100 },
  { title: t('common.status'), dataIndex: 'status', width: 90 },
  { title: t('common.createdAt'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 280, fixed: 'right' as const },
]);

// ---------- 详情抽屉(含绑定商户/集团账号) ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailMerchants = ref<TableRow[]>([]);
const detailAccounts = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiGroupDetail(row.id);
    detail.value = data.group;
    detailMerchants.value = data.merchants;
    detailAccounts.value = data.accounts;
  } finally {
    detailLoading.value = false;
  }
}

async function reloadDetail(): Promise<void> {
  if (detail.value) {
    await openDetail(detail.value as TableRow);
  }
}

const merchantColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('merchant.listPage.name'), dataIndex: 'merchant_name', ellipsis: true },
  { title: t('common.type'), dataIndex: 'merchant_type', width: 80 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 80 },
]);
const accountColumns = computed(() => [
  { title: t('login.username'), dataIndex: 'username' },
  { title: t('user.realName'), dataIndex: 'real_name' },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('system.admin.lastLogin'), dataIndex: 'last_login_at', width: 160 },
]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  groupName: '',
  groupShortName: '',
  logo: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  remark: '',
  siteId: 0,
});

function resetForm(): void {
  Object.assign(form, {
    groupName: '',
    groupShortName: '',
    logo: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    remark: '',
    siteId: 0,
  });
}

function openCreate(): void {
  editingId.value = 0;
  resetForm();
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    groupName: row.group_name ?? '',
    groupShortName: row.group_short_name ?? '',
    logo: row.logo ?? '',
    contactName: row.contact_name ?? '',
    // 联系电话列表为脱敏值,留空保留原值
    contactPhone: '',
    contactEmail: row.contact_email ?? '',
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveGroup(): Promise<void> {
  if (!form.groupName.trim()) {
    message.warning(t('merchant.groupPage.name'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiGroupUpdate({ id: editingId.value, ...form });
    } else {
      if (!form.contactName.trim() || !form.contactPhone.trim()) {
        message.warning(t('common.required'));
        return;
      }
      await apiGroupAdd({ ...form });
    }
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 绑定/解绑商户 ----------
const bindOpen = ref(false);
const bindSaving = ref(false);
const bindTarget = ref<TableRow | null>(null);
const bindMerchantIds = ref<number[]>([]);
const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantSearching = ref(false);

function openBind(row: TableRow): void {
  bindTarget.value = row;
  bindMerchantIds.value = [];
  merchantOptions.value = [];
  bindOpen.value = true;
  void searchUnboundMerchant('');
}

/** 仅搜索未绑定集团的已审核商户(unboundOnly) */
async function searchUnboundMerchant(keyword: string): Promise<void> {
  merchantSearching.value = true;
  try {
    const data = await apiMerchantList({
      merchantName: keyword,
      unboundOnly: 1,
      siteId: bindTarget.value?.site_id || undefined,
      page: 1,
      pageSize: 20,
    });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    merchantSearching.value = false;
  }
}

async function doBind(): Promise<void> {
  if (!bindTarget.value || bindMerchantIds.value.length === 0) {
    message.warning(t('merchant.groupPage.selectMerchants'));
    return;
  }
  bindSaving.value = true;
  try {
    const result = await apiGroupBind(bindTarget.value.id, bindMerchantIds.value);
    message.success(t('merchant.groupPage.bindSuccess', { count: result.bound }));
    bindOpen.value = false;
    await load();
  } finally {
    bindSaving.value = false;
  }
}

async function doUnbind(merchant: TableRow): Promise<void> {
  if (!detail.value) {
    return;
  }
  await apiGroupUnbind(detail.value.id, merchant.id);
  message.success(t('merchant.groupPage.unbindSuccess'));
  await Promise.all([reloadDetail(), load()]);
}

// ---------- 集团账号生成/重置 ----------
const accountResetting = ref(false);

async function resetAccount(): Promise<void> {
  if (!detail.value) {
    return;
  }
  accountResetting.value = true;
  try {
    const account = await apiGroupAccountReset(detail.value.id);
    Modal.success({
      title: account.created ? t('merchant.groupPage.accountCreated') : t('merchant.groupPage.accountReset'),
      content: `${t('login.username')}:${account.username}  ${t('system.admin.initialPwd')}:${account.password}`,
      width: 520,
    });
    await reloadDetail();
  } finally {
    accountResetting.value = false;
  }
}

// ---------- 启停 / 删除 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiGroupToggleStatus(row.id);
  message.success(result.status === 1 ? t('common.enable') : t('common.disable'));
  await load();
}

async function doDelete(row: TableRow): Promise<void> {
  await apiGroupDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.groupPage.name')">
          <a-input v-model:value="query.groupName" allow-clear :placeholder="t('common.pleaseInput')" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 120px">
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
      <template #title>{{ t('merchant.groupPage.title') }}</template>
      <template #extra>
        <a-button v-perm="'merchant:group:add'" type="primary" @click="openCreate">
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
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button v-perm="'merchant:group:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button
                v-if="record.status === 1"
                v-perm="'merchant:group:bind'"
                type="link"
                size="small"
                @click="openBind(record)"
              >{{ t('merchant.groupPage.bindMerchant') }}</a-button>
              <a-popconfirm
                :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'merchant:group:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('common.disable') : t('common.enable') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('merchant.groupPage.deleteConfirm')" @confirm="doDelete(record)">
                <a-button v-perm="'merchant:group:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉:基础信息 + 绑定商户 + 集团账号 -->
    <a-drawer v-model:open="drawerOpen" :title="t('common.detail')" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('merchant.groupPage.name')" :span="2">{{ detail.group_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.groupPage.shortName')">{{ detail.group_short_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('merchant.groupPage.contact')">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.groupPage.phone')">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.groupPage.email')" :span="2">{{ detail.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.remark')" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
          </a-descriptions>

          <a-divider orientation="left">{{ t('merchant.groupPage.boundMerchants') }}</a-divider>
          <a-table :columns="merchantColumns" :data-source="detailMerchants" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'merchant_type'">{{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}</template>
              <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="MERCHANT_STATUS_MAP" /></template>
              <template v-else-if="column.key === 'action_col'">
                <a-popconfirm :title="t('merchant.groupPage.unbindConfirm')" @confirm="doUnbind(record)">
                  <a-button v-perm="'merchant:group:bind'" type="link" size="small" danger>{{ t('merchant.groupPage.unbind') }}</a-button>
                </a-popconfirm>
              </template>
            </template>
          </a-table>

          <a-divider orientation="left">{{ t('merchant.groupPage.groupAccounts') }}</a-divider>
          <a-space style="margin-bottom: 12px">
            <a-button
              v-perm="'merchant:group:account'"
              type="primary"
              size="small"
              :loading="accountResetting"
              :disabled="detail.status !== 1"
              @click="resetAccount"
            >{{ detailAccounts.length ? t('merchant.groupPage.resetAccount') : t('merchant.groupPage.genAccount') }}</a-button>
          </a-space>
          <a-table :columns="accountColumns" :data-source="detailAccounts" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'"><StatusTag :value="record.status" /></template>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') : t('common.add')"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="saveGroup"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('merchant.groupPage.name')" required>
              <a-input v-model:value="form.groupName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.groupPage.shortName')">
              <a-input v-model:value="form.groupShortName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.groupPage.contact')" :required="!editingId">
              <a-input v-model:value="form.contactName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.groupPage.phone')" :required="!editingId">
              <a-input v-model:value="form.contactPhone" :placeholder="editingId ? t('common.optional') : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.groupPage.email')">
              <a-input v-model:value="form.contactEmail" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item v-if="isSuper && !editingId" :label="t('common.site')" required>
              <SiteTreeSelect v-model:value="form.siteId" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="Logo">
              <a-input v-model:value="form.logo" :placeholder="t('common.pleaseInput')" />
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

    <!-- 绑定商户 -->
    <a-modal
      v-model:open="bindOpen"
      :title="`${t('merchant.groupPage.bindMerchant')}:${bindTarget?.group_name ?? ''}`"
      width="520px"
      :confirm-loading="bindSaving"
      @ok="doBind"
    >
      <a-alert :message="t('merchant.groupPage.bindTip')" type="info" show-icon style="margin: 12px 0 16px" />
      <a-select
        v-model:value="bindMerchantIds"
        mode="multiple"
        :filter-option="false"
        :options="merchantOptions"
        :loading="merchantSearching"
        :placeholder="t('merchant.groupPage.selectMerchants')"
        style="width: 100%"
        @search="searchUnboundMerchant"
      />
    </a-modal>
  </PageContainer>
</template>
