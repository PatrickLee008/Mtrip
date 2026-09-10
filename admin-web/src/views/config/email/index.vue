<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiEmailChannelAdd, apiEmailChannelDelete, apiEmailChannelList, apiEmailChannelToggleStatus, apiEmailChannelUpdate } from '@/api/config';

const { loading, list, load, pagination } = useTable(apiEmailChannelList, { page: 1, pageSize: 20 });
const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({
  siteId: 0, providerName: 'SMTP', smtpHost: '', smtpPort: 587, encryption: 'tls', username: '', password: '',
  fromEmail: '', fromName: 'mTrip', otpSubject: 'Your mTrip verification code',
  otpContent: 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.',
  codeExpireSec: 300, pinLength: 6, maxInvalidAttempts: 5, remark: '',
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 }, { title: 'Site', dataIndex: 'site_id', width: 90 },
  { title: 'Provider', dataIndex: 'provider_name', width: 130 }, { title: 'SMTP Host', dataIndex: 'smtp_host', width: 190 },
  { title: 'From', dataIndex: 'from_email', width: 210 }, { title: 'Security', dataIndex: 'encryption', width: 90 },
  { title: 'Status', dataIndex: 'status', width: 90 }, { title: 'Action', key: 'action', fixed: 'right' as const, width: 180 },
];

function resetForm(): void {
  Object.assign(form, { siteId: 0, providerName: 'SMTP', smtpHost: '', smtpPort: 587, encryption: 'tls', username: '', password: '', fromEmail: '', fromName: 'mTrip', otpSubject: 'Your mTrip verification code', otpContent: 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.', codeExpireSec: 300, pinLength: 6, maxInvalidAttempts: 5, remark: '' });
}
function openCreate(): void { editingId.value = 0; resetForm(); modalOpen.value = true; }
function openEdit(row: TableRow): void {
  editingId.value = Number(row.id); Object.assign(form, { siteId: row.site_id ?? 0, providerName: row.provider_name ?? 'SMTP', smtpHost: row.smtp_host ?? '', smtpPort: row.smtp_port ?? 587, encryption: row.encryption ?? 'tls', username: '', password: '', fromEmail: row.from_email ?? '', fromName: row.from_name ?? 'mTrip', otpSubject: row.otp_subject ?? 'Your mTrip verification code', otpContent: row.otp_content ?? '', codeExpireSec: row.code_expire_sec ?? 300, pinLength: row.pin_length ?? 6, maxInvalidAttempts: row.max_invalid_attempts ?? 5, remark: row.remark ?? '' }); modalOpen.value = true;
}
async function save(): Promise<void> { saving.value = true; try { const payload = { ...form, ...(editingId.value ? { id: editingId.value } : {}) }; if (editingId.value) await apiEmailChannelUpdate(payload); else await apiEmailChannelAdd(payload); message.success('Saved'); modalOpen.value = false; await load(); } finally { saving.value = false; } }
async function toggle(row: TableRow): Promise<void> { await apiEmailChannelToggleStatus(Number(row.id)); await load(); }
async function remove(row: TableRow): Promise<void> { await apiEmailChannelDelete(Number(row.id)); message.success('Deleted'); await load(); }
onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>Email SMTP Channels</template>
      <template #extra><a-space><a-button @click="load"><template #icon><ReloadOutlined /></template>Refresh</a-button><a-button v-perm="'config:email:add'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>Add channel</a-button></a-space></template>
      <a-alert type="info" show-icon style="margin-bottom: 16px" message="Passwords are encrypted at rest. OTP bodies are never stored in delivery logs." />
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'site_id'">{{ record.site_id === 0 ? 'All sites' : record.site_id }}</template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" /></template>
          <template v-else-if="column.key === 'action'"><a-space :size="0"><a-button v-perm="'config:email:edit'" type="link" size="small" @click="openEdit(record)"><EditOutlined /> Edit</a-button><a-button v-perm="'config:email:status'" type="link" size="small" @click="toggle(record)">{{ record.status === 1 ? 'Disable' : 'Enable' }}</a-button><a-popconfirm title="Delete this channel?" @confirm="remove(record)"><a-button v-perm="'config:email:delete'" danger type="link" size="small"><DeleteOutlined /> Delete</a-button></a-popconfirm></a-space></template>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:open="modalOpen" :title="editingId ? 'Edit email channel' : 'Add email channel'" width="680px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '150px' } }" style="margin-top: 16px"><a-form-item label="Site"><SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="Boolean(editingId)" /></a-form-item><a-form-item label="Provider name"><a-input v-model:value="form.providerName" /></a-form-item><a-form-item label="SMTP host" required><a-input v-model:value="form.smtpHost" placeholder="smtp.example.com" /></a-form-item><a-form-item label="Port"><a-input-number v-model:value="form.smtpPort" :min="1" :max="65535" style="width: 100%" /></a-form-item><a-form-item label="Transport security"><a-select v-model:value="form.encryption"><a-select-option value="tls">STARTTLS</a-select-option><a-select-option value="ssl">SSL/TLS</a-select-option><a-select-option value="none">None (not recommended)</a-select-option></a-select></a-form-item><a-form-item label="SMTP username" required><a-input v-model:value="form.username" autocomplete="off" /></a-form-item><a-form-item label="SMTP password" required><a-input-password v-model:value="form.password" autocomplete="new-password" :placeholder="editingId ? 'Leave blank to keep current secret' : ''" /></a-form-item><a-form-item label="From email" required><a-input v-model:value="form.fromEmail" /></a-form-item><a-form-item label="From name"><a-input v-model:value="form.fromName" /></a-form-item><a-form-item label="OTP subject"><a-input v-model:value="form.otpSubject" /></a-form-item><a-form-item label="OTP body"><a-textarea v-model:value="form.otpContent" :rows="3" /></a-form-item><a-form-item label="OTP expiry (seconds)"><a-input-number v-model:value="form.codeExpireSec" :min="60" :max="3600" style="width: 100%" /></a-form-item><a-form-item label="OTP digits"><a-input-number v-model:value="form.pinLength" :min="4" :max="8" style="width: 100%" /></a-form-item><a-form-item label="Max invalid attempts"><a-input-number v-model:value="form.maxInvalidAttempts" :min="1" :max="10" style="width: 100%" /></a-form-item><a-form-item label="Remark"><a-input v-model:value="form.remark" /></a-form-item></a-form>
    </a-modal>
  </PageContainer>
</template>
