<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiAccountAdd,
  apiAccountList,
  apiAccountResetPassword,
  apiAccountToggleStatus,
  apiAccountUpdate,
} from '@/api/account';
import { apiAccountRoles, apiRoleGrant, apiRoleList, type MerchantRole } from '@/api/role';

/** 子账号管理:列表筛选 / 新增编辑 / 重置密码 / 启停(主账号不可停用) / 赋角色 */
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiAccountList, {
  keyword: '',
  status: undefined,
});

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('account.username'), dataIndex: 'username', width: 150 },
  { title: t('account.realName'), dataIndex: 'realName', width: 120 },
  { title: t('account.phone'), dataIndex: 'mobile', width: 140 },
  { title: t('account.isOwner'), dataIndex: 'isOwner', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('account.lastLoginAt'), dataIndex: 'lastLoginAt', width: 160 },
  { title: t('common.operation'), key: 'action', width: 220, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({ username: '', password: '', realName: '', mobile: '' });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { username: '', password: '', realName: '', mobile: '' });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, { username: row.username, password: '', realName: row.realName, mobile: row.mobile });
  modalOpen.value = true;
}

async function saveAccount(): Promise<void> {
  if (editingId.value === 0 && !form.username.trim()) {
    message.warning(t('account.username') + t('common.required'));
    return;
  }
  if (editingId.value === 0 && form.password.length < 8) {
    message.warning(t('account.pwdRule'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value === 0) {
      await apiAccountAdd({
        username: form.username.trim(),
        password: form.password,
        realName: form.realName,
        mobile: form.mobile,
      });
    } else {
      await apiAccountUpdate({ id: editingId.value, realName: form.realName, mobile: form.mobile });
    }
    message.success(t('common.saveSuccess'));
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
    message.warning(t('account.pwdRule'));
    return;
  }
  pwdSaving.value = true;
  try {
    await apiAccountResetPassword(pwdTarget.value!.id, pwdValue.value);
    message.success(t('common.opSuccess'));
    pwdOpen.value = false;
  } finally {
    pwdSaving.value = false;
  }
}

// ---------- 启停 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  await apiAccountToggleStatus(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

// ---------- 赋角色 ----------
const roleOpen = ref(false);
const roleSaving = ref(false);
const roleTarget = ref<TableRow | null>(null);
const roleOptions = ref<MerchantRole[]>([]);
const selectedRoleIds = ref<number[]>([]);

async function openGrant(row: TableRow): Promise<void> {
  roleTarget.value = row;
  roleOpen.value = true;
  const [roles, owned] = await Promise.all([apiRoleList(), apiAccountRoles(row.id)]);
  roleOptions.value = roles;
  selectedRoleIds.value = owned.roleIds;
}

async function saveGrant(): Promise<void> {
  roleSaving.value = true;
  try {
    await apiRoleGrant(roleTarget.value!.id, selectedRoleIds.value);
    message.success(t('common.opSuccess'));
    roleOpen.value = false;
  } finally {
    roleSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input v-model:value="query.keyword" :placeholder="t('common.pleaseInput')" allow-clear style="width: 180px" @press-enter="search" />
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
      <template #title>{{ t('menu.account') }}</template>
      <template #extra>
        <a-button v-perm="'mch:account:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('account.addTitle') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'isOwner'">
            <a-tag v-if="record.isOwner" color="gold">{{ t('common.yes') }}</a-tag>
            <span v-else>{{ t('common.no') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'mch:account:edit'" type="link" size="small" :disabled="record.isOwner" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-perm="'mch:account:reset-pwd'" type="link" size="small" @click="openResetPwd(record)">{{ t('account.resetPwd') }}</a-button>
              <a-button v-if="!record.isOwner" v-perm="'mch:role:grant'" type="link" size="small" @click="openGrant(record)">{{ t('account.assignRole') }}</a-button>
              <a-popconfirm
                v-if="!record.isOwner"
                :title="record.status === 1 ? t('common.disable') + '?' : t('common.enable') + '?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'mch:account:status'" type="link" size="small">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('account.addTitle') : t('account.editTitle')"
      :confirm-loading="modalSaving"
      width="480px"
      @ok="saveAccount"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item :label="t('account.username')" required>
          <a-input v-model:value="form.username" :disabled="editingId !== 0" />
        </a-form-item>
        <a-form-item v-if="editingId === 0" :label="t('account.password')" required>
          <a-input-password v-model:value="form.password" :placeholder="t('account.pwdRule')" />
        </a-form-item>
        <a-form-item :label="t('account.realName')">
          <a-input v-model:value="form.realName" />
        </a-form-item>
        <a-form-item :label="t('account.phone')">
          <a-input v-model:value="form.mobile" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" :title="t('account.resetPwd')" :confirm-loading="pwdSaving" width="420px" @ok="doResetPwd">
      <a-form layout="vertical">
        <a-form-item :label="t('account.newPassword')" required>
          <a-input-password v-model:value="pwdValue" :placeholder="t('account.pwdRule')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 赋角色 -->
    <a-modal v-model:open="roleOpen" :title="`${t('account.assignRole')} - ${roleTarget?.username ?? ''}`" :confirm-loading="roleSaving" width="460px" @ok="saveGrant">
      <a-checkbox-group v-model:value="selectedRoleIds" style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px">
        <a-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id">{{ role.roleName }}</a-checkbox>
      </a-checkbox-group>
    </a-modal>
  </PageContainer>
</template>
