<script setup lang="ts">
import { reactive, ref } from 'vue';
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

/**
 * C端用户列表(文档 6.4.4)
 * 状态:1正常 ⇄ 2冻结(必填原因留痕);3注销为用户侧操作不可逆
 * 手机号列表脱敏;详情超管可见明文
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP: Record<number, StatusItem> = {
  1: { text: '正常', color: 'success' },
  2: { text: '冻结', color: 'error' },
  3: { text: '已注销', color: 'default' },
};
const REAL_NAME_MAP: Record<number, StatusItem> = {
  0: { text: '未认证', color: 'default' },
  1: { text: '已认证', color: 'success' },
  2: { text: '认证失败', color: 'error' },
};
const SOURCE_TEXT: Record<number, string> = { 1: 'Android', 2: 'iOS', 3: 'H5', 4: '小程序' };

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

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '昵称', dataIndex: 'nickname', width: 150, ellipsis: true },
  { title: '手机号', dataIndex: 'mobile', width: 130 },
  { title: '余额', dataIndex: 'balance', width: 100 },
  { title: '积分', dataIndex: 'points', width: 80 },
  { title: '实名', dataIndex: 'real_name_status', width: 90 },
  { title: '注册来源', dataIndex: 'register_source', width: 90 },
  { title: '状态', dataIndex: 'user_status', width: 80 },
  { title: '注册时间', dataIndex: 'register_time', width: 165 },
  { title: '最后登录', dataIndex: 'last_login_at', width: 165 },
  { title: '操作', key: 'action_col', width: 130, fixed: 'right' as const },
];

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
    message.warning('请填写操作原因');
    return;
  }
  toggleSubmitting.value = true;
  try {
    const data = await apiUserToggleStatus({ id: toggleForm.id, reason: toggleForm.reason.trim() });
    message.success(data.userStatus === 2 ? '用户已冻结' : '用户已解冻');
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
        <a-form-item label="昵称">
          <a-input v-model:value="query.nickname" allow-clear placeholder="模糊匹配" style="width: 150px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.userStatus" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">正常</a-select-option>
            <a-select-option :value="2">冻结</a-select-option>
            <a-select-option :value="3">已注销</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="实名认证">
          <a-select v-model:value="query.realNameStatus" allow-clear placeholder="全部" style="width: 110px">
            <a-select-option :value="0">未认证</a-select-option>
            <a-select-option :value="1">已认证</a-select-option>
            <a-select-option :value="2">认证失败</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="注册来源">
          <a-select v-model:value="query.registerSource" allow-clear placeholder="全部" style="width: 110px">
            <a-select-option :value="1">Android</a-select-option>
            <a-select-option :value="2">iOS</a-select-option>
            <a-select-option :value="3">H5</a-select-option>
            <a-select-option :value="4">小程序</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="注册日期">
          <a-range-picker v-model:value="registerRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="用户列表">
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
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.user_status === 1 || record.user_status === 2"
                v-perm="'user:list:status'"
                type="link"
                size="small"
                :danger="record.user_status === 1"
                @click="openToggle(record)"
              >{{ record.user_status === 1 ? '冻结' : '解冻' }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="用户详情" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="昵称">{{ detail.nickname || '-' }}</a-descriptions-item>
            <a-descriptions-item label="状态"><StatusTag :value="detail.user_status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="手机号">{{ detail.mobile || '-' }}</a-descriptions-item>
            <a-descriptions-item label="邮箱">{{ detail.email || '-' }}</a-descriptions-item>
            <a-descriptions-item label="余额">{{ formatAmount(detail.balance) }}</a-descriptions-item>
            <a-descriptions-item label="积分">{{ detail.points }}</a-descriptions-item>
            <a-descriptions-item label="实名认证"><StatusTag :value="detail.real_name_status" :map="REAL_NAME_MAP" /></a-descriptions-item>
            <a-descriptions-item label="真实姓名">{{ detail.real_name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="身份证号">{{ detail.id_card || '-' }}</a-descriptions-item>
            <a-descriptions-item label="注册来源">{{ SOURCE_TEXT[detail.register_source] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="注册时间">{{ detail.register_time }}</a-descriptions-item>
            <a-descriptions-item label="最后登录">{{ detail.last_login_at || '-' }}</a-descriptions-item>
            <a-descriptions-item label="最后登录IP">{{ detail.last_login_ip || '-' }}</a-descriptions-item>
            <a-descriptions-item label="会员等级ID">{{ detail.member_level_id || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.remark" label="备注" :span="2">{{ detail.remark }}</a-descriptions-item>
          </a-descriptions>
          <a-divider orientation="left">余额流水(近10条)</a-divider>
          <a-table
            :columns="[
              { title: '变动金额', dataIndex: 'amount', width: 110 },
              { title: '变动后余额', dataIndex: 'after_balance', width: 110 },
              { title: '说明', dataIndex: 'remark', ellipsis: true },
              { title: '时间', dataIndex: 'created_at', width: 160 },
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
          <a-divider orientation="left">积分流水(近10条)</a-divider>
          <a-table
            :columns="[
              { title: '变动积分', dataIndex: 'points', width: 110 },
              { title: '变动后积分', dataIndex: 'after_points', width: 110 },
              { title: '说明', dataIndex: 'remark', ellipsis: true },
              { title: '时间', dataIndex: 'created_at', width: 160 },
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
      :title="toggleForm.freeze ? '冻结用户' : '解冻用户'"
      :confirm-loading="toggleSubmitting"
      :ok-button-props="toggleForm.freeze ? { danger: true } : undefined"
      @ok="submitToggle"
    >
      <a-alert
        v-if="toggleForm.freeze"
        type="warning"
        show-icon
        message="冻结后用户无法登录与下单,原因将写入备注留痕"
        style="margin-bottom: 16px"
      />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="用户">{{ toggleForm.nickname || `#${toggleForm.id}` }}</a-form-item>
        <a-form-item label="操作原因" required>
          <a-textarea v-model:value="toggleForm.reason" :rows="3" :maxlength="200" placeholder="必填" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
