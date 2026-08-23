<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { BellOutlined, LoginOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import NotifyDrawer from '@/components/merchant/NotifyDrawer.vue';
import ImpersonateModal from '@/components/merchant/ImpersonateModal.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantActivate, apiMerchantList } from '@/api/merchant';
import { ref } from 'vue';

/** 已暂停商户(Super Admin Portal 模块 03),固定 status=4(已禁用/暂停) */
const { t } = useI18n();

const STATUS_MAP: Record<number, StatusItem> = {
  3: { text: 'Active', color: 'success' },
  4: { text: 'Suspended', color: 'warning' },
};
const TYPE_TEXT: Record<number, string> = { 1: 'Hotel', 2: 'Scenic', 3: 'Composite' };

const { loading, list, query, load, search, reset, pagination } = useTable(apiMerchantList, {
  status: 4,
  merchantName: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 220, ellipsis: true },
  { title: 'Type', dataIndex: 'merchant_type', width: 100 },
  { title: 'Contact', dataIndex: 'contact_name', width: 130 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: 'Created', dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

async function reactivate(row: TableRow): Promise<void> {
  await apiMerchantActivate(row.id);
  message.success(t('merchant.profile.activateSuccess'));
  await load();
}

const notifyOpen = ref(false);
const notifyTarget = ref<TableRow | null>(null);

function openNotify(row: TableRow): void {
  notifyTarget.value = row;
  notifyOpen.value = true;
}

const impersonateOpen = ref(false);
const impersonateTarget = ref<TableRow | null>(null);

function openImpersonate(row: TableRow): void {
  impersonateTarget.value = row;
  impersonateOpen.value = true;
}

onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Merchant">
          <a-input v-model:value="query.merchantName" allow-clear style="width: 200px" @press-enter="search" />
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_type'">{{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}</template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="STATUS_MAP" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-popconfirm v-if="record.status === 4" title="Reactivate this merchant?" @confirm="reactivate(record)">
              <a-button v-perm="'merchant:list:status'" type="link" size="small" style="color: var(--sap-success)">Reactivate</a-button>
            </a-popconfirm>
            <a-tooltip :title="t('merchant.notifyPage.title')">
              <a-button v-perm="'merchant:list:notify'" type="link" size="small" @click="openNotify(record)"><template #icon><BellOutlined /></template></a-button>
            </a-tooltip>
            <a-tooltip :title="t('merchant.impersonate.title')">
              <a-button v-perm="'merchant:list:impersonate'" type="link" size="small" @click="openImpersonate(record)"><template #icon><LoginOutlined /></template></a-button>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <NotifyDrawer v-model:open="notifyOpen" :merchant="notifyTarget" @sent="load" />
    <ImpersonateModal v-model:open="impersonateOpen" :merchant="impersonateTarget" />
  </PageContainer>
</template>
