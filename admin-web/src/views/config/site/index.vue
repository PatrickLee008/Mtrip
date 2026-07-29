<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiSiteAdd,
  apiSiteConfigs,
  apiSiteDelete,
  apiSiteList,
  apiSiteSaveConfigs,
  apiSiteToggleStatus,
  apiSiteUpdate,
  type GroupedConfigs,
} from '@/api/config';

/** 站点管理:SaaS 多站点(国家/区域/城市)+ 站点差异化配置 */
const SITE_TYPE: Record<number, { text: string; color: string }> = {
  1: { text: '国家站', color: 'blue' },
  2: { text: '区域站', color: 'purple' },
  3: { text: '城市站', color: 'green' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiSiteList, {
  siteName: '',
  siteType: undefined,
  status: undefined,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '站点名称', dataIndex: 'site_name', width: 140 },
  { title: '类型', dataIndex: 'site_type', width: 90 },
  { title: '域名', dataIndex: 'site_domain', ellipsis: true },
  { title: '国家码', dataIndex: 'country_code', width: 80 },
  { title: '时区', dataIndex: 'timezone', width: 130 },
  { title: '货币', dataIndex: 'currency', width: 70 },
  { title: '语言', dataIndex: 'language', width: 90 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '排序', dataIndex: 'sort', width: 70 },
  { title: '操作', key: 'action_col', width: 240, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  parentId: 0,
  siteName: '',
  siteType: 3,
  siteDomain: '',
  countryCode: '',
  timezone: 'UTC',
  currency: 'EUR',
  language: 'en-US',
  contactName: '',
  contactEmail: '',
  sort: 0,
  remark: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    parentId: 0,
    siteName: '',
    siteType: 3,
    siteDomain: '',
    countryCode: '',
    timezone: 'UTC',
    currency: 'EUR',
    language: 'en-US',
    contactName: '',
    contactEmail: '',
    sort: 0,
    remark: '',
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    parentId: row.parent_id ?? 0,
    siteName: row.site_name ?? '',
    siteType: row.site_type ?? 3,
    siteDomain: row.site_domain ?? '',
    countryCode: row.country_code ?? '',
    timezone: row.timezone ?? 'UTC',
    currency: row.currency ?? 'EUR',
    language: row.language ?? 'en-US',
    contactName: row.contact_name ?? '',
    contactEmail: row.contact_email ?? '',
    sort: row.sort ?? 0,
    remark: row.remark ?? '',
  });
  modalOpen.value = true;
}

async function saveSite(): Promise<void> {
  if (!form.siteName.trim()) {
    message.warning('请输入站点名称');
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiSiteUpdate({ id: editingId.value, ...form });
      message.success('站点已更新');
    } else {
      await apiSiteAdd({ ...form });
      message.success('站点已创建');
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiSiteToggleStatus(row.id);
  message.success(result.status === 1 ? '站点已启用' : '站点已停用');
  await load();
}

async function removeSite(row: TableRow): Promise<void> {
  // 后端校验:有下级站点/有绑定管理员时拒绝删除
  await apiSiteDelete(row.id);
  message.success('站点已删除');
  await load();
}

// ---------- 差异化配置抽屉(local本地化/page页面/operate运营/push推送) ----------
const CFG_GROUPS = [
  { key: 'local', label: '本地化' },
  { key: 'page', label: '页面' },
  { key: 'operate', label: '运营' },
  { key: 'push', label: '推送' },
];

const cfgOpen = ref(false);
const cfgLoading = ref(false);
const cfgSaving = ref(false);
const cfgSite = ref<TableRow | null>(null);
const cfgGroup = ref('local');
/** 编辑中的配置行:{group,key,value,name} */
const cfgRows = ref<{ group: string; key: string; value: string; name: string }[]>([]);

async function openConfigs(row: TableRow): Promise<void> {
  cfgSite.value = row;
  cfgGroup.value = 'local';
  cfgOpen.value = true;
  cfgLoading.value = true;
  try {
    const grouped: GroupedConfigs = await apiSiteConfigs(row.id);
    cfgRows.value = Object.entries(grouped).flatMap(([group, rows]) =>
      rows.map((item) => ({
        group,
        key: String(item.config_key ?? ''),
        value: String(item.config_value ?? ''),
        name: String(item.config_name ?? ''),
      })),
    );
  } finally {
    cfgLoading.value = false;
  }
}

function addCfgRow(): void {
  cfgRows.value.push({ group: cfgGroup.value, key: '', value: '', name: '' });
}

function removeCfgRow(row: { group: string; key: string }): void {
  cfgRows.value = cfgRows.value.filter((item) => item !== row);
}

async function saveConfigs(): Promise<void> {
  if (!cfgSite.value) {
    return;
  }
  const rows = cfgRows.value.filter((item) => item.key.trim());
  if (rows.some((item) => !/^[a-z][a-z0-9_]*$/i.test(item.key.trim()))) {
    message.warning('配置键仅允许字母/数字/下划线,且以字母开头');
    return;
  }
  cfgSaving.value = true;
  try {
    const result = await apiSiteSaveConfigs(
      cfgSite.value.id,
      rows.map((item) => ({ group: item.group, key: item.key.trim(), value: item.value, name: item.name })),
    );
    message.success(`已保存 ${result.saved} 项站点配置`);
    cfgOpen.value = false;
  } finally {
    cfgSaving.value = false;
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
        <a-form-item label="站点名称">
          <a-input v-model:value="query.siteName" placeholder="模糊搜索" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.siteType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option :value="1">国家站</a-select-option>
            <a-select-option :value="2">区域站</a-select-option>
            <a-select-option :value="3">城市站</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">停用</a-select-option>
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
      <template #title>站点管理</template>
      <template #extra>
        <a-button v-perm="'config:site:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增站点
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'site_type'">
            <a-tag :color="SITE_TYPE[record.site_type]?.color">{{ SITE_TYPE[record.site_type]?.text ?? record.site_type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:site:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-perm="'config:site:edit'" type="link" size="small" @click="openConfigs(record)">
                <SettingOutlined />差异化配置
              </a-button>
              <a-popconfirm
                :title="record.status === 1 ? '确认停用该站点?停用后该站点将不可访问' : '确认启用该站点?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:site:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? '停用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm title="确认删除该站点?存在下级站点或绑定管理员时将无法删除" @confirm="removeSite(record)">
                <a-button v-perm="'config:site:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑站点' : '新增站点'"
      width="640px"
      :confirm-loading="modalSaving"
      @ok="saveSite"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-divider orientation="left" style="margin-top: 0">基础信息</a-divider>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="上级站点">
              <SiteTreeSelect v-model:value="form.parentId" allow-all placeholder="全球(根)" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="站点名称" required>
              <a-input v-model:value="form.siteName" placeholder="如:巴黎" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="站点类型" required>
              <a-select v-model:value="form.siteType">
                <a-select-option :value="1">国家站</a-select-option>
                <a-select-option :value="2">区域站</a-select-option>
                <a-select-option :value="3">城市站</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="站点域名">
              <a-input v-model:value="form.siteDomain" placeholder="如 paris.mtrip.com" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">本地化</a-divider>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="国家码">
              <a-input v-model:value="form.countryCode" placeholder="ISO 3166,如 FR" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="时区">
              <a-input v-model:value="form.timezone" placeholder="如 Europe/Paris" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="货币">
              <a-input v-model:value="form.currency" placeholder="ISO 4217,如 EUR" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="语言">
              <a-input v-model:value="form.language" placeholder="如 fr-FR" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">联系人与其他</a-divider>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="联系人">
              <a-input v-model:value="form.contactName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系邮箱">
              <a-input v-model:value="form.contactEmail" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="备注">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 差异化配置抽屉 -->
    <a-drawer
      v-model:open="cfgOpen"
      :title="`站点差异化配置 — ${cfgSite?.site_name ?? ''}`"
      width="680px"
      destroy-on-close
    >
      <a-spin :spinning="cfgLoading">
        <a-tabs v-model:active-key="cfgGroup">
          <a-tab-pane v-for="group in CFG_GROUPS" :key="group.key" :tab="group.label">
            <div
              v-for="row in cfgRows.filter((item) => item.group === group.key)"
              :key="cfgRows.indexOf(row)"
              class="cfg-row"
            >
              <a-input v-model:value="row.key" placeholder="配置键,如 vat_rate" style="width: 180px" />
              <a-input v-model:value="row.value" placeholder="配置值" style="flex: 1" />
              <a-input v-model:value="row.name" placeholder="名称说明" style="width: 160px" />
              <a-button type="text" danger size="small" @click="removeCfgRow(row)">删除</a-button>
            </div>
            <a-button type="dashed" block style="margin-top: 8px" @click="addCfgRow">
              <PlusOutlined />添加「{{ group.label }}」配置项
            </a-button>
          </a-tab-pane>
        </a-tabs>
      </a-spin>
      <template #footer>
        <a-space>
          <a-button @click="cfgOpen = false">取消</a-button>
          <a-button v-perm="'config:site:edit'" type="primary" :loading="cfgSaving" @click="saveConfigs">保存配置</a-button>
        </a-space>
      </template>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.cfg-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
</style>
