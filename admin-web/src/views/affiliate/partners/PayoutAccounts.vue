<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  apiAffiliatePayoutAccounts, apiInspectAffiliatePayoutAccount, apiReviewAffiliatePayoutAccount,
  type AffiliatePayoutAccountSummary,
} from '@/api/affiliate';

const props = defineProps<{ affiliateId: number }>();
const { t } = useI18n();
const accounts = ref<AffiliatePayoutAccountSummary[]>();
const selected = ref<AffiliatePayoutAccountSummary>();
const details = ref<{ holderName: string; accountNumber: string; version: number }>();
const reason = ref('');
const busy = ref(false);
const modalOpen = ref(false);

async function load(): Promise<void> {
  busy.value = true;
  try {
    accounts.value = await apiAffiliatePayoutAccounts(props.affiliateId);
  } finally {
    busy.value = false;
  }
}

async function inspect(account: AffiliatePayoutAccountSummary): Promise<void> {
  busy.value = true;
  try {
    const result = await apiInspectAffiliatePayoutAccount(account.id);
    selected.value = account;
    details.value = result;
    modalOpen.value = true;
  } finally {
    busy.value = false;
  }
}

function close(): void {
  modalOpen.value = false;
  details.value = undefined;
  selected.value = undefined;
  reason.value = '';
}

async function review(status: number): Promise<void> {
  if (!selected.value || !details.value || busy.value) return;
  busy.value = true;
  try {
    await apiReviewAffiliatePayoutAccount({
      id: selected.value.id, version: details.value.version, status, reason: reason.value.trim(),
    });
    close();
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-perm="'affiliate:payout-account:verify'" style="margin-top: 16px">
    <a-button :loading="busy" @click="load">{{ t('affiliatePayout.accounts') }}</a-button>
    <a-list v-if="accounts" :data-source="accounts" size="small">
      <template #renderItem="{ item }">
        <a-list-item>
          {{ item.provider_name }} · •••• {{ item.number_suffix }} · {{ t('affiliatePayout.status' + item.status) }}
          <template #actions>
            <a-button type="link" :disabled="busy" @click="inspect(item)">{{ t('affiliatePayout.inspect') }}</a-button>
          </template>
        </a-list-item>
      </template>
    </a-list>
    <a-modal :open="modalOpen" :title="t('affiliatePayout.inspect')" :mask-closable="false" @cancel="close">
      <a-descriptions v-if="details" :column="1">
        <a-descriptions-item :label="t('affiliatePayout.holder')">{{ details.holderName }}</a-descriptions-item>
        <a-descriptions-item :label="t('affiliatePayout.number')">{{ details.accountNumber }}</a-descriptions-item>
      </a-descriptions>
      <a-textarea v-if="selected?.status === 0" v-model:value="reason" :placeholder="t('affiliatePayout.reason')" :maxlength="500" />
      <template #footer>
        <a-button @click="close">{{ t('common.cancel') }}</a-button>
        <a-button v-if="selected?.status === 0" danger :loading="busy" :disabled="!reason.trim()" @click="review(2)">
          {{ t('affiliatePayout.reject') }}
        </a-button>
        <a-button v-if="selected?.status === 0" type="primary" :loading="busy" :disabled="!selected.provider_enabled" @click="review(1)">
          {{ t('affiliatePayout.verify') }}
        </a-button>
      </template>
    </a-modal>
  </div>
</template>
