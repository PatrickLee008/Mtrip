<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiMenuTree,
  apiRoleAdd,
  apiRoleAdmins,
  apiRoleAssignPerms,
  apiRoleDelete,
  apiRoleList,
  apiRolePerms,
  apiRoleToggleStatus,
  apiRoleUpdate,
} from '@/api/system';
import type { MenuNode } from '@/api/types';

/** 角色管理:CRUD / 权限分配(菜单树+按钮勾选) / 查看绑定管理员 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiRoleList, {
  roleName: '',
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('system.role.name'), dataIndex: 'role_name', width: 160 },
  { title: t('common.type'), dataIndex: 'role_type', width: 100 },
  { title: t('common.site'), dataIndex: 'site_id', width: 90 },
  { title: t('system.role.adminCount'), dataIndex: 'admin_count', width: 100 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.description'), dataIndex: 'description', ellipsis: true },
  { title: t('common.action'), key: 'action', width: 300, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({ roleName: '', siteId: 0, description: '' });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { roleName: '', siteId: 0, description: '' });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, { roleName: row.role_name, siteId: row.site_id, description: row.description });
  modalOpen.value = true;
}

async function saveRole(): Promise<void> {
  if (!form.roleName.trim()) {
    message.warning(t('system.role.inputName'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value === 0) {
      await apiRoleAdd({ roleName: form.roleName.trim(), siteId: form.siteId, description: form.description });
    } else {
      await apiRoleUpdate({ id: editingId.value, roleName: form.roleName.trim(), description: form.description });
    }
    message.success(editingId.value === 0 ? t('system.role.createSuccess') : t('system.role.updateSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  await apiRoleToggleStatus(row.id);
  message.success(row.status === 1 ? t('system.admin.disabled') : t('system.admin.enabled'));
  void load();
}

async function removeRole(row: TableRow): Promise<void> {
  await apiRoleDelete(row.id);
  message.success(t('system.role.deleted'));
  void load();
}

// ---------- 权限分配抽屉 ----------
const permOpen = ref(false);
const permSaving = ref(false);
const permLoading = ref(false);
const permTarget = ref<TableRow | null>(null);
const permTreeData = ref<DataNode[]>([]);
const checkedKeys = ref<number[]>([]);
const halfCheckedKeys = ref<number[]>([]);

function toTreeNodes(nodes: MenuNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: node.menu_type === 3 ? `${node.menu_name}(Button)` : node.menu_name,
    children: node.children?.length ? toTreeNodes(node.children) : undefined,
  }));
}

function splitChecked(nodes: MenuNode[], granted: Set<number>): { checked: number[]; half: number[] } {
  const checked: number[] = [];
  const half: number[] = [];
  const walk = (node: MenuNode): 'full' | 'half' | 'none' => {
    const self = granted.has(node.id);
    if (!node.children?.length) {
      if (self) checked.push(node.id);
      return self ? 'full' : 'none';
    }
    const states = node.children.map(walk);
    const allFull = states.every((s) => s === 'full');
    const anyOn = states.some((s) => s !== 'none');
    if (self && allFull) {
      checked.push(node.id);
      return 'full';
    }
    if (self || anyOn) {
      half.push(node.id);
      return 'half';
    }
    return 'none';
  };
  nodes.forEach(walk);
  return { checked, half };
}

async function openPerms(row: TableRow): Promise<void> {
  permTarget.value = row;
  permOpen.value = true;
  permLoading.value = true;
  try {
    const [tree, perms] = await Promise.all([apiMenuTree(), apiRolePerms(row.id)]);
    permTreeData.value = toTreeNodes(tree);
    const { checked, half } = splitChecked(tree, new Set(perms.menuIds));
    checkedKeys.value = checked;
    halfCheckedKeys.value = half;
  } finally {
    permLoading.value = false;
  }
}

function onPermCheck(_keys: unknown, info: { halfCheckedKeys?: number[] }): void {
  halfCheckedKeys.value = info.halfCheckedKeys ?? [];
}

async function savePerms(): Promise<void> {
  permSaving.value = true;
  try {
    await apiRoleAssignPerms(permTarget.value!.id, [...checkedKeys.value, ...halfCheckedKeys.value]);
    message.success(t('system.role.permAssigned'));
    permOpen.value = false;
    void load();
  } finally {
    permSaving.value = false;
  }
}

// ---------- 绑定管理员抽屉 ----------
const adminOpen = ref(false);
const adminLoading = ref(false);
const adminList = ref<TableRow[]>([]);
const adminTarget = ref<TableRow | null>(null);
const adminColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('system.admin.username'), dataIndex: 'username' },
  { title: t('user.realName'), dataIndex: 'real_name' },
  { title: t('common.site'), dataIndex: 'site_id', width: 80 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
];

async function openAdmins(row: TableRow): Promise<void> {
  adminTarget.value = row;
  adminOpen.value = true;
  adminLoading.value = true;
  try {
    adminList.value = await apiRoleAdmins(row.id);
  } finally {
    adminLoading.value = false;
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
        <a-form-item :label="t('system.role.name')">
          <a-input v-model:value="query.roleName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 160px" @press-enter="search" />
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
      <template #title>{{ t('system.role.title') }}</template>
      <template #extra>
        <a-button v-perm="'sys:role:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('system.role.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'role_type'">
            <a-tag :color="record.role_type === 1 ? 'blue' : 'cyan'">{{ record.role_type === 1 ? t('system.role.platformRole') : t('system.role.siteRole') }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'site_id'">
            <a-tag v-if="record.site_id === 0" color="blue">{{ t('app.allSites') }}</a-tag>
            <span v-else>{{ record.site_id }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'admin_count'">
            <a-button type="link" size="small" @click="openAdmins(record)">{{ record.admin_count }}</a-button>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'sys:role:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-perm="'sys:role:perm'" type="link" size="small" @click="openPerms(record)">{{ t('system.role.assignPerm') }}</a-button>
              <a-popconfirm
                v-if="record.id !== 1"
                :title="record.status === 1 ? t('system.role.confirmDisable') : t('system.role.confirmEnable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'sys:role:edit'" type="link" size="small">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm v-if="record.id !== 1" :title="t('system.role.confirmDelete')" @confirm="removeRole(record)">
                <a-button v-perm="'sys:role:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('system.role.add') : t('system.role.edit')"
      :confirm-loading="modalSaving"
      width="480px"
      @ok="saveRole"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item :label="t('system.role.name')" required>
          <a-input v-model:value="form.roleName" />
        </a-form-item>
        <a-form-item v-if="isSuper && editingId === 0" :label="t('common.site')">
          <SiteTreeSelect v-model:value="form.siteId" allow-all />
        </a-form-item>
        <a-form-item :label="t('common.description')">
          <a-textarea v-model:value="form.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 分配权限 -->
    <a-drawer v-model:open="permOpen" :title="t('system.role.permDrawerTitle', { name: permTarget?.role_name ?? '' })" width="480">
      <a-spin :spinning="permLoading">
        <a-alert type="info" show-icon :message="t('system.role.permTip')" style="margin-bottom: 12px" />
        <a-tree
          v-model:checked-keys="checkedKeys"
          :tree-data="permTreeData"
          checkable
          default-expand-all
          @check="onPermCheck"
        />
      </a-spin>
      <template #footer>
        <a-space>
          <a-button @click="permOpen = false">{{ t('common.cancel') }}</a-button>
          <a-button type="primary" :loading="permSaving" @click="savePerms">{{ t('common.save') }}</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 绑定管理员 -->
    <a-drawer v-model:open="adminOpen" :title="t('system.role.adminDrawerTitle', { name: adminTarget?.role_name ?? '' })" width="560">
      <a-table
        :columns="adminColumns"
        :data-source="adminList"
        :loading="adminLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
        </template>
      </a-table>
    </a-drawer>
  </PageContainer>
</template>
