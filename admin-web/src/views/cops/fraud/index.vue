<script setup lang="ts">
import { onMounted } from 'vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiFraudList } from '@/api/cops';

/** 风控看板:命中风控用户列表(只读;处置在「申诉处理」页) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiFraudList, {
  level: undefined,
  siteId: 0,
});

const LEVEL: Record<number, { text: string; color: string }> = {
  0: { text: '正常', color: 'default' },
  1: { text: '警告', color: 'warning' },
  2: { text: '限制', color: 'error' },
  3: { text: '封禁', color: 'error' },
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '用户ID', dataIndex: 'user_id', width: 100 },
  { title: '风险分', dataIndex: 'fraud_score', width: 90 },
  { title: '风控级别', dataIndex: 'level', width: 110 },
  { title: '最近原因', dataIndex: 'last_reason', ellipsis: true },
  { title: '最近评估', dataIndex: 'last_eval_at', width: 170 },
];

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="风控级别">
          <a-select v-model:value="query.level" placeholder="全部" allow-clear style="width: 140px">
            <a-select-option :value="1">警告</a-select-option>
            <a-select-option :value="2">限制</a-select-option>
            <a-select-option :value="3">封禁</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="风控用户">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'level'">
            <a-tag :color="LEVEL[record.level]?.color">{{ LEVEL[record.level]?.text ?? record.level }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
