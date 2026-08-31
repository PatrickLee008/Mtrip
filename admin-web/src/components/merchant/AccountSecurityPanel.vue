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

// 重置结果:明文密码仅此一次返回,关闭即不可再取回
const credentials = ref<{ username: string; password: string } | null>(null);

async function copyCredential(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  message.success(t('merchantSecurity.credentialCopied'));
}

function confirm(): void {
  const account = target.value;
  if (!account || !reason.value.trim()) { message.warning(t('merchantSecurity.reasonRequired')); return; }
  Modal.confirm({
    title: t('merchant.profile.reset2Fa'), content: t('merchantSecurity.resetConfirm', { name: account.username }), okType: 'danger',
    async onOk() {
      busy.value = true;
      try {
        const result = await apiMerchantReset2Fa({ merchantId: props.merchantId, accountId: account.id, expectedVersion: account.auth_version, reason: reason.value.trim() });
        target.value = null;
        credentials.value = result;
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
    <a-alert :message="t('merchantSecurity.resetIncludesPassword')" type="warning" show-icon style="margin-bottom: 12px" />
    <a-form layout="vertical"><a-form-item :label="t('merchantSecurity.reason')" required><a-textarea v-model:value="reason" :maxlength="200" /></a-form-item></a-form>
  </a-modal>

  <!-- 重置结果:明文密码仅此一次可见,不提供"取消",避免误以为可以放弃后重看 -->
  <a-modal
    :open="!!credentials"
    :title="t('merchantSecurity.resetDoneTitle')"
    :closable="false"
    :mask-closable="false"
    :cancel-button-props="{ style: { display: 'none' } }"
    :ok-text="t('merchantSecurity.credentialAcknowledge')"
    @ok="credentials = null"
  >
    <a-alert :message="t('merchantSecurity.credentialVisibleOnce')" type="warning" show-icon style="margin-bottom: 16px" />
    <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item :label="t('merchantSecurity.account')">
        <a-typography-text copyable>{{ credentials?.username }}</a-typography-text>
      </a-descriptions-item>
      <a-descriptions-item :label="t('merchantSecurity.newPassword')">
        <a-space>
          <strong style="font-family: monospace; font-size: 15px; letter-spacing: 1px">{{ credentials?.password }}</strong>
          <a-button size="small" @click="credentials && copyCredential(credentials.password)">
            {{ t('merchantSecurity.credentialCopy') }}
          </a-button>
        </a-space>
      </a-descriptions-item>
    </a-descriptions>
    <p style="margin: 12px 0 0; color: #64748b; font-size: 12px">{{ t('merchantSecurity.resetDoneHint') }}</p>
  </a-modal>
</template>
