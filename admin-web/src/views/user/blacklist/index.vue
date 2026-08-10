<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiEndUserList, apiEndUserUnblacklist } from '@/api/enduser';

/** 黑名单用户(Super Admin Portal 模块 07),固定 userStatus=4 */
const { t } = useI18n();
const router = useRouter();

const USER_STATUS: Record<number, StatusItem> = {
  4: { text: 'Blacklisted', color: 'error' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiEndUserList, {
  userStatus: 4,
  nickname: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: 'Nickname', dataIndex: 'nickname', width: 180, ellipsis: true },
  { title: 'Mobile', dataIndex: 'mobile', width: 140 },
  { title: 'Status', dataIndex: 'user_status', width: 120 },
  { title: 'Registered', dataIndex: 'register_time', width: 170 },
  { title: 'Remark', dataIndex: 'remark', ellipsis: true },
  { title: t('common.action'), key: 'action_col', width: 190, fixed: 'right' as const },
]);

async function removeBlacklist(row: TableRow): Promise<void> {
  await apiEndUserUnblacklist(row.id);
  message.success(t('tip.saveSuccess'));
  await load();
}
function view360(row: TableRow): void {
  void router.push({ path: '/user/profile', query: { userId: row.id } });
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Nickname">
          <a-input v-model:value="query.nickname" allow-clear style="width: 200px" @press-enter="search" />
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1020 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'user_status'">
            <StatusTag :value="record.user_status" :map="USER_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="view360(record)">360</a-button>
              <a-popconfirm title="Remove from blacklist?" @confirm="removeBlacklist(record)">
                <a-button v-perm="'user:list:status'" type="link" size="small" style="color: var(--sap-success)">Remove</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
