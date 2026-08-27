<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { apiMerchantSecurityAccounts, apiMerchantReset2Fa, type SecurityAccount } from '@/api/merchant';

const props = defineProps<{ merchantId: number; accessConfigured: boolean }>();
const { t } = useI18n();
const user = useUserStore();
const rows = ref<SecurityAccount[]>([]);
const target = ref<SecurityAccount | null>(null);
const reason = ref('');
const busy = ref(false);
const columns = computed(() => [
  { title: t('merchantSecurity.account'), dataIndex: 'username' },
  { title: t('merchantSecurity.type'), key: 'type' },
  { title: t('merchant.profile.twoFaStatus'), key: 'security' },
  { title: t('merchant.profile.twoFaEnrolled'), dataIndex: 'two_fa_enrolled_at' },
  { title: t('merchant.profile.twoFaLastReset'), dataIndex: 'two_fa_last_reset_at' },
  { title: t('merchant.profile.reset2Fa'), key: 'reset' },
]);
async function load(): Promise<void> {
  rows.value = [];
  if (props.merchantId && user.profile?.isSuper) rows.value = await apiMerchantSecurityAccounts(props.merchantId);
}
watch(() => props.merchantId, load, { immediate: true });
function openReset(account: SecurityAccount): void { target.value = account; reason.value = ''; }
function confirm(): void {
  const account = target.value;
  if (!account || !reason.value.trim()) { message.warning(t('merchantSecurity.reasonRequired')); return; }
  Modal.confirm({
    title: t('merchant.profile.reset2Fa'), content: t('merchantSecurity.resetConfirm', { name: account.username }), okType: 'danger',
    async onOk() {
      busy.value = true;
      try {
        await apiMerchantReset2Fa({ merchantId: props.merchantId, accountId: account.id, expectedVersion: account.auth_version, reason: reason.value.trim() });
        target.value = null;
        message.success(t('merchant.profile.reset2FaSuccess'));
        await load();
      } finally { busy.value = false; }
    },
  });
}
</script>

<template>
  <a-divider orientation="left">{{ t('merchant.profile.accountSecurity') }}</a-divider>
  <p>{{ t('merchant.profile.merchantAccessCode') }}: {{ accessConfigured ? t('merchantDirectory.configured') : t('merchantDirectory.notConfigured') }}</p>
  <template v-if="user.profile?.isSuper">
    <a-alert :message="t('merchantSecurity.hint')" type="info" show-icon />
    <a-table :data-source="rows" :columns="columns" row-key="id" :pagination="false" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">{{ t(`merchantSecurity.type${record.account_type}`) }}</template>
        <template v-else-if="column.key === 'security'">
          <a-tag :color="record.two_fa_status === 1 ? 'success' : 'warning'">{{ t(`merchantSecurity.status${record.two_fa_status}`) }}</a-tag>
          <span v-if="record.two_fa_status === 1">Google Authenticator</span>
        </template>
        <a-button v-else-if="column.key === 'reset'" v-perm="'merchant:list:2fa'" size="small" danger @click="openReset(record)">{{ t('merchant.profile.reset2Fa') }}</a-button>
      </template>
    </a-table>
  </template>
  <a-alert v-else :message="t('merchantSecurity.superOnly')" type="info" />
  <a-modal :open="!!target" :title="t('merchant.profile.reset2Fa')" :confirm-loading="busy" @cancel="target = null" @ok="confirm">
    <p>{{ target?.username }}</p>
    <a-form layout="vertical"><a-form-item :label="t('merchantSecurity.reason')" required><a-textarea v-model:value="reason" :maxlength="200" /></a-form-item></a-form>
  </a-modal>
</template>
