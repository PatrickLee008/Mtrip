<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
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

const { loading, list, query, load, search, reset, pagination } = useTable(apiRoleList, {
  roleName: '',
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '角色名称', dataIndex: 'role_name', width: 160 },
  { title: '类型', dataIndex: 'role_type', width: 100 },
  { title: '站点', dataIndex: 'site_id', width: 90 },
  { title: '绑定管理员', dataIndex: 'admin_count', width: 100 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 300, fixed: 'right' as const },
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
    message.warning('请输入角色名称');
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value === 0) {
      await apiRoleAdd({ roleName: form.roleName.trim(), siteId: form.siteId, description: form.description });
    } else {
      await apiRoleUpdate({ id: editingId.value, roleName: form.roleName.trim(), description: form.description });
    }
    message.success(editingId.value === 0 ? '角色创建成功' : '角色更新成功');
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  await apiRoleToggleStatus(row.id);
  message.success(row.status === 1 ? '已禁用' : '已启用');
  void load();
}

async function removeRole(row: TableRow): Promise<void> {
  await apiRoleDelete(row.id);
  message.success('角色已删除');
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
    title: node.menu_type === 3 ? `${node.menu_name}(按钮)` : node.menu_name,
    children: node.children?.length ? toTreeNodes(node.children) : undefined,
  }));
}

/** 已授权 id 拆分为「全选节点」与「半选父节点」,避免回显时父节点误全选 */
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
    // 全选节点 + 半选父节点一并落库,保证父级菜单可见
    await apiRoleAssignPerms(permTarget.value!.id, [...checkedKeys.value, ...halfCheckedKeys.value]);
    message.success('权限分配成功');
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
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '登录账号', dataIndex: 'username' },
  { title: '姓名', dataIndex: 'real_name' },
  { title: '站点', dataIndex: 'site_id', width: 80 },
  { title: '状态', dataIndex: 'status', width: 80 },
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
        <a-form-item label="角色名称">
          <a-input v-model:value="query.roleName" placeholder="模糊搜索" allow-clear style="width: 160px" @press-enter="search" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 180px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 110px">
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>角色列表</template>
      <template #extra>
        <a-button v-perm="'sys:role:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增角色
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
            <a-tag :color="record.role_type === 1 ? 'blue' : 'cyan'">{{ record.role_type === 1 ? '平台角色' : '站点角色' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'site_id'">
            <a-tag v-if="record.site_id === 0" color="blue">全平台</a-tag>
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
              <a-button v-perm="'sys:role:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-perm="'sys:role:perm'" type="link" size="small" @click="openPerms(record)">分配权限</a-button>
              <a-popconfirm
                v-if="record.id !== 1"
                :title="record.status === 1 ? '禁用后该角色下管理员将失去对应权限,确认?' : '确认启用该角色?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'sys:role:edit'" type="link" size="small">
                  {{ record.status === 1 ? '禁用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm v-if="record.id !== 1" title="确认删除该角色?(仍有管理员绑定时将被拒绝)" @confirm="removeRole(record)">
                <a-button v-perm="'sys:role:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? '新增角色' : '编辑角色'"
      :confirm-loading="modalSaving"
      width="480px"
      @ok="saveRole"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item label="角色名称" required>
          <a-input v-model:value="form.roleName" />
        </a-form-item>
        <a-form-item v-if="isSuper && editingId === 0" label="所属站点">
          <SiteTreeSelect v-model:value="form.siteId" allow-all />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="form.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 分配权限 -->
    <a-drawer v-model:open="permOpen" :title="`分配权限 - ${permTarget?.role_name ?? ''}`" width="480">
      <a-spin :spinning="permLoading">
        <a-alert type="info" show-icon message="勾选菜单与按钮级权限,保存后立即生效" style="margin-bottom: 12px" />
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
          <a-button @click="permOpen = false">取消</a-button>
          <a-button type="primary" :loading="permSaving" @click="savePerms">保存</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 绑定管理员 -->
    <a-drawer v-model:open="adminOpen" :title="`绑定管理员 - ${adminTarget?.role_name ?? ''}`" width="560">
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
