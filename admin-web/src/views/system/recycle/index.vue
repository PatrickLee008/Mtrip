<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiRecycleEmpty,
  apiRecycleList,
  apiRecyclePurge,
  apiRecycleRestore,
  apiRecycleTables,
  type RecycleTable,
} from '@/api/recycle';

/** 回收站:集中管理两库软删数据(恢复 / 彻底删除 / 一键清空) */
const { t, locale } = useI18n();

/** 名称列以外的元字段,渲染"名称/标识"列时排除 */
const META_FIELDS = new Set(['id', 'site_id', 'deleted_at', 'created_at']);

const tables = ref<RecycleTable[]>([]);
const activeKey = ref('');

const activeTable = computed(() => tables.value.find((item) => item.key === activeKey.value) ?? null);
const systemTables = computed(() => tables.value.filter((item) => item.group === 'system'));
const businessTables = computed(() => tables.value.filter((item) => item.group === 'business'));

function tableLabel(item: RecycleTable): string {
  return locale.value === 'zh-CN' ? item.label : item.labelEn;
}

const { loading, list, query, load, search, pagination } = useTable(apiRecycleList, {
  key: '',
  keyword: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 90 },
  { title: t('recycle.colName'), key: 'name_col', ellipsis: true },
  { title: t('recycle.colSite'), dataIndex: 'site_id', width: 90 },
  { title: t('recycle.colDeletedAt'), dataIndex: 'deleted_at', width: 180 },
  { title: t('recycle.colCreatedAt'), dataIndex: 'created_at', width: 180 },
  { title: t('common.action'), key: 'action_col', width: 200, fixed: 'right' as const },
]);

/** 拼接名称/标识列:排除元字段后的可读值 */
function displayName(row: TableRow): string {
  const parts = Object.entries(row)
    .filter(([field, value]) => !META_FIELDS.has(field) && value !== null && value !== '')
    .map(([, value]) => String(value));
  return parts.length > 0 ? parts.join(' / ') : '-';
}

async function loadTables(): Promise<void> {
  tables.value = await apiRecycleTables();
}

/** 菜单点击:key 转字符串后切换表 */
function onMenuClick(info: { key: string | number }): void {
  selectTable(String(info.key));
}

function selectTable(key: string): void {
  if (key === activeKey.value) {
    return;
  }
  activeKey.value = key;
  query.key = key;
  query.keyword = '';
  search();
}

/** 操作后同时刷新列表与左侧数量角标 */
async function refreshAll(): Promise<void> {
  await Promise.all([load(), loadTables()]);
}

async function restore(row: TableRow): Promise<void> {
  await apiRecycleRestore(activeKey.value, row.id);
  message.success(t('recycle.restored'));
  await refreshAll();
}

async function purge(row: TableRow): Promise<void> {
  await apiRecyclePurge(activeKey.value, row.id);
  message.success(t('recycle.purged'));
  await refreshAll();
}

function emptyAll(): void {
  const current = activeTable.value;
  if (!current) {
    return;
  }
  if (current.count <= 0) {
    message.info(t('recycle.emptyNoData'));
    return;
  }
  Modal.confirm({
    title: t('recycle.confirmEmptyTitle', { label: tableLabel(current) }),
    content: t('recycle.confirmEmptyContent', { count: current.count }),
    okType: 'danger',
    okText: t('recycle.empty'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      const result = await apiRecycleEmpty(current.key);
      message.success(t('recycle.emptied', { count: result.deleted }));
      await refreshAll();
    },
  });
}

onMounted(async () => {
  await loadTables();
  const first = tables.value[0];
  if (first) {
    selectTable(first.key);
  }
});
</script>

<template>
  <PageContainer>
    <div class="recycle-layout">
      <!-- 左侧:数据类型选择器(分组 + 数量角标) -->
      <a-card :bordered="false" class="mtrip-card-shadow recycle-side">
        <template #title>{{ t('recycle.selectTable') }}</template>
        <a-menu :selected-keys="[activeKey]" mode="inline" @click="onMenuClick">
          <a-menu-item-group :title="t('recycle.groupSystem')">
            <a-menu-item v-for="item in systemTables" :key="item.key">
              <span class="recycle-item">
                <span class="recycle-item-label">
                  {{ tableLabel(item) }}
                  <a-tag v-if="item.scope === 'global'" color="orange" style="margin-left: 4px">
                    {{ t('recycle.globalTag') }}
                  </a-tag>
                </span>
                <a-badge :count="item.count" :number-style="{ backgroundColor: item.count ? '#ff4d4f' : '#d9d9d9' }" show-zero />
              </span>
            </a-menu-item>
          </a-menu-item-group>
          <a-menu-item-group :title="t('recycle.groupBusiness')">
            <a-menu-item v-for="item in businessTables" :key="item.key">
              <span class="recycle-item">
                <span class="recycle-item-label">{{ tableLabel(item) }}</span>
                <a-badge :count="item.count" :number-style="{ backgroundColor: item.count ? '#ff4d4f' : '#d9d9d9' }" show-zero />
              </span>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </a-card>

      <!-- 右侧:软删数据列表 -->
      <a-card :bordered="false" class="mtrip-card-shadow recycle-main">
        <template #title>{{ activeTable ? tableLabel(activeTable) : t('recycle.title') }}</template>
        <template #extra>
          <a-button
            v-perm="'sys:recycle:empty'"
            danger
            :disabled="!activeTable || activeTable.count <= 0"
            @click="emptyAll"
          >
            <template #icon><DeleteOutlined /></template>{{ t('recycle.empty') }}
          </a-button>
        </template>

        <template v-if="activeTable">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item>
              <a-input
                v-model:value="query.keyword"
                :placeholder="t('recycle.keywordPlaceholder')"
                allow-clear
                style="width: 220px"
                @press-enter="search"
              />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button @click="refreshAll"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <a-table
            :columns="columns"
            :data-source="list"
            :loading="loading"
            :pagination="pagination"
            row-key="id"
            size="middle"
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name_col'">
                {{ displayName(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'site_id'">
                {{ record.site_id === undefined ? '-' : record.site_id }}
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-popconfirm :title="t('recycle.confirmRestore')" @confirm="restore(record)">
                    <a-button v-perm="'sys:recycle:restore'" type="link" size="small">
                      <UndoOutlined />{{ t('recycle.restore') }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm :title="t('recycle.confirmPurge')" ok-type="danger" @confirm="purge(record)">
                    <a-button v-perm="'sys:recycle:purge'" type="link" size="small" danger>
                      {{ t('recycle.purge') }}
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </template>
        <a-empty v-else :description="t('recycle.selectTableTip')" style="margin: 48px 0" />
      </a-card>
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
.recycle-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.recycle-side {
  width: 260px;
  flex-shrink: 0;

  :deep(.ant-card-body) {
    padding: 8px;
  }

  :deep(.ant-menu) {
    border-inline-end: none;
  }
}

.recycle-main {
  flex: 1;
  min-width: 0;
}

.recycle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.recycle-item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
