<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { deletionList, deletionDetail, deletionRequest, deletionAction, deletionPolicy, saveDeletionPolicy, type DeletionRow } from '@/api/accountDeletion';

const { t } = useI18n();
const route = useRoute();
const user = useUserStore();
const isSuper = user.profile?.isSuper === true;
const myId = computed(() => user.profile?.id ?? 0);
const states = ['legacy','pending_admin','pending_finance','pending_checker','ready','expired','rejected','revoked','completed'];
const { list, loading, query, pagination, search, reset, load } = useTable(deletionList,
  { userId: Number(route.query.userId) || undefined, requestId: undefined, state: '', siteId: 0 });
const columns = computed(() => [
  { title: t('accountDeletion.requestId'), dataIndex: 'id', width: 100 },
  { title: t('accountDeletion.consumer'), dataIndex: 'user_id', width: 110 },
  { title: t('accountDeletion.state'), key: 'state', width: 190 },
  { title: t('accountDeletion.requestedAmount'), dataIndex: 'requested_balance', width: 160 },
  { title: t('accountDeletion.approvedAmount'), dataIndex: 'approved_balance', width: 160 },
  { title: t('accountDeletion.expires'), dataIndex: 'approval_expires_at', width: 180 },
  { title: t('accountDeletion.reason'), dataIndex: 'request_reason', ellipsis: true },
  { title: t('common.action'), key: 'action', width: 110 },
]);
const drawer = ref(false);
const detailLoading = ref(false);
const detail = ref<Awaited<ReturnType<typeof deletionDetail>> | null>(null);
async function openDetail(row: DeletionRow): Promise<void> {
  drawer.value = true; detailLoading.value = true; detail.value = null;
  try { detail.value = await deletionDetail(row.id); } finally { detailLoading.value = false; }
}
const row = computed(() => detail.value?.request);
const canMake = computed(() => row.value?.state === 'pending_finance' && row.value.approved_by !== myId.value);
const canCheck = computed(() => row.value?.state === 'pending_checker' && row.value.approved_by !== myId.value && row.value.finance_maker_id !== myId.value);
const actionOpen = ref(false);
const saving = ref(false);
const form = reactive({ action: '', approve: 1, userId: Number(route.query.userId) || undefined, reason: '', evidence: '' });
function openAction(action: string, approve = 1): void {
  Object.assign(form, { action, approve, reason: '', evidence: '' }); actionOpen.value = true;
}
async function submit(): Promise<void> {
  if (saving.value) return;
  if (!form.reason.trim() || (form.action === 'request' && !form.userId)) { message.warning(t('accountDeletion.required')); return; }
  saving.value = true;
  try {
    const result = form.action === 'request'
      ? await deletionRequest({ userId: form.userId, reason: form.reason.trim(), evidence: form.evidence.trim() })
      : await deletionAction(form.action, { requestId: row.value?.id, approve: form.approve, reason: form.reason.trim(), expectedBalance: String(detail.value?.consumer?.balance ?? '') });
    actionOpen.value = false; message.success(t('tip.saveSuccess')); await load(); await openDetail(result);
  } finally { saving.value = false; }
}
const tab = ref('requests');
const policy = ref<Awaited<ReturnType<typeof deletionPolicy>> | null>(null);
const policyForm = reactive({ thresholdAmount: 0, validityDays: 7, effectiveAt: '', reason: '', expectedVersion: 0 });
async function loadPolicy(): Promise<void> {
  policy.value = await deletionPolicy();
  Object.assign(policyForm, { thresholdAmount: Number(policy.value.current.threshold_amount), validityDays: policy.value.current.validity_days,
    expectedVersion: policy.value.version, reason: '', effectiveAt: new Date().toISOString().slice(0,19) });
}
function changeTab(key: string | number): void { if (key === 'policy') void loadPolicy(); }
async function savePolicy(): Promise<void> {
  if (saving.value) return;
  if (!policyForm.reason.trim() || !policyForm.effectiveAt) { message.warning(t('accountDeletion.required')); return; }
  saving.value = true;
  try {
    await saveDeletionPolicy({ ...policyForm, thresholdAmount: String(policyForm.thresholdAmount), effectiveAt: policyForm.effectiveAt.replace('T',' '), reason: policyForm.reason.trim() });
    message.success(t('tip.saveSuccess')); await loadPolicy();
  } finally { saving.value = false; }
}
const historyColumns = computed(() => ['id','threshold_amount','validity_days','effective_at','actor_name','reason'].map(k => ({ title: t(`accountDeletion.fields.${k}`), dataIndex: k })));
const eventColumns = computed(() => ['created_at','action','actor_name','reason'].map(k => ({ title: t(`accountDeletion.fields.${k}`), dataIndex: k })));
void load();
</script>

<template>
  <PageContainer :title="t('accountDeletion.title')">
    <a-card>
      <a-tabs v-model:active-key="tab" @change="changeTab">
        <a-tab-pane key="requests" :tab="t('accountDeletion.requests')">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item :label="t('accountDeletion.consumer')"><a-input-number v-model:value="query.userId" :min="1" :precision="0" /></a-form-item>
            <a-form-item :label="t('accountDeletion.requestId')"><a-input-number v-model:value="query.requestId" :min="1" :precision="0" /></a-form-item>
            <a-form-item :label="t('accountDeletion.state')"><a-select v-model:value="query.state" style="width:200px"><a-select-option value="">{{ t('common.all') }}</a-select-option><a-select-option v-for="s in states" :key="s" :value="s">{{ t(`accountDeletion.states.${s}`) }}</a-select-option></a-select></a-form-item>
            <a-form-item v-if="isSuper"><SiteTreeSelect v-model:value="query.siteId" allow-all /></a-form-item>
            <a-form-item><a-space><a-button @click="search">{{ t('common.search') }}</a-button><a-button @click="reset">{{ t('common.reset') }}</a-button><a-button v-perm="'user:deletion:request'" type="primary" @click="openAction('request')">{{ t('accountDeletion.newRequest') }}</a-button></a-space></a-form-item>
          </a-form>
          <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" :scroll="{x:1100}">
            <template #bodyCell="{column,record}"><template v-if="column.key==='state'">{{ t(`accountDeletion.states.${record.state}`) }}</template><a-button v-else-if="column.key==='action'" type="link" @click="openDetail(record)">{{ t('common.detail') }}</a-button></template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane v-if="isSuper" key="policy" :tab="t('accountDeletion.policy')">
          <a-alert type="info" show-icon :message="t('accountDeletion.positiveBalanceNotice')" style="margin-bottom:16px" />
          <a-form layout="vertical" style="max-width:640px">
            <a-form-item :label="t('accountDeletion.threshold')"><a-input-number v-model:value="policyForm.thresholdAmount" :min="0" :max="9999999999.99" :precision="2" /></a-form-item>
            <a-form-item :label="t('accountDeletion.validity')"><a-input-number v-model:value="policyForm.validityDays" :min="1" :max="365" :precision="0" /></a-form-item>
            <a-form-item :label="t('accountDeletion.effectiveUtc')"><a-input v-model:value="policyForm.effectiveAt" type="datetime-local" step="1" /></a-form-item>
            <a-form-item :label="t('accountDeletion.reason')"><a-textarea v-model:value="policyForm.reason" :maxlength="255" /></a-form-item>
            <a-button v-perm="'user:deletion:config'" type="primary" :loading="saving" :disabled="!policy" @click="savePolicy">{{ t('common.save') }}</a-button>
          </a-form>
          <a-table :columns="historyColumns" :data-source="policy?.history ?? []" row-key="id" :scroll="{x:900}" style="margin-top:24px" />
        </a-tab-pane>
      </a-tabs>
    </a-card>
    <a-drawer v-model:open="drawer" :title="t('accountDeletion.title')" width="min(820px, 100vw)">
      <a-spin :spinning="detailLoading">
        <template v-if="detail && row">
          <a-descriptions :column="1" bordered>
            <a-descriptions-item :label="t('accountDeletion.requestId')">{{ row.id }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.consumer')">{{ row.user_id }} / {{ detail.consumer?.user_status }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.state')">{{ t(`accountDeletion.states.${row.state}`) }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.latestBalance')">{{ detail.consumer?.balance }} MMK</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.threshold')">{{ detail.policy.threshold_amount }} MMK</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.approvedAmount')">{{ row.approved_balance }} MMK</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.expires')">{{ row.approval_expires_at || '—' }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.reason')">{{ row.request_reason }} / {{ row.approve_reason }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.evidence')">{{ row.evidence || '—' }}</a-descriptions-item>
            <a-descriptions-item :label="t('accountDeletion.blockers')"><div v-for="b in detail.blockers" :key="b.id">{{ b.order_no }} / {{ b.booking_status }} / {{ b.refund_status }} / {{ b.end_date }}</div><span v-if="!detail.blockers.length">{{ t('accountDeletion.none') }}</span></a-descriptions-item>
          </a-descriptions>
          <a-space wrap style="margin:16px 0">
            <template v-if="isSuper && row.state==='pending_admin'"><a-button v-perm="'user:list:approve-deletion'" type="primary" @click="openAction('approve')">{{ t('accountDeletion.approve') }}</a-button><a-button v-perm="'user:list:approve-deletion'" danger @click="openAction('approve',0)">{{ t('accountDeletion.reject') }}</a-button></template>
            <a-button v-if="canMake" v-perm="'user:deletion:prepare'" @click="openAction('prepare')">{{ t('accountDeletion.prepare') }}</a-button>
            <template v-if="canCheck"><a-button v-perm="'user:deletion:check'" type="primary" @click="openAction('check')">{{ t('accountDeletion.check') }}</a-button><a-button v-perm="'user:deletion:check'" danger @click="openAction('check',0)">{{ t('accountDeletion.reject') }}</a-button></template>
            <a-button v-if="isSuper && ['legacy','pending_admin','pending_finance','pending_checker','ready','expired'].includes(row.state)" v-perm="'user:list:approve-deletion'" danger @click="openAction('revoke')">{{ t('accountDeletion.revoke') }}</a-button>
          </a-space>
          <a-alert v-if="row.state==='ready'" type="info" show-icon :message="t('accountDeletion.consumerConfirms')" />
          <a-table :columns="eventColumns" :data-source="detail.events" row-key="id" :scroll="{x:700}" style="margin-top:16px" />
        </template>
      </a-spin>
    </a-drawer>
    <a-modal v-model:open="actionOpen" :title="t('accountDeletion.confirmAction')" :confirm-loading="saving" @ok="submit">
      <a-alert type="warning" show-icon :message="t('accountDeletion.reviewNotice')" style="margin-bottom:16px" />
      <a-form layout="vertical">
        <a-form-item v-if="form.action==='request'" :label="t('accountDeletion.consumer')"><a-input-number v-model:value="form.userId" :min="1" :precision="0" /></a-form-item>
        <a-form-item :label="t('accountDeletion.reason')" required><a-textarea v-model:value="form.reason" :maxlength="255" :rows="3" /></a-form-item>
        <a-form-item v-if="form.action==='request'" :label="t('accountDeletion.evidence')"><a-input v-model:value="form.evidence" :maxlength="1000" /></a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
