<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiAffiliateReferral } from '@/api/affiliate';

/** 推荐返利记录(C 端 Refer & Earn,user_referral;与 B2B Affiliate 独立) */
const { t } = useI18n();

const REWARD_STATUS: Record<number, StatusItem> = {
  0: { text: 'Pending', color: 'warning' },
  1: { text: 'Rewarded', color: 'success' },
  2: { text: 'Void', color: 'default' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiAffiliateReferral, {
  rewardStatus: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: 'Inviter', dataIndex: 'inviter_user_id', width: 120 },
  { title: 'Invitee', dataIndex: 'invitee_user_id', width: 120 },
  { title: 'Reward Status', dataIndex: 'reward_status', width: 140 },
  { title: 'Reward Amount', dataIndex: 'reward_amount', width: 130 },
  { title: 'First Order', dataIndex: 'reward_order_id', width: 120 },
  { title: 'Bound At', dataIndex: 'bind_time', width: 170 },
  { title: 'Rewarded At', dataIndex: 'reward_time', width: 170 },
]);

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Reward Status">
          <a-select v-model:value="query.rewardStatus" allow-clear placeholder="All" style="width: 150px">
            <a-select-option :value="0">Pending</a-select-option>
            <a-select-option :value="1">Rewarded</a-select-option>
            <a-select-option :value="2">Void</a-select-option>
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'reward_status'">
            <StatusTag :value="record.reward_status" :map="REWARD_STATUS" />
          </template>
          <template v-else-if="column.dataIndex === 'reward_order_id'">{{ record.reward_order_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'reward_time'">{{ record.reward_time || '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
