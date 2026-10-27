<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { ArrowRightOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, FileTextOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
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

async function refresh(initial = false) {
  const id = props.ticketId; const current = generation;
  if (!props.open || !id) return;
  try {
    const value = await supportGet<SupportTicket>('ticket', { ticketId: id });
    if (current !== generation) return;
    const changed = !ticket.value || value.version > ticket.value.version;
    if (changed) ticket.value = value;
    failed.value = false;
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
  if (draft.value.trim() || files.value.length) Modal.confirm({ title: t('support.unsaved'), okText: t('support.discard'), cancelText: t('support.stay'), onOk: close });
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
function ask(action: string) { reason.value = ''; reasonAction.value = action; reasonOpen.value = true; }
async function act(action: string) {
  if (!ticket.value || busy.value || uploading.value) return;
  if (action !== 'reply' && !reason.value.trim()) { message.warning(t('support.reasonRequired')); return; }
  if (action === 'reply' && !draft.value.trim() && !files.value.length) return;
  const id = ticket.value.id; const current = generation;
  const body = action === 'reply' ? { content: draft.value.trim(), attachmentIds: files.value.map(file => file.id) } : { reason: reason.value.trim() };
  const fingerprint = JSON.stringify([id, action, body]);
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, data: { ticketId: id, expectedVersion: ticket.value.version, requestId: supportRequestId(), ...body } };
  busy.value = true;
  try {
    await supportAction(action, pending.data);
    if (current !== generation) return;
    pending = null; draft.value = ''; files.value = []; reasonOpen.value = false;
    message.success(t('support.changed')); emit('changed'); await refresh();
  } catch (error) {
    if (current === generation && error && typeof error === 'object' && 'code' in error && error.code === 40901) { pending = null; await refresh(); }
  } finally { busy.value = false; }
}
function foreground() { if (!document.hidden) void refresh(); }
watch(() => [props.open, props.ticketId], () => {
  generation++; clearInterval(timer); ticket.value = null; replies.value = []; events.value = []; draft.value = ''; files.value = []; pending = null; reasonOpen.value = false;
  if (props.open) { void refresh(true); timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000); }
}, { immediate: true });
window.addEventListener('focus', foreground);
onBeforeUnmount(() => { generation++; clearInterval(timer); window.removeEventListener('focus', foreground); });
</script>

<template>
  <a-drawer root-class-name="support-controls support-ticket-drawer" :open="open" :closable="false" width="min(585px, 100vw)" :mask-closable="false" @close="requestClose">
    <template #title>
      <div class="drawer-heading">
        <h2>{{ ticket?.ticket_no || t('support.tickets') }}</h2>
        <div v-if="ticket" class="ticket-badges">
          <a-tag :color="color(ticket.status)">{{ t('support.states.' + ticket.status) }}</a-tag>
          <a-tag :color="ticket.priority === 'high' ? 'red' : ticket.priority === 'medium' ? 'orange' : 'default'">{{ t('support.priorities.' + ticket.priority) }}</a-tag>
          <span>{{ t('support.categories.' + ticket.category) }}</span>
        </div>
      </div>
    </template>
    <template #extra><a-button type="text" class="drawer-close" :aria-label="t('support.closePanel')" @click="requestClose"><CloseOutlined /></a-button></template>
    <div v-if="failed" class="drawer-state"><a-alert type="error" :message="t('support.failed')" show-icon><template #action><a-button @click="refresh(true)">{{ t('support.retry') }}</a-button></template></a-alert></div>
    <div v-else-if="!ticket" class="drawer-state"><a-spin /></div>
    <template v-if="ticket">
      <section class="ticket-summary">
        <h3>{{ ticket.subject }}</h3>
        <dl class="ticket-meta">
          <div><dt>{{ t('support.created') }}</dt><dd>{{ ticket.created_at }}</dd></div>
          <div><dt>{{ t('support.updated') }}</dt><dd>{{ ticket.updated_at }}</dd></div>
          <div><dt>{{ t('support.agent') }}</dt><dd>{{ ticket.assignee_name || t('support.unassigned') }}</dd></div>
          <div><dt>{{ t('support.category') }}</dt><dd>{{ t('support.categories.' + ticket.category) }}</dd></div>
        </dl>
        <div class="ticket-context"><span>{{ t('support.property') }}: {{ ticket.property_name || t('support.general') }}</span><span>{{ t('support.creator') }}: {{ ticket.creator_name }}</span></div>
        <p v-if="ticket.violation_id" class="related-violation">{{ t('support.relatedViolation', { id: ticket.violation_id }) }}</p>
      </section>
      <a-tabs v-model:active-key="pane" class="history-tabs">
        <a-tab-pane key="conversation" :tab="t('support.conversation')">
          <section class="history-panel conversation">
            <article v-for="reply in conversation" :key="reply.id" :class="['reply', { merchant: reply.actor_type === 'merchant' }]" :aria-label="reply.actor_name">
              <span class="message-avatar" :title="reply.actor_name" aria-hidden="true">{{ avatarLabel(reply) }}</span>
              <div class="message-content">
                <p v-if="reply.actor_type !== 'merchant'" class="message-sender">{{ reply.actor_name }} · {{ t('support.supportTeam') }}</p>
                <p v-if="reply.content" class="message-bubble">{{ reply.content }}</p>
                <button v-for="file in reply.attachments" :key="file.id" class="file-link" @click="supportDownload(file)"><FileTextOutlined /><span>{{ file.filename }}</span><DownloadOutlined /></button>
                <time>{{ reply.created_at }}</time>
              </div>
            </article>
            <a-button v-if="replies.length < totals.replies" block @click="moreHistory('replies')">{{ t('support.loadMore') }}</a-button>
          </section>
        </a-tab-pane>
        <a-tab-pane key="activity" :tab="t('support.activity')">
          <section class="history-panel activity-panel">
            <a-timeline><a-timeline-item v-for="event in events" :key="event.id"><strong>{{ t('support.actions.' + event.action) }}</strong><p class="event-meta">{{ event.actor_name }} · {{ event.created_at }}</p><p v-if="event.reason" class="preserve">{{ event.reason }}</p><p v-for="(change, key) in event.changes" :key="key" class="change">{{ changeText(String(key), change) }}</p></a-timeline-item></a-timeline>
            <a-button v-if="events.length < totals.events" block @click="moreHistory('events')">{{ t('support.loadMore') }}</a-button>
          </section>
        </a-tab-pane>
      </a-tabs>
    </template>
    <template v-if="ticket" #footer>
      <div class="ticket-footer">
        <a-alert v-if="terminal" class="terminal-notice" show-icon type="success" :message="t('support.terminal', { status: t('support.states.' + ticket.status) })" />
        <div v-else-if="ticket.capabilities.reply" class="composer">
          <label for="support-ticket-reply" class="reply-label">{{ t('support.replyLabel') }}</label>
          <a-textarea id="support-ticket-reply" v-model:value="draft" :maxlength="5000" :rows="3" :placeholder="t('support.replyHint')" />
          <div v-if="files.length" class="attachment-list"><a-tag v-for="file in files" :key="file.id" closable @close.prevent="files = files.filter(item => item.id !== file.id)">{{ file.filename }}</a-tag></div>
        </div>
        <div class="ticket-actions">
          <template v-if="!terminal && ticket.capabilities.reply">
            <a-button v-perm="'mch:support:reply'" type="primary" :loading="busy" :disabled="uploading || (!draft.trim() && !files.length)" @click="act('reply')"><ArrowRightOutlined />{{ t('support.reply') }}</a-button>
            <a-upload :before-upload="addFile" :show-upload-list="false" accept=".pdf,.jpg,.jpeg,.png,.xlsx" :disabled="uploading || busy || files.length >= 5"><a-button v-perm="'mch:support:reply'" :loading="uploading"><UploadOutlined />{{ t('support.upload') }}</a-button></a-upload>
          </template>
          <a-button v-if="terminal && ticket.capabilities.reopen" v-perm="'mch:support:reopen'" class="reopen-button" @click="ask('reopen')"><ReloadOutlined />{{ t('support.reopen') }}</a-button>
          <a-button v-if="ticket.status !== 'closed' && ticket.capabilities.close" v-perm="'mch:support:close'" @click="ask('close')"><CheckOutlined />{{ t('support.close') }}</a-button>
        </div>
      </div>
    </template>
    <a-modal wrap-class-name="support-controls" v-model:open="reasonOpen" :title="t('support.' + reasonAction)" :confirm-loading="busy" :ok-text="t('support.save')" :cancel-text="t('support.cancel')" @ok="act(reasonAction)"><a-form layout="vertical"><a-form-item :label="t('support.reason')" required><a-textarea v-model:value="reason" :maxlength="5000" :rows="4" :placeholder="t('support.reasonHint')" /></a-form-item></a-form></a-modal>
  </a-drawer>
</template>

<style lang="less">
.support-ticket-drawer.ant-drawer {
  --ticket-primary: #4169ed;
  --ticket-secondary: #d9e1fb;
  --ticket-text: #1f1b36;

  .ant-drawer-content { border: 1px solid #e2e8f0; border-radius: 12px 0 0 12px; }
  .ant-drawer-header { padding: 20px; border-bottom: 1px solid #e2e8f0; }
  .ant-drawer-header-title { min-width: 0; }
  .ant-drawer-extra { margin-left: 12px; align-self: flex-start; }
  .ant-drawer-body,
  .ant-drawer-body:has(~ .ant-drawer-footer) { padding: 0 !important; }
  .ant-drawer-footer { position: static; flex-shrink: 0; padding: 0; background: #fff; border-top: 1px solid #e2e8f0; }
  .ant-btn-primary:not(:disabled) { background: var(--ticket-primary) !important; border-color: var(--ticket-primary) !important; }
}
</style>

<style scoped lang="less">
.drawer-heading h2 { margin: 0; font-size: 13.5px; line-height: 20px; font-weight: 700; color: var(--ticket-text); overflow-wrap: anywhere; }
.ticket-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.ticket-badges :deep(.ant-tag) { margin: 0; border-radius: 20px; font-size: 10.5px; line-height: 18px; padding: 0 6px; font-weight: 500; }
.ticket-badges > span:last-child:not(.ant-tag) { color: #94a3b8; font-size: 11.5px; font-weight: 400; }
.drawer-close { color: #8b8c96; padding: 0; width: 28px; height: 28px; }
.drawer-state { padding: 20px; }
.ticket-summary { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
.ticket-summary h3 { margin: 0 0 12px; color: var(--ticket-text); font-size: 13.5px; line-height: 21px; font-weight: 600; overflow-wrap: anywhere; }
.ticket-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.ticket-meta > div { padding: 10px; border: 1px solid #e2e8f0; border-radius: 7px; background: #ebf0ff; }
.ticket-meta dt { color: #8b8c96; font-size: 10.5px; line-height: 16px; }
.ticket-meta dd { margin: 2px 0 0; color: var(--ticket-text); font-size: 12px; line-height: 18px; font-weight: 600; overflow-wrap: anywhere; }
.ticket-context { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; font-size: 10.5px; line-height: 16px; color: #8b8c96; overflow-wrap: anywhere; }
.related-violation { font-size: 11px; margin: 8px 0 0; }
.history-tabs :deep(.ant-tabs-nav) { padding: 0 20px; margin: 0; }
.history-tabs :deep(.ant-tabs-tab) { padding: 12px 0; font-size: 11px; }
.history-panel { padding: 16px 20px; }
.conversation { display: flex; flex-direction: column; gap: 16px; }
.reply { display: flex; align-items: flex-start; gap: 10px; }
.message-avatar { width: 28px; height: 28px; margin-top: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; background: var(--ticket-secondary); color: #8b8c96; font-size: 10px; font-weight: 700; }
.message-content { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: 85%; }
.message-sender { margin: 0 0 4px; color: #8b8c96; font-size: 10.5px; line-height: 16px; }
.message-bubble { margin: 0; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 3px 10px 10px 10px; background: var(--ticket-secondary); color: var(--ticket-text); font-size: 12.5px; line-height: 20.313px; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; }
.reply.merchant { flex-direction: row-reverse; }
.reply.merchant .message-avatar { background: var(--ticket-primary); color: #fff; }
.reply.merchant .message-content { align-items: flex-end; }
.reply.merchant .message-bubble { background: var(--ticket-primary); color: #fff; border-color: transparent; border-radius: 10px 3px 10px 10px; }
.file-link { display: flex; align-items: center; gap: 8px; max-width: 100%; margin-top: 6px; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 7px; background: #fff; color: #64748b; text-align: left; cursor: pointer; font-size: 11.5px; line-height: 17px; }
.file-link span:not(.anticon) { min-width: 0; overflow-wrap: anywhere; }
.file-link .anticon { flex-shrink: 0; }
.reply.merchant .file-link { border-color: #b9c8fa; background: #f0f4ff; color: var(--ticket-primary); }
.message-content time { margin-top: 4px; color: #8b8c96; font-size: 10.5px; line-height: 16px; }
.reply.merchant time { text-align: right; }
.activity-panel :deep(.ant-timeline-item-content) { font-size: 12px; color: var(--ticket-text); }
.activity-panel :deep(.ant-timeline-item-head) { border-color: var(--ticket-primary); }
.event-meta,.change { color: #8b8c96; font-size: 11px; margin: 4px 0; }
.preserve,.change { white-space: pre-wrap; overflow-wrap: anywhere; }
.ticket-footer { padding: 16px 20px; }
.reply-label { display: block; margin-bottom: 8px; font-size: 10.5px; line-height: 16px; color: #8b8c96; text-transform: uppercase; letter-spacing: 1px; }
.composer :deep(textarea.ant-input) { height: 80px; min-height: 80px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 7px !important; background: #fff !important; color: var(--ticket-text); font-size: 12.5px; line-height: 20px; resize: none; }
.attachment-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.attachment-list :deep(.ant-tag) { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.ticket-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ticket-actions :deep(.ant-btn) { font-size: 12px; border-radius: 7px; }
.reopen-button { color: #b45309; border-color: #f6c68c; }
.terminal-notice { border-radius: 10px; font-size: 12.5px; }
@media(max-width:600px) { .message-content { max-width: calc(100% - 38px); } }
</style>
