<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { BellOutlined, LoginOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiMerchantBlacklistList } from '@/api/merchant';
import NotifyDrawer from '@/components/merchant/NotifyDrawer.vue';
import ImpersonateModal from '@/components/merchant/ImpersonateModal.vue';
import MerchantStatusActions from '@/components/merchant/MerchantStatusActions.vue';

/** 黑名单商户(Super Admin Portal 模块 03) */
const { t } = useI18n();

const { loading, list, load, pagination } = useTable(apiMerchantBlacklistList, {});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 200, ellipsis: true },
  { title: 'Merchant ID', dataIndex: 'merchant_id', width: 110 },
  { title: 'Reason', dataIndex: 'reason', ellipsis: true },
  { title: 'Evidence', dataIndex: 'evidence', ellipsis: true },
  { title: 'Operator', dataIndex: 'operator_name', width: 120 },
  { title: 'Created', dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 120, fixed: 'right' as const },
]);

function statusTarget(row: TableRow): TableRow {
  return { ...row, id: row.merchant_id, status: 4, is_blacklisted: true };
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
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>Blacklisted Merchants</template>
      <template #extra>
        <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action_col'">
            <MerchantStatusActions :merchant="statusTarget(record)" @changed="load" />
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
