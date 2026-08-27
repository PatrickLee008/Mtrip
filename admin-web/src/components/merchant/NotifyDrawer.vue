<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { apiMerchantNotifySend, apiMerchantNotifyTemplates } from '@/api/merchant';
import type { TableRow } from '@/composables/useTable';
import { get } from '@/utils/http';
import type { Dayjs } from 'dayjs';

/**
 * 发送商户通知抽屉(整改 B1,原型 Send Notification 抽屉 540px)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.6
 */
const props = defineProps<{
  open: boolean;
  merchant: TableRow | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'sent'): void;
}>();

const { t } = useI18n();

const CATEGORIES = ['booking', 'promotion', 'rewards', 'wallet', 'refund', 'account', 'security', 'support', 'system'] as const;
const CHANNELS = ['push', 'inapp', 'email', 'sms'] as const;
const DEEP_LINKS = ['booking_detail', 'wallet', 'promotion', 'user_profile', 'page', 'none'] as const;
const availableChannels = ref<Record<string, boolean>>({ inapp: true });
const requestId = ref('');
const schedule = ref<Dayjs>();
const notifications = ref<TableRow[]>([]);

const form = reactive({
  category: 'system',
  title: '',
  message: '',
  deepLinkType: 'none',
  deepLinkValue: '',
  channels: ['inapp'] as string[],
  sendType: 1,
  sendAt: '',
});
const templates = ref<TableRow[]>([]);
const sending = ref(false);
const templateId = ref<number | undefined>(undefined);

watch(
  () => props.open,
  async (open) => {
    if (!open || !props.merchant) {
      return;
    }
    Object.assign(form, {
      category: 'system',
      title: '',
      message: '',
      deepLinkType: 'none',
      deepLinkValue: '',
      channels: ['inapp'],
      sendType: 1,
      sendAt: '',
    });
    templateId.value = undefined;
    requestId.value = crypto.randomUUID();
    schedule.value = undefined;
    try {
      availableChannels.value = await get('/admin/merchant/notification/channels');
      const history = await get<{ list: TableRow[] }>('/admin/merchant/notification/list', { merchantId: props.merchant.id });
      notifications.value = history.list;
      templates.value = await apiMerchantNotifyTemplates(props.merchant.id);
    } catch {
      templates.value = [];
    }
  },
);

watch(() => form.deepLinkType, () => { form.deepLinkValue = ''; }, { flush: 'sync' });
function applyTemplate(id: number | undefined): void {
  const tp = templates.value.find((x) => x.id === id);
  if (tp) {
    form.category = tp.category || 'system';
    form.title = tp.title || '';
    form.message = tp.message || '';
    form.deepLinkType = tp.deep_link_type || 'none';
    form.deepLinkValue = tp.deep_link_value || '';
  }
}

watch(() => JSON.stringify([form, templateId.value, schedule.value?.toISOString()]), () => { requestId.value = crypto.randomUUID(); }, { flush: 'sync' });
function preview(): void {
  Modal.info({
    title: form.title || t('merchant.notifyPage.previewNoTitle'),
    content: `${form.message}\n\n${t('merchant.notifyPage.channel')}: ${form.channels.join(', ')}`,
    width: 420,
  });
}

async function send(): Promise<void> {
  if (!props.merchant) {
    return;
  }
  if (!form.title.trim() || !form.message.trim()) {
    message.warning(t('merchant.notifyPage.required'));
    return;
  }
  if (form.channels.length === 0) {
    message.warning(t('merchant.notifyPage.channelRequired'));
    return;
  }
  sending.value = true;
  try {
    await apiMerchantNotifySend({
      merchantId: props.merchant.id,
      category: form.category,
      title: form.title,
      message: form.message,
      deepLinkType: form.deepLinkType,
      deepLinkValue: form.deepLinkValue,
      channels: form.channels,
      sendType: form.sendType,
      sendAt: form.sendType === 2 ? schedule.value?.toISOString() : undefined,
      requestId: requestId.value, templateId: templateId.value,
    });
    message.success(t(form.sendType === 2 ? 'merchant.s3.scheduled' : 'merchant.notifyPage.sent'));
    emit('update:open', false);
    emit('sent');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <a-drawer
    :open="open"
    :title="t('merchant.notifyPage.title')"
    :width="540"
    @update:open="emit('update:open', $event)"
  >
    <a-alert type="info" show-icon :message="t('merchant.s3.inappOnly')" style="margin-bottom: 16px" /><a-form layout="vertical">
      <a-form-item :label="t('merchant.notifyPage.recipient')">
        <a-input :value="merchant ? `${merchant.merchant_name} (#${merchant.id})` : ''" disabled />
      </a-form-item>
      <a-form-item :label="`${t('merchant.notifyPage.category')} *`">
        <a-select v-model:value="form.category">
          <a-select-option v-for="c in CATEGORIES" :key="c" :value="c">{{ t(`merchant.notifyPage.cat.${c}`) }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.useTemplate')">
        <a-select v-model:value="templateId" allow-clear :placeholder="t('merchant.notifyPage.templatePlaceholder')" @change="applyTemplate">
          <a-select-option v-for="tp in templates" :key="tp.id" :value="tp.id">{{ tp.title }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="`${t('merchant.notifyPage.titleLabel')} *`">
        <a-input v-model:value="form.title" :maxlength="200" />
      </a-form-item>
      <a-form-item :label="`${t('merchant.notifyPage.messageLabel')} *`">
        <a-textarea v-model:value="form.message" :rows="4" :maxlength="1000" show-count />
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.deepLink')">
        <a-space direction="vertical" style="width: 100%">
          <a-select v-model:value="form.deepLinkType">
            <a-select-option v-for="d in DEEP_LINKS" :key="d" :value="d">{{ t(`merchant.notifyPage.link.${d}`) }}</a-select-option>
          </a-select>
          <a-input v-if="['booking_detail', 'promotion', 'page'].includes(form.deepLinkType)" v-model:value="form.deepLinkValue" :placeholder="t('merchant.notifyPage.deepLinkValuePlaceholder')" />
        </a-space>
      </a-form-item>
      <a-form-item :label="`${t('merchant.notifyPage.channel')} *`">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
          <label
            v-for="ch in CHANNELS"
            :key="ch"
            class="channel-card"
            :class="{ active: form.channels.includes(ch) }"
            @click="availableChannels[ch] && (form.channels = form.channels.includes(ch) ? form.channels.filter((x) => x !== ch) : [...form.channels, ch])"
          >
            <input v-model="form.channels" type="checkbox" :value="ch" :disabled="!availableChannels[ch]" style="display: none" />
            <span>{{ t(`merchant.notifyPage.channelName.${ch}`) }} {{ availableChannels[ch] ? '' : t('merchant.s3.unconfigured') }}</span>
          </label>
        </div>
      </a-form-item>
      <a-form-item :label="t('merchant.notifyPage.sendTiming')">
        <a-radio-group v-model:value="form.sendType" style="margin-bottom: 8px">
          <a-radio :value="1">⚡ {{ t('merchant.notifyPage.sendNow') }}</a-radio>
          <a-radio :value="2">📅 {{ t('merchant.notifyPage.schedule') }}</a-radio>
        </a-radio-group>
        <a-date-picker
          v-if="form.sendType === 2"
          v-model:value="schedule"
          show-time
          style="width: 100%"
          :placeholder="t('merchant.notifyPage.schedulePlaceholder')"
        />
      </a-form-item>
    </a-form>
    <a-divider>{{ t('merchant.s3.deliveryHistory') }}</a-divider>
    <a-list :data-source="notifications" size="small"><template #renderItem="{ item }"><a-list-item>
      <div>{{ item.title }} · {{ item.send_at }}<div v-for="delivery in item.deliveries" :key="delivery.id">{{ delivery.channel }}: {{ t(`merchant.s3.delivery.${delivery.status}`) }}</div><span v-if="!item.deliveries?.length">{{ t('merchant.s3.legacyDelivery') }}</span></div>
    </a-list-item></template></a-list>
    <template #footer>
      <div style="display: flex; gap: 8px; justify-content: flex-end">
        <a-button @click="emit('update:open', false)">{{ t('merchant.notifyPage.cancel') }}</a-button>
        <a-button @click="preview">{{ t('merchant.notifyPage.preview') }}</a-button>
        <a-button type="primary" :loading="sending" @click="send">{{ t('merchant.notifyPage.sendNowBtn') }}</a-button>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped lang="less">
.channel-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fafbfc;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 600;
  }
}
</style>
