<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { useUserStore } from '@/stores/user';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiMerchantDetail, apiMerchantStatusChange, apiMerchantStatusHistory, type MerchantStatusAction } from '@/api/merchant';

const props = defineProps<{ merchant: TableRow }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const userStore = useUserStore();
const isSuper = computed(() => userStore.profile?.isSuper === true);
const open = ref(false);
const loading = ref(false);
const saving = ref(false);
const action = ref<MerchantStatusAction>('suspend');
const current = ref<TableRow | null>(null);
const form = reactive({ note: '', evidence: '', until: undefined as Dayjs | undefined });
let retryPayload = '';
let requestId = '';
const title = computed(() => t(`merchantStatus.${action.value}`));
const historyOpen = ref(false);
const history = useTable((params) => apiMerchantStatusHistory({ ...params, id: props.merchant.id }), {});
const historyColumns = computed(() => [
  { title: t('merchantStatus.action'), dataIndex: 'action', width: 130 },
  { title: t('merchantStatus.transition'), key: 'transition', width: 180 },
  { title: t('merchantStatus.note'), dataIndex: 'note' },
  { title: t('merchantStatus.actor'), dataIndex: 'actor_name', width: 120 },
  { title: t('merchantStatus.time'), dataIndex: 'created_at', width: 180 },
]);

async function show(next: MerchantStatusAction): Promise<void> {
  action.value = next;
  open.value = true;
  loading.value = true;
  current.value = null;
  Object.assign(form, { note: '', evidence: '', until: undefined });
  retryPayload = '';
  try {
    current.value = (await apiMerchantDetail(props.merchant.id)).merchant;
  } finally {
    loading.value = false;
  }
}

function confirm(): void {
  if (!current.value || saving.value) return;
  if (!form.note.trim() || (form.until && (!form.until.isValid() || !form.until.isAfter(dayjs())))) {
    message.warning(t('merchantStatus.invalid'));
    return;
  }
  const payload = {
    id: current.value.id,
    expectedVersion: Number(current.value.status_version),
    note: form.note.trim(),
    evidence: form.evidence.trim(),
    suspendedUntil: form.until?.toISOString(),
  };
  const key = JSON.stringify([action.value, payload]);
  if (key !== retryPayload) {
    requestId = crypto.randomUUID();
    retryPayload = key;
  }
  Modal.confirm({
    title: `${title.value}: ${current.value.merchant_name}`,
    content: t(action.value === 'unblacklist' ? 'merchantStatus.unblacklistWarning' : 'merchantStatus.confirm'),
    okText: t('common.confirm'),
    async onOk() {
      saving.value = true;
      try {
        await apiMerchantStatusChange(action.value, { ...payload, requestId });
        message.success(t('tip.saveSuccess'));
        open.value = false;
        emit('changed');
      } finally {
        saving.value = false;
      }
    },
  });
}

function showHistory(): void {
  historyOpen.value = true;
  void history.search();
}
function localTime(value: string | null): string {
  return value ? dayjs(`${value.replace(' ', 'T')}Z`).format('YYYY-MM-DD HH:mm:ss') : '—';
}
</script>

<template>
  <a-space :size="0" wrap>
    <a-button v-if="merchant.status === 3 && !merchant.is_blacklisted" v-perm="'merchant:status:suspend'" type="link" size="small" danger @click="show('suspend')">{{ t('merchantStatus.suspend') }}</a-button>
    <a-button v-if="merchant.status === 4 && !merchant.is_blacklisted && !Number(merchant.reactivation_requires_super)" v-perm="'merchant:status:activate'" type="link" size="small" @click="show('activate')">{{ t('merchantStatus.activate') }}</a-button>
    <a-button v-if="isSuper && merchant.status === 4 && !merchant.is_blacklisted && Number(merchant.reactivation_requires_super)" v-perm="'merchant:status:reactivate'" type="link" size="small" @click="show('reactivate')">{{ t('merchantStatus.reactivate') }}</a-button>
    <a-button v-if="isSuper && [3, 4].includes(merchant.status) && !merchant.is_blacklisted" v-perm="'merchant:status:blacklist'" type="link" size="small" danger @click="show('blacklist')">{{ t('merchantStatus.blacklist') }}</a-button>
    <a-button v-if="isSuper && merchant.is_blacklisted" v-perm="'merchant:status:unblacklist'" type="link" size="small" @click="show('unblacklist')">{{ t('merchantStatus.unblacklist') }}</a-button>
    <a-button v-perm="'merchant:status:history'" type="link" size="small" @click="showHistory">{{ t('merchantStatus.history') }}</a-button>
  </a-space>
  <a-modal v-model:open="open" :title="title" :confirm-loading="saving" :ok-button-props="{ disabled: loading || !current }" :closable="!saving" :mask-closable="false" @ok="confirm">
    <a-spin :spinning="loading">
      <a-alert :message="t('merchantStatus.scope')" type="info" show-icon style="margin-bottom: 16px" />
      <a-form layout="vertical" :disabled="saving">
        <a-form-item :label="t('merchantStatus.note')" required><a-textarea v-model:value="form.note" :maxlength="500" :rows="3" show-count /></a-form-item>
        <a-form-item v-if="action === 'suspend'" :label="t('merchantStatus.until')"><a-date-picker v-model:value="form.until" show-time style="width: 100%" /><div>{{ t('merchantStatus.untilHint') }}</div></a-form-item>
        <a-form-item v-if="action === 'blacklist'" :label="t('merchantStatus.evidence')"><a-textarea v-model:value="form.evidence" :maxlength="500" :rows="2" /></a-form-item>
        <a-alert v-if="action === 'unblacklist'" :message="t('merchantStatus.unblacklistWarning')" type="warning" show-icon />
      </a-form>
    </a-spin>
  </a-modal>
  <a-drawer v-model:open="historyOpen" :title="t('merchantStatus.history')" :width="880">
    <a-alert :message="t('merchantStatus.historyHint')" type="info" style="margin-bottom: 16px" />
    <a-table :data-source="history.list.value" :columns="historyColumns" :loading="history.loading.value" :pagination="history.pagination.value" row-key="id" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">{{ t(`merchantStatus.${record.action}`) }}</template>
        <template v-else-if="column.key === 'transition'">{{ t(`merchantStatus.${record.from_status}`) }} → {{ t(`merchantStatus.${record.to_status}`) }}<div v-if="record.suspended_until">{{ t('merchantStatus.until') }}: {{ localTime(record.suspended_until) }}</div></template>
        <template v-else-if="column.dataIndex === 'created_at'">{{ localTime(record.created_at) }}</template>
        <template v-else-if="column.dataIndex === 'note'">{{ record.note }}<div v-if="record.evidence">{{ t('merchantStatus.evidence') }}: {{ record.evidence }}</div></template>
      </template>
    </a-table>
  </a-drawer>
</template>
