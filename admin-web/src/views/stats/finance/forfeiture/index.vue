<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { forfeitureReport, forfeitureExport } from '@/api/accountDeletion';
const { t } = useI18n();
const isSuper = useUserStore().profile?.isSuper === true;
const summary = ref('0.00');
const exporting = ref(false);
const { list, loading, query, pagination, search, reset, load } = useTable(async params => {
  const result = await forfeitureReport(params); summary.value = result.summary.completedAmount; return result;
}, { userId: undefined, requestId: undefined, approverId: undefined, state: '', startDate: '', endDate: '', siteId: 0 });
const states = ['legacy','pending_admin','pending_finance','pending_checker','ready','expired','rejected','revoked','completed'];
const keys = ['id','user_id','state','amount','currency','approved_name','finance_maker_name','finance_checker_name','approve_reason','created_at','approved_at','closed_at','balance_log_id'];
const columns = computed(() => keys.map(k => ({ title: t(`accountDeletion.fields.${k}`), dataIndex: k, key: k, width: k.endsWith('_at') ? 180 : 140 })));
async function download(format: string): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const file = await forfeitureExport({ ...query, format });
    const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
    const a = document.createElement('a'); a.href = url; a.download = file.filename; a.click(); URL.revokeObjectURL(url);
  } finally { exporting.value = false; }
}
void load();
</script>
<template>
  <PageContainer :title="t('accountDeletion.report')">
    <a-card style="margin-bottom:16px"><a-form layout="inline">
      <a-form-item v-for="key in ['userId','requestId','approverId']" :key="key" :label="t(`accountDeletion.${key==='userId'?'consumer':key}`)"><a-input-number v-model:value="query[key]" :min="1" :precision="0" /></a-form-item>
      <a-form-item :label="t('accountDeletion.state')"><a-select v-model:value="query.state" style="width:190px"><a-select-option value="">{{ t('common.all') }}</a-select-option><a-select-option v-for="s in states" :key="s" :value="s">{{ t(`accountDeletion.states.${s}`) }}</a-select-option></a-select></a-form-item>
      <a-form-item :label="t('accountDeletion.requestDates')"><a-input v-model:value="query.startDate" type="date" /><a-input v-model:value="query.endDate" type="date" /></a-form-item>
      <a-form-item v-if="isSuper"><SiteTreeSelect v-model:value="query.siteId" allow-all /></a-form-item>
      <a-form-item><a-space><a-button @click="search">{{ t('common.search') }}</a-button><a-button @click="reset">{{ t('common.reset') }}</a-button></a-space></a-form-item>
    </a-form></a-card>
    <a-card>
      <div class="tab-toolbar"><a-space wrap><strong>{{ t('accountDeletion.completedTotal') }}: {{ summary }} MMK</strong><a-button v-perm="'user:deletion:export'" :loading="exporting" @click="download('csv')">CSV</a-button><a-button v-perm="'user:deletion:export'" :loading="exporting" @click="download('xlsx')">XLSX</a-button></a-space></div>
      <a-table :data-source="list" :columns="columns" :loading="loading" :pagination="pagination" row-key="id" :scroll="{x:1900}"><template #bodyCell="{column,record}"><template v-if="column.key==='state'">{{ t(`accountDeletion.states.${record.state}`) }}</template></template></a-table>
    </a-card>
  </PageContainer>
</template>
