<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiAccountAdd,
  apiAccountAssignProperties,
  apiAccountDelete,
  apiAccountList,
  apiAccountProperties,
  apiAccountPropertyOptions,
  apiAccountQuota,
  apiAccountResetPassword,
  apiAccountToggleStatus,
  apiAccountUpdate,
  type PropertyOption,
} from '@/api/account';
import { apiAccountRoles, apiRoleGrant, apiRoleList, type MerchantRole } from '@/api/role';
import { useUserStore } from '@/stores/user';

/** 子账号管理:列表筛选 / 新增编辑 / 重置密码 / 启停(主账号不可停用) / 赋角色 */
const { t } = useI18n();
const userStore = useUserStore();

const { loading, list, page, query, load, search, reset, pagination } = useTable(apiAccountList, {
  keyword: '',
  status: undefined,
});

const columns = computed(() => [
  { title: t('account.staffName'), dataIndex: 'realName', width: 240 },
  { title: t('account.phone'), dataIndex: 'mobile', width: 160 },
  { title: t('common.status'), dataIndex: 'status', width: 110 },
  { title: t('account.lastLoginAt'), dataIndex: 'lastLoginAt', width: 180 },
  { title: t('common.operation'), key: 'action', width: 280, fixed: 'right' as const },
]);

const staffPagination = computed(() => ({
  ...pagination.value,
  showSizeChanger: false,
  showQuickJumper: false,
  size: 'small' as const,
  showTotal: (total: number, range: [number, number]) =>
    t('account.showingStaff', { shown: range[1] - range[0] + 1, total }),
}));

// ---------- 子账号配额(平台配置,主账号不占额) ----------
const quota = reactive({ limit: 0, used: 0, remaining: 0 });

async function loadQuota(): Promise<void> {
  Object.assign(quota, await apiAccountQuota());
}

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({ username: '', password: '', realName: '', mobile: '' });
const createRoleIds = ref<number[]>([]);
const createRolesLoading = ref(false);

async function openCreate(): Promise<void> {
  if (quota.remaining <= 0) {
    message.warning(t('account.quotaFull', { limit: quota.limit }));
    return;
  }
  editingId.value = 0;
  Object.assign(form, { username: '', password: '', realName: '', mobile: '' });
  createRoleIds.value = [];
  createRolesLoading.value = true;
  try {
    if (canGrantRoles.value) roleOptions.value = (await apiRoleList()).filter((role) => role.status === 1);
    modalOpen.value = true;
  } finally {
    createRolesLoading.value = false;
  }
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
        roleIds: canGrantRoles.value ? createRoleIds.value : [],
      });
    } else {
      await apiAccountUpdate({ id: editingId.value, realName: form.realName, mobile: form.mobile });
    }
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    void load();
    void loadQuota();
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

async function deleteAccount(row: TableRow): Promise<void> {
  await apiAccountDelete(row.id);
  message.success(t('common.opSuccess'));
  if (list.value.length === 1 && page.value > 1) page.value -= 1;
  await Promise.all([load(), loadQuota()]);
}

// ---------- 赋角色 ----------
const roleOpen = ref(false);
const roleSaving = ref(false);
const roleTarget = ref<TableRow | null>(null);
const roleOptions = ref<MerchantRole[]>([]);
const selectedRoleIds = ref<number[]>([]);
const propertyOptions = ref<PropertyOption[]>([]);
const selectedPropertyIds = ref<number[]>([]);
const canGrantRoles = computed(() => userStore.hasPerm('mch:role:grant'));
const canAssignProperties = computed(() => userStore.hasPerm('mch:account:property-assign'));

async function openGrant(row: TableRow): Promise<void> {
  roleTarget.value = row;
  roleOpen.value = true;
  if (canGrantRoles.value) {
    const [roles, owned] = await Promise.all([apiRoleList(), apiAccountRoles(row.id)]);
    roleOptions.value = roles;
    selectedRoleIds.value = owned.roleIds;
  }
  if (canAssignProperties.value) {
    const [properties, assigned] = await Promise.all([apiAccountPropertyOptions(), apiAccountProperties(row.id)]);
    propertyOptions.value = properties;
    selectedPropertyIds.value = assigned.propertyIds;
  }
}

async function saveGrant(): Promise<void> {
  roleSaving.value = true;
  try {
    if (canGrantRoles.value) {
      await apiRoleGrant(roleTarget.value!.id, selectedRoleIds.value);
    }
    if (canAssignProperties.value) {
      await apiAccountAssignProperties(roleTarget.value!.id, selectedPropertyIds.value);
    }
    message.success(t('common.opSuccess'));
    roleOpen.value = false;
  } finally {
    roleSaving.value = false;
  }
}

onMounted(() => {
  void load();
  void loadQuota();
});
</script>

<template>
  <PageContainer class="staff-page">
    <header class="staff-heading">
      <div>
        <h1>{{ t('account.title') }}</h1>
        <p>{{ t('account.subtitle') }}</p>
      </div>
      <div class="staff-heading-actions">
        <span class="staff-quota">{{ t('account.quota', { used: quota.used, limit: quota.limit }) }}</span>
        <a-button v-perm="'mch:account:add'" type="primary" :loading="createRolesLoading" :disabled="quota.remaining <= 0" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('account.addTitle') }}
        </a-button>
      </div>
    </header>
    <div class="staff-filters">
      <a-form layout="inline" :colon="false">
        <a-form-item>
          <a-input v-model:value="query.keyword" :aria-label="t('common.keyword')" :placeholder="t('account.searchPlaceholder')" allow-clear class="staff-search" @press-enter="search">
            <template #prefix><SearchOutlined /></template>
          </a-input>
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
    </div>

    <section class="staff-list" :aria-label="t('account.title')">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="staffPagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 970 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'realName'">
            <div class="staff-identity">
              <a-avatar :size="32">{{ (record.realName || record.username).slice(0, 1).toUpperCase() }}</a-avatar>
              <div>
                <div class="staff-name">{{ record.realName || record.username }}<a-tag v-if="record.isOwner" class="owner-tag">{{ t('account.isOwner') }}</a-tag></div>
                <small>{{ record.username }}</small>
              </div>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'mobile' || column.dataIndex === 'lastLoginAt'">
            <span class="staff-secondary">{{ record[column.dataIndex] || '—' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag class="staff-status" :value="record.status" :map="{ 1: { text: t('status.enabled'), color: 'success' }, 2: { text: t('status.disabled'), color: 'error' } }" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4" wrap>
              <a-tooltip :title="t('common.edit')" :trigger="['hover', 'focus']"><a-button v-perm="'mch:account:edit'" type="text" size="small" :aria-label="t('common.edit')" :disabled="record.isOwner" @click="openEdit(record)"><EditOutlined /></a-button></a-tooltip>
              <a-tooltip :title="t('account.resetPwd')" :trigger="['hover', 'focus']"><a-button v-perm="'mch:account:reset-pwd'" type="text" size="small" :aria-label="t('account.resetPwd')" @click="openResetPwd(record)"><KeyOutlined /></a-button></a-tooltip>
              <a-tooltip v-if="!record.isOwner" :title="t('account.assignRole')" :trigger="['hover', 'focus']"><a-button v-perm="['mch:role:grant', 'mch:account:property-assign']" type="text" size="small" :aria-label="t('account.assignRole')" @click="openGrant(record)"><SafetyCertificateOutlined /></a-button></a-tooltip>
              <a-popconfirm
                v-if="!record.isOwner"
                :title="record.status === 1 ? t('common.disable') + '?' : t('common.enable') + '?'"
                @confirm="toggleStatus(record)"
              >
                <a-tooltip :title="record.status === 1 ? t('common.disable') : t('common.enable')" :trigger="['hover', 'focus']">
                  <a-button v-perm="'mch:account:status'" type="text" size="small" :aria-label="record.status === 1 ? t('common.disable') : t('common.enable')">
                    <StopOutlined v-if="record.status === 1" /><CheckCircleOutlined v-else />
                  </a-button>
                </a-tooltip>
              </a-popconfirm>
              <a-popconfirm v-if="!record.isOwner && record.id !== userStore.profile?.id" :title="t('account.deleteConfirm', { name: record.realName || record.username })" :ok-text="t('common.delete')" :cancel-text="t('common.cancel')" @confirm="deleteAccount(record)">
                <a-tooltip :title="t('account.deleteStaff')" :trigger="['hover', 'focus']"><a-button v-perm="'mch:account:delete'" danger type="text" size="small" :aria-label="t('account.deleteStaff')"><DeleteOutlined /></a-button></a-tooltip>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('account.addTitle') : t('account.editTitle')"
      :confirm-loading="modalSaving"
      :ok-text="editingId === 0 ? t('account.createStaff') : t('common.save')"
      :cancel-text="t('common.cancel')"
      class="staff-modal"
      width="520px"
      centered
      @ok="saveAccount"
    >
      <a-form :model="form" layout="vertical" class="staff-form">
        <a-form-item name="username" :label="t('account.username')" required>
          <a-input v-model:value="form.username" :placeholder="t('account.usernamePlaceholder')" :disabled="editingId !== 0" autocomplete="off" />
        </a-form-item>
        <a-form-item v-if="editingId === 0" name="password" :label="t('account.password')" required>
          <a-input-password v-model:value="form.password" :placeholder="t('account.pwdRule')" autocomplete="new-password" />
        </a-form-item>
        <a-form-item name="realName" :label="t('account.staffName')">
          <a-input v-model:value="form.realName" :placeholder="t('account.namePlaceholder')" />
        </a-form-item>
        <a-form-item name="mobile" :label="t('account.phone')">
          <a-input v-model:value="form.mobile" :placeholder="t('account.phonePlaceholder')" />
        </a-form-item>
        <a-form-item v-if="editingId === 0 && canGrantRoles" :label="t('account.assignRole')">
          <a-checkbox-group v-model:value="createRoleIds" class="staff-role-options">
            <a-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id" class="staff-role-option" :class="{ selected: createRoleIds.includes(role.id) }">
              <strong>{{ role.roleName }}</strong><small v-if="role.remark">{{ role.remark }}</small>
            </a-checkbox>
          </a-checkbox-group>
          <a-empty v-if="roleOptions.length === 0" :description="t('account.noRoles')" :image="null" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" class="staff-modal" :title="t('account.resetPwd')" :confirm-loading="pwdSaving" width="520px" centered @ok="doResetPwd">
      <a-form layout="vertical" class="staff-form">
        <a-form-item :label="t('account.newPassword')" required>
          <a-input-password v-model:value="pwdValue" :placeholder="t('account.pwdRule')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 赋角色 -->
    <a-modal v-model:open="roleOpen" class="staff-modal" :title="`${t('account.assignRole')} - ${roleTarget?.username ?? ''}`" :confirm-loading="roleSaving" width="520px" centered @ok="saveGrant">
      <a-form layout="vertical" class="staff-form">
        <a-form-item v-if="canGrantRoles" :label="t('account.assignRole')">
          <a-checkbox-group v-model:value="selectedRoleIds" class="staff-role-options">
            <a-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id" class="staff-role-option" :class="{ selected: selectedRoleIds.includes(role.id) }">
              <strong>{{ role.roleName }}</strong><small v-if="role.remark">{{ role.remark }}</small>
            </a-checkbox>
          </a-checkbox-group>
        </a-form-item>
        <a-divider v-if="canGrantRoles && canAssignProperties" />
        <a-form-item v-if="canAssignProperties" v-perm="'mch:account:property-assign'" :label="t('account.assignProperties')">
          <a-select v-model:value="selectedPropertyIds" mode="multiple" style="width: 100%" :placeholder="t('account.selectProperties')">
            <a-select-option v-for="property in propertyOptions" :key="property.id" :value="property.id">
              {{ property.store_name }} · {{ property.merchant_name }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.staff-page :deep(.page-body) { background: #f7f8fa; }
.staff-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 8px 0 24px; }
.staff-heading h1 { margin: 0 0 6px; color: #1e1e2d; font-size: 24px; font-weight: 700; letter-spacing: -.4px; }
.staff-heading p { max-width: 550px; margin: 0; color: #8b8c96; line-height: 22px; }
.staff-heading-actions { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.staff-heading-actions :deep(.ant-btn) { height: 40px; }
.staff-quota { color: #8b8c96; font-size: 12px; }
.staff-filters { margin-bottom: 16px; }
.staff-filters :deep(.ant-input-affix-wrapper), .staff-filters :deep(.ant-select-selector) { background: #fff !important; }
.staff-search { width: 280px; }
.staff-search :deep(.ant-input) { min-height: 0 !important; border: 0 !important; background: transparent !important; }
.staff-search :deep(.ant-input-prefix) { color: #8b8c96; margin-right: 8px; }
.staff-list { overflow: hidden; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
.staff-list :deep(.ant-table-wrapper) { border: 0 !important; border-radius: 0 !important; }
.staff-list :deep(.ant-table) { border: 0; border-radius: 0; }
.staff-list :deep(.ant-table-thead > tr > th) { height: 44px !important; padding: 12px 22px !important; background: #f8f9fb !important; color: #8b8c96 !important; font-size: 12px !important; font-weight: 600; text-transform: none; }
.staff-list :deep(.ant-table-thead > tr > th::before) { display: none; }
.staff-list :deep(.ant-table-tbody > tr.ant-table-row > td) { padding: 16px 22px !important; border-bottom-color: #edf0f4; }
.staff-identity { display: flex; align-items: center; gap: 12px; }
.staff-identity :deep(.ant-avatar) { flex-shrink: 0; background: #e2e8f0; color: #1e1e2d; font-size: 12px; }
.staff-name { display: flex; align-items: center; gap: 8px; color: #1e1e2d; font-weight: 600; }
.staff-identity small, .staff-secondary { color: #8b8c96; font-size: 12px; }
.staff-identity small { display: block; margin-top: 3px; }
.owner-tag { margin: 0; border: 0; border-radius: 5px; background: #f0f3ff; color: #4169ed; font-size: 11px; }
.staff-status { border: 0; border-radius: 5px; padding: 3px 8px; }
.staff-list :deep(.ant-pagination) { margin: 0; min-height: 52px; padding: 12px 16px; align-items: center; border-top: 1px solid #edf0f4; }
.staff-list :deep(.ant-pagination-total-text) { margin-right: auto; color: #7b8495; font-size: 11px; }
.staff-list :deep(.ant-pagination-item), .staff-list :deep(.ant-pagination-item-link) { min-width: 24px; height: 24px; line-height: 24px; border-radius: 5px; }
.staff-page :deep(.ant-btn-primary:not(:disabled)), :global(.staff-modal .ant-btn-primary:not(:disabled)) { border-color: #4169ed !important; background: #4169ed !important; color: #fff !important; }
.staff-page :deep(.ant-btn-primary:disabled), :global(.staff-modal .ant-btn-primary:disabled) { border-color: #e2e8f0 !important; background: #e2e8f0 !important; color: #64748b !important; }
:global(.staff-modal .ant-modal-content) { overflow: hidden; padding: 0; border-radius: 16px; }
:global(.staff-modal .ant-modal-header) { margin: 0; padding: 24px; border-bottom: 1px solid #e2e8f0; }
:global(.staff-modal .ant-modal-title) { color: #1e1e2d; font-size: 20px; font-weight: 700; }
:global(.staff-modal .ant-modal-close) { top: 22px; right: 20px; }
:global(.staff-modal .ant-modal-body) { max-height: calc(100dvh - 220px); overflow-y: auto; padding: 24px; }
:global(.staff-modal .ant-modal-footer) { margin: 0; padding: 20px 24px; border-top: 1px solid #e2e8f0; }
:global(.staff-modal .ant-modal-footer .ant-btn) { height: 40px; }
.staff-form :deep(.ant-form-item) { margin-bottom: 20px; }
.staff-form :deep(.ant-form-item:last-child) { margin-bottom: 0; }
.staff-form :deep(.ant-form-item-label > label) { color: #1e1e2d; font-size: 14px; font-weight: 600; letter-spacing: 0; }
.staff-form :deep(.ant-input), .staff-form :deep(.ant-input-affix-wrapper), .staff-form :deep(.ant-select-selector) { min-height: 40px !important; background: #fff !important; }
.staff-form :deep(.ant-input-affix-wrapper > .ant-input) { min-height: 0 !important; border: 0 !important; border-radius: 0 !important; }
.staff-role-options { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.staff-role-option { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; }
.staff-role-option.selected { border-color: #4169ed; background: #f7f8ff; box-shadow: inset 0 0 0 1px #4169ed; }
.staff-role-option strong { display: block; font-size: 14px; font-weight: 600; }
.staff-role-option small { display: block; margin-top: 6px; color: #8b8c96; line-height: 20px; }
@media (max-width: 900px) { .staff-heading { align-items: flex-start; flex-direction: column; gap: 16px; } .staff-heading-actions { flex-wrap: wrap; } }
@media (max-width: 600px) { .staff-search { width: 100%; } .staff-filters :deep(.ant-form-item:first-child) { flex: 1 1 100%; margin-right: 0; } .staff-list :deep(.ant-pagination) { flex-wrap: wrap; row-gap: 8px; } .staff-heading h1 { font-size: 22px; } }
</style>
