<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined, MessageOutlined, MoreOutlined, PaperClipOutlined, PhoneOutlined, SearchOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons-vue';
import { chatAction, chatDetail, chatList, chatMessages, chatNoteHistory, chatReplies, chatUpload, downloadChatAttachment, previewChatAttachment, type Attachment, type ChatMessage, type Conversation, type Note } from '@/api/chat';
import { useUserStore } from '@/stores/user';
import { useChatStore } from '@/stores/chat';

const { t, locale } = useI18n();
const user = useUserStore();
const realtime = useChatStore();
const route = useRoute();
const router = useRouter();
const rows = ref<Conversation[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');
const tab = ref('all');
const status = ref('');
const assignee = ref('');
const loading = ref(false);
const detail = ref<Conversation | null>(null);
const selected = ref(0);
const messages = ref<ChatMessage[]>([]);
const history = ref<HTMLElement>();
const moreHistory = ref(false);
const draft = ref('');
const files = ref<Attachment[]>([]);
const uploading = ref(false);
const sending = ref(false);
const sendFailure = ref(false);
const pending = ref<{ clientMessageId: string; content: string; attachmentIds: number[]; files: Attachment[] } | null>(null);
const replyItems = ref<{ kind: string; content: string }[]>([]);
const noteOpen = ref(false);
const noteText = ref('');
const noteVersion = ref(0);
const noteHistory = ref<(Note & { created_at: string })[]>([]);
const notePage = ref(0);
const noteTotal = ref(0);
const noteLoading = ref(false);
const settingsOpen = ref(false);
const quickKind = ref('checkin');
const quickContent = ref('');
const transferOpen = ref(false);
const transferId = ref<number>(0);
const loadError = ref(false);
const unreadBelow = ref(false);
const previews = ref<Record<number, string>>({});
function clearPreviews() { Object.values(previews.value).forEach(URL.revokeObjectURL); previews.value = {}; }
async function loadPreviews(items: ChatMessage[], e: number) {
  for (const file of items.flatMap((m) => m.attachments || []).filter((f) => f.mime.startsWith('image/'))) {
    if (previews.value[file.id]) continue;
    try { const url = await previewChatAttachment(file.id); if (e === epoch) previews.value[file.id] = url; else URL.revokeObjectURL(url); } catch { /* The download action remains available for retry. */ }
  }
}
async function callGuest() { const data = await chatAction<{ phone: string }>('contact', { conversationId: selected.value }); if (data.phone && /^[+0-9 ()-]+$/.test(data.phone)) window.location.href = 'tel:' + data.phone.replace(/[ ()-]/g, ''); else message.info(t('chat.noPhone')); }
watch(selected, (id) => { realtime.activeConversation = id; });
let epoch = 0;
let listRequest = 0;
let searchTimer: ReturnType<typeof setTimeout>;
let refreshTimer: ReturnType<typeof setTimeout>;
let delivered = 0;
let read = 0;
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const tabs = computed(() => ['all', 'unread', ...(user.selectedProperty && user.selectedProperty.business_type !== 'hotel' ? [] : ['inhouse'])]);
const assigneeName = computed(() => detail.value?.handlers.find((h) => h.id === detail.value?.assignee_id)?.name || t('chat.unassigned'));
const nearBottom = () => !history.value || history.value.scrollHeight - history.value.scrollTop - history.value.clientHeight < 80;
const time = (value: string) => value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
function paymentLabel(value: number) { const keys: Record<number, string> = { 1: 'pending', 2: 'paid', 3: 'partialRefunded', 4: 'refunded', 5: 'failed' }; return t('booking.paymentStatus.' + (keys[value] || 'pending')); }
function sentState(id: number) {
  const receipts = detail.value?.receipts.filter((r) => r.actor_role === 'user') || [];
  return receipts.some((r) => r.read_id >= id) ? t('chat.read') : receipts.some((r) => r.delivered_id >= id) ? t('chat.delivered') : t('chat.sent');
}
async function loadList(append = false) {
  const request = ++listRequest;
  const e = epoch;
  loading.value = true;
  try {
    const result = await chatList({ page: append ? page.value + 1 : 1, pageSize: 30, keyword: keyword.value, tab: tab.value, status: status.value, assignee: assignee.value });
    if (e !== epoch || request !== listRequest) return;
    page.value = result.page; total.value = result.total;
    rows.value = append ? [...rows.value, ...result.list] : result.list;
    loadError.value = false;
  } catch { if (e === epoch) loadError.value = true; }
  finally { if (request === listRequest) loading.value = false; }
}
async function markVisible() {
  const id = selected.value;
  const max = messages.value.at(-1)?.id || 0;
  if (!max || !id) return;
  const e = epoch;
  if (max > delivered) {
    delivered = max;
    try { await chatAction('receipt', { conversationId: id, messageId: max, read: 0 }); } catch { if (e === epoch) delivered = 0; }
  }
  if (e !== epoch || selected.value !== id) return;
  if (document.visibilityState === 'visible' && document.hasFocus() && nearBottom() && max > read) {
    read = max; unreadBelow.value = false;
    try {
      await chatAction('receipt', { conversationId: id, messageId: max, read: 1 });
      if (e === epoch && selected.value === id) { const row = rows.value.find((r) => r.id === id); if (row) row.unread = 0; void realtime.refresh(); }
    } catch { if (e === epoch) read = 0; }
  }
}
async function toBottom() {
  await nextTick();
  if (history.value) history.value.scrollTop = history.value.scrollHeight;
  void markVisible();
}
async function openConversation(id: number) {
  ++epoch; clearPreviews(); const e = epoch;
  selected.value = id; detail.value = null; messages.value = []; draft.value = ''; files.value = []; pending.value = null;
  delivered = 0; read = 0; unreadBelow.value = false; sendFailure.value = false;
  try {
    const [c, result, replies] = await Promise.all([chatDetail(id), chatMessages(id), chatReplies(id, locale.value)]);
    if (e !== epoch) return;
    detail.value = c; messages.value = result.list; detail.value.receipts = result.receipts;
    moreHistory.value = result.list.length === 50; replyItems.value = replies; void loadPreviews(result.list, e);
    await toBottom();
  } catch { if (e === epoch) { selected.value = 0; detail.value = null; } }
}
async function refreshThread() {
  const id = selected.value; const e = epoch;
  if (!id) return;
  const follow = nearBottom();
  try {
    const [c, result] = await Promise.all([chatDetail(id), chatMessages(id, 0, messages.value.at(-1)?.id || 0)]);
    if (e !== epoch || selected.value !== id) return;
    detail.value = c; detail.value.receipts = result.receipts;
    const seen = new Set(messages.value.map((m) => m.id));
    const added = result.list.filter((m) => !seen.has(m.id));
    messages.value.push(...added); void loadPreviews(added, e);
    if (added.length === 50) { await refreshThread(); return; }
    if (added.length && follow) await toBottom();
    else if (added.length) unreadBelow.value = true;
    void markVisible();
  } catch { if (e === epoch) { selected.value = 0; detail.value = null; messages.value = []; noteOpen.value = false; settingsOpen.value = false; transferOpen.value = false; } }
}
async function older() {
  const id = selected.value; const e = epoch; const height = history.value?.scrollHeight || 0;
  const result = await chatMessages(id, messages.value[0]?.id || 0);
  if (e !== epoch || id !== selected.value) return;
  messages.value.unshift(...result.list); void loadPreviews(result.list, e); moreHistory.value = result.list.length === 50;
  await nextTick(); if (history.value) history.value.scrollTop += history.value.scrollHeight - height;
}
async function send(retry = false) {
  if (sending.value || uploading.value || !detail.value) return;
  if (!retry) {
    if (pending.value || (!draft.value.trim() && !files.value.length)) return;
    pending.value = { clientMessageId: crypto.randomUUID(), content: draft.value.trim(), attachmentIds: files.value.map((f) => f.id), files: [...files.value] };
    draft.value = ''; files.value = [];
  }
  const data = pending.value; const id = selected.value; const e = epoch;
  if (!data) return;
  sending.value = true; sendFailure.value = false;
  try {
    await chatAction('send', { conversationId: id, ...data });
    if (e !== epoch) return;
    pending.value = null; await refreshThread(); await toBottom(); void loadList();
  } catch { if (e === epoch) sendFailure.value = true; }
  finally { sending.value = false; }
}
async function attach(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files || []); input.value = '';
  if (files.value.length + picked.length > 5) { message.warning(t('chat.fileLimit')); return; }
  const id = selected.value; const e = epoch; uploading.value = true;
  try {
    for (const file of picked) {
      const max = file.type === 'application/pdf' ? 20 : 10;
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > max * 1024 * 1024) { message.warning(t('chat.fileTypes')); continue; }
      const uploaded = await chatUpload(id, file);
      if (e !== epoch) return;
      files.value.push(uploaded);
    }
  } finally { uploading.value = false; }
}
async function openNote() {
  if (!detail.value) return;
  noteText.value = detail.value.note?.content || ''; noteVersion.value = detail.value.note?.version || 0; noteHistory.value = []; noteOpen.value = true;
  notePage.value = 0; noteTotal.value = 0; await loadNotes();
}
async function loadNotes() {
  if (noteLoading.value) return;
  const id = selected.value; const e = epoch; const page = notePage.value + 1;
  noteLoading.value = true;
  try {
    const result = await chatNoteHistory(id, page);
    if (e !== epoch || id !== selected.value || !noteOpen.value) return;
    noteHistory.value.push(...result.list); noteTotal.value = result.total; notePage.value = page;
  } finally { noteLoading.value = false; }
}
async function saveNote() {
  const id = selected.value; const e = epoch;
  await chatAction('note', { conversationId: id, content: noteText.value, version: noteVersion.value });
  if (e !== epoch) return;
  noteOpen.value = false; await refreshThread();
}
async function change(action: string, extra: Record<string, unknown> = {}) {
  if (!detail.value) return;
  const e = epoch;
  await chatAction(action, { conversationId: selected.value, version: detail.value.version, ...extra });
  if (e !== epoch) return;
  transferOpen.value = false; await refreshThread(); void loadList();
}
function insertReply(kind: string) {
  const reply = replyItems.value.find((r) => r.kind === kind);
  if (!reply?.content) { message.info(t('chat.replyMissing')); return; }
  draft.value = reply.content;
}
function editQuick() {
  quickContent.value = replyItems.value.find((r) => r.kind === quickKind.value)?.content || '';
}
async function saveQuick() {
  const id = selected.value; const e = epoch;
  await chatAction('quick-reply', { conversationId: id, language: locale.value, kind: quickKind.value, content: quickContent.value });
  const result = await chatReplies(id, locale.value);
  if (e === epoch) { replyItems.value = result; settingsOpen.value = false; }
}
function toggleAlerts(checked: boolean | string | number) { void realtime.preferences(!!checked, realtime.soundEnabled); }
function toggleSound(checked: boolean | string | number) { void realtime.preferences(realtime.inappEnabled, !!checked); }
function enter(event: KeyboardEvent) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); } }
function resetScope() {
  ++epoch; clearPreviews(); selected.value = 0; detail.value = null; rows.value = []; messages.value = []; files.value = []; draft.value = ''; pending.value = null;
  noteOpen.value = false; settingsOpen.value = false; transferOpen.value = false;
  void loadList();
}
watch(() => user.selectedPropertyId, resetScope);
watch([tab, status, assignee], () => void loadList());
watch(keyword, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => void loadList(), 300); });
watch(quickKind, editQuick);
watch(locale, async () => { if (selected.value) { const id = selected.value; const e = epoch; const r = await chatReplies(id, locale.value); if (e === epoch) replyItems.value = r; } });
watch(() => realtime.revision, () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (realtime.event.kind !== 'receipt') void loadList();
    if (realtime.event.kind === 'ready' || realtime.event.conversationId === selected.value) void refreshThread();
  }, 100);
});
watch(() => route.query.conversationId, (id) => { if (id) void openConversation(Number(id)); });
onMounted(() => { void loadList(); if (route.query.conversationId) void openConversation(Number(route.query.conversationId)); document.addEventListener('visibilitychange', markVisible); window.addEventListener('focus', markVisible); });
onActivated(() => { if (selected.value) void refreshThread(); });
onBeforeUnmount(() => { ++epoch; clearPreviews(); realtime.activeConversation = 0; clearTimeout(searchTimer); clearTimeout(refreshTimer); document.removeEventListener('visibilitychange', markVisible); window.removeEventListener('focus', markVisible); });
</script>

<template>
  <div class="messaging" :class="{ 'thread-selected': selected }">
    <aside class="inbox">
      <div class="inbox-heading"><h1>{{ t('chat.title') }}</h1><span class="count">{{ total }}</span><a-popover :title="t('chat.alertSettings')" trigger="click"><template #content><div class="preference-row"><span>{{ t('chat.inappAlerts') }}</span><a-switch :checked="realtime.inappEnabled" @change="toggleAlerts" /></div><div class="preference-row"><span>{{ t('chat.soundAlerts') }}</span><a-switch :checked="realtime.soundEnabled" @change="toggleSound" /></div></template><button class="icon-button" :aria-label="t('chat.alertSettings')"><SettingOutlined /></button></a-popover></div>
      <div class="search"><SearchOutlined /><input v-model="keyword" :placeholder="t('chat.search')" :aria-label="t('chat.search')" /></div>
      <div class="tabs"><button v-for="item in tabs" :key="item" :class="{ active: tab === item }" @click="tab = item">{{ t('chat.tabs.' + item) }}</button></div>
      <div class="filters">
        <a-select v-model:value="status" size="small" :aria-label="t('chat.status')"><a-select-option value="">{{ t('chat.allStatuses') }}</a-select-option><a-select-option value="0">{{ t('chat.open') }}</a-select-option><a-select-option value="1">{{ t('chat.resolved') }}</a-select-option></a-select>
        <a-select v-model:value="assignee" size="small" :aria-label="t('chat.assignee')"><a-select-option value="">{{ t('chat.anyAssignee') }}</a-select-option><a-select-option value="mine">{{ t('chat.mine') }}</a-select-option><a-select-option value="unassigned">{{ t('chat.unassigned') }}</a-select-option></a-select>
      </div>
      <div class="conversation-list" :aria-busy="loading">
        <button v-for="row in rows" :key="row.id" class="conversation" :class="{ selected: selected === row.id, unread: row.unread }" @click="openConversation(row.id)">
          <span class="avatar">{{ initials(row.guest_name) }}</span>
          <span class="row-content"><span class="row-head"><strong>{{ row.guest_name }}</strong><small>{{ time(row.last_time) }}<template v-if="row.awaiting_reply"> · {{ t('chat.awaitingReply') }}</template></small></span><span class="property-label">{{ row.property_name }} · {{ row.order_no || t('chat.prebooking') }}</span><span class="row-preview"><span>{{ row.last_message || t('chat.noMessages') }}</span><b v-if="row.unread" class="unread-count">{{ row.unread }}</b><CheckOutlined v-else-if="row.status === 1" class="resolved-icon" /></span></span>
        </button>
        <div v-if="!rows.length && !loading" class="empty-list"><MessageOutlined /><p>{{ loadError ? t('chat.loadError') : t('chat.empty') }}</p><a-button v-if="loadError" @click="loadList()">{{ t('chat.retry') }}</a-button></div>
        <a-button v-if="rows.length < total" block type="text" :loading="loading" @click="loadList(true)">{{ t('chat.loadMore') }}</a-button>
        <div v-if="loading" class="list-loading"><a-spin size="small" /></div>
      </div>
    </aside>
    <main class="thread">
      <template v-if="detail">
        <header class="thread-header">
          <button class="mobile-back icon-button" :aria-label="t('chat.back')" @click="selected = 0"><ArrowLeftOutlined /></button>
          <span class="avatar">{{ initials(detail.guest_name) }}</span>
          <div class="guest-heading"><h2>{{ detail.guest_name }} <span v-if="detail.booking?.booking_status === 3" class="tag inhouse">{{ t('chat.tabs.inhouse') }}</span><span v-if="detail.status === 1" class="tag resolved"><CheckOutlined /> {{ t('chat.resolved') }}</span></h2><span>{{ detail.property_name }} · {{ assigneeName }}</span></div>
          <button v-perm="'mch:order:guest-contact'" class="icon-button" :aria-label="t('chat.call')" @click="callGuest"><PhoneOutlined /></button><a-dropdown :trigger="['click']"><button class="icon-button" :aria-label="t('chat.actions')"><MoreOutlined /></button><template #overlay><a-menu>
            <a-menu-item key="note" @click="openNote"><EditOutlined /> {{ t('chat.note') }}</a-menu-item>
            <a-menu-item v-if="user.hasPerm('mch:chat:reply') && !detail.assignee_id" key="claim" @click="change('claim')">{{ t('chat.claim') }}</a-menu-item>
            <a-menu-item v-if="user.hasPerm('mch:chat:assign')" key="assign" @click="transferId = detail.assignee_id; transferOpen = true">{{ t('chat.assign') }}</a-menu-item>
            <a-menu-item v-if="user.hasPerm('mch:chat:resolve')" key="resolve" @click="change('resolve', { resolved: detail.status === 1 ? 0 : 1 })">{{ detail.status === 1 ? t('chat.reopen') : t('chat.resolve') }}</a-menu-item>
          </a-menu></template></a-dropdown>
        </header>
        <div class="booking-card" v-if="detail.booking"><div><span class="eyebrow">{{ t('chat.booking') }} #{{ detail.booking.order_no }}</span><strong>{{ detail.booking.goods_name }} · {{ detail.booking.sku_name }}</strong><span>{{ detail.booking.use_date }} → {{ detail.booking.end_date }} · {{ detail.booking.quantity }} {{ t('chat.rooms') }}</span><span>{{ detail.booking.currency }} {{ detail.booking.pay_amount }} · {{ paymentLabel(detail.booking.payment_status) }}</span></div><a-button type="link" @click="router.push({ path: '/order', query: { notificationTarget: String(detail.booking.id) } })">{{ t('chat.viewBooking') }} ↗</a-button></div>
        <div class="booking-card prebooking" v-else>{{ detail.order_id ? t('chat.bookingRestricted') : t('chat.prebookingHint') }}</div>
        <button v-if="detail.note?.content" class="note-strip" @click="openNote"><EditOutlined /><strong>{{ t('chat.note') }}</strong><span>{{ detail.note.content }}</span><span>↗</span></button>
        <div class="connection" :class="{ offline: !realtime.connected }"><span />{{ realtime.connected ? t('chat.connected') : t('chat.reconnecting') }}</div>
        <div ref="history" class="message-history" @scroll="markVisible">
          <div class="history-start"><a-button v-if="moreHistory" size="small" type="text" @click="older">{{ t('chat.older') }}</a-button><span v-else>{{ t('chat.historyStart') }}</span></div>
          <div v-if="!messages.length" class="empty-chat">{{ t('chat.noMessages') }}</div>
          <div v-for="item in messages" :key="item.id" class="message-row" :class="{ outgoing: item.sender_type !== 1 }">
            <span v-if="item.sender_type === 1" class="avatar small">{{ initials(detail.guest_name) }}</span>
            <div class="message-body"><span v-if="item.sender_type !== 1" class="sender">{{ item.sender_role === 'admin' ? t('chat.platform') + ' · ' : '' }}{{ item.sender_name }}</span><div class="bubble"><p v-if="item.content">{{ item.content }}</p><a-image v-for="file in item.attachments.filter((f) => previews[f.id])" :key="'preview-' + file.id" :src="previews[file.id]" :width="160" :alt="file.filename" /><button v-for="file in item.attachments" :key="file.id" class="attachment" @click="downloadChatAttachment(file.id)"><PaperClipOutlined /> {{ file.filename }} <small>{{ (file.size / 1024 / 1024).toFixed(1) }} MB</small> ↗</button></div><div class="message-meta">{{ time(item.created_at) }}<span v-if="item.sender_type !== 1"> · {{ sentState(item.id) }}</span></div></div>
          </div>
          <div v-if="pending" class="message-row outgoing"><div class="message-body"><div class="bubble"><p>{{ pending.content }}</p><p v-for="file in pending.files" :key="file.id">{{ file.filename }}</p></div><small v-if="sending">{{ t('chat.sending') }}</small><button v-if="sendFailure" class="retry-send" @click="send(true)">{{ t('chat.sendFailed') }} · {{ t('chat.retry') }}</button></div></div>
        </div>
        <button v-if="unreadBelow" class="new-messages" @click="toBottom">{{ t('chat.newMessages') }} ↓</button>
        <footer class="composer" v-if="user.hasPerm('mch:chat:reply')">
          <div class="quick-replies"><button v-for="kind in ['checkin', 'wifi', 'directions']" :key="kind" @click="insertReply(kind)">{{ t('chat.quick.' + kind) }}</button><button v-perm="'mch:chat:settings'" :aria-label="t('chat.quickSettings')" @click="editQuick(); settingsOpen = true"><SettingOutlined /></button></div>
          <div v-if="files.length" class="file-drafts"><span v-for="file in files" :key="file.id">{{ file.filename }}<button :aria-label="t('chat.remove')" @click="files = files.filter((f) => f.id !== file.id)"><CloseOutlined /></button></span></div>
          <div class="input-row"><label class="attach-button" :class="{ disabled: uploading || !!pending }"><PaperClipOutlined /><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" :aria-label="t('chat.attach')" :disabled="uploading || !!pending" @change="attach" /></label><textarea v-model="draft" :maxlength="2000" :placeholder="t('chat.placeholder')" rows="2" @keydown="enter" /><button class="send-button" :aria-label="t('chat.send')" :disabled="sending || uploading || !!pending || (!draft.trim() && !files.length)" @click="send()"><SendOutlined /></button></div>
          <div class="composer-hint"><span>{{ uploading ? t('chat.uploading') : t('chat.inputHint') }}</span><span>{{ draft.length }}/2000</span></div>
        </footer>
      </template>
      <div v-else class="thread-empty"><MessageOutlined /><h2>{{ selected ? t('chat.loading') : t('chat.select') }}</h2><p>{{ t('chat.selectHint') }}</p><a-button v-if="selected" class="mobile-back" @click="selected = 0">{{ t('chat.back') }}</a-button></div>
    </main>
    <a-drawer v-model:open="noteOpen" :title="t('chat.note')" :width="Math.min(480, 0.94 * (history?.ownerDocument.defaultView?.innerWidth || 480))"><p class="private-hint">{{ t('chat.privateNote') }}</p><a-textarea v-model:value="noteText" :rows="8" :maxlength="10000" :disabled="!user.hasPerm('mch:chat:note')" /><a-button v-perm="'mch:chat:note'" type="primary" class="save-note" @click="saveNote">{{ t('chat.save') }}</a-button><h3>{{ t('chat.noteHistory') }}</h3><article v-for="item in noteHistory" :key="item.version" class="note-version"><strong>v{{ item.version }} · {{ item.editor_name }}</strong><small>{{ time(item.created_at) }}</small><p>{{ item.content }}</p></article><a-button v-if="noteHistory.length < noteTotal" :loading="noteLoading" @click="loadNotes">{{ t('chat.loadMore') }}</a-button></a-drawer>
    <a-modal v-model:open="transferOpen" :title="t('chat.assign')" @ok="change('assign', { assigneeId: transferId })"><a-select v-model:value="transferId" style="width:100%"><a-select-option :value="0">{{ t('chat.unassigned') }}</a-select-option><a-select-option v-for="handler in detail?.handlers" :key="handler.id" :value="handler.id">{{ handler.name }}</a-select-option></a-select></a-modal>
    <a-modal v-model:open="settingsOpen" :title="t('chat.quickSettings')" @ok="saveQuick"><p>{{ detail?.property_name }} · {{ locale }}</p><a-select v-model:value="quickKind" style="width:100%; margin-bottom:16px"><a-select-option v-for="kind in ['checkin', 'wifi', 'directions']" :key="kind" :value="kind">{{ t('chat.quick.' + kind) }}</a-select-option></a-select><p v-if="quickKind === 'wifi'">{{ t('chat.wifiRestriction') }}</p><a-textarea v-model:value="quickContent" :rows="6" :maxlength="2000" /></a-modal>
  </div>
</template>

<style scoped lang="less">
.preference-row { display:flex; gap:24px; align-items:center; justify-content:space-between; padding:8px 0; }
.messaging { display:flex; height:calc(100dvh - 56px); min-height:0; overflow:hidden; background:#fff; border:1px solid var(--mtrip-border); border-radius:0; color:var(--mtrip-text-main); }
.inbox { width:348px; flex-shrink:0; border-right:1px solid #e9edf2; display:flex; flex-direction:column; }
.inbox-heading { display:flex; .icon-button { margin-left:auto; } align-items:center; gap:10px; padding:24px 20px 18px; h1 { font-size:22px; margin:0; font-weight:650; } .count { padding:2px 8px; border-radius:20px; background:#f2f5fa; font-size:12px; color:#6d778b; } }
.search { display:flex; gap:10px; align-items:center; margin:0 20px 16px; padding:10px 12px; border:1px solid #e5e9ef; border-radius:8px; color:#8490a3; input { min-width:0; width:100%; border:0; outline:0; background:transparent; font:inherit; font-size:12px; color:var(--mtrip-text-main); } }
.tabs { display:flex; margin:0 20px 12px; gap:6px; padding:4px; background:#f5f6f9; border-radius:24px; button { flex:1; padding:7px 4px; border:0; background:none; color:#6b7485; border-radius:20px; cursor:pointer; font:inherit; font-size:12px; white-space:nowrap; } button.active { background:#4169ed; color:white; box-shadow:0 2px 5px #4169ed22; } }
.filters { padding:0 20px 16px; display:flex; gap:8px; :deep(.ant-select) { width:50%; } }
.conversation-list { overflow-y:auto; flex:1; border-top:1px solid #edf0f4; }
.conversation { display:flex; align-items:center; gap:12px; width:100%; padding:20px; border:0; border-bottom:1px solid #f0f2f6; background:#fff; text-align:left; cursor:pointer; font:inherit; border-left:3px solid transparent; &:hover { background:#f9faff; } &.selected { background:#f0f4ff; border-left-color:#4169ed; } }
.avatar { width:42px; height:42px; border-radius:50%; background:#eef1f6; color:#73809a; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; flex-shrink:0; &.small { width:30px; height:30px; font-size:10px; } }
.row-content { display:flex; flex-direction:column; gap:6px; min-width:0; flex:1; }.row-head { display:flex; justify-content:space-between; gap:6px; strong { font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { font-size:9px; color:#9aa2af; white-space:nowrap; } }.unread .row-head strong { font-weight:700; }.property-label { font-size:11px; color:#8490a3; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.row-preview { display:flex; gap:8px; align-items:center; font-size:12px; color:#8790a1; >span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } }.unread .row-preview { color:#3c4659; }.unread-count { background:#4169ed; color:#fff; min-width:18px; height:18px; border-radius:9px; text-align:center; font-size:10px; padding:2px; }.resolved-icon { color:#239d79; }
.empty-list { text-align:center; padding:70px 25px; color:#9aa3b3; font-size:13px; > .anticon { font-size:30px; } }.list-loading { padding:16px; text-align:center; }
.thread { flex:1; min-width:0; display:flex; flex-direction:column; position:relative; }.thread-header { padding:20px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #edf0f4; }.guest-heading { flex:1; min-width:0; h2 { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 0 4px; font-size:16px; font-weight:600; } >span { color:#9aa2b0; font-size:11px; } }.tag { font-size:10px; font-weight:500; border-radius:4px; padding:3px 7px; }.inhouse { background:#eff4ff; color:#4b78d0; }.resolved { color:#208a66; background:#e8f6ee; }.icon-button { border:1px solid #e9edf3; background:#fff; width:34px; height:34px; border-radius:7px; cursor:pointer; }.mobile-back { display:none; }
.booking-card { margin:20px 20px 0; padding:14px 16px; background:#f8faff; border:1px solid #e5ebf7; border-radius:9px; display:flex; align-items:center; justify-content:space-between; gap:12px; >div { display:flex; flex-direction:column; gap:5px; min-width:0; } strong { font-size:13px; font-weight:500; } span { font-size:11px; color:#8591a5; } .eyebrow { color:#4169ed; font-size:10px; } :deep(.ant-btn) { font-size:11px; } }.prebooking { color:#8d98a8; font-size:12px; background:#fafbfc; }
.note-strip { display:flex; gap:8px; align-items:center; margin:12px 20px 0; padding:12px; color:#bc7a22; background:#fff7e7; border:1px solid #fbe8c2; border-radius:7px; cursor:pointer; font-size:11px; strong { white-space:nowrap; } >span:nth-last-child(2) { flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; text-align:left; } }
.connection { display:flex; align-items:center; gap:5px; margin:10px 20px 0; color:#9aa6b8; font-size:10px; >span { width:5px; height:5px; background:#31b38b; border-radius:50%; } &.offline >span { background:#e9a744; } }
.message-history { flex:1; overflow-y:auto; padding:16px 20px 24px; overscroll-behavior:contain; }.history-start { text-align:center; color:#bac0ca; font-size:10px; margin-bottom:24px; }.message-row { display:flex; gap:8px; margin-bottom:16px; align-items:flex-end; &.outgoing { justify-content:flex-end; } }.message-body { max-width:75%; }.sender { display:block; text-align:right; font-size:10px; color:#8d98aa; margin:0 2px 5px; }.bubble { padding:12px 16px; border-radius:12px 12px 12px 3px; background:#f3f5f8; font-size:13px; line-height:1.65; overflow-wrap:anywhere; p { margin:0; white-space:pre-wrap; } }.outgoing .bubble { color:white; background:#4169ed; border-radius:12px 12px 3px 12px; }.message-meta { margin-top:6px; font-size:9px; color:#a9b1bf; }.outgoing .message-meta { text-align:right; }.attachment { display:block; padding:6px 0; color:inherit; border:0; background:none; text-decoration:underline; cursor:pointer; overflow-wrap:anywhere; font-size:12px; small { opacity:.65; } }.empty-chat { padding:50px; text-align:center; color:#a9b1bf; font-size:13px; }.retry-send { border:0; background:none; color:#c55c48; cursor:pointer; font-size:11px; }.new-messages { position:absolute; bottom:156px; left:50%; transform:translateX(-50%); border:1px solid #d8e1ff; background:#fff; color:#4169ed; padding:7px 16px; border-radius:20px; font-size:11px; cursor:pointer; box-shadow:0 3px 12px #1a2c4b15; }
.composer { padding:12px 20px; border-top:1px solid #edf0f4; }.quick-replies { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; button { border:1px solid #e5eaf1; background:white; padding:6px 10px; border-radius:16px; font-size:10px; color:#78859a; cursor:pointer; &:hover { border-color:#4169ed; color:#4169ed; } } }.input-row { border:1px solid #e2e6ed; border-radius:9px; display:flex; align-items:center; padding:8px; gap:8px; textarea { flex:1; min-width:0; resize:none; border:0; outline:0; font:inherit; font-size:12px; line-height:20px; max-height:100px; } }.attach-button { padding:8px; color:#9aa3b2; font-size:19px; cursor:pointer; input { display:none; } }.disabled { opacity:.4; cursor:default; }.send-button { width:38px; height:38px; background:#4169ed; color:#fff; border:0; border-radius:7px; cursor:pointer; &:disabled { opacity:.4; cursor:default; } }.composer-hint { display:flex; justify-content:space-between; margin-top:6px; color:#acb3bf; font-size:9px; }.file-drafts { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; >span { padding:5px 8px; background:#f1f5ff; font-size:11px; border-radius:5px; button { border:0; background:none; cursor:pointer; } } }.thread-empty { margin:auto; text-align:center; padding:40px; color:#a0aabb; >.anticon { font-size:48px; color:#c9d3e6; } h2 { font-size:18px; color:#5f6d85; margin-top:24px; } p { font-size:12px; } }
.private-hint { background:#fff6e5; color:#a9752b; padding:12px; border-radius:6px; font-size:12px; }.save-note { margin:16px 0 32px; }.note-version { border-top:1px solid #eef0f5; padding:16px 0; strong,small { display:block; } small { color:#9aa4b4; font-size:10px; margin-top:4px; } p { white-space:pre-wrap; font-size:12px; margin-top:10px; } }
@media(max-width:1100px) { .inbox { width:300px; }.conversation { padding:16px 12px; }.message-body { max-width:85%; } }
@media(max-width:760px) { .preference-row { display:flex; gap:24px; align-items:center; justify-content:space-between; padding:8px 0; }
.messaging { height:calc(100dvh - 56px); min-height:0; border-radius:8px; }.inbox { width:100%; border-right:0; }.thread { display:none; }.thread-selected .inbox { display:none; }.thread-selected .thread { display:flex; width:100%; }.mobile-back { display:inline-block; }.thread-header { padding:14px 12px; gap:8px; }.thread-header .avatar { display:none; }.guest-heading h2 { font-size:14px; }.booking-card { margin:12px 12px 0; padding:10px; flex-wrap:wrap; }.note-strip { margin:10px 12px 0; }.message-history { padding:16px 12px; }.composer { padding:12px; }.connection { margin-left:12px; }.message-body { max-width:88%; }.row-head small { font-size:10px; }.new-messages { bottom:160px; white-space:nowrap; } }
</style>
