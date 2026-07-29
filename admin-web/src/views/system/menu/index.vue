<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TreeSelectProps } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { apiMenuAdd, apiMenuDelete, apiMenuTree, apiMenuUpdate } from '@/api/system';
import type { MenuNode } from '@/api/types';

/** 菜单权限管理:树形表格 / 新增菜单与按钮 / 编辑 / 删除校验(有子级禁止) */
const loading = ref(false);
const treeData = ref<MenuNode[]>([]);
const expandedRowKeys = ref<number[]>([]);

const columns = [
  { title: '菜单名称', dataIndex: 'menu_name', width: 220 },
  { title: '类型', dataIndex: 'menu_type', width: 90 },
  { title: '权限标识', dataIndex: 'perm_key', width: 200 },
  { title: '路由地址', dataIndex: 'route_path', width: 160 },
  { title: '组件路径', dataIndex: 'component', width: 200, ellipsis: true },
  { title: '图标', dataIndex: 'icon', width: 150, ellipsis: true },
  { title: '排序', dataIndex: 'sort', width: 70 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
];

const TYPE_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '目录', color: 'blue' },
  2: { text: '页面', color: 'green' },
  3: { text: '按钮', color: 'orange' },
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    treeData.value = await apiMenuTree();
    // 默认展开一级目录
    expandedRowKeys.value = treeData.value.map((node) => node.id);
  } finally {
    loading.value = false;
  }
}

/** 目录/页面节点转 TreeSelect(选择父级用,按钮不能作为父级) */
function toParentOptions(nodes: MenuNode[]): TreeSelectProps['treeData'] {
  return nodes
    .filter((node) => node.menu_type !== 3)
    .map((node) => ({
      value: node.id,
      label: node.menu_name,
      children: node.children?.length ? toParentOptions(node.children) : undefined,
    }));
}

const parentOptions = ref<TreeSelectProps['treeData']>([]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  parentId: 0,
  menuName: '',
  menuType: 1,
  permKey: '',
  routePath: '',
  component: '',
  icon: '',
  sort: 0,
  status: 1,
  remark: '',
});

function openCreate(parent?: MenuNode): void {
  editingId.value = 0;
  Object.assign(form, {
    parentId: parent?.id ?? 0,
    menuName: '',
    menuType: parent ? (parent.menu_type === 2 ? 3 : 2) : 1,
    permKey: '',
    routePath: '',
    component: '',
    icon: '',
    sort: 0,
    status: 1,
    remark: '',
  });
  parentOptions.value = [{ value: 0, label: '根(一级目录)' }, ...(toParentOptions(treeData.value) ?? [])];
  modalOpen.value = true;
}

function openEdit(row: MenuNode): void {
  editingId.value = row.id;
  Object.assign(form, {
    parentId: row.parent_id,
    menuName: row.menu_name,
    menuType: row.menu_type,
    permKey: row.perm_key,
    routePath: row.route_path,
    component: row.component,
    icon: row.icon,
    sort: row.sort,
    status: row.status,
    remark: (row as Record<string, any>).remark ?? '',
  });
  parentOptions.value = [{ value: 0, label: '根(一级目录)' }, ...(toParentOptions(treeData.value) ?? [])];
  modalOpen.value = true;
}

async function saveMenu(): Promise<void> {
  if (!form.menuName.trim()) {
    message.warning('请输入菜单名称');
    return;
  }
  modalSaving.value = true;
  try {
    const payload = { ...form, menuName: form.menuName.trim() };
    if (editingId.value === 0) {
      await apiMenuAdd(payload);
    } else {
      await apiMenuUpdate({ ...payload, id: editingId.value });
    }
    message.success(editingId.value === 0 ? '菜单创建成功' : '菜单更新成功');
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

async function removeMenu(row: MenuNode): Promise<void> {
  await apiMenuDelete(row.id);
  message.success('菜单已删除');
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>菜单权限树</template>
      <template #extra>
        <a-space>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
          <a-button v-perm="'sys:menu:add'" type="primary" @click="openCreate()">
            <template #icon><PlusOutlined /></template>新增一级目录
          </a-button>
        </a-space>
      </template>
      <a-table
        v-model:expanded-row-keys="expandedRowKeys"
        :columns="columns"
        :data-source="treeData"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'menu_type'">
            <a-tag :color="TYPE_MAP[record.menu_type]?.color">{{ TYPE_MAP[record.menu_type]?.text ?? record.menu_type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'perm_key'">
            <a-typography-text v-if="record.perm_key" code>{{ record.perm_key }}</a-typography-text>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="{ 1: { text: '显示', color: 'success' }, 2: { text: '隐藏', color: 'default' } }" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button
                v-if="record.menu_type !== 3"
                v-perm="'sys:menu:add'"
                type="link"
                size="small"
                @click="openCreate(record)"
              >
                新增子级
              </a-button>
              <a-button v-perm="'sys:menu:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除?存在子级时将被拒绝" @confirm="removeMenu(record)">
                <a-button v-perm="'sys:menu:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? '新增菜单/按钮' : '编辑菜单/按钮'"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveMenu"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item label="父级菜单">
          <a-tree-select
            v-model:value="form.parentId"
            :tree-data="parentOptions"
            tree-default-expand-all
            show-search
            tree-node-filter-prop="label"
            :disabled="editingId !== 0"
          />
        </a-form-item>
        <a-form-item label="类型" required>
          <a-radio-group v-model:value="form.menuType" :disabled="editingId !== 0">
            <a-radio :value="1">目录</a-radio>
            <a-radio :value="2">页面</a-radio>
            <a-radio :value="3">按钮</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model:value="form.menuName" />
        </a-form-item>
        <a-form-item label="权限标识">
          <a-input v-model:value="form.permKey" placeholder="如 sys:admin:list(全局唯一)" />
        </a-form-item>
        <template v-if="form.menuType !== 3">
          <a-form-item label="路由地址">
            <a-input v-model:value="form.routePath" placeholder="如 /system/admin" />
          </a-form-item>
          <a-form-item v-if="form.menuType === 2" label="组件路径">
            <a-input v-model:value="form.component" placeholder="如 system/admin/index(映射 src/views/)" />
          </a-form-item>
          <a-form-item v-if="form.menuType === 1" label="图标">
            <a-input v-model:value="form.icon" placeholder="@ant-design/icons-vue 组件名,如 SettingOutlined" />
          </a-form-item>
        </template>
        <a-form-item label="排序">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 120px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">显示</a-radio>
            <a-radio :value="2">隐藏</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
