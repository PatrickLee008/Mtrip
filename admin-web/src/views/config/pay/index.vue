<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CopyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiPayAdd,
  apiPayCopy,
  apiPayDelete,
  apiPayList,
  apiPayToggleStatus,
  apiPayUpdate,
} from '@/api/config';

/** 支付渠道:Stripe/PayPal 渠道配置(密钥掩码留空保留)+ 超管跨站点复制 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const CHANNEL_TEXT: Record<string, string> = { stripe: 'Stripe', paypal: 'PayPal' };

const { loading, list, query, load, search, reset, pagination } = useTable(apiPayList, {
  channelCode: undefined,
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '渠道', dataIndex: 'channel_code', width: 100 },
  { title: '渠道名称', dataIndex: 'channel_name', width: 150 },
  { title: '商户号', dataIndex: 'merchant_no', width: 140, ellipsis: true },
  { title: '费率(%)', dataIndex: 'fee_rate', width: 90 },
  { title: '支持币种', dataIndex: 'currencies', width: 160, ellipsis: true },
  { title: '分账', dataIndex: 'split_enabled', width: 70 },
  { title: '站点', dataIndex: 'site_name', width: 110 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 260, fixed: 'right' as const },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  channelCode: 'stripe',
  channelName: '',
  apiKey: '',
  merchantNo: '',
  webhookUrl: '',
  feeRate: 0,
  minAmount: 0,
  maxAmount: 0,
  currencies: [] as string[],
  splitEnabled: 0,
  remark: '',
  siteId: 0,
});

const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'AUD', 'CAD'].map((code) => ({
  value: code,
  label: code,
}));

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    channelCode: 'stripe',
    channelName: '',
    apiKey: '',
    merchantNo: '',
    webhookUrl: '',
    feeRate: 0,
    minAmount: 0,
    maxAmount: 0,
    currencies: [],
    splitEnabled: 0,
    remark: '',
    siteId: 0,
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    channelCode: row.channel_code ?? 'stripe',
    channelName: row.channel_name ?? '',
    // API 密钥掩码回显,留空表示保留原值
    apiKey: '',
    merchantNo: row.merchant_no ?? '',
    webhookUrl: row.webhook_url ?? '',
    feeRate: Number(row.fee_rate ?? 0),
    minAmount: Number(row.min_amount ?? 0),
    maxAmount: Number(row.max_amount ?? 0),
    currencies: String(row.currencies ?? '').split(',').filter(Boolean),
    splitEnabled: row.split_enabled ?? 0,
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function savePay(): Promise<void> {
  if (!form.channelName.trim()) {
    message.warning('请输入渠道名称');
    return;
  }
  modalSaving.value = true;
  try {
    const data = { ...form, currencies: form.currencies.map((code) => code.toUpperCase()) };
    if (editingId.value) {
      await apiPayUpdate({ id: editingId.value, ...data });
      message.success('支付渠道已更新');
    } else {
      await apiPayAdd(data);
      message.success('支付渠道已创建');
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiPayToggleStatus(row.id);
  message.success(result.status === 1 ? '渠道已启用' : '渠道已停用');
  await load();
}

async function removePay(row: TableRow): Promise<void> {
  // 后端校验:启用中的渠道需先停用才能删除
  await apiPayDelete(row.id);
  message.success('支付渠道已删除');
  await load();
}

// ---------- 复制到站点(仅超管) ----------
const copyOpen = ref(false);
const copySaving = ref(false);
const copySource = ref<TableRow | null>(null);
const copySiteIds = ref<number[]>([]);

function openCopy(row: TableRow): void {
  copySource.value = row;
  copySiteIds.value = [];
  copyOpen.value = true;
}

async function doCopy(): Promise<void> {
  if (!copySource.value || !copySiteIds.value.length) {
    message.warning('请至少选择一个目标站点');
    return;
  }
  copySaving.value = true;
  try {
    const result = await apiPayCopy(copySource.value.id, copySiteIds.value);
    message.success(`已复制到 ${result.copied.length} 个站点${result.skipped.length ? `,跳过 ${result.skipped.length} 个(已存在同渠道)` : ''}`);
    copyOpen.value = false;
    await load();
  } finally {
    copySaving.value = false;
  }
}

// 复制目标站点多选:临时单值输入(SiteTreeSelect 为单选组件),用列表累加
const copyPickId = ref(0);

function addCopySite(): void {
  const id = copyPickId.value;
  if (id > 0 && !copySiteIds.value.includes(id)) {
    copySiteIds.value = [...copySiteIds.value, id];
  }
  copyPickId.value = 0;
}

function removeCopySite(id: number): void {
  copySiteIds.value = copySiteIds.value.filter((item) => item !== id);
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="渠道">
          <a-select v-model:value="query.channelCode" allow-clear placeholder="全部" style="width: 130px">
            <a-select-option value="stripe">Stripe</a-select-option>
            <a-select-option value="paypal">PayPal</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">停用</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
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
      <template #title>支付渠道</template>
      <template #extra>
        <a-button v-perm="'config:pay:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增渠道
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
          <template v-if="column.dataIndex === 'channel_code'">
            <a-tag :color="record.channel_code === 'stripe' ? 'purple' : 'blue'">
              {{ CHANNEL_TEXT[record.channel_code] ?? record.channel_code }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'split_enabled'">
            {{ record.split_enabled === 1 ? '是' : '否' }}
          </template>
          <template v-else-if="column.dataIndex === 'site_name'">
            {{ record.site_id === 0 ? '全平台' : (record.site_name ?? record.site_id) }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:pay:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-if="isSuper" v-perm="'config:pay:add'" type="link" size="small" @click="openCopy(record)">
                <CopyOutlined />复制到站点
              </a-button>
              <a-tooltip title="联调阶段开放(模块08)">
                <a-button type="link" size="small" disabled>回调测试</a-button>
              </a-tooltip>
              <a-popconfirm
                :title="record.status === 1 ? '确认停用该渠道?停用后前台将无法使用该支付方式' : '确认启用该渠道?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:pay:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? '停用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm title="确认删除该渠道?启用中的渠道需先停用" @confirm="removePay(record)">
                <a-button v-perm="'config:pay:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑支付渠道' : '新增支付渠道'"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="savePay"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="渠道类型" required>
              <a-select v-model:value="form.channelCode" :disabled="!!editingId">
                <a-select-option value="stripe">Stripe</a-select-option>
                <a-select-option value="paypal">PayPal</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="渠道名称" required>
              <a-input v-model:value="form.channelName" placeholder="如:Stripe-欧洲区" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API 密钥">
              <a-input-password
                v-model:value="form.apiKey"
                :placeholder="editingId ? '留空保留原值' : ''"
                autocomplete="new-password"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="商户号">
              <a-input v-model:value="form.merchantNo" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="Webhook 地址">
              <a-input v-model:value="form.webhookUrl" placeholder="https://api.mtrip.com/pay/webhook/..." />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="费率(%)">
              <a-input-number v-model:value="form.feeRate" :min="0" :max="100" :step="0.01" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最小金额">
              <a-input-number v-model:value="form.minAmount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最大金额">
              <a-input-number v-model:value="form.maxAmount" :min="0" style="width: 100%" placeholder="0=不限" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="支持币种">
              <a-select v-model:value="form.currencies" mode="tags" :options="CURRENCY_OPTIONS" placeholder="ISO 4217 大写,如 EUR" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="开启分账">
              <a-radio-group v-model:value="form.splitEnabled">
                <a-radio :value="0">关闭</a-radio>
                <a-radio :value="1">开启</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="归属站点">
              <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 复制到站点(仅超管) -->
    <a-modal
      v-model:open="copyOpen"
      :title="`复制渠道「${copySource?.channel_name ?? ''}」到其他站点`"
      width="480px"
      :confirm-loading="copySaving"
      @ok="doCopy"
    >
      <a-alert
        message="将当前渠道配置(含密钥)复制到所选站点;目标站点已存在同类型渠道时自动跳过"
        type="info"
        show-icon
        style="margin: 12px 0 16px"
      />
      <div class="copy-picker">
        <SiteTreeSelect v-model:value="copyPickId" style="flex: 1" placeholder="选择目标站点" />
        <a-button type="primary" ghost @click="addCopySite">添加</a-button>
      </div>
      <div style="margin-top: 12px">
        <a-tag v-for="id in copySiteIds" :key="id" closable @close="removeCopySite(id)">站点 #{{ id }}</a-tag>
        <span v-if="!copySiteIds.length" style="color: var(--mtrip-text-aux)">尚未选择目标站点</span>
      </div>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.copy-picker {
  display: flex;
  gap: 8px;
}
</style>
