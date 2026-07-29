<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiAdminAdd,
  apiAdminDelete,
  apiAdminDetail,
  apiAdminList,
  apiAdminLoginLogs,
  apiAdminResetPassword,
  apiAdminToggleStatus,
  apiAdminUpdate,
  apiRoleAll,
} from '@/api/system';

/** 管理员管理:列表筛选 / 新增编辑(角色绑定) / 重置密码 / 启停 / 删除 / 登录记录 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiAdminList, {
  username: '',
  realName: '',
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('system.admin.username'), dataIndex: 'username', width: 130 },
  { title: t('user.realName'), dataIndex: 'realName', width: 110 },
  { title: t('common.site'), dataIndex: 'siteId', width: 90 },
  { title: t('system.admin.mobile'), dataIndex: 'mobile', width: 130 },
  { title: t('system.admin.email'), dataIndex: 'email', width: 170, ellipsis: true },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('system.admin.lastLogin'), dataIndex: 'lastLoginAt', width: 160 },
  { title: t('common.action'), key: 'action', width: 300, fixed: 'right' as const },
];

// ---------- 新增/编辑弹窗 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const roleOptions = ref<TableRow[]>([]);
const form = reactive({
  username: '',
  password: '',
  realName: '',
  mobile: '',
  email: '',
  siteId: 0,
  roleIds: [] as number[],
  remark: '',
});

async function openCreate(): Promise<void> {
  editingId.value = 0;
  Object.assign(form, { username: '', password: '', realName: '', mobile: '', email: '', siteId: 0, roleIds: [], remark: '' });
  modalOpen.value = true;
}

async function openEdit(row: TableRow): Promise<void> {
  editingId.value = row.id;
  const detail = await apiAdminDetail(row.id);
  Object.assign(form, {
    username: detail.username,
    password: '',
    realName: detail.realName,
    mobile: detail.mobile,
    email: detail.email,
    siteId: detail.siteId,
    roleIds: detail.roleIds ?? [],
    remark: detail.remark,
  });
  modalOpen.value = true;
}

async function saveAdmin(): Promise<void> {
  if (!form.username.trim()) {
    message.warning(t('system.admin.inputUsername'));
    return;
  }
  if (editingId.value === 0 && !form.password) {
    message.warning(t('system.admin.inputPassword'));
    return;
  }
  modalSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      realName: form.realName,
      mobile: form.mobile,
      email: form.email,
      siteId: form.siteId,
      roleIds: form.roleIds,
      remark: form.remark,
    };
    if (editingId.value === 0) {
      await apiAdminAdd({ ...payload, password: form.password });
    } else {
      await apiAdminUpdate({ ...payload, id: editingId.value });
    }
    message.success(editingId.value === 0 ? t('system.admin.createSuccess') : t('system.admin.updateSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 重置密码 ----------
const pwdOpen = ref(false);
const pwdSaving = ref(false);
const pwdTarget = ref<TableRow | null>(null);
const pwdValue = ref('');

function openResetPwd(row: TableRow): void {
  pwdTarget.value = row;
  pwdValue.value = '';
  pwdOpen.value = true;
}

async function doResetPwd(): Promise<void> {
  if (pwdValue.value.length < 8) {
    message.warning(t('system.admin.pwdRule'));
    return;
  }
  pwdSaving.value = true;
  try {
    await apiAdminResetPassword(pwdTarget.value!.id, pwdValue.value);
    message.success(t('system.admin.pwdResetSuccess'));
    pwdOpen.value = false;
  } finally {
    pwdSaving.value = false;
  }
}

// ---------- 启停 / 删除 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  await apiAdminToggleStatus(row.id);
  message.success(row.status === 1 ? t('system.admin.disabled') : t('system.admin.enabled'));
  void load();
}

async function removeAdmin(row: TableRow): Promise<void> {
  await apiAdminDelete(row.id);
  message.success(t('system.admin.deleted'));
  void load();
}

// ---------- 登录记录抽屉 ----------
const logOpen = ref(false);
const logLoading = ref(false);
const logList = ref<TableRow[]>([]);
const logTarget = ref<TableRow | null>(null);
const logColumns = [
  { title: t('system.admin.logTime'), dataIndex: 'created_at', width: 160 },
  { title: 'IP', dataIndex: 'login_ip', width: 130 },
  { title: t('system.admin.device'), dataIndex: 'user_agent', ellipsis: true },
  { title: t('system.admin.logResult'), dataIndex: 'status', width: 90 },
];

async function openLoginLogs(row: TableRow): Promise<void> {
  logTarget.value = row;
  logOpen.value = true;
  logLoading.value = true;
  try {
    const data = await apiAdminLoginLogs({ adminId: row.id, page: 1, pageSize: 50 });
    logList.value = data.list;
  } finally {
    logLoading.value = false;
  }
}

onMounted(() => {
  void load();
  void apiRoleAll().then((rows) => {
    roleOptions.value = rows;
  });
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('system.admin.username')">
          <a-input v-model:value="query.username" :placeholder="t('common.pleaseInput')" allow-clear style="width: 160px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.realName')">
          <a-input v-model:value="query.realName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 180px" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
            <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
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
      <template #title>{{ t('system.admin.title') }}</template>
      <template #extra>
        <a-button v-perm="'sys:admin:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('system.admin.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'username'">
            {{ record.username }}
            <a-tag v-if="record.isSuper" color="gold">{{ t('app.superAdmin') }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'siteId'">
            <a-tag v-if="record.siteId === 0" color="blue">{{ t('app.allSites') }}</a-tag>
            <span v-else>{{ record.siteId }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'sys:admin:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-perm="'sys:admin:reset-pwd'" type="link" size="small" @click="openResetPwd(record)">{{ t('system.admin.resetPwd') }}</a-button>
              <a-popconfirm
                v-if="!record.isSuper"
                :title="record.status === 1 ? t('system.admin.confirmDisable') : t('system.admin.confirmEnable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'sys:admin:status'" type="link" size="small">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
              <a-button type="link" size="small" @click="openLoginLogs(record)">{{ t('system.admin.loginLog') }}</a-button>
              <a-popconfirm v-if="!record.isSuper" :title="t('system.admin.confirmDelete')" @confirm="removeAdmin(record)">
                <a-button v-perm="'sys:admin:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('system.admin.add') : t('system.admin.edit')"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveAdmin"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item :label="t('system.admin.username')" required>
          <a-input v-model:value="form.username" :disabled="editingId !== 0" :placeholder="t('system.admin.usernameImmutable')" />
        </a-form-item>
        <a-form-item v-if="editingId === 0" :label="t('system.admin.initialPwd')" required>
          <a-input-password v-model:value="form.password" :placeholder="t('system.admin.pwdRule')" />
        </a-form-item>
        <a-form-item :label="t('user.realName')">
          <a-input v-model:value="form.realName" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="form.siteId" allow-all />
        </a-form-item>
        <a-form-item :label="t('system.admin.role')">
          <a-select v-model:value="form.roleIds" mode="multiple" :placeholder="t('common.pleaseSelect')" option-filter-prop="label">
            <a-select-option v-for="role in roleOptions" :key="role.id" :value="role.id" :label="role.role_name">
              {{ role.role_name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('system.admin.mobile')">
          <a-input v-model:value="form.mobile" :placeholder="t('system.admin.mobilePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('system.admin.email')">
          <a-input v-model:value="form.email" />
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" :title="t('system.admin.resetPwd')" :confirm-loading="pwdSaving" width="420px" @ok="doResetPwd">
      <a-alert type="warning" show-icon :message="t('system.admin.pwdWarning')" style="margin-bottom: 16px" />
      <a-form layout="vertical">
        <a-form-item :label="t('system.admin.setPwdFor', { name: pwdTarget?.username })" required>
          <a-input-password v-model:value="pwdValue" :placeholder="t('system.admin.pwdRule')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 登录记录 -->
    <a-drawer v-model:open="logOpen" :title="t('system.admin.loginLogTitle', { name: logTarget?.username ?? '' })" width="640">
      <a-table
        :columns="logColumns"
        :data-source="logList"
        :loading="logLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="{ 1: { text: t('status.success'), color: 'success' }, 2: { text: t('status.failed'), color: 'error' } }" />
          </template>
        </template>
      </a-table>
    </a-drawer>
  </PageContainer>
</template>
