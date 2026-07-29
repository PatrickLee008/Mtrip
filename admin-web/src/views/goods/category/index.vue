<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiCategoryList, apiCategorySave, apiCategoryDelete } from '@/api/goods';

/** 商品分类管理:两级树,酒店/门票分开维护;删除须无子分类且无关联商品 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const goodsType = ref(1);
const loading = ref(false);
const tree = ref<TableRow[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    tree.value = await apiCategoryList({ goodsType: goodsType.value });
  } finally {
    loading.value = false;
  }
}

const columns = [
  { title: t('goods.category.name'), dataIndex: 'category_name' },
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('goods.category.icon'), dataIndex: 'icon', width: 90 },
  { title: t('common.sort'), dataIndex: 'sort', width: 80 },
  { title: t('common.status'), dataIndex: 'status', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 200 },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  categoryName: '',
  parentId: 0,
  icon: '',
  sort: 0,
  status: 1,
  siteId: 0,
});

function openCreate(parentId = 0): void {
  editingId.value = 0;
  Object.assign(form, { categoryName: '', parentId, icon: '', sort: 0, status: 1, siteId: 0 });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    categoryName: row.category_name ?? '',
    parentId: row.parent_id ?? 0,
    icon: row.icon ?? '',
    sort: row.sort ?? 0,
    status: row.status ?? 1,
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveCategory(): Promise<void> {
  if (!form.categoryName.trim()) {
    message.warning(t('goods.category.inputName'));
    return;
  }
  if (!editingId.value && isSuper && !form.siteId) {
    message.warning(t('goods.category.selectSite'));
    return;
  }
  modalSaving.value = true;
  try {
    await apiCategorySave({
      id: editingId.value || undefined,
      goodsType: goodsType.value,
      ...form,
    });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function removeCategory(row: TableRow): Promise<void> {
  await apiCategoryDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>
        <a-radio-group v-model:value="goodsType" button-style="solid" @change="load">
          <a-radio-button :value="1">{{ t('goods.category.hotel') }}</a-radio-button>
          <a-radio-button :value="2">{{ t('goods.category.ticket') }}</a-radio-button>
        </a-radio-group>
      </template>
      <template #extra>
        <a-space>
          <a-button v-perm="'goods:category:add'" type="primary" @click="openCreate(0)">
            <template #icon><PlusOutlined /></template>{{ t('goods.category.addRoot') }}
          </a-button>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
        </a-space>
      </template>
      <a-table
        :columns="columns"
        :data-source="tree"
        :loading="loading"
        row-key="id"
        size="middle"
        :pagination="false"
        :expand-row-by-click="false"
        default-expand-all-rows
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'icon'">
            <a-image v-if="record.icon" :src="record.icon" :width="28" :height="28" />
            <span v-else>-</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('status.enabled') : t('status.disabled') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button
                v-if="record.parent_id === 0"
                v-perm="'goods:category:add'"
                type="link"
                size="small"
                @click="openCreate(record.id)"
              >{{ t('goods.category.addChild') }}</a-button>
              <a-button v-perm="'goods:category:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm
                :title="t('goods.category.confirmDelete')"
                :ok-button-props="{ danger: true }"
                @confirm="removeCategory(record)"
              >
                <a-button v-perm="'goods:category:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑分类 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('goods.category.editTitle') : form.parentId ? t('goods.category.addChildTitle') : t('goods.category.addRootTitle')"
      width="480px"
      :confirm-loading="modalSaving"
      @ok="saveCategory"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('goods.category.name')" required>
          <a-input v-model:value="form.categoryName" :maxlength="50" />
        </a-form-item>
        <a-form-item v-if="isSuper && !editingId" :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="form.siteId" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.category.parent')">
          <a-select v-model:value="form.parentId">
            <a-select-option :value="0">{{ t('goods.category.noParent') }}</a-select-option>
            <a-select-option v-for="root in tree" :key="root.id" :value="root.id" :disabled="root.id === editingId">
              {{ root.category_name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('goods.category.icon')">
          <a-input v-model:value="form.icon" :placeholder="t('goods.category.iconPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('common.sort')">
          <a-input-number v-model:value="form.sort" :min="0" :max="9999" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">{{ t('status.enabled') }}</a-radio>
            <a-radio :value="2">{{ t('status.disabled') }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
