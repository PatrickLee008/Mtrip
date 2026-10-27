<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { DownloadOutlined, FileTextOutlined, PaperClipOutlined, SendOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { supportAction, supportDownload, supportGet, supportRequestId, supportUpload, type SupportEvent, type SupportFile, type SupportPage, type SupportReply, type SupportTicket } from '@/api/support';

const props = defineProps<{ open: boolean; ticketId: number }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>();
const { t } = useI18n();
const ticket = ref<SupportTicket | null>(null);
const replies = ref<SupportReply[]>([]); const events = ref<SupportEvent[]>([]);
const totals = reactive({ replies: 0, events: 0 });
const draft = ref(''); const files = ref<SupportFile[]>([]); const busy = ref(false); const uploading = ref(false); const failed = ref(false);
const reasonOpen = ref(false); const reasonAction = ref('close'); const reason = ref('');
const terminal = computed(() => ['resolved', 'closed'].includes(ticket.value?.status || ''));
const pane = ref('conversation');
const candidates = ref<{ id: number; name: string }[]>([]);
const assigneeId = ref(0); const priority = ref('medium'); const targetStatus = ref('open');
const metadataChanges = computed<Record<string, unknown>>(() => {
  const value = ticket.value; if (!value) return {};
  const changes: Record<string, unknown> = {};
  if (value.capabilities.assign && assigneeId.value !== Number(value.assigned_admin_id || 0)) changes.assigneeId = assigneeId.value;
  if (value.capabilities.priority && priority.value !== value.priority) changes.priority = priority.value;
  if (value.capabilities.status && targetStatus.value !== value.status) changes.status = targetStatus.value;
  return changes;
});
const metadataDirty = computed(() => Object.keys(metadataChanges.value).length > 0);
const conversation = computed<SupportReply[]>(() => ticket.value ? [{
  id: 0, actor_type: 'merchant', actor_name: ticket.value.creator_name, content: ticket.value.description,
  created_at: ticket.value.created_at, attachments: ticket.value.attachments,
}, ...replies.value] : []);
const avatarLabel = (reply: SupportReply) => reply.actor_type === 'merchant' ? 'M' : Array.from(reply.actor_name.trim())[0]?.toLocaleUpperCase() || 'S';
let timer: ReturnType<typeof setInterval> | undefined;
let generation = 0;
const historyRequests = { replies: 0, events: 0 };
let pending: { fingerprint: string; data: Record<string, unknown> } | null = null;
function changeText(key: string, change: { from: unknown; to: unknown } | string) {
  const label = t('support.fields.' + key);
  if (typeof change === 'string') return label;
  const value = (item: unknown) => key === 'status' ? t('support.states.' + item) : key === 'priority' ? t('support.priorities.' + item) : item ? '#' + item : t('support.unassigned');
  return `${label}: ${value(change.from)} → ${value(change.to)}`;
}
function moreHistory(kind: 'replies' | 'events') { void history(kind).catch(() => { failed.value = true; }); }
const color = (status: string) => ({ open: 'blue', in_progress: 'purple', waiting_merchant: 'orange', waiting_support: 'gold', resolved: 'green', closed: 'default' }[status] || 'default');

async function refresh(initial = false, syncControls = false) {
  const id = props.ticketId; const current = generation;
  if (!props.open || !id) return;
  try {
    const value = await supportGet<SupportTicket>('ticket', { ticketId: id });
    if (current !== generation) return;
    if (ticket.value && value.version < ticket.value.version) return;
    const edits = metadataChanges.value;
    const changed = !ticket.value || value.version > ticket.value.version;
    if (changed) ticket.value = value;
    failed.value = false;
    if (changed || initial || syncControls) {
      if (initial || syncControls || !('assigneeId' in edits)) assigneeId.value = Number(value.assigned_admin_id || 0);
      if (initial || syncControls || !('priority' in edits)) priority.value = value.priority;
      if (initial || syncControls || !('status' in edits)) targetStatus.value = value.status;
    }
    const people = await supportGet<typeof candidates.value>('assignees', { ticketId: id });
    if (current !== generation) return;
    candidates.value = people;
    await Promise.all([history('replies', initial), history('events', initial)]);
  } catch {
    if (current === generation) { failed.value = true; ticket.value = null; replies.value = []; events.value = []; }
  }
}
async function history(kind: 'replies' | 'events', initial = false) {
  const id = props.ticketId; const current = generation;
  const request = ++historyRequests[kind];
  const rows = kind === 'replies' ? replies.value : events.value;
  const afterId = initial ? 0 : rows[rows.length - 1]?.id || 0;
  const result = await supportGet<SupportPage<SupportReply | SupportEvent>>(kind, { ticketId: id, afterId, pageSize: 50 });
  if (current !== generation || request !== historyRequests[kind]) return;
  if (kind === 'replies') {
    const next = result.list as SupportReply[];
    replies.value = initial ? next : [...replies.value, ...next.filter(row => !replies.value.some(old => old.id === row.id))];
  } else {
    const next = result.list as SupportEvent[];
    events.value = initial ? next : [...events.value, ...next.filter(row => !events.value.some(old => old.id === row.id))];
  }
  totals[kind] = afterId === 0 ? result.total : rows.length + result.total;
}
function requestClose() {
  if (busy.value || uploading.value) return;
  const close = () => emit('update:open', false);
  if (draft.value.trim() || files.value.length || metadataDirty.value) Modal.confirm({ title: t('support.unsaved'), okText: t('support.discard'), cancelText: t('support.stay'), onOk: close });
  else close();
}
async function addFile(file: File) {
  if (files.value.length >= 5 || file.size > 10000000 || !/\.(pdf|jpe?g|png|xlsx)$/i.test(file.name)) { message.warning(t('support.invalidFile')); return false; }
  const id = props.ticketId; const current = generation;
  uploading.value = true;
  try { const result = await supportUpload(file, { ticketId: id }); if (current === generation) files.value.push(result); }
  catch { /* HTTP layer displays the error. */ }
  finally { uploading.value = false; }
  return false;
}
function ask(action: string) {
  reason.value = ''; reasonAction.value = action; reasonOpen.value = true;
}
function saveDetails() {
  if (!metadataDirty.value) return;
  if ('status' in metadataChanges.value) ask('status');
  else void act('assigneeId' in metadataChanges.value ? 'assign' : 'priority');
}
async function act(action: string) {
  if (!ticket.value || busy.value || uploading.value) return;
  const metadata = ['assign', 'priority', 'status'].includes(action);
  if (metadata) {
    if (!metadataDirty.value) { reasonOpen.value = false; return; }
    action = 'status' in metadataChanges.value ? 'status' : 'assigneeId' in metadataChanges.value ? 'assign' : 'priority';
  }
  if (['status', 'reopen'].includes(action) && !reason.value.trim()) { message.warning(t('support.reasonRequired')); return; }
  if (action === 'reply' && !draft.value.trim() && !files.value.length) return;
  const id = ticket.value.id; const current = generation;
  const body = action === 'reply' ? { content: draft.value.trim(), attachmentIds: files.value.map(file => file.id) }
    : metadata ? { ...metadataChanges.value, ...(action === 'status' ? { reason: reason.value.trim() } : {}) } : { reason: reason.value.trim() };
  const fingerprint = JSON.stringify([id, action, body]);
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, data: { ticketId: id, expectedVersion: ticket.value.version, requestId: supportRequestId(), ...body } };
  busy.value = true;
  try {
    await supportAction(action, pending.data);
    if (current !== generation) return;
    pending = null; reasonOpen.value = false;
    if (action === 'reply') { draft.value = ''; files.value = []; }
    message.success(t('support.changed')); emit('changed'); await refresh(false, metadata || action === 'reopen');
  } catch (error) {
    if (current === generation && error && typeof error === 'object' && 'code' in error && error.code === 40901) { pending = null; await refresh(false, true); }
  } finally { busy.value = false; }
}
function foreground() { if (!document.hidden) void refresh(); }
watch(() => [props.open, props.ticketId], () => {
  generation++; clearInterval(timer); ticket.value = null; replies.value = []; events.value = []; draft.value = ''; files.value = []; pending = null; reasonOpen.value = false;
  assigneeId.value = 0; priority.value = 'medium'; targetStatus.value = 'open';
  if (props.open) { void refresh(true); timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000); }
}, { immediate: true });
window.addEventListener('focus', foreground);
onBeforeUnmount(() => { generation++; clearInterval(timer); window.removeEventListener('focus', foreground); });
</script>

<template>
  <a-drawer :open="open" :title="ticket?.ticket_no || t('support.tickets')" width="min(680px, 100vw)" :mask-closable="false" @close="requestClose">
    <a-alert v-if="failed" type="error" :message="t('support.failed')" show-icon><template #action><a-button @click="refresh(true)">{{ t('support.retry') }}</a-button></template></a-alert>
    <a-spin v-else-if="!ticket" />
    <template v-if="ticket">
      <div class="ticket-heading"><a-tag :color="color(ticket.status)">{{ t('support.states.' + ticket.status) }}</a-tag><a-tag>{{ t('support.priorities.' + ticket.priority) }}</a-tag></div>
      <h2>{{ ticket.subject }}</h2>
      <a-descriptions :column="2" size="small" class="ticket-meta">
        <a-descriptions-item :label="t('support.category')">{{ t('support.categories.' + ticket.category) }}</a-descriptions-item>
        <a-descriptions-item :label="t('support.agent')">{{ ticket.assignee_name || t('support.unassigned') }}</a-descriptions-item>
        <a-descriptions-item :label="t('support.creator')">{{ ticket.creator_name }}</a-descriptions-item>
        <a-descriptions-item :label="t('support.created')">{{ ticket.created_at }}</a-descriptions-item>
        <a-descriptions-item :label="t('support.property')">{{ ticket.property_name || t('support.general') }}</a-descriptions-item>
        <a-descriptions-item :label="t('support.updated')">{{ ticket.updated_at }}</a-descriptions-item>
      </a-descriptions>
      <p v-if="ticket.violation_id">{{ t('support.relatedViolation', { id: ticket.violation_id }) }}</p>
      <section v-if="!terminal && (ticket.capabilities.assign || ticket.capabilities.priority || ticket.capabilities.status)" class="platform-controls">
        <div v-if="ticket.capabilities.assign"><label for="support-assignee">{{ t('support.agent') }}</label><a-select id="support-assignee" v-model:value="assigneeId" :disabled="busy"><a-select-option :value="0">{{ t('support.unassigned') }}</a-select-option><a-select-option v-for="person in candidates" :key="person.id" :value="person.id">{{ person.name }}</a-select-option></a-select></div>
        <div v-if="ticket.capabilities.priority"><label for="support-priority">{{ t('support.priority') }}</label><a-select id="support-priority" v-model:value="priority" :disabled="busy"><a-select-option v-for="value in ['low','medium','high']" :key="value" :value="value">{{ t('support.priorities.' + value) }}</a-select-option></a-select></div>
        <div v-if="ticket.capabilities.status"><label for="support-target-status">{{ t('support.status') }}</label><a-select id="support-target-status" v-model:value="targetStatus" :disabled="busy"><a-select-option v-for="state in ['open','in_progress','waiting_merchant','waiting_support','resolved','closed']" :key="state" :value="state" :disabled="state === 'open'">{{ t('support.states.' + state) }}</a-select-option></a-select></div>
        <p class="status-hint">{{ t('support.saveDetailsHint') }}</p>
        <a-button v-perm="['help:ticket:assign','help:ticket:priority','help:ticket:status']" type="primary" :loading="busy" :disabled="uploading || !metadataDirty" @click="saveDetails">{{ t('support.save') }}</a-button>
      </section>
      <a-tabs v-model:active-key="pane">
        <a-tab-pane key="conversation" :tab="t('support.conversation')">
          <section class="conversation">
            <article v-for="reply in conversation" :key="reply.id" :class="['reply', { outgoing: reply.actor_type === 'admin' }]" :aria-label="reply.actor_name">
              <span class="message-avatar" :title="reply.actor_name" aria-hidden="true">{{ avatarLabel(reply) }}</span>
              <div class="message-content">
                <p class="message-sender">{{ reply.actor_name }}</p>
                <p v-if="reply.content" class="message-bubble">{{ reply.content }}</p>
                <button v-for="file in reply.attachments" :key="file.id" class="file-link" @click="supportDownload(file)"><FileTextOutlined /><span>{{ file.filename }}</span><DownloadOutlined /></button>
                <time>{{ reply.created_at }}</time>
              </div>
            </article>
          </section>
          <a-button v-if="replies.length < totals.replies" block @click="moreHistory('replies')">{{ t('support.loadMore') }}</a-button>
        </a-tab-pane>
        <a-tab-pane key="activity" :tab="t('support.activity')">
          <a-timeline><a-timeline-item v-for="event in events" :key="event.id"><strong>{{ t('support.actions.' + event.action) }}</strong><p>{{ event.actor_name }} · {{ event.created_at }}</p><p v-if="event.reason" class="preserve">{{ event.reason }}</p><p v-for="(change, key) in event.changes" :key="key" class="change">{{ changeText(String(key), change) }}</p></a-timeline-item></a-timeline>
          <a-button v-if="events.length < totals.events" block @click="moreHistory('events')">{{ t('support.loadMore') }}</a-button>
        </a-tab-pane>
      </a-tabs>
      <a-alert v-if="terminal" show-icon type="info" :message="t('support.terminal', { status: t('support.states.' + ticket.status) })" />
      <div v-else-if="ticket.capabilities.reply" class="composer">
        <p class="status-hint">{{ t('support.replyTransitionHint') }}</p>
        <a-textarea id="support-reply" v-model:value="draft" :maxlength="5000" :rows="4" :placeholder="t('support.replyHint')" />
        <div class="attachment-list"><a-tag v-for="file in files" :key="file.id" closable @close.prevent="files = files.filter(item => item.id !== file.id)">{{ file.filename }}</a-tag></div>
        <div class="composer-actions"><a-upload :before-upload="addFile" :show-upload-list="false" accept=".pdf,.jpg,.jpeg,.png,.xlsx" :disabled="uploading || busy || files.length >= 5"><a-button v-perm="'help:ticket:reply'" :loading="uploading"><PaperClipOutlined />{{ t('support.upload') }}</a-button></a-upload><a-button v-perm="'help:ticket:reply'" type="primary" :loading="busy" :disabled="uploading || (!draft.trim() && !files.length)" @click="act('reply')"><SendOutlined />{{ t('support.reply') }}</a-button></div>
      </div>
      <div class="bottom-actions"><a-button v-if="terminal && ticket.capabilities.reopen" v-perm="'help:ticket:reopen'" type="primary" @click="ask('reopen')">{{ t('support.reopen') }}</a-button></div>
    </template>
    <a-modal v-model:open="reasonOpen" :title="t('support.' + (reasonAction === 'status' ? 'changeStatus' : reasonAction))" :confirm-loading="busy" :ok-text="t('support.save')" :cancel-text="t('support.cancel')" @ok="act(reasonAction)"><a-form layout="vertical"><a-form-item :label="t('support.reason')" required><a-textarea v-model:value="reason" :maxlength="5000" :rows="4" :placeholder="t('support.reasonHint')" /></a-form-item></a-form></a-modal>
  </a-drawer>
</template>

<style scoped lang="less">
.platform-controls { margin:20px 0; }
.platform-controls>div { display:flex; align-items:center; gap:12px; margin:12px 0; }
.platform-controls label { min-width:98px; flex-shrink:0; }
.platform-controls .ant-select { flex:1; min-width:0; height:34px; }
.platform-controls :deep(.ant-select-selector) { height:34px; }
.platform-controls :deep(.ant-select-selection-item) { line-height:32px; }
.platform-controls>.ant-btn { display:block; height:34px; margin-left:auto; }
.status-hint { margin:6px 0 12px; color:#64748b; font-size:12px; }
h2 { font-size:20px; font-weight:700; margin:12px 0 20px; overflow-wrap:anywhere; }
.ticket-meta { padding-bottom:20px; border-bottom:1px solid #e2e8f0; }
.conversation { display:flex; flex-direction:column; gap:16px; padding:8px 0 16px; }
.reply { display:flex; align-items:flex-start; gap:10px; }
.message-avatar { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:28px; height:28px; margin-top:2px; border-radius:50%; background:#d9e1fb; color:#64748b; font-size:10px; font-weight:700; }
.message-content { display:flex; flex-direction:column; align-items:flex-start; min-width:0; max-width:85%; }
.message-sender { margin:0 0 4px; color:#64748b; font-size:10.5px; line-height:16px; }
.message-bubble { max-width:100%; margin:0; padding:10px 14px; border:1px solid #e2e8f0; border-radius:3px 10px 10px 10px; background:#d9e1fb; color:#1b1b1b; font-size:12.5px; line-height:20.313px; white-space:pre-wrap; overflow-wrap:anywhere; }
.reply.outgoing { flex-direction:row-reverse; }
.reply.outgoing .message-avatar { background:#4169ed; color:#fff; }
.reply.outgoing .message-content { align-items:flex-end; }
.reply.outgoing .message-bubble { border-color:transparent; border-radius:10px 3px 10px 10px; background:#4169ed; color:#fff; }
.file-link { display:flex; align-items:center; gap:8px; max-width:100%; margin-top:6px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; color:#64748b; text-align:left; cursor:pointer; font-size:11.5px; line-height:17px; }
.file-link span:not(.anticon) { min-width:0; overflow-wrap:anywhere; }
.file-link .anticon { flex-shrink:0; }
.reply.outgoing .file-link { border-color:#b9c8fa; background:#f0f4ff; color:#4169ed; }
.message-content time { margin-top:4px; color:#64748b; font-size:10.5px; line-height:16px; }
.reply.outgoing time { text-align:right; }
.preserve,.change { white-space:pre-wrap; overflow-wrap:anywhere; }
.change { color:#64748b; font-size:12px; }
.composer { margin-top:20px; }
.composer :deep(textarea.ant-input) { min-height:80px; height:80px; resize:none; }
.composer-actions,.bottom-actions { display:flex; justify-content:space-between; gap:12px; margin-top:16px; }
.composer-actions :deep(.ant-btn) { height:34px; }
.platform-controls>.ant-btn-primary:disabled,.composer-actions :deep(.ant-btn-primary:disabled) { color:#475569; background:#e2e8f0; border-color:#cbd5e1; }
.bottom-actions { justify-content:flex-end; }
.attachment-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.attachment-list :deep(.ant-tag) { max-width:100%; white-space:normal; overflow-wrap:anywhere; }
@media(max-width:600px) {
  .message-content { max-width:calc(100% - 38px); }
  .composer-actions { flex-wrap:wrap; }
  .platform-controls>div { flex-wrap:wrap; gap:8px; }
  .platform-controls label { width:100%; }
}
</style>
