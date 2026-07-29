<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CopyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

const CHANNEL_TEXT = computed<Record<string, string>>(() => ({
  stripe: t('config.pay.typeStripe'),
  paypal: t('config.pay.typePaypal'),
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiPayList, {
  channelCode: undefined,
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.pay.channelType'), dataIndex: 'channel_code', width: 100 },
  { title: t('config.pay.channelName'), dataIndex: 'channel_name', width: 150 },
  { title: t('common.code'), dataIndex: 'merchant_no', width: 140, ellipsis: true },
  { title: t('config.pay.feeRate'), dataIndex: 'fee_rate', width: 90 },
  { title: t('config.pay.currency'), dataIndex: 'currencies', width: 160, ellipsis: true },
  { title: t('config.pay.splitAccount'), dataIndex: 'split_enabled', width: 70 },
  { title: t('common.site'), dataIndex: 'site_name', width: 110 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 260, fixed: 'right' as const },
]);

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
    message.warning(t('common.pleaseInput'));
    return;
  }
  modalSaving.value = true;
  try {
    const data = { ...form, currencies: form.currencies.map((code) => code.toUpperCase()) };
    if (editingId.value) {
      await apiPayUpdate({ id: editingId.value, ...data });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiPayAdd(data);
      message.success(t('tip.saveSuccess'));
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiPayToggleStatus(row.id);
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await load();
}

async function removePay(row: TableRow): Promise<void> {
  // 后端校验:启用中的渠道需先停用才能删除
  await apiPayDelete(row.id);
  message.success(t('tip.deleteSuccess'));
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
    message.warning(t('common.pleaseSelect'));
    return;
  }
  copySaving.value = true;
  try {
    const result = await apiPayCopy(copySource.value.id, copySiteIds.value);
    message.success(t('tip.saveSuccess') + ` (${result.copied.length})`);
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
        <a-form-item :label="t('config.pay.channelType')">
          <a-select v-model:value="query.channelCode" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option value="stripe">Stripe</a-select-option>
            <a-select-option value="paypal">PayPal</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
            <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
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
      <template #title>{{ t('config.pay.title') }}</template>
      <template #extra>
        <a-button v-perm="'config:pay:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('config.pay.actions.add') }}
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
            {{ record.split_enabled === 1 ? t('common.yes') : t('common.no') }}
          </template>
          <template v-else-if="column.dataIndex === 'site_name'">
            {{ record.site_id === 0 ? t('app.allSites') : (record.site_name ?? record.site_id) }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:pay:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-if="isSuper" v-perm="'config:pay:add'" type="link" size="small" @click="openCopy(record)">
                <CopyOutlined />{{ t('config.client.copy') }}
              </a-button>
              <a-tooltip :title="t('tip.comingSoon')">
                <a-button type="link" size="small" disabled>{{ t('config.pay.actions.test') }}</a-button>
              </a-tooltip>
              <a-popconfirm
                :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:pay:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('tip.confirmDelete')" @confirm="removePay(record)">
                <a-button v-perm="'config:pay:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') + ' ' + t('config.pay.title') : t('config.pay.actions.add')"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="savePay"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.pay.channelType')" required>
              <a-select v-model:value="form.channelCode" :disabled="!!editingId">
                <a-select-option value="stripe">Stripe</a-select-option>
                <a-select-option value="paypal">PayPal</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.pay.channelName')" required>
              <a-input v-model:value="form.channelName" :placeholder="t('config.pay.channelNamePlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.pay.apiKey')">
              <a-input-password
                v-model:value="form.apiKey"
                :placeholder="editingId ? t('common.optional') : ''"
                autocomplete="new-password"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.code')">
              <a-input v-model:value="form.merchantNo" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.pay.webhookUrl')">
              <a-input v-model:value="form.webhookUrl" :placeholder="t('config.pay.webhookUrlPlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="t('config.pay.feeRate')">
              <a-input-number v-model:value="form.feeRate" :min="0" :max="100" :step="0.01" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="t('config.pay.minAmount')">
              <a-input-number v-model:value="form.minAmount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="t('config.pay.maxAmount')">
              <a-input-number v-model:value="form.maxAmount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.pay.currency')">
              <a-select v-model:value="form.currencies" mode="tags" :options="CURRENCY_OPTIONS" :placeholder="t('config.pay.currencyPlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.pay.splitAccount')">
              <a-radio-group v-model:value="form.splitEnabled">
                <a-radio :value="0">{{ t('common.disable') }}</a-radio>
                <a-radio :value="1">{{ t('common.enable') }}</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.site')">
              <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.remark')">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 复制到站点(仅超管) -->
    <a-modal
      v-model:open="copyOpen"
      :title="t('config.client.copy')"
      width="480px"
      :confirm-loading="copySaving"
      @ok="doCopy"
    >
      <a-alert
        :message="t('tip.comingSoon')"
        type="info"
        show-icon
        style="margin: 12px 0 16px"
      />
      <div class="copy-picker">
        <SiteTreeSelect v-model:value="copyPickId" style="flex: 1" :placeholder="t('common.pleaseSelect')" />
        <a-button type="primary" ghost @click="addCopySite">{{ t('common.add') }}</a-button>
      </div>
      <div style="margin-top: 12px">
        <a-tag v-for="id in copySiteIds" :key="id" closable @close="removeCopySite(id)">{{ t('common.site') }} #{{ id }}</a-tag>
        <span v-if="!copySiteIds.length" style="color: var(--mtrip-text-aux)">{{ t('common.none') }}</span>
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
