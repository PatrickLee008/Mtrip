<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { StatusItem } from '@/components/StatusTag.vue';
import type { TableRow } from '@/composables/useTable';
import {
  apiCustomer360,
  apiEndUserToggleStatus,
  apiEndUserBlacklist,
  apiEndUserUnblacklist,
} from '@/api/enduser';

/** Customer 360:选中用户后聚合展示其全景(Super Admin Portal 模块 07) */
const { t } = useI18n();
const route = useRoute();

const USER_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' },
  2: { text: 'Suspended', color: 'warning' },
  3: { text: 'Closed', color: 'default' },
  4: { text: 'Blacklisted', color: 'error' },
};

const searchId = ref<number | undefined>(undefined);
const loading = ref(false);
const loaded = ref(false);
const data = reactive({
  user: null as TableRow | null,
  level: null as TableRow | null,
  balanceLogs: [] as TableRow[],
  pointsLogs: [] as TableRow[],
  bookings: [] as TableRow[],
  coupons: [] as TableRow[],
  transactions: [] as TableRow[],
  referralCount: 0,
});

async function loadUser(id: number): Promise<void> {
  if (!id) return;
  loading.value = true;
  try {
    const res = await apiCustomer360(id);
    data.user = res.user;
    data.level = res.level;
    data.balanceLogs = res.balanceLogs;
    data.pointsLogs = res.pointsLogs;
    data.bookings = res.bookings;
    data.coupons = res.coupons;
    data.transactions = res.transactions;
    data.referralCount = res.referralCount;
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}
function doSearch(): void {
  if (searchId.value) void loadUser(searchId.value);
}

const status = computed(() => Number(data.user?.user_status ?? 0));

// ---------- 账户操作 ----------
const actionOpen = ref(false);
const actionSaving = ref(false);
const actionKind = ref<'suspend' | 'blacklist'>('suspend');
const actionReason = ref('');
const actionEvidence = ref('');
function openAction(kind: 'suspend' | 'blacklist'): void {
  actionKind.value = kind;
  actionReason.value = '';
  actionEvidence.value = '';
  actionOpen.value = true;
}
async function doAction(): Promise<void> {
  if (!data.user) return;
  if (!actionReason.value.trim()) {
    message.warning('Reason is required');
    return;
  }
  actionSaving.value = true;
  try {
    if (actionKind.value === 'suspend') {
      await apiEndUserToggleStatus(data.user.id, actionReason.value);
    } else {
      await apiEndUserBlacklist(data.user.id, actionReason.value, actionEvidence.value);
    }
    message.success(t('tip.saveSuccess'));
    actionOpen.value = false;
    await loadUser(data.user.id);
  } finally {
    actionSaving.value = false;
  }
}
async function unfreeze(): Promise<void> {
  if (!data.user) return;
  await apiEndUserToggleStatus(data.user.id, 'Reactivated by admin');
  message.success(t('tip.saveSuccess'));
  await loadUser(data.user.id);
}
async function unblacklist(): Promise<void> {
  if (!data.user) return;
  await apiEndUserUnblacklist(data.user.id);
  message.success(t('tip.saveSuccess'));
  await loadUser(data.user.id);
}

const balanceCols = [
  { title: 'Type', dataIndex: 'change_type', width: 90 },
  { title: 'Amount', dataIndex: 'amount', width: 110 },
  { title: 'After', dataIndex: 'after_balance', width: 110 },
  { title: 'Remark', dataIndex: 'remark', ellipsis: true },
  { title: 'Time', dataIndex: 'created_at', width: 170 },
];
const pointsCols = [
  { title: 'Type', dataIndex: 'change_type', width: 90 },
  { title: 'Points', dataIndex: 'points', width: 100 },
  { title: 'After', dataIndex: 'after_points', width: 100 },
  { title: 'Remark', dataIndex: 'remark', ellipsis: true },
  { title: 'Time', dataIndex: 'created_at', width: 170 },
];
const bookingCols = [
  { title: 'Order', dataIndex: 'id', width: 90 },
  { title: 'Status', dataIndex: 'order_status', width: 100 },
  { title: 'Amount', dataIndex: 'pay_amount', width: 110 },
  { title: 'Created', dataIndex: 'created_at', width: 170 },
];

onMounted(() => {
  const q = Number(route.query.userId);
  if (q > 0) {
    searchId.value = q;
    void loadUser(q);
  }
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-space>
        <span style="color: var(--sap-muted)">User ID</span>
        <a-input-number v-model:value="searchId" :min="1" style="width: 160px" @press-enter="doSearch" />
        <a-button type="primary" @click="doSearch"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
      </a-space>
    </a-card>

    <a-spin :spinning="loading">
      <a-empty v-if="!loaded" description="Enter a User ID to load the customer 360 view" style="margin: 48px 0" />
      <template v-else-if="data.user">
        <!-- 头卡 -->
        <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
          <div style="display: flex; align-items: center; gap: 16px">
            <a-avatar :size="56" :src="data.user.avatar">{{ (data.user.nickname || '?').slice(0, 2) }}</a-avatar>
            <div style="flex: 1">
              <div style="font-size: 18px; font-weight: 600">
                {{ data.user.nickname || '(no name)' }}
                <StatusTag :value="status" :map="USER_STATUS" style="margin-left: 8px" />
              </div>
              <div style="color: var(--sap-muted); font-size: 13px">
                ID {{ data.user.id }} · {{ data.user.mobile }} · {{ data.level?.level_name || 'No tier' }}
              </div>
            </div>
            <a-space>
              <a-button v-if="status === 1" v-perm="'user:list:status'" @click="openAction('suspend')">Suspend</a-button>
              <a-button v-if="status === 2" v-perm="'user:list:status'" type="primary" @click="unfreeze">Reactivate</a-button>
              <a-button v-if="status !== 4 && status !== 3" v-perm="'user:list:status'" danger @click="openAction('blacklist')">Blacklist</a-button>
              <a-button v-if="status === 4" v-perm="'user:list:status'" @click="unblacklist">Remove Blacklist</a-button>
            </a-space>
          </div>
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :span="6"><a-statistic title="Balance" :value="Number(data.user.balance || 0)" :precision="2" /></a-col>
            <a-col :span="6"><a-statistic title="Points" :value="Number(data.user.points || 0)" /></a-col>
            <a-col :span="6"><a-statistic title="Bookings" :value="data.bookings.length" /></a-col>
            <a-col :span="6"><a-statistic title="Referrals" :value="data.referralCount" /></a-col>
          </a-row>
        </a-card>

        <!-- 360 明细 Tab -->
        <a-card :bordered="false" class="mtrip-card-shadow">
          <a-tabs>
            <a-tab-pane key="profile" tab="Profile">
              <a-descriptions :column="2" size="small" bordered>
                <a-descriptions-item label="Nickname">{{ data.user.nickname || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Status"><StatusTag :value="status" :map="USER_STATUS" /></a-descriptions-item>
                <a-descriptions-item label="Mobile">{{ data.user.mobile || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Email">{{ data.user.email || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Real Name">{{ data.user.real_name || '-' }}</a-descriptions-item>
                <a-descriptions-item label="ID Card">{{ data.user.id_card || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Member Level">{{ data.level?.level_name || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Member Expiry">{{ data.user.member_expire_time || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Registered">{{ data.user.register_time }}</a-descriptions-item>
                <a-descriptions-item label="Last Login">{{ data.user.last_login_at || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Remark" :span="2">{{ data.user.remark || '-' }}</a-descriptions-item>
              </a-descriptions>
            </a-tab-pane>
            <a-tab-pane key="wallet" tab="Wallet">
              <a-table :columns="balanceCols" :data-source="data.balanceLogs" row-key="id" size="small" :pagination="false" />
            </a-tab-pane>
            <a-tab-pane key="points" tab="Points">
              <a-table :columns="pointsCols" :data-source="data.pointsLogs" row-key="id" size="small" :pagination="false" />
            </a-tab-pane>
            <a-tab-pane key="bookings" tab="Bookings">
              <a-table :columns="bookingCols" :data-source="data.bookings" row-key="id" size="small" :pagination="false" />
            </a-tab-pane>
            <a-tab-pane key="coupons" tab="Coupons">
              <a-table :data-source="data.coupons" row-key="id" size="small" :pagination="false" />
            </a-tab-pane>
            <a-tab-pane key="transactions" tab="Transactions">
              <a-table :data-source="data.transactions" row-key="id" size="small" :pagination="false" />
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </template>
    </a-spin>

    <a-modal
      v-model:open="actionOpen"
      :title="actionKind === 'suspend' ? 'Suspend User' : 'Blacklist User'"
      :confirm-loading="actionSaving"
      :ok-button-props="{ danger: actionKind === 'blacklist' }"
      @ok="doAction"
    >
      <a-textarea v-model:value="actionReason" :rows="3" placeholder="Reason (required)" style="margin-bottom: 12px" />
      <a-textarea v-if="actionKind === 'blacklist'" v-model:value="actionEvidence" :rows="2" placeholder="Evidence (optional)" />
    </a-modal>
  </PageContainer>
</template>
