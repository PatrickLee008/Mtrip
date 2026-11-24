<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { apiConsumerAffiliateAccess, apiSetConsumerAffiliateAccess, type ConsumerAffiliateAccess } from '@/api/affiliate';

const { t } = useI18n();
const userId = ref<number | null>(null);
const record = ref<ConsumerAffiliateAccess>();
const busy = ref(false);
const affiliateType = ref('agent');
const nextStatus = ref(1);
const reason = ref('');
const status = computed(() => Number(record.value?.profile?.status ?? 0));
const key = 'affiliateConsumer';
const statuses = ['inactive', 'active', 'suspended', 'disabled'];
const statusLabel = (value: number) => t(`${key}.${statuses[value] ?? 'inactive'}`);

async function load(): Promise<void> {
  if (!userId.value || busy.value) return;
  record.value = undefined;
  busy.value = true;
  try {
    record.value = await apiConsumerAffiliateAccess(userId.value);
    nextStatus.value = status.value === 1 ? 2 : 1;
  } finally {
    busy.value = false;
  }
}

async function save(): Promise<void> {
  const selected = record.value;
  if (!selected || busy.value || !reason.value.trim()) return;
  busy.value = true;
  try {
    await apiSetConsumerAffiliateAccess({
      userId: selected.user.id,
      expectedStatus: status.value,
      status: nextStatus.value,
      affiliateType: selected.profile ? '' : affiliateType.value,
      reason: reason.value.trim(),
    });
    reason.value = '';
    record.value = undefined;
    message.success(t('common.success'));
    record.value = await apiConsumerAffiliateAccess(selected.user.id);
    nextStatus.value = status.value === 1 ? 2 : 1;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <a-card :title="t(`${key}.title`)" :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
    <a-form layout="inline" @submit.prevent="load">
      <a-form-item :label="t(`${key}.userId`)">
        <a-input-number v-model:value="userId" :min="1" :max="Number.MAX_SAFE_INTEGER" :precision="0" :disabled="busy" @change="record = undefined; reason = ''" />
      </a-form-item>
      <a-form-item><a-button html-type="submit" :disabled="!userId" :loading="busy">{{ t('common.search') }}</a-button></a-form-item>
    </a-form>
    <template v-if="record">
      <a-descriptions size="small" :column="2" style="margin-top: 16px">
        <a-descriptions-item :label="t(`${key}.userId`)">{{ record.user.id }} · {{ record.user.nickname }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.status')">{{ statusLabel(status) }}</a-descriptions-item>
        <template v-if="record.profile">
          <a-descriptions-item :label="t(`${key}.affiliateId`)">{{ record.profile.id }}</a-descriptions-item>
          <a-descriptions-item :label="t(`${key}.activatedAt`)">{{ record.profile.activated_at }}</a-descriptions-item>
          <a-descriptions-item :label="t(`${key}.type`)">{{ t(`${key}.${record.profile.affiliate_type}`) }}</a-descriptions-item>
        </template>
      </a-descriptions>
      <a-form v-perm="'affiliate:partner:manage-consumer'" layout="vertical" @submit.prevent="save">
        <a-form-item v-if="!record.profile" :label="t(`${key}.type`)">
          <a-select v-model:value="affiliateType" style="width: 200px">
            <a-select-option value="agent">{{ t(`${key}.agent`) }}</a-select-option>
            <a-select-option value="merchant">{{ t(`${key}.merchant`) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-else :label="t('common.status')">
          <a-select v-model:value="nextStatus" style="width: 200px">
            <a-select-option v-for="value in [1, 2, 3]" :key="value" :value="value" :disabled="value === status">
              {{ statusLabel(value) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t(`${key}.reason`)" required>
          <a-input v-model:value="reason" :maxlength="500" />
        </a-form-item>
        <a-button type="primary" html-type="submit" :loading="busy" :disabled="!reason.trim() || nextStatus === status || (nextStatus === 1 && record.user.user_status !== 1)">
          {{ t('common.save') }}
        </a-button>
      </a-form>
      <a-divider v-if="record.history.length" orientation="left">{{ t(`${key}.history`) }}</a-divider>
      <a-timeline v-if="record.history.length">
        <a-timeline-item v-for="item in record.history" :key="item.id">
          {{ item.created_at }} · {{ t(`${key}.operatorId`) }} {{ item.operator_id }} · {{ statusLabel(item.previous_status) }} → {{ statusLabel(item.new_status) }}<br />
          {{ item.reason }}
        </a-timeline-item>
      </a-timeline>
    </template>
  </a-card>
</template>
