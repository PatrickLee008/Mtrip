<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { CloseOutlined, FileTextOutlined, DownOutlined, SearchOutlined, LinkOutlined, MobileOutlined,
  DesktopOutlined, MailOutlined, MessageOutlined, CheckCircleFilled, ThunderboltOutlined,
  CalendarOutlined, SendOutlined, EyeOutlined, BellOutlined, HistoryOutlined } from '@ant-design/icons-vue';
import { apiMerchantNotifySend, apiMerchantNotifyTemplates } from '@/api/merchant';
import type { TableRow } from '@/composables/useTable';
import { get } from '@/utils/http';
import { genUUID } from '@/utils/uuid';

const props = defineProps<{ open: boolean; merchant: TableRow | null }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'sent'): void }>();
const { t } = useI18n();
const CATEGORIES = ['booking', 'promotion', 'rewards', 'wallet', 'refund', 'account', 'security', 'support', 'system'];
const CHANNELS = [
  { key: 'push', icon: MobileOutlined }, { key: 'inapp', icon: DesktopOutlined },
  { key: 'email', icon: MailOutlined }, { key: 'sms', icon: MessageOutlined },
];
const DEEP_LINKS = ['booking_detail', 'wallet', 'promotion', 'user_profile', 'page', 'none'];
const PAGES = ['/dashboard', '/order', '/promotions', '/earnings', '/notifications', '/settings'];
const form = reactive({ category: undefined as string | undefined, title: '', message: '', deepLinkType: 'none',
  deepLinkValue: '', channels: ['inapp'] as string[], sendType: 1, scheduleDate: '', scheduleTime: '' });
const availableChannels = ref<Record<string, boolean>>({});
const channelsLoading = ref(false);
const channelsFailed = ref(false);
const templates = ref<TableRow[]>([]);
const templatesLoading = ref(false);
const templatesFailed = ref(false);
const templateOpen = ref(false);
const templateQuery = ref('');
const templateId = ref<number>();
const sending = ref(false);
const previewOpen = ref(false);
const notifications = ref<TableRow[]>([]);
const historyOpen = ref(false);
const historyLoading = ref(false);
const historyFailed = ref(false);
const historyPage = ref(1);
const historyTotal = ref(0);
const merchantCode = computed(() => props.merchant?.merchant_code || `MCH-${String(props.merchant?.id || '').padStart(4, '0')}`);
const merchantName = computed(() => props.merchant?.merchant_name || '—');
const initials = computed(() => Array.from(merchantName.value).slice(0, 2).join('').toUpperCase());
const filteredTemplates = computed(() => {
  const query = templateQuery.value.trim().toLocaleLowerCase();
  return templates.value.filter(tp => `${tp.title} ${tp.message} ${t(`merchant.notifyPage.cat.${tp.category}`)}`.toLocaleLowerCase().includes(query));
});
const unresolved = computed(() => /{{|}}/.test(form.title + form.message));
const selectedChannels = computed(() => CHANNELS.filter(ch => form.channels.includes(ch.key)));
let generation = 0;
let channelsRequest = 0;
let templatesRequest = 0;
let historyRequest = 0;
let requestId = '';
let retryPayload = '';
watch(() => [props.open, props.merchant?.id], () => {
  generation += 1;
  previewOpen.value = false;
  templateOpen.value = false;
  historyOpen.value = false;
  notifications.value = [];
  historyTotal.value = 0;
  historyPage.value = 1;
  historyLoading.value = false;
  historyFailed.value = false;
  templates.value = [];
  templateId.value = undefined;
  templateQuery.value = '';
  availableChannels.value = {};
  channelsLoading.value = false;
  templatesLoading.value = false;
  channelsFailed.value = false;
  templatesFailed.value = false;
  Object.assign(form, { category: undefined, title: '', message: '', deepLinkType: 'none', deepLinkValue: '',
    channels: ['inapp'], sendType: 1, scheduleDate: '', scheduleTime: '' });
  requestId = '';
  retryPayload = '';
  if (props.open && props.merchant) { void loadChannels(); void loadTemplates(); }
}, { immediate: true });
watch(() => form.deepLinkType, () => { form.deepLinkValue = ''; }, { flush: 'sync' });
async function loadChannels(): Promise<void> {
  const current = generation;
  const request = ++channelsRequest;
  channelsLoading.value = true;
  channelsFailed.value = false;
  availableChannels.value = {};
  try {
    const result = await get<Record<string, boolean>>('/admin/merchant/notification/channels');
    if (current === generation && request === channelsRequest) availableChannels.value = result;
  } catch { if (current === generation && request === channelsRequest) channelsFailed.value = true; }
  finally { if (current === generation && request === channelsRequest) channelsLoading.value = false; }
}
async function loadTemplates(): Promise<void> {
  if (!props.merchant) return;
  const current = generation;
  const request = ++templatesRequest;
  templatesLoading.value = true;
  templatesFailed.value = false;
  templates.value = [];
  try {
    const result = await apiMerchantNotifyTemplates(props.merchant.id);
    if (current === generation && request === templatesRequest) templates.value = result;
  } catch { if (current === generation && request === templatesRequest) templatesFailed.value = true; }
  finally { if (current === generation && request === templatesRequest) templatesLoading.value = false; }
}
function applyTemplate(id: number): void {
  if (sending.value) return;
  const tp = templates.value.find(item => item.id === id);
  if (!tp) return;
  templateId.value = id;
  form.category = CATEGORIES.includes(tp.category) ? tp.category : undefined;
  form.title = tp.title || '';
  form.message = tp.message || '';
  form.deepLinkType = DEEP_LINKS.includes(tp.deep_link_type) ? tp.deep_link_type : 'none';
  form.deepLinkValue = form.deepLinkType === 'none' ? '' : tp.deep_link_value || '';
  templateOpen.value = false;
}
function toggleChannel(key: string): void {
  if (sending.value || !availableChannels.value[key]) return;
  form.channels = form.channels.includes(key) ? form.channels.filter(value => value !== key) : [...form.channels, key];
}
function channelDescription(key: string): string {
  if (!availableChannels.value[key]) return t('merchant.s3.unconfigured');
  if (key === 'email') return props.merchant?.contact_email || '—';
  if (key === 'sms') return props.merchant?.contact_phone || '—';
  return t(`merchant.notifyPage.channelHint.${key}`);
}
function previewParts(value: string): { text: string; variable: boolean }[] {
  return value.split(/({{[^{}]*}})/g).filter(Boolean).map(text => ({ text, variable: /^{{[^{}]*}}$/.test(text) }));
}
function preview(): void { previewOpen.value = true; }
function close(): void { if (!sending.value) emit('update:open', false); }
async function send(): Promise<void> {
  if (sending.value || channelsLoading.value || !props.merchant) return;
  if (!form.category || !CATEGORIES.includes(form.category) || !form.title.trim() || !form.message.trim()
    || Array.from(form.title.trim()).length > 200 || Array.from(form.message.trim()).length > 1000) {
    message.warning(t('merchant.notifyPage.required')); return;
  }
  if (unresolved.value) { message.warning(t('merchant.notifyPage.variablesRequired')); return; }
  if (!form.channels.length || form.channels.some(ch => !availableChannels.value[ch])) {
    message.warning(t('merchant.notifyPage.channelRequired')); return;
  }
  if (!DEEP_LINKS.includes(form.deepLinkType)
    || (['booking_detail', 'promotion'].includes(form.deepLinkType) && !/^[1-9]\d*$/.test(form.deepLinkValue.trim()))
    || (form.deepLinkType === 'page' && !PAGES.includes(form.deepLinkValue))) {
    message.warning(t('merchant.notifyPage.destinationRequired')); return;
  }
  let sendAt: string | undefined;
  let scheduledInPast = false;
  if (form.sendType === 2) {
    const value = `${form.scheduleDate}T${form.scheduleTime}:00+06:30`;
    const date = new Date(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.scheduleDate) || !/^\d{2}:\d{2}$/.test(form.scheduleTime)
      || !Number.isFinite(date.getTime())
      || new Date(date.getTime() + 390 * 60000).toISOString().slice(0, 16) !== `${form.scheduleDate}T${form.scheduleTime}`) {
      message.warning(t('merchant.notifyPage.scheduleRequired')); return;
    }
    sendAt = date.toISOString();
    scheduledInPast = date.getTime() <= Date.now();
  }
  const payload = { merchantId: props.merchant.id, category: form.category, title: form.title.trim(), message: form.message.trim(),
    deepLinkType: form.deepLinkType, deepLinkValue: ['booking_detail', 'promotion', 'page'].includes(form.deepLinkType) ? form.deepLinkValue.trim() : '',
    channels: [...form.channels], sendType: form.sendType, sendAt, templateId: templateId.value };
  const key = JSON.stringify(payload);
  // A lost response may be retried after the due time; only the exact earlier request is eligible.
  if (scheduledInPast && key !== retryPayload) { message.warning(t('merchant.notifyPage.scheduleRequired')); return; }
  if (key !== retryPayload) { requestId = genUUID(); retryPayload = key; }
  const current = generation;
  sending.value = true;
  try {
    await apiMerchantNotifySend({ ...payload, requestId });
    message.success(t(payload.sendType === 2 ? 'merchant.s3.scheduled' : 'merchant.notifyPage.sent'));
    if (current === generation) { emit('update:open', false); emit('sent'); }
  } catch { /* The HTTP layer displays failures; retain this draft and request ID for retry. */ }
  finally { sending.value = false; }
}
async function loadHistory(page = 1): Promise<void> {
  if (!props.merchant) return;
  const current = generation;
  const request = ++historyRequest;
  historyPage.value = page;
  historyLoading.value = true;
  historyFailed.value = false;
  notifications.value = [];
  historyTotal.value = 0;
  try {
    const result = await get<{ list: TableRow[]; total: number }>('/admin/merchant/notification/list', { merchantId: props.merchant.id, page, pageSize: 5 });
    if (current === generation && request === historyRequest) { notifications.value = result.list; historyTotal.value = result.total; }
  } catch { if (current === generation && request === historyRequest) historyFailed.value = true; }
  finally { if (current === generation && request === historyRequest) historyLoading.value = false; }
}
function toggleHistory(): void { historyOpen.value = !historyOpen.value; if (historyOpen.value) void loadHistory(); }
function formatHistoryTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString(undefined, { timeZone: 'Asia/Yangon' });
}
</script>

<template>
  <a-drawer :open="open" :width="540" :root-style="{ zIndex: 1100 }" root-class-name="merchant-notify-drawer" :closable="false"
    :mask-closable="!sending" :keyboard="!sending" @close="close">
    <template #title>
      <div class="notify-heading"><div><h2>{{ t('merchant.notifyPage.title') }}</h2><p>{{ t('merchant.notifyPage.toMerchant', { name: merchantName, code: merchantCode }) }}</p></div>
        <a-button type="text" :disabled="sending" :aria-label="t('common.close')" @click="close"><CloseOutlined /></a-button>
      </div>
    </template>
    <a-form layout="vertical" class="notify-form" :disabled="sending">
      <a-form-item :label="t('merchant.notifyPage.recipient')">
        <div class="notify-recipient"><span class="notify-avatar">{{ initials }}</span><div class="notify-recipient-info">
          <div class="notify-recipient-name"><strong>{{ merchantName }}</strong><code>{{ merchantCode }}</code></div>
          <div class="notify-contacts"><span>{{ merchant?.contact_email || '—' }}</span><span>{{ merchant?.contact_phone || '—' }}</span></div>
        </div><em>{{ t('merchant.notifyPage.readOnly') }}</em></div>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.category')" required>
        <a-select v-model:value="form.category" :dropdown-style="{ zIndex: 1150 }" :placeholder="t('merchant.notifyPage.categoryPlaceholder')" :aria-label="t('merchant.notifyPage.category')">
          <a-select-option v-for="category in CATEGORIES" :key="category" :value="category">{{ t(`merchant.notifyPage.cat.${category}`) }}</a-select-option>
        </a-select>
      </a-form-item>
      <div class="notify-template">
        <button type="button" class="notify-template-toggle" :disabled="sending" :aria-expanded="templateOpen" @click="templateOpen = !templateOpen">
          <FileTextOutlined /><span>{{ t('merchant.notifyPage.useTemplate') }} <small>{{ t('merchant.notifyPage.templatePlaceholder') }}</small></span><DownOutlined :class="{ 'is-open': templateOpen }" />
        </button>
        <div v-if="templateOpen" class="notify-template-panel">
          <a-input v-model:value="templateQuery" :placeholder="t('merchant.notifyPage.templateSearch')" :aria-label="t('merchant.notifyPage.templateSearch')" allow-clear><template #prefix><SearchOutlined /></template></a-input>
          <div v-if="templatesLoading" class="notify-state"><a-spin size="small" /></div>
          <div v-else-if="templatesFailed" class="notify-state" role="alert">{{ t('merchant.notifyPage.templatesFailed') }} <a-button type="link" size="small" @click="loadTemplates">{{ t('merchant.notifyPage.retry') }}</a-button></div>
          <div v-else-if="!filteredTemplates.length" class="notify-state">{{ t('merchant.notifyPage.templatesEmpty') }}</div>
          <div v-else class="notify-template-results"><button v-for="tp in filteredTemplates" :key="tp.id" type="button" :disabled="sending" @click="applyTemplate(tp.id)">
            <span class="notify-template-category">{{ t(`merchant.notifyPage.cat.${tp.category}`) }}</span><strong>{{ tp.title }}</strong><span>{{ tp.message }}</span>
          </button></div>
        </div>
      </div>
      <a-form-item :label="t('merchant.notifyPage.titleLabel')" required>
        <a-input v-model:value="form.title" :maxlength="200" :placeholder="t('merchant.notifyPage.titlePlaceholder')" :aria-label="t('merchant.notifyPage.titleLabel')" />
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.messageLabel')" required>
        <a-textarea v-model:value="form.message" :rows="5" :maxlength="1000" :placeholder="t('merchant.notifyPage.messagePlaceholder')" :aria-label="t('merchant.notifyPage.messageLabel')" />
        <div class="notify-count">{{ t('merchant.notifyPage.characterCount', { count: Array.from(form.message).length }) }}</div>
        <div v-if="unresolved" class="notify-variable-warning" role="status">{{ t('merchant.notifyPage.variablesRequired') }}</div>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.deepLink')">
        <a-select v-model:value="form.deepLinkType" :dropdown-style="{ zIndex: 1150 }" :aria-label="t('merchant.notifyPage.deepLink')">
          <template #suffixIcon><LinkOutlined /></template>
          <a-select-option v-for="link in DEEP_LINKS" :key="link" :value="link">{{ t(`merchant.notifyPage.link.${link}`) }}</a-select-option>
        </a-select>
        <a-input v-if="['booking_detail', 'promotion'].includes(form.deepLinkType)" v-model:value="form.deepLinkValue" class="notify-link-value" :maxlength="30" :placeholder="t('merchant.notifyPage.deepLinkValuePlaceholder')" :aria-label="t('merchant.notifyPage.deepLinkValuePlaceholder')" />
        <a-select v-else-if="form.deepLinkType === 'page'" v-model:value="form.deepLinkValue" :dropdown-style="{ zIndex: 1150 }" class="notify-link-value" :placeholder="t('merchant.notifyPage.pagePlaceholder')" :aria-label="t('merchant.notifyPage.pagePlaceholder')">
          <a-select-option v-for="page in PAGES" :key="page" :value="page">{{ t(`merchant.notifyPage.pages.${page.slice(1)}`) }}</a-select-option>
        </a-select>
        <p class="notify-hint">{{ t('merchant.notifyPage.destinationHint') }}</p>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.channel')" required>
        <div v-if="channelsFailed" class="notify-state" role="alert">{{ t('merchant.notifyPage.channelsFailed') }} <a-button type="link" size="small" @click="loadChannels">{{ t('merchant.notifyPage.retry') }}</a-button></div>
        <a-spin :spinning="channelsLoading"><div class="notify-channel-grid">
          <button v-for="channel in CHANNELS" :key="channel.key" type="button" class="notify-channel" :class="[channel.key, { active: availableChannels[channel.key] && form.channels.includes(channel.key) }]"
            :disabled="sending || !availableChannels[channel.key]" :aria-pressed="!!availableChannels[channel.key] && form.channels.includes(channel.key)" @click="toggleChannel(channel.key)">
            <span class="notify-channel-icon"><component :is="channel.icon" /></span><span class="notify-channel-copy"><strong>{{ t(`merchant.notifyPage.channelLabel.${channel.key}`) }}</strong><small>{{ channelDescription(channel.key) }}</small></span><CheckCircleFilled v-if="availableChannels[channel.key] && form.channels.includes(channel.key)" class="notify-channel-check" />
          </button>
        </div></a-spin>
        <p class="notify-hint">{{ t('merchant.s3.inappOnly') }}</p>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.sendTiming')">
        <div class="notify-timing" role="group" :aria-label="t('merchant.notifyPage.sendTiming')">
          <button type="button" :class="{ active: form.sendType === 1 }" :aria-pressed="form.sendType === 1" :disabled="sending" @click="form.sendType = 1"><ThunderboltOutlined />{{ t('merchant.notifyPage.sendNow') }}</button>
          <button type="button" :class="{ active: form.sendType === 2 }" :aria-pressed="form.sendType === 2" :disabled="sending" @click="form.sendType = 2"><CalendarOutlined />{{ t('merchant.notifyPage.schedule') }}</button>
        </div>
        <div v-if="form.sendType === 2" class="notify-schedule">
          <label>{{ t('merchant.notifyPage.scheduleDate') }}<input v-model="form.scheduleDate" type="date" :disabled="sending" :aria-label="t('merchant.notifyPage.scheduleDate')" /></label>
          <label>{{ t('merchant.notifyPage.scheduleTime') }}<input v-model="form.scheduleTime" type="time" :disabled="sending" :aria-label="t('merchant.notifyPage.scheduleTime')" /></label>
        </div>
      </a-form-item>
    </a-form>
    <section class="notify-history"><button type="button" :aria-expanded="historyOpen" @click="toggleHistory"><HistoryOutlined /><span>{{ t('merchant.s3.deliveryHistory') }}</span><DownOutlined :class="{ 'is-open': historyOpen }" /></button>
      <div v-if="historyOpen" class="notify-history-body">
        <p class="notify-hint">{{ t('merchant.notifyPage.historyTimezone') }}</p>
        <div v-if="historyLoading" class="notify-state"><a-spin size="small" /></div>
        <div v-else-if="historyFailed" class="notify-state" role="alert">{{ t('merchant.notifyPage.historyFailed') }} <a-button type="link" size="small" @click="loadHistory(historyPage)">{{ t('merchant.notifyPage.retry') }}</a-button></div>
        <template v-else><div v-if="!notifications.length" class="notify-state">{{ t('merchant.notifyPage.historyEmpty') }}</div>
          <article v-for="item in notifications" :key="item.id" class="notify-history-item"><strong>{{ item.title }}</strong><time>{{ formatHistoryTime(item.send_at) }}</time>
            <div v-for="delivery in item.deliveries" :key="delivery.id">{{ t(`merchant.notifyPage.channelLabel.${delivery.channel}`) }} · {{ t(`merchant.s3.delivery.${delivery.status}`) }}</div>
            <span v-if="!item.deliveries?.length">{{ t('merchant.s3.legacyDelivery') }}</span>
          </article>
          <a-pagination v-if="historyTotal > 5" size="small" :current="historyPage" :total="historyTotal" :page-size="5" :show-size-changer="false" @change="loadHistory" />
        </template>
      </div>
    </section>
    <template #footer><div class="notify-footer">
      <a-button :disabled="sending" @click="close">{{ t('merchant.notifyPage.cancel') }}</a-button>
      <a-button :disabled="sending" @click="preview"><EyeOutlined />{{ t('merchant.notifyPage.preview') }}</a-button>
      <a-button v-perm="'merchant:list:notify'" type="primary" :loading="sending" :disabled="channelsLoading || channelsFailed" class="notify-submit" @click="send"><SendOutlined />{{ t(form.sendType === 2 ? 'merchant.notifyPage.scheduleBtn' : 'merchant.notifyPage.sendNowBtn') }}</a-button>
    </div></template>
  </a-drawer>
  <a-modal v-model:open="previewOpen" :width="500" :z-index="1200" :footer="null" :closable="false" wrap-class-name="merchant-notify-preview" centered>
    <div class="notify-preview-heading"><div><h3>{{ t('merchant.notifyPage.previewTitle') }}</h3><p>{{ t('merchant.notifyPage.previewSubtitle') }}</p></div><a-button type="text" :aria-label="t('common.close')" @click="previewOpen = false"><CloseOutlined /></a-button></div>
    <div class="notify-preview-body">
      <p class="notify-preview-note">{{ t(unresolved ? 'merchant.notifyPage.previewVariables' : 'merchant.notifyPage.previewHint') }}</p>
      <div v-if="!selectedChannels.length" class="notify-state">{{ t('merchant.notifyPage.channelRequired') }}</div>
      <section v-for="channel in selectedChannels" :key="channel.key" class="notify-preview-channel"><h4>{{ t(`merchant.notifyPage.channelLabel.${channel.key}`) }}</h4>
        <div class="notify-preview-card" :class="channel.key"><div class="notify-preview-brand"><span><BellOutlined /> mTrip</span><small>{{ t('merchant.notifyPage.previewNow') }}</small></div>
          <strong><template v-for="(part, index) in previewParts(form.title || t('merchant.notifyPage.previewNoTitle'))" :key="index"><mark v-if="part.variable">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></strong>
          <p><template v-for="(part, index) in previewParts(form.message)" :key="index"><mark v-if="part.variable">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></p>
          <div class="notify-preview-recipient">{{ t('merchant.notifyPage.toMerchant', { name: merchantName, code: merchantCode }) }}</div>
        </div>
      </section>
    </div><div class="notify-preview-footer"><a-button type="primary" @click="previewOpen = false">{{ t('merchant.notifyPage.closePreview') }}</a-button></div>
  </a-modal>
</template>

<style scoped>
.notify-heading, .notify-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.notify-heading h2, .notify-preview-heading h3 { margin: 0; color: #1a2332; font-size: 15px; line-height: 20px; font-weight: 700; }
.notify-heading p, .notify-preview-heading p { margin: 2px 0 0; color: #94a3b8; font-size: 12px; line-height: 16px; font-weight: 400; overflow-wrap: anywhere; }
.notify-heading .ant-btn, .notify-preview-heading .ant-btn { flex: 0 0 32px; width: 32px; height: 32px; padding: 0; color: #64748b; }
.notify-heading :deep(.anticon), .notify-preview-heading :deep(.anticon) { margin: 0; font-size: 14px; }
.notify-form :deep(.ant-form-item) { margin-bottom: 20px; }
.notify-form :deep(.ant-form-item-label) { padding: 0 0 6px; }
.notify-form :deep(.ant-form-item-label > label) { color: #475569; font-size: 12px; font-weight: 600; }
.notify-form :deep(.ant-form-item-required::before) { display: none !important; }
.notify-form :deep(.ant-form-item-required::after) { display: inline-block !important; content: '*' !important; color: #dc2626; margin-left: 4px; }
.notify-form :deep(.ant-input), .notify-form :deep(.ant-select-selector) { font-size: 13px; border-color: #e3e8f0; border-radius: 7px; }
.notify-form :deep(.ant-input:not(textarea)) { min-height: 38px; }
.notify-form :deep(.ant-select-single) { height: 38px; }
.notify-form :deep(.ant-select-single .ant-select-selector) { height: 38px; }
.notify-form :deep(.ant-select-single .ant-select-selection-search-input) { height: 36px; }
.notify-form :deep(textarea.ant-input) { min-height: 128px; padding: 10px 12px; line-height: 21px; }
.notify-form :deep(.ant-select-selection-item), .notify-form :deep(.ant-select-selection-placeholder) { line-height: 36px !important; }
.notify-recipient { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #e3e8f0; border-radius: 8px; background: #f8fafc; }
.notify-avatar { flex: 0 0 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: #1664ff; color: #fff; font-size: 13px; font-weight: 700; }
.notify-recipient-info { flex: 1; min-width: 0; }
.notify-recipient-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.notify-recipient-name strong { color: #1a2332; font-size: 13px; overflow-wrap: anywhere; }
.notify-recipient-name code { color: #94a3b8; font-size: 10px; padding: 1px 5px; border: 1px solid #e3e8f0; border-radius: 4px; background: #fff; }
.notify-contacts { display: flex; flex-wrap: wrap; gap: 2px 8px; margin-top: 3px; color: #64748b; font-size: 11px; overflow-wrap: anywhere; }
.notify-recipient em { color: #94a3b8; font-size: 10px; white-space: nowrap; }
.notify-template { margin: 0 0 20px; }
.notify-template-toggle { display: flex; align-items: center; width: 100%; gap: 8px; padding: 9px 12px; background: #f8fafc; color: #475569; border: 1px solid #e3e8f0; border-radius: 7px; font-size: 12px; text-align: left; cursor: pointer; }
.notify-template-toggle > span:nth-child(2) { flex: 1; }
.notify-template-toggle small { color: #94a3b8; font-size: 10px; }
.notify-template-toggle :deep(.anticon:first-child) { color: #94a3b8; }
.is-open { transform: rotate(180deg); }
.notify-template-panel { margin-top: 6px; padding: 10px; border: 1px solid #e3e8f0; border-radius: 8px; background: #fff; box-shadow: 0 4px 12px #1a23320a; }
.notify-template-results { max-height: 230px; overflow-y: auto; margin-top: 8px; }
.notify-template-results > button { display: flex; flex-direction: column; gap: 3px; width: 100%; padding: 10px; border: 0; border-radius: 5px; background: #fff; color: #64748b; text-align: left; font-size: 11px; cursor: pointer; }
.notify-template-results > button:hover { background: #f0f6ff; }
.notify-template-results strong { color: #1a2332; font-size: 12px; }
.notify-template-results > button > span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 100%; }
.notify-template-category { color: #1664ff; font-size: 10px; }
.notify-count { margin-top: 5px; text-align: right; color: #b0b8c4; font-size: 11px; }
.notify-variable-warning { margin-top: 6px; color: #b45309; font-size: 11px; }
.notify-link-value { margin-top: 8px; width: 100%; }
.notify-hint { margin: 7px 0 0; color: #94a3b8; font-size: 11px; line-height: 17px; }
.notify-channel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.notify-channel { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px; border: 1px solid #e3e8f0; border-radius: 8px; background: #fff; text-align: left; color: #475569; cursor: pointer; }
.notify-channel-icon { display: grid; place-items: center; flex: 0 0 28px; height: 28px; background: #f1f5f9; border-radius: 5px; color: #94a3b8; }
.notify-channel-copy { flex: 1; min-width: 0; }
.notify-channel-copy strong, .notify-channel-copy small { display: block; overflow-wrap: anywhere; }
.notify-channel-copy strong { font-size: 12px; font-weight: 600; }
.notify-channel-copy small { margin-top: 3px; font-size: 10px; color: #94a3b8; }
.notify-channel.active { background: #eff6ff; border-color: #1664ff; color: #1664ff; }
.notify-channel.active .notify-channel-icon { background: #1664ff; color: #fff; }
.notify-channel-check { font-size: 16px; }
.notify-channel:disabled { cursor: not-allowed; opacity: .6; }
.notify-timing { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.notify-timing > button { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 9px 8px; border: 1px solid #e3e8f0; border-radius: 7px; background: #fff; font-size: 12px; color: #64748b; cursor: pointer; }
.notify-timing > button.active { color: #1664ff; background: #eff6ff; border-color: #1664ff; font-weight: 600; }
.notify-schedule { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.notify-schedule label { color: #64748b; font-size: 11px; min-width: 0; }
.notify-schedule input { display: block; box-sizing: border-box; width: 100%; min-width: 0; height: 38px; padding: 7px 10px; margin-top: 5px; border: 1px solid #e3e8f0; border-radius: 7px; background: #fff; color: #1a2332; font-family: inherit; font-size: 12px; }
.notify-history { margin-top: 4px; border-top: 1px solid #f1f5f9; padding-top: 14px; }
.notify-history > button { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: transparent; color: #64748b; font-size: 12px; text-align: left; padding: 0; cursor: pointer; }
.notify-history > button > span:nth-child(2) { flex: 1; }
.notify-history-body { margin-top: 8px; }
.notify-history-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #64748b; overflow-wrap: anywhere; }
.notify-history-item strong { color: #1a2332; font-size: 12px; }
.notify-history-item time { color: #94a3b8; }
.notify-state { padding: 16px 8px; color: #94a3b8; font-size: 12px; text-align: center; }
.notify-footer { display: flex; align-items: center; gap: 8px; }
.notify-footer .ant-btn { height: 36px; font-size: 13px; border-radius: 7px; }
.notify-submit { margin-left: auto; }
:global(.merchant-notify-drawer .ant-drawer-content-wrapper) { max-width: 100vw; }
:global(.merchant-notify-drawer .ant-drawer-header) { min-height: 60px; padding: 10px 24px; border-color: #e3e8f0; }
:global(.merchant-notify-drawer .ant-drawer-body) { padding: 20px 24px; }
:global(.merchant-notify-drawer .ant-drawer-footer) { padding: 16px 24px; border-color: #e3e8f0; background: #fafbfc; }
:global(.merchant-notify-preview .ant-modal-content) { padding: 0; border-radius: 14px; overflow: hidden; }
.notify-preview-heading { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
.notify-preview-body { padding: 20px; max-height: 65vh; overflow-y: auto; }
.notify-preview-note { padding: 10px 12px; margin: 0 0 20px; border: 1px solid #f4e7a2; border-radius: 8px; background: #fffbeb; color: #92400e; font-size: 11px; line-height: 17px; }
.notify-preview-channel h4 { margin: 0 0 10px; color: #94a3b8; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; }
.notify-preview-channel + .notify-preview-channel { margin-top: 20px; }
.notify-preview-card { padding: 14px; border: 1px solid #e3e8f0; border-radius: 12px; color: #1a2332; background: #f8fafc; font-size: 12px; }
.notify-preview-card.push { background: #1c2533; color: #fff; }
.notify-preview-brand { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.notify-preview-brand > span { font-weight: 600; }
.notify-preview-brand .anticon { display: inline-grid; place-items: center; width: 24px; height: 24px; margin-right: 5px; color: #1664ff; background: #eff6ff; border-radius: 6px; }
.notify-preview-brand small { font-size: 10px; color: #94a3b8; }
.notify-preview-card strong { display: block; overflow-wrap: anywhere; }
.notify-preview-card p { margin: 7px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 20px; }
.notify-preview-card mark { color: #92400e; background: #fef3c7; border-radius: 2px; }
.notify-preview-recipient { margin-top: 12px; font-size: 10px; color: #94a3b8; overflow-wrap: anywhere; }
.notify-preview-footer { display: flex; justify-content: flex-end; border-top: 1px solid #f1f5f9; padding: 12px 20px; }
button:focus-visible, input:focus-visible { outline: 2px solid #1664ff; outline-offset: 2px; }
@media (max-width: 480px) {
  :global(.merchant-notify-drawer .ant-drawer-header) { padding: 10px 16px; }
  :global(.merchant-notify-drawer .ant-drawer-body) { padding: 16px; }
  :global(.merchant-notify-drawer .ant-drawer-footer) { padding: 12px 16px; }
  .notify-recipient { flex-wrap: wrap; }
  .notify-recipient em { margin-left: 48px; }
  .notify-template-toggle small { display: block; margin-top: 2px; }
  .notify-channel { gap: 6px; padding: 10px 8px; }
}
</style>
