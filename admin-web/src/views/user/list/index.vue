<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiUserDetail, apiUserList, apiUserToggleStatus } from '@/api/user';

const { t } = useI18n();

/**
 * C端用户列表(文档 6.4.4)
 * 状态:1正常 ⇄ 2冻结(必填原因留痕);3注销为用户侧操作不可逆
 * 手机号列表脱敏;详情超管可见明文
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('status.active'), color: 'success' },
  2: { text: t('status.locked'), color: 'error' },
  3: { text: t('common.delete'), color: 'default' },
}));
const REAL_NAME_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('common.no'), color: 'default' },
  1: { text: t('common.yes'), color: 'success' },
  2: { text: t('common.failed'), color: 'error' },
}));
const SOURCE_TEXT = computed<Record<number, string>>(() => ({
  1: 'Android',
  2: 'iOS',
  3: 'H5',
  4: t('log.apiPage.clientTypeMini'),
}));

// 注册日期区间
const registerRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiUserList({
    ...params,
    startDate: registerRange.value?.[0],
    endDate: registerRange.value?.[1],
  }),
  { nickname: '', userStatus: undefined, realNameStatus: undefined, registerSource: undefined, siteId: 0 },
);

function doReset(): void {
  registerRange.value = [];
  reset();
}

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('user.listPage.nickname'), dataIndex: 'nickname', width: 150, ellipsis: true },
  { title: t('user.listPage.mobile'), dataIndex: 'mobile', width: 130 },
  { title: t('merchant.accountPage.balance'), dataIndex: 'balance', width: 100 },
  { title: t('merchant.accountPage.balance'), dataIndex: 'points', width: 80 },
  { title: t('user.listPage.username'), dataIndex: 'real_name_status', width: 90 },
  { title: t('user.listPage.registerSource'), dataIndex: 'register_source', width: 90 },
  { title: t('user.listPage.status'), dataIndex: 'user_status', width: 80 },
  { title: t('user.listPage.registerTime'), dataIndex: 'register_time', width: 165 },
  { title: t('user.listPage.lastLogin'), dataIndex: 'last_login_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

// ---------- 详情抽屉(含余额/积分流水摘要) ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const balanceLogs = ref<TableRow[]>([]);
const pointsLogs = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiUserDetail(row.id);
    detail.value = data.user;
    balanceLogs.value = data.balanceLogs;
    pointsLogs.value = data.pointsLogs;
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 冻结/解冻(必填原因) ----------
const toggleOpen = ref(false);
const toggleSubmitting = ref(false);
const toggleForm = reactive({ id: 0, nickname: '', freeze: true, reason: '' });

function openToggle(row: TableRow): void {
  toggleForm.id = row.id;
  toggleForm.nickname = row.nickname;
  toggleForm.freeze = row.user_status === 1;
  toggleForm.reason = '';
  toggleOpen.value = true;
}

async function submitToggle(): Promise<void> {
  if (!toggleForm.reason.trim()) {
    message.warning(t('common.required'));
    return;
  }
  toggleSubmitting.value = true;
  try {
    const data = await apiUserToggleStatus({ id: toggleForm.id, reason: toggleForm.reason.trim() });
    message.success(data.userStatus === 2 ? t('status.locked') : t('status.active'));
    toggleOpen.value = false;
    void load();
  } finally {
    toggleSubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('user.listPage.nickname')">
          <a-input v-model:value="query.nickname" allow-clear :placeholder="t('common.pleaseInput')" style="width: 150px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.listPage.status')">
          <a-select v-model:value="query.userStatus" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ STATUS_MAP.value[1].text }}</a-select-option>
            <a-select-option :value="2">{{ STATUS_MAP.value[2].text }}</a-select-option>
            <a-select-option :value="3">{{ STATUS_MAP.value[3].text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('user.listPage.username')">
          <a-select v-model:value="query.realNameStatus" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option :value="0">{{ REAL_NAME_MAP.value[0].text }}</a-select-option>
            <a-select-option :value="1">{{ REAL_NAME_MAP.value[1].text }}</a-select-option>
            <a-select-option :value="2">{{ REAL_NAME_MAP.value[2].text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('user.listPage.registerSource')">
          <a-select v-model:value="query.registerSource" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option :value="1">Android</a-select-option>
            <a-select-option :value="2">iOS</a-select-option>
            <a-select-option :value="3">H5</a-select-option>
            <a-select-option :value="4">{{ t('log.apiPage.clientTypeMini') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('user.listPage.registerTime')">
          <a-range-picker v-model:value="registerRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('user.listPage.title')">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'nickname'">
            <a-space>
              <a-avatar v-if="record.avatar" :src="record.avatar" size="small" />
              <span>{{ record.nickname || '-' }}</span>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'balance'">{{ formatAmount(record.balance) }}</template>
          <template v-else-if="column.dataIndex === 'real_name_status'">
            <StatusTag :value="record.real_name_status" :map="REAL_NAME_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'register_source'">{{ SOURCE_TEXT[record.register_source] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'user_status'">
            <StatusTag :value="record.user_status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'last_login_at'">{{ record.last_login_at || '-' }}</template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button
                v-if="record.user_status === 1 || record.user_status === 2"
                v-perm="'user:list:status'"
                type="link"
                size="small"
                :danger="record.user_status === 1"
                @click="openToggle(record)"
              >{{ record.user_status === 1 ? t('status.locked') : t('status.active') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('common.detail')" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('user.listPage.nickname')">{{ detail.nickname || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.status')"><StatusTag :value="detail.user_status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.mobile')">{{ detail.mobile || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.email')">{{ detail.email || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.accountPage.balance')">{{ formatAmount(detail.balance) }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.accountPage.balance')">{{ detail.points }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.username')"><StatusTag :value="detail.real_name_status" :map="REAL_NAME_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('user.realName')">{{ detail.real_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('system.admin.mobile')">{{ detail.id_card || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.registerSource')">{{ SOURCE_TEXT[detail.register_source] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.registerTime')">{{ detail.register_time }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.lastLogin')">{{ detail.last_login_at || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.lastLogin')">{{ detail.last_login_ip || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('user.listPage.username')">{{ detail.member_level_id || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.remark" :label="t('common.remark')" :span="2">{{ detail.remark }}</a-descriptions-item>
          </a-descriptions>
          <a-divider orientation="left">{{ t('merchant.accountPage.balance') }}</a-divider>
          <a-table
            :columns="[
              { title: t('merchant.accountPage.balance'), dataIndex: 'amount', width: 110 },
              { title: t('merchant.accountPage.balance'), dataIndex: 'after_balance', width: 110 },
              { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
              { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
            ]"
            :data-source="balanceLogs"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'amount'">
                <span :style="{ color: Number(record.amount) >= 0 ? 'var(--mtrip-success, #52c41a)' : 'var(--mtrip-error, #ff4d4f)' }">
                  {{ Number(record.amount) >= 0 ? '+' : '' }}{{ formatAmount(record.amount) }}
                </span>
              </template>
              <template v-else-if="column.dataIndex === 'after_balance'">{{ formatAmount(record.after_balance) }}</template>
            </template>
          </a-table>
          <a-divider orientation="left">{{ t('merchant.accountPage.balance') }}</a-divider>
          <a-table
            :columns="[
              { title: t('merchant.accountPage.balance'), dataIndex: 'points', width: 110 },
              { title: t('merchant.accountPage.balance'), dataIndex: 'after_points', width: 110 },
              { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
              { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
            ]"
            :data-source="pointsLogs"
            row-key="id"
            size="small"
            :pagination="false"
          />
        </template>
      </a-spin>
    </a-drawer>

    <!-- 冻结/解冻 Modal -->
    <a-modal
      v-model:open="toggleOpen"
      :title="toggleForm.freeze ? t('status.locked') : t('status.active')"
      :confirm-loading="toggleSubmitting"
      :ok-button-props="toggleForm.freeze ? { danger: true } : undefined"
      @ok="submitToggle"
    >
      <a-alert
        v-if="toggleForm.freeze"
        type="warning"
        show-icon
        :message="t('status.locked')"
        style="margin-bottom: 16px"
      />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('user.listPage.username')">{{ toggleForm.nickname || `#${toggleForm.id}` }}</a-form-item>
        <a-form-item :label="t('common.remark')" required>
          <a-textarea v-model:value="toggleForm.reason" :rows="3" :maxlength="200" :placeholder="t('common.required')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
