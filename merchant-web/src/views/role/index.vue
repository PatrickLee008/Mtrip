<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { PlusOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import {
  apiRoleAdd,
  apiRoleAssign,
  apiRoleDelete,
  apiRoleList,
  apiRoleMenuTree,
  apiRoleMenus,
  apiRoleUpdate,
  type MerchantRole,
} from '@/api/role';
import type { MenuNode } from '@/api/types';
import { menuTitle } from '@/locales/menuI18n';

/** 角色管理:CRUD / 菜单授权(本 account_type 可见菜单树) */
const { t } = useI18n();

const loading = ref(false);
const list = ref<MerchantRole[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await apiRoleList();
  } finally {
    loading.value = false;
  }
}

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('role.roleName'), dataIndex: 'roleName', width: 160 },
  { title: t('role.roleCode'), dataIndex: 'roleCode', width: 160 },
  { title: t('role.isBuiltin'), dataIndex: 'isBuiltin', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
  { title: t('common.operation'), key: 'action', width: 240, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({ roleName: '', roleCode: '', remark: '', status: 1 });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { roleName: '', roleCode: '', remark: '', status: 1 });
  modalOpen.value = true;
}

function openEdit(row: MerchantRole): void {
  editingId.value = row.id;
  Object.assign(form, { roleName: row.roleName, roleCode: row.roleCode, remark: row.remark, status: row.status });
  modalOpen.value = true;
}

async function saveRole(): Promise<void> {
  if (!form.roleName.trim()) {
    message.warning(t('role.roleName') + t('common.required'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value === 0) {
      await apiRoleAdd({ roleName: form.roleName.trim(), roleCode: form.roleCode.trim(), remark: form.remark });
    } else {
      await apiRoleUpdate({ id: editingId.value, roleName: form.roleName.trim(), remark: form.remark, status: form.status });
    }
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

async function removeRole(row: MerchantRole): Promise<void> {
  await apiRoleDelete(row.id);
  message.success(t('common.opSuccess'));
  void load();
}

// ---------- 菜单授权抽屉 ----------
const permOpen = ref(false);
const permSaving = ref(false);
const permLoading = ref(false);
const permTarget = ref<MerchantRole | null>(null);
const permTreeData = ref<DataNode[]>([]);
const checkedKeys = ref<number[]>([]);
const halfCheckedKeys = ref<number[]>([]);

function toTreeNodes(nodes: MenuNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: menuTitle(node),
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

async function openPerms(row: MerchantRole): Promise<void> {
  permTarget.value = row;
  permOpen.value = true;
  permLoading.value = true;
  try {
    const [tree, perms] = await Promise.all([apiRoleMenuTree(), apiRoleMenus(row.id)]);
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
    await apiRoleAssign(permTarget.value!.id, [...checkedKeys.value, ...halfCheckedKeys.value]);
    message.success(t('common.opSuccess'));
    permOpen.value = false;
  } finally {
    permSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('menu.role') }}</template>
      <template #extra>
        <a-button v-perm="'mch:role:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('role.addTitle') }}
        </a-button>
      </template>
      <a-alert type="info" show-icon :message="t('role.builtinTip')" style="margin-bottom: 12px" />
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'isBuiltin'">
            <a-tag v-if="record.isBuiltin" color="blue">{{ t('common.yes') }}</a-tag>
            <span v-else>{{ t('common.no') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'mch:role:assign'" type="link" size="small" @click="openPerms(record as MerchantRole)">{{ t('role.assignMenu') }}</a-button>
              <a-button v-perm="'mch:role:edit'" type="link" size="small" :disabled="record.isBuiltin" @click="openEdit(record as MerchantRole)">{{ t('common.edit') }}</a-button>
              <a-popconfirm v-if="!record.isBuiltin" :title="t('common.deleteConfirm')" @confirm="removeRole(record as MerchantRole)">
                <a-button v-perm="'mch:role:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('role.addTitle') : t('role.editTitle')"
      :confirm-loading="modalSaving"
      width="480px"
      @ok="saveRole"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item :label="t('role.roleName')" required>
          <a-input v-model:value="form.roleName" />
        </a-form-item>
        <a-form-item v-if="editingId === 0" :label="t('role.roleCode')" required>
          <a-input v-model:value="form.roleCode" />
        </a-form-item>
        <a-form-item v-if="editingId !== 0" :label="t('common.status')">
          <a-select v-model:value="form.status" style="width: 140px">
            <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
            <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 菜单授权 -->
    <a-drawer v-model:open="permOpen" :title="`${t('role.assignMenu')} - ${permTarget?.roleName ?? ''}`" width="480">
      <a-spin :spinning="permLoading">
        <a-alert type="info" show-icon :message="t('role.menuTree')" style="margin-bottom: 12px" />
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
  </PageContainer>
</template>
