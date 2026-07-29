<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TreeSelectProps } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { apiMenuAdd, apiMenuDelete, apiMenuTree, apiMenuUpdate } from '@/api/system';
import type { MenuNode } from '@/api/types';
import { menuTitle } from '@/locales/menuI18n';

/** 菜单权限管理:树形表格 / 新增菜单与按钮 / 编辑 / 删除校验(有子级禁止) */
const { t } = useI18n();
const loading = ref(false);
const treeData = ref<MenuNode[]>([]);
const expandedRowKeys = ref<number[]>([]);

const columns = [
  { title: t('system.menu.name'), dataIndex: 'menu_name', width: 200 },
  { title: t('system.menu.nameEn'), dataIndex: 'menu_name_en', width: 170, ellipsis: true },
  { title: t('system.menu.i18nKey'), dataIndex: 'i18n_key', width: 180, ellipsis: true },
  { title: t('common.type'), dataIndex: 'menu_type', width: 90 },
  { title: t('system.menu.permKey'), dataIndex: 'perm_key', width: 200 },
  { title: t('system.menu.route'), dataIndex: 'route_path', width: 160 },
  { title: t('system.menu.component'), dataIndex: 'component', width: 200, ellipsis: true },
  { title: t('system.menu.icon'), dataIndex: 'icon', width: 150, ellipsis: true },
  { title: t('common.sort'), dataIndex: 'sort', width: 70 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('system.menu.cache'), dataIndex: 'is_cache', width: 100 },
  { title: t('common.action'), key: 'action', width: 200, fixed: 'right' as const },
];

const TYPE_MAP: Record<number, { text: string; color: string }> = {
  1: { text: t('system.menu.typeDir'), color: 'blue' },
  2: { text: t('system.menu.typePage'), color: 'green' },
  3: { text: t('system.menu.typeBtn'), color: 'orange' },
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    treeData.value = await apiMenuTree();
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
      label: menuTitle(node),
      children: node.children?.length ? toParentOptions(node.children) : undefined,
    }));
}

const parentOptions = ref<TreeSelectProps['treeData']>([]);

const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  parentId: 0,
  menuName: '',
  menuNameEn: '',
  i18nKey: '',
  menuType: 1,
  permKey: '',
  routePath: '',
  component: '',
  icon: '',
  sort: 0,
  status: 1,
  isCache: 1,
  remark: '',
});

function openCreate(parent?: MenuNode): void {
  editingId.value = 0;
  Object.assign(form, {
    parentId: parent?.id ?? 0,
    menuName: '',
    menuNameEn: '',
    i18nKey: '',
    menuType: parent ? (parent.menu_type === 2 ? 3 : 2) : 1,
    permKey: '',
    routePath: '',
    component: '',
    icon: '',
    sort: 0,
    status: 1,
    isCache: 1,
    remark: '',
  });
  parentOptions.value = [{ value: 0, label: t('system.menu.root') }, ...(toParentOptions(treeData.value) ?? [])];
  modalOpen.value = true;
}

function openEdit(row: MenuNode): void {
  editingId.value = row.id;
  Object.assign(form, {
    parentId: row.parent_id,
    menuName: row.menu_name,
    menuNameEn: row.menu_name_en ?? '',
    i18nKey: row.i18n_key ?? '',
    menuType: row.menu_type,
    permKey: row.perm_key,
    routePath: row.route_path,
    component: row.component,
    icon: row.icon,
    sort: row.sort,
    status: row.status,
    isCache: row.is_cache ?? 1,
    remark: (row as Record<string, any>).remark ?? '',
  });
  parentOptions.value = [{ value: 0, label: t('system.menu.root') }, ...(toParentOptions(treeData.value) ?? [])];
  modalOpen.value = true;
}

async function saveMenu(): Promise<void> {
  if (!form.menuName.trim()) {
    message.warning(t('system.menu.inputName'));
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
    message.success(editingId.value === 0 ? t('system.menu.createSuccess') : t('system.menu.updateSuccess'));
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

async function removeMenu(row: MenuNode): Promise<void> {
  await apiMenuDelete(row.id);
  message.success(t('system.menu.deleted'));
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('system.menu.title') }}</template>
      <template #extra>
        <a-space>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
          <a-button v-perm="'sys:menu:add'" type="primary" @click="openCreate()">
            <template #icon><PlusOutlined /></template>{{ t('system.menu.addRoot') }}
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
        :scroll="{ x: 1750 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'menu_type'">
            <a-tag :color="TYPE_MAP[record.menu_type]?.color">{{ TYPE_MAP[record.menu_type]?.text ?? record.menu_type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'perm_key'">
            <a-typography-text v-if="record.perm_key" code>{{ record.perm_key }}</a-typography-text>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="{ 1: { text: t('system.menu.show'), color: 'success' }, 2: { text: t('system.menu.hide'), color: 'default' } }" />
          </template>
          <template v-else-if="column.dataIndex === 'is_cache'">
            <StatusTag v-if="record.menu_type === 2" :value="record.is_cache" :map="{ 1: { text: t('system.menu.cacheOn'), color: 'success' }, 2: { text: t('system.menu.cacheOff'), color: 'default' } }" />
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
                {{ t('system.menu.addChild') }}
              </a-button>
              <a-button v-perm="'sys:menu:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm :title="t('system.menu.confirmDelete')" @confirm="removeMenu(record)">
                <a-button v-perm="'sys:menu:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? t('system.menu.add') : t('system.menu.edit')"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveMenu"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item :label="t('system.menu.parent')">
          <a-tree-select
            v-model:value="form.parentId"
            :tree-data="parentOptions"
            tree-default-expand-all
            show-search
            tree-node-filter-prop="label"
            :disabled="editingId !== 0"
          />
        </a-form-item>
        <a-form-item :label="t('common.type')" required>
          <a-radio-group v-model:value="form.menuType" :disabled="editingId !== 0">
            <a-radio :value="1">{{ t('system.menu.typeDir') }}</a-radio>
            <a-radio :value="2">{{ t('system.menu.typePage') }}</a-radio>
            <a-radio :value="3">{{ t('system.menu.typeBtn') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('common.name')" required>
          <a-input v-model:value="form.menuName" />
        </a-form-item>
        <a-form-item :label="t('system.menu.nameEn')">
          <a-input v-model:value="form.menuNameEn" :placeholder="t('system.menu.nameEnPlaceholder')" />
        </a-form-item>
        <a-form-item v-if="form.menuType !== 3" :label="t('system.menu.i18nKey')">
          <a-input v-model:value="form.i18nKey" :placeholder="t('system.menu.i18nKeyPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('system.menu.permKey')">
          <a-input v-model:value="form.permKey" :placeholder="t('system.menu.permKeyPlaceholder')" />
        </a-form-item>
        <template v-if="form.menuType !== 3">
          <a-form-item :label="t('system.menu.route')">
            <a-input v-model:value="form.routePath" :placeholder="t('system.menu.routePlaceholder')" />
          </a-form-item>
          <a-form-item v-if="form.menuType === 2" :label="t('system.menu.component')">
            <a-input v-model:value="form.component" :placeholder="t('system.menu.componentPlaceholder')" />
          </a-form-item>
          <a-form-item v-if="form.menuType === 1" :label="t('system.menu.icon')">
            <a-input v-model:value="form.icon" :placeholder="t('system.menu.iconPlaceholder')" />
          </a-form-item>
        </template>
        <a-form-item :label="t('common.sort')">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 120px" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">{{ t('system.menu.show') }}</a-radio>
            <a-radio :value="2">{{ t('system.menu.hide') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="form.menuType === 2" :label="t('system.menu.cache')" :extra="t('system.menu.cacheTip')">
          <a-radio-group v-model:value="form.isCache">
            <a-radio :value="1">{{ t('system.menu.cacheOn') }}</a-radio>
            <a-radio :value="2">{{ t('system.menu.cacheOff') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
