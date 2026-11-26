<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { apiStoreStatusHistory, apiStoreToggleStatus } from '@/api/merchant';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';

const props = defineProps<{ store: TableRow }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const user = useUserStore();
const suspended = computed(() => Number(props.store.operating_status) === 3);
const managed = computed(() => [1, 2, 3].includes(Number(props.store.operating_status)));
const request = ref<{ id: number; name: string; action: 'suspend' | 'restore'; expectedVersion: number }>();
const reason = ref('');
const saving = ref(false);
const historyOpen = ref(false);
const history = useTable(params => apiStoreStatusHistory({ ...params, id: Number(props.store.id) }));

function open(): void {
  request.value = { id: Number(props.store.id), name: props.store.store_name,
    action: suspended.value ? 'restore' : 'suspend', expectedVersion: Number(props.store.booking_status_version) };
  reason.value = '';
}

async function save(): Promise<void> {
  if (!request.value || saving.value) return;
  if (!reason.value.trim()) {
    message.warning(t('merchant.storeBooking.reasonRequired'));
    return;
  }
  const { id, action, expectedVersion } = request.value;
  saving.value = true;
  try {
    await apiStoreToggleStatus({ id, action, expectedVersion, reason: reason.value.trim() });
    request.value = undefined;
    message.success(t('tip.saveSuccess'));
    emit('changed');
    if (historyOpen.value) await history.load();
  } finally {
    saving.value = false;
  }
}

function showHistory(): void {
  historyOpen.value = true;
  history.search();
}

const columns = computed(() => [
  { title: t('common.action'), key: 'action', width: 120 },
  { title: t('merchantStatus.transition'), key: 'transition', width: 160 },
  { title: t('merchant.storeBooking.reason'), dataIndex: 'reason' },
  { title: t('merchantStatus.actor'), dataIndex: 'actor_name', width: 120 },
  { title: t('merchant.storeBooking.effectiveAt'), dataIndex: 'effective_at', width: 170 },
]);
</script>

<template>
  <a-button v-if="user.profile?.isSuper && managed" v-perm="'merchant:store:status'" type="link" size="small"
    :danger="!suspended" @click="open">
    {{ t(suspended ? 'merchant.storeBooking.restore' : 'merchant.storeBooking.suspend') }}
  </a-button>
  <a-button v-perm="'merchant:store:list'" type="link" size="small" @click="showHistory">{{ t('merchant.storeBooking.history') }}</a-button>

  <a-modal :open="!!request" :title="t(request?.action === 'restore' ? 'merchant.storeBooking.restore' : 'merchant.storeBooking.suspend')"
    :confirm-loading="saving" :mask-closable="false" :closable="!saving" :cancel-button-props="{ disabled: saving }"
    @cancel="request = undefined" @ok="save">
    <p>{{ request?.name }} · #{{ request?.id }}</p>
    <p>{{ t(request?.action === 'restore' ? 'merchant.storeBooking.restoreHint' : 'merchant.storeBooking.suspendHint') }}</p>
    <a-form layout="vertical">
      <a-form-item :label="t('merchant.storeBooking.reason')" required>
        <a-textarea v-model:value="reason" :rows="3" :maxlength="500" />
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal v-model:open="historyOpen" :title="t('merchant.storeBooking.history') + ' · ' + store.store_name" :width="860" :footer="null">
    <a-table :columns="columns" :data-source="history.list.value" :loading="history.loading.value" :pagination="history.pagination.value"
      :scroll="{ x: 680 }" size="small" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">{{ t('merchant.storeBooking.' + record.action) }}</template>
        <template v-if="column.key === 'transition'">
          {{ t('merchant.storeBooking.state' + record.from_status) }} → {{ t('merchant.storeBooking.state' + record.to_status) }}
        </template>
      </template>
    </a-table>
  </a-modal>
</template>
