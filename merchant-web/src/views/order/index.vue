<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import {
  CloseOutlined,
  DownloadOutlined,
  ExportOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import PageContainer from '@/components/PageContainer.vue';
import AmountText from '@/components/AmountText.vue';
import { useTable } from '@/composables/useTable';
import { apiAvailabilityOptions, type AvailabilityHotel, type AvailabilityRoom } from '@/api/availability';
import {
  apiBookingCancel,
  apiBookingCheckIn,
  apiBookingCheckOut,
  apiBookingConfirm,
  apiBookingDetail,
  apiBookingList,
  apiBookingNoShow,
  apiBookingStats,
  apiBookingSync,
  apiBookingTimeline,
  apiBookingVoucher,
  apiGuestContact,
  apiGuestMessage,
  apiGuestThread,
  apiNoteAdd,
  apiRefundApply,
  apiRefundQuote,
  downloadBookingCsv,
  type BookingDetail,
  type BookingRow,
  type BookingStats,
  type BookingVoucher,
  type GuestThread,
  type RefundQuote,
  type TimelineEvent,
} from '@/api/booking';

/**
 * Booking Management(实现方案-Merchant-M4 §8):
 * 严格按 Figma 原型还原——标题/工具条/页签/表格 + 430px 右侧详情面板(并排非抽屉)。
 * 数据全部来自真实接口;原型未实现的确认弹窗按 PRD §2.4 补齐;
 * 原型中的佣金/净结算等演示数据不展示(方案 §1.5 不伪造)。
 */
const { t } = useI18n();
const route = useRoute();

// ---------- 统计(页签数量) ----------
const stats = ref<BookingStats | null>(null);
async function loadStats(): Promise<void> {
  try {
    stats.value = await apiBookingStats();
  } catch {
    /* 拦截器已提示 */
  }
}

// ---------- 筛选条件 ----------
const q = ref('');
const dateRange = ref<string[]>([]);
const hotelId = ref<number | undefined>(undefined);
const moreFilters = reactive<{ roomTypeId?: number; bookingStatus?: number; paymentStatus?: number; channel?: string }>({});
const moreOpen = ref(false);
const sort = reactive<{ field: string; dir: 'asc' | 'desc' }>({ field: 'booked', dir: 'desc' });

const activeTab = ref('all');
const TAB_STATUS: Record<string, number | undefined> = {
  all: undefined,
  pending: 1,
  confirmed: 2,
  pendingCheckin: 2,
  inhouse: 3,
  checkedOut: 4,
  cancelled: 5,
  noShow: 6,
};

function currentParams(): Record<string, unknown> {
  return {
    q: q.value || undefined,
    dateFrom: dateRange.value?.[0] || undefined,
    dateTo: dateRange.value?.[1] || undefined,
    hotelId: hotelId.value,
    roomTypeId: moreFilters.roomTypeId,
    bookingStatus: activeTab.value !== 'all' ? TAB_STATUS[activeTab.value] : moreFilters.bookingStatus,
    paymentStatus: moreFilters.paymentStatus,
    channel: moreFilters.channel,
    sort: sort.field,
    dir: sort.dir,
  };
}

const { loading, list, load, search, pagination } = useTable<BookingRow>(
  (params) => apiBookingList({ ...currentParams(), ...params }),
  {},
);

function switchTab(key: string): void {
  activeTab.value = key;
  search();
}

function applyMoreFilters(): void {
  moreOpen.value = false;
  search();
}

function resetMoreFilters(): void {
  moreFilters.roomTypeId = undefined;
  moreFilters.bookingStatus = undefined;
  moreFilters.paymentStatus = undefined;
  moreFilters.channel = undefined;
}

// ---------- 酒店/房型选项(真实数据) ----------
const hotels = ref<AvailabilityHotel[]>([]);
const roomOptions = computed<AvailabilityRoom[]>(() => {
  const source = hotelId.value ? hotels.value.filter((h) => h.id === hotelId.value) : hotels.value;
  return source.flatMap((h) => h.rooms ?? []);
});

async function loadHotelOptions(): Promise<void> {
  try {
    hotels.value = await apiAvailabilityOptions();
  } catch {
    hotels.value = [];
  }
}

// ---------- 状态/渠道展示 ----------
const BOOKING_TAG: Record<number, string> = { 1: 'pending', 2: 'confirmed', 3: 'checkedin', 4: 'checkedout', 5: 'cancelled', 6: 'noshow' };
const PAY_TAG: Record<number, string> = { 1: 'pending', 2: 'paid', 3: 'refunded', 4: 'refunded', 5: 'failed' };
const PAY_TEXT_KEY: Record<number, string> = { 1: 'pending', 2: 'paid', 3: 'partialRefunded', 4: 'refunded', 5: 'failed' };

function bookingStatusText(s: number): string {
  const map: Record<number, string> = { 1: 'pending', 2: 'confirmed', 3: 'checkedIn', 4: 'checkedOut', 5: 'cancelled', 6: 'noShow' };
  return t(`booking.status.${map[s] ?? 'pending'}`);
}

function channelText(c: string): string {
  return t(`booking.channelMap.${c}`, c);
}

function fmtDate(v: string | null | undefined): string {
  return v ? dayjs(v).format('DD MMM YYYY') : '—';
}

function nightsOf(row: { use_date?: string | null; end_date?: string | null }): number {
  if (!row.use_date || !row.end_date) return 0;
  return dayjs(row.end_date).diff(dayjs(row.use_date), 'day');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** No-show 截止:入住日当地 23:59(与后端 BookingConst::noShowDeadline 一致) */
function noShowDeadlineOf(useDate: string | null): dayjs.Dayjs | null {
  return useDate ? dayjs(`${useDate} 23:59:59`) : null;
}

function pastDeadline(useDate: string | null): boolean {
  const d = noShowDeadlineOf(useDate);
  return d !== null && dayjs().isAfter(d);
}

// ---------- 表格列与排序 ----------
const showHotelColumn = computed(() => !hotelId.value);
const columns = computed(() => {
  const cols: Record<string, unknown>[] = [
    { title: t('booking.columns.bookingId'), dataIndex: 'order_no', width: 150 },
    { title: t('booking.columns.guest'), dataIndex: 'contact_name', width: 140, ellipsis: true },
  ];
  if (showHotelColumn.value) {
    cols.push({ title: t('booking.columns.hotel'), dataIndex: 'goods_name', width: 170, ellipsis: true });
  }
  cols.push(
    { title: t('booking.columns.room'), dataIndex: 'sku_name', width: 140, ellipsis: true },
    { title: t('booking.columns.dates'), key: 'dates', width: 150, sorter: true },
    { title: t('booking.columns.status'), key: 'status', width: 110 },
    { title: t('booking.columns.payment'), key: 'payment', width: 120 },
    { title: t('booking.columns.channel'), dataIndex: 'booking_channel', width: 90 },
    { title: t('booking.columns.actions'), key: 'action', width: 210, fixed: 'right' as const },
  );
  return cols;
});

function onTableChange(_pag: unknown, _filters: unknown, sorter: { field?: string; order?: string | null }): void {
  if (sorter?.field === 'dates') {
    sort.field = 'checkin';
    sort.dir = sorter.order === 'ascend' ? 'asc' : 'desc';
    void load();
  }
}

// ---------- 详情面板 ----------
const selectedId = ref<number | null>(null);
const detail = ref<BookingDetail | null>(null);
const detailLoading = ref(false);
const timeline = ref<TimelineEvent[]>([]);
const timelineTotal = ref(0);
const timelinePage = ref(1);

async function openDetail(id: number): Promise<void> {
  selectedId.value = id;
  detailLoading.value = true;
  detail.value = null;
  timeline.value = [];
  timelinePage.value = 1;
  try {
    detail.value = await apiBookingDetail(id);
    const tl = await apiBookingTimeline(id, 1, 20);
    timeline.value = tl.list;
    timelineTotal.value = tl.total;
  } catch {
    selectedId.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail(): void {
  selectedId.value = null;
  detail.value = null;
}

async function loadMoreTimeline(): Promise<void> {
  if (!selectedId.value) return;
  timelinePage.value += 1;
  const tl = await apiBookingTimeline(selectedId.value, timelinePage.value, 20);
  timeline.value.push(...tl.list);
}

function operatorText(type: number): string {
  const map: Record<number, string> = { 0: 'operatorSystem', 1: 'operatorGuest', 2: 'operatorMerchant', 3: 'operatorAdmin' };
  return t(`booking.timeline.${map[type] ?? 'operatorSystem'}`);
}

function eventText(ev: TimelineEvent): string {
  const key = `booking.timeline.types.${ev.event_type}`;
  const translated = t(key);
  return translated === key ? ev.event_type : translated;
}

// ---------- 内部备注 ----------
const noteDraft = ref('');
const noteSaving = ref(false);
async function saveNote(): Promise<void> {
  if (!selectedId.value || !noteDraft.value.trim()) return;
  noteSaving.value = true;
  try {
    await apiNoteAdd(selectedId.value, noteDraft.value.trim());
    noteDraft.value = '';
    message.success(t('booking.messages.noteSaved'));
    await openDetail(selectedId.value);
  } finally {
    noteSaving.value = false;
  }
}

// ---------- 操作弹窗 ----------
type ActionType = '' | 'confirm' | 'checkIn' | 'checkOut' | 'cancel' | 'noShow' | 'refund' | 'voucher' | 'guestContact';
const action = ref<ActionType>('');
const actionOpen = computed({
  get: () => action.value !== '',
  set: (v: boolean) => {
    if (!v) action.value = '';
  },
});
const targetId = ref(0);
const targetNo = ref('');
const submitting = ref(false);

const roomNoDraft = ref('');
const reasonDraft = ref('');
const waiveFee = ref(false);
const waiveReasonDraft = ref('');
const refundQuote = ref<RefundQuote | null>(null);
const refundAmount = ref<number | null>(null);
const refundReason = ref('');
const voucher = ref<BookingVoucher | null>(null);
const guestContact = ref<{ phone: string; name: string } | null>(null);
const targetDeadline = ref<string>('');

async function openAction(type: ActionType, row: { id: number; order_no: string; use_date?: string | null }): Promise<void> {
  targetId.value = row.id;
  targetNo.value = row.order_no;
  roomNoDraft.value = '';
  reasonDraft.value = '';
  waiveFee.value = false;
  waiveReasonDraft.value = '';
  refundQuote.value = null;
  refundAmount.value = null;
  refundReason.value = '';
  voucher.value = null;
  guestContact.value = null;
  const deadline = noShowDeadlineOf(row.use_date ?? null);
  targetDeadline.value = deadline ? deadline.format('YYYY-MM-DD HH:mm') : '';

  if (type === 'noShow' && !pastDeadline(row.use_date ?? null)) {
    message.warning(t('booking.modal.deadlineText', { deadline: targetDeadline.value }));
    return;
  }
  action.value = type;
  if (type === 'refund') {
    try {
      refundQuote.value = await apiRefundQuote(row.id);
      refundAmount.value = refundQuote.value.refundable;
    } catch {
      action.value = '';
    }
  }
  if (type === 'voucher') {
    try {
      voucher.value = await apiBookingVoucher(row.id);
    } catch {
      action.value = '';
    }
  }
  if (type === 'guestContact') {
    try {
      guestContact.value = await apiGuestContact(row.id);
    } catch {
      action.value = '';
    }
  }
}

const actionTitle = computed(() => {
  const map: Record<string, string> = {
    confirm: 'booking.modal.confirmTitle',
    checkIn: 'booking.modal.checkInTitle',
    checkOut: 'booking.modal.checkOutTitle',
    cancel: 'booking.modal.cancelTitle',
    noShow: 'booking.modal.noShowTitle',
    refund: 'booking.modal.refundTitle',
    voucher: 'booking.modal.voucherTitle',
    guestContact: 'booking.guest.revealTitle',
  };
  return action.value ? t(map[action.value]) : '';
});

async function submitAction(): Promise<void> {
  submitting.value = true;
  try {
    switch (action.value) {
      case 'confirm':
        await apiBookingConfirm(targetId.value);
        message.success(t('booking.messages.confirmed'));
        break;
      case 'checkIn':
        await apiBookingCheckIn(targetId.value, roomNoDraft.value.trim());
        message.success(t('booking.messages.checkedIn'));
        break;
      case 'checkOut':
        await apiBookingCheckOut(targetId.value);
        message.success(t('booking.messages.checkedOut'));
        break;
      case 'cancel':
        await apiBookingCancel(targetId.value, reasonDraft.value.trim());
        message.success(t('booking.messages.cancelled'));
        break;
      case 'noShow':
        if (waiveFee.value && !waiveReasonDraft.value.trim()) {
          message.warning(t('booking.modal.waiveReasonLabel') + t('common.required'));
          return;
        }
        await apiBookingNoShow(targetId.value, waiveFee.value, waiveReasonDraft.value.trim());
        message.success(t('booking.messages.noShowMarked'));
        break;
      case 'refund':
        await apiRefundApply(targetId.value, refundAmount.value, refundReason.value.trim());
        message.success(t('booking.messages.refundDone'));
        break;
      default:
        return;
    }
    action.value = '';
    void load();
    void loadStats();
    if (selectedId.value === targetId.value && selectedId.value !== null) {
      void openDetail(selectedId.value);
    }
  } finally {
    submitting.value = false;
  }
}

// ---------- 住客消息抽屉(实现方案 M4 §9.2,复用客服会话) ----------
const msgDrawerOpen = ref(false);
const msgThread = ref<GuestThread | null>(null);
const msgLoading = ref(false);
const msgDraft = ref('');
const msgSending = ref(false);
const msgListRef = ref<HTMLElement | null>(null);

function scrollMsgToBottom(): void {
  if (msgListRef.value) msgListRef.value.scrollTop = msgListRef.value.scrollHeight;
}

async function openMessageDrawer(): Promise<void> {
  if (!selectedId.value) return;
  msgDrawerOpen.value = true;
  msgThread.value = null;
  msgDraft.value = '';
  msgLoading.value = true;
  try {
    msgThread.value = await apiGuestThread(selectedId.value);
    await nextTick();
    scrollMsgToBottom();
  } catch {
    msgDrawerOpen.value = false;
  } finally {
    msgLoading.value = false;
  }
}

async function sendGuestMessage(): Promise<void> {
  const content = msgDraft.value.trim();
  if (!selectedId.value || !content || !msgThread.value) return;
  msgSending.value = true;
  try {
    const res = await apiGuestMessage(selectedId.value, content);
    msgThread.value.messages.push({
      id: res.messageId,
      site_id: 0,
      conversation_id: msgThread.value.conversationId,
      sender_type: 2,
      content,
      msg_type: 1,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
    msgDraft.value = '';
    await nextTick();
    scrollMsgToBottom();
  } finally {
    msgSending.value = false;
  }
}

// ---------- Force Sync ----------
const syncing = ref(false);
async function forceSync(): Promise<void> {
  if (!selectedId.value) return;
  syncing.value = true;
  try {
    await apiBookingSync(selectedId.value, 'pms');
    message.success(t('booking.sync.submitted'));
    await openDetail(selectedId.value);
  } finally {
    syncing.value = false;
  }
}

// ---------- 导出与凭证下载 ----------
const exporting = ref(false);
async function exportCsv(): Promise<void> {
  exporting.value = true;
  message.loading({ content: t('booking.messages.exporting'), key: 'export' });
  try {
    const params = { ...currentParams() };
    delete (params as Record<string, unknown>).page;
    await downloadBookingCsv(params);
    message.success({ content: t('booking.messages.exported'), key: 'export' });
  } catch {
    message.error({ content: t('common.pleaseInput'), key: 'export' });
  } finally {
    exporting.value = false;
  }
}

function downloadVoucher(): void {
  if (!selectedId.value || !detail.value) {
    message.info(t('booking.messages.selectFirst'));
    return;
  }
  void openAction('voucher', { id: selectedId.value, order_no: detail.value.order.order_no, use_date: detail.value.order.use_date });
}

function printVoucher(): void {
  window.print();
}

// ---------- 取消政策文案(真实快照) ----------
function policyText(policy: Record<string, unknown> | null): string {
  if (!policy) return t('booking.stay.policyFree');
  const type = Number(policy.ruleType ?? 1);
  if (type === 3) return t('booking.stay.policyNonRefundable');
  if (type === 2) return t('booking.stay.policyTiered');
  return t('booking.stay.policyFree');
}

function syncText(status: string): string {
  const key = `booking.sync.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

// ---------- 通知深链:点击商户通知直达目标预订 ----------
watch(
  () => route.query.notificationTarget,
  (value) => {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) void openDetail(Number(value));
  },
  { immediate: true },
);

onMounted(() => {
  void load();
  void loadStats();
  void loadHotelOptions();
});
</script>

<template>
  <PageContainer>
    <div class="bm-page">
      <!-- 标题与全局操作 -->
      <div class="bm-header">
        <h1 class="bm-title">{{ t('booking.title') }}</h1>
        <div class="bm-header-actions">
          <a-button v-perm="'mch:order:voucher'" class="bm-btn" @click="downloadVoucher">
            <template #icon><DownloadOutlined /></template>{{ t('booking.download') }}
          </a-button>
          <a-button v-perm="'mch:order:export'" class="bm-btn" :loading="exporting" @click="exportCsv">
            <template #icon><ExportOutlined /></template>{{ t('booking.export') }}
          </a-button>
        </div>
      </div>

      <!-- 工具条:搜索/日期/酒店/更多筛选 -->
      <div class="bm-toolbar">
        <a-input
          v-model:value="q"
          allow-clear
          class="bm-input"
          :placeholder="t('booking.searchPlaceholder')"
          style="width: 200px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined style="color: #94a3b8" /></template>
        </a-input>
        <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 250px" @change="search" />
        <a-select v-model:value="hotelId" allow-clear :placeholder="t('booking.allHotels')" style="width: 193px" @change="search">
          <a-select-option v-for="h in hotels" :key="h.id" :value="h.id">{{ h.name }}</a-select-option>
        </a-select>
        <a-popover v-model:open="moreOpen" trigger="click" placement="bottomRight" overlay-class-name="bm-more-pop">
          <template #content>
            <div class="bm-more">
              <div class="bm-more-title">MORE FILTERS</div>
              <div class="bm-more-field">
                <div class="bm-more-label">{{ t('booking.filters.roomType') }}</div>
                <a-select v-model:value="moreFilters.roomTypeId" allow-clear :placeholder="t('booking.filters.allRoomTypes')" style="width: 100%">
                  <a-select-option v-for="r in roomOptions" :key="r.id" :value="r.id">{{ r.name }}</a-select-option>
                </a-select>
              </div>
              <div class="bm-more-field">
                <div class="bm-more-label">{{ t('booking.filters.bookingStatus') }}</div>
                <a-select v-model:value="moreFilters.bookingStatus" allow-clear :placeholder="t('booking.filters.allStatuses')" style="width: 100%">
                  <a-select-option :value="1">{{ t('booking.status.pending') }}</a-select-option>
                  <a-select-option :value="2">{{ t('booking.status.confirmed') }}</a-select-option>
                  <a-select-option :value="3">{{ t('booking.status.checkedIn') }}</a-select-option>
                  <a-select-option :value="4">{{ t('booking.status.checkedOut') }}</a-select-option>
                  <a-select-option :value="5">{{ t('booking.status.cancelled') }}</a-select-option>
                  <a-select-option :value="6">{{ t('booking.status.noShow') }}</a-select-option>
                </a-select>
              </div>
              <div class="bm-more-field">
                <div class="bm-more-label">{{ t('booking.filters.paymentStatus') }}</div>
                <a-select v-model:value="moreFilters.paymentStatus" allow-clear :placeholder="t('booking.filters.allPayments')" style="width: 100%">
                  <a-select-option :value="2">{{ t('booking.paymentStatus.paid') }}</a-select-option>
                  <a-select-option :value="1">{{ t('booking.paymentStatus.pending') }}</a-select-option>
                  <a-select-option :value="4">{{ t('booking.paymentStatus.refunded') }}</a-select-option>
                  <a-select-option :value="3">{{ t('booking.paymentStatus.partialRefunded') }}</a-select-option>
                </a-select>
              </div>
              <div class="bm-more-field">
                <div class="bm-more-label">{{ t('booking.filters.channel') }}</div>
                <a-select v-model:value="moreFilters.channel" allow-clear :placeholder="t('booking.filters.allChannels')" style="width: 100%">
                  <a-select-option value="mtrip">{{ t('booking.channelMap.mtrip') }}</a-select-option>
                  <a-select-option value="walkin">{{ t('booking.channelMap.walkin') }}</a-select-option>
                  <a-select-option value="phone">{{ t('booking.channelMap.phone') }}</a-select-option>
                  <a-select-option value="ota">{{ t('booking.channelMap.ota') }}</a-select-option>
                </a-select>
              </div>
              <div class="bm-more-foot">
                <a-button type="text" size="small" @click="resetMoreFilters">{{ t('booking.reset') }}</a-button>
                <a-button type="primary" size="small" @click="applyMoreFilters">{{ t('booking.apply') }}</a-button>
              </div>
            </div>
          </template>
          <a-button class="bm-btn">
            <template #icon><FilterOutlined /></template>{{ t('booking.moreFilters') }}
          </a-button>
        </a-popover>
      </div>

      <!-- 页签 -->
      <div class="bm-tabs">
        <div
          v-for="key in ['all', 'pending', 'confirmed', 'pendingCheckin', 'inhouse', 'checkedOut', 'cancelled', 'noShow']"
          :key="key"
          class="bm-tab"
          :class="{ active: activeTab === key }"
          @click="switchTab(key)"
        >
          {{ t(`booking.tabs.${key}`) }}
          <span class="bm-tab-count">{{ stats ? (stats as Record<string, number>)[key === 'all' ? 'all' : key] ?? 0 : 0 }}</span>
        </div>
      </div>

      <!-- 表格 + 详情面板 -->
      <div class="bm-body">
        <div class="bm-table-card" :class="{ 'with-panel': selectedId !== null }">
          <a-table
            :columns="columns"
            :data-source="list"
            :loading="loading"
            :pagination="pagination"
            row-key="id"
            size="middle"
            :scroll="{ x: 1100 }"
            :row-class-name="(record: BookingRow) => (record.id === selectedId ? 'bm-row-active' : '')"
            :custom-row="(record: BookingRow) => ({ onClick: () => openDetail(record.id) })"
            @change="onTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'order_no'">
                <span class="bm-booking-id">{{ record.order_no }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'contact_name'">
                <span class="bm-guest">
                  <span class="bm-avatar">{{ initials(record.contact_name || '?') }}</span>
                  {{ record.contact_name }}
                </span>
              </template>
              <template v-else-if="column.key === 'dates'">
                <div class="bm-dates">
                  <div>{{ fmtDate(record.use_date) }}</div>
                  <div>{{ fmtDate(record.end_date) }} · {{ t('booking.nightsShort', { n: nightsOf(record) }) }}</div>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <span class="btag" :class="`btag-${BOOKING_TAG[record.booking_status] ?? 'pending'}`">{{ bookingStatusText(record.booking_status) }}</span>
              </template>
              <template v-else-if="column.key === 'payment'">
                <span class="btag" :class="`btag-pay-${PAY_TAG[record.payment_status] ?? 'pending'}`">{{ t(`booking.paymentStatus.${PAY_TEXT_KEY[record.payment_status] ?? 'pending'}`) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'booking_channel'">
                {{ channelText(record.booking_channel) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <span class="bm-row-actions" @click.stop>
                  <a-button type="text" size="small" class="bm-row-btn" @click="openDetail(record.id)">{{ t('booking.view') }}</a-button>
                  <a-button
                    v-if="record.booking_status === 1 && record.booking_channel !== 'mtrip'"
                    v-perm="'mch:order:confirm'"
                    type="text"
                    size="small"
                    class="bm-row-btn"
                    @click="openAction('confirm', record)"
                  >{{ t('booking.actions.confirm') }}</a-button>
                  <a-button
                    v-if="record.booking_status === 2"
                    v-perm="'mch:order:check-in'"
                    type="text"
                    size="small"
                    class="bm-row-btn"
                    @click="openAction('checkIn', record)"
                  >{{ t('booking.actions.checkIn') }}</a-button>
                  <a-button
                    v-if="record.booking_status === 3"
                    v-perm="'mch:order:check-out'"
                    type="text"
                    size="small"
                    class="bm-row-btn"
                    @click="openAction('checkOut', record)"
                  >{{ t('booking.actions.checkOut') }}</a-button>
                  <a-button
                    v-if="record.booking_status === 1 || record.booking_status === 2"
                    v-perm="'mch:order:cancel'"
                    type="text"
                    size="small"
                    class="bm-row-btn"
                    @click="openAction('cancel', record)"
                  >{{ t('booking.actions.cancel') }}</a-button>
                  <a-button
                    v-if="record.booking_status === 2 && pastDeadline(record.use_date)"
                    v-perm="'mch:order:no-show'"
                    type="text"
                    size="small"
                    class="bm-row-btn"
                    @click="openAction('noShow', record)"
                  >{{ t('booking.actions.noShow') }}</a-button>
                </span>
              </template>
            </template>
          </a-table>
        </div>

        <!-- 右侧详情面板(430px,与表格并排) -->
        <div v-if="selectedId !== null" class="bm-panel">
          <div class="bm-panel-head">
            <span class="bm-panel-no">{{ detail?.order.order_no ?? '...' }}</span>
            <span v-if="detail" class="btag" :class="`btag-${BOOKING_TAG[detail.order.booking_status] ?? 'pending'}`">
              {{ bookingStatusText(detail.order.booking_status) }}
            </span>
            <a-button type="text" size="small" class="bm-panel-close" @click="closeDetail">
              <template #icon><CloseOutlined /></template>
            </a-button>
          </div>
          <a-spin :spinning="detailLoading">
            <div v-if="detail" class="bm-panel-body">
              <!-- Booking Summary -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.summary') }}</h3>
                <div class="bm-fields">
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.bookingId') }}</span><span class="bm-value">{{ detail.order.order_no }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.hotel') }}</span><span class="bm-value">{{ detail.order.goods_name }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.roomType') }}</span><span class="bm-value">{{ detail.order.sku_name }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.channel') }}</span><span class="bm-value">{{ channelText(detail.order.booking_channel) }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.checkIn') }}</span><span class="bm-value">{{ fmtDate(detail.stay.useDate) }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.checkOut') }}</span><span class="bm-value">{{ fmtDate(detail.stay.endDate) }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.duration') }}</span><span class="bm-value">{{ t('booking.durationNights', { n: detail.nights }) }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.summary.guests') }}</span><span class="bm-value">{{ detail.stay.quantity }}</span></div>
                </div>
              </section>

              <!-- Guest Information -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.guest') }}</h3>
                <div class="bm-fields">
                  <div class="bm-field"><span class="bm-label">{{ t('booking.columns.guest') }}</span><span class="bm-value">{{ detail.order.contact_name }}</span></div>
                  <div class="bm-field">
                    <span class="bm-label">{{ t('booking.guest.phone') }}</span>
                    <span class="bm-value">
                      {{ detail.order.contact_phone }}
                      <a-button
                        v-perm="'mch:order:guest-contact'"
                        type="link"
                        size="small"
                        class="bm-link"
                        @click="openAction('guestContact', { id: detail.order.id, order_no: detail.order.order_no, use_date: detail.order.use_date })"
                      >{{ t('booking.guest.reveal') }}</a-button>
                    </span>
                  </div>
                </div>
                <div class="bm-hint">{{ t('booking.guest.maskedTip') }}</div>
              </section>

              <!-- Payment Summary -->
              <section class="bm-section">
                <h3 class="bm-section-title">
                  {{ t('booking.sections.payment') }}
                  <span class="btag bm-section-tag" :class="`btag-pay-${PAY_TAG[detail.payment.paymentStatus] ?? 'pending'}`">
                    {{ t(`booking.paymentStatus.${PAY_TEXT_KEY[detail.payment.paymentStatus] ?? 'pending'}`) }}
                  </span>
                </h3>
                <div class="bm-fields">
                  <div class="bm-field"><span class="bm-label">{{ t('booking.pay.roomTotal') }}</span><AmountText class="bm-value" :value="detail.payment.totalAmount" /></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.pay.discount') }}</span><AmountText class="bm-value" :value="detail.payment.discountAmount" /></div>
                  <div class="bm-field bm-field-strong"><span class="bm-label">{{ t('booking.pay.payAmount') }}</span><AmountText class="bm-value" :value="detail.payment.payAmount" /></div>
                  <div v-if="detail.payment.payTime" class="bm-field"><span class="bm-label">{{ t('booking.pay.payTime') }}</span><span class="bm-value">{{ detail.payment.payTime }}</span></div>
                  <div v-if="detail.payment.payTradeNo" class="bm-field"><span class="bm-label">{{ t('booking.pay.tradeNo') }}</span><span class="bm-value">{{ detail.payment.payTradeNo }}</span></div>
                  <div v-if="detail.payment.paymentStatus === 1 && detail.payment.paymentExpiresAt" class="bm-field">
                    <span class="bm-label">{{ t('booking.pay.expiresAt') }}</span><span class="bm-value">{{ detail.payment.paymentExpiresAt }}</span>
                  </div>
                </div>
                <div v-if="detail.payment.refunds.length" class="bm-refunds">
                  <div class="bm-label" style="margin-bottom: 4px">{{ t('booking.pay.refunds') }}</div>
                  <div v-for="r in detail.payment.refunds" :key="r.id" class="bm-refund-row">
                    <span>{{ r.refund_no }}</span>
                    <AmountText :value="r.refund_amount" type="expense" />
                  </div>
                </div>
                <div v-else class="bm-hint">{{ t('booking.pay.noRefunds') }}</div>
              </section>

              <!-- Stay Details -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.stay') }}</h3>
                <div class="bm-fields">
                  <div class="bm-field"><span class="bm-label">{{ t('booking.stay.mealPlan') }}</span><span class="bm-value">{{ detail.stay.mealPlan || '—' }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.stay.roomNo') }}</span><span class="bm-value">{{ detail.stay.roomNo || '—' }}</span></div>
                  <div class="bm-field"><span class="bm-label">{{ t('booking.stay.cancellationPolicy') }}</span><span class="bm-value">{{ policyText(detail.stay.cancellationPolicy) }}</span></div>
                  <div v-if="detail.stay.noShowDeadline" class="bm-field"><span class="bm-label">{{ t('booking.stay.noShowDeadline') }}</span><span class="bm-value">{{ detail.stay.noShowDeadline }}</span></div>
                </div>
                <div class="bm-label" style="margin-top: 8px">{{ t('booking.stay.specialRequests') }}</div>
                <div class="bm-value bm-requests">{{ detail.stay.specialRequests || t('booking.stay.noRequests') }}</div>
              </section>

              <!-- Internal Notes -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.notes') }}</h3>
                <a-textarea
                  v-model:value="noteDraft"
                  v-perm="'mch:order:note'"
                  :rows="2"
                  :maxlength="2000"
                  :placeholder="t('booking.notes.placeholder')"
                />
                <div class="bm-note-foot">
                  <span class="bm-hint">{{ t('booking.notes.staffOnly') }}</span>
                  <a-button v-perm="'mch:order:note'" type="text" size="small" :loading="noteSaving" :disabled="!noteDraft.trim()" @click="saveNote">
                    {{ t('booking.notes.save') }}
                  </a-button>
                </div>
                <div v-if="detail.notes.length" class="bm-notes">
                  <div v-for="n in detail.notes" :key="n.id" class="bm-note-item">
                    <div class="bm-note-meta">{{ n.author_name }} · {{ n.created_at }}</div>
                    <div class="bm-note-content">{{ n.content }}</div>
                  </div>
                </div>
                <div v-else class="bm-hint">{{ t('booking.notes.empty') }}</div>
              </section>

              <!-- Booking Timeline -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.timeline') }}</h3>
                <div v-if="timeline.length" class="bm-timeline">
                  <div v-for="ev in timeline" :key="ev.id" class="bm-timeline-item">
                    <span class="bm-dot" :class="{ 'bm-dot-fail': ev.status !== 1 }" />
                    <div class="bm-timeline-body">
                      <div class="bm-timeline-title">{{ eventText(ev) }} <span class="bm-timeline-op">· {{ operatorText(ev.operator_type) }}{{ ev.operator_name ? ` ${ev.operator_name}` : '' }}</span></div>
                      <div class="bm-timeline-time">{{ ev.created_at }}</div>
                    </div>
                  </div>
                  <a-button v-if="timeline.length < timelineTotal" type="link" size="small" @click="loadMoreTimeline">…</a-button>
                </div>
                <div v-else class="bm-hint">{{ t('booking.timeline.empty') }}</div>
              </section>

              <!-- Sync Status -->
              <section class="bm-section">
                <h3 class="bm-section-title">{{ t('booking.sections.sync') }}</h3>
                <div class="bm-fields">
                  <div class="bm-field">
                    <span class="bm-label">{{ t('booking.sync.pms') }}</span>
                    <span class="bm-value" :class="{ 'bm-sync-off': detail.sync.pms === 'not_connected' }">{{ syncText(detail.sync.pms) }}</span>
                  </div>
                  <div class="bm-field">
                    <span class="bm-label">{{ t('booking.sync.cm') }}</span>
                    <span class="bm-value" :class="{ 'bm-sync-off': detail.sync.channel === 'not_connected' }">{{ syncText(detail.sync.channel) }}</span>
                  </div>
                </div>
                <a-button v-perm="'mch:order:sync'" class="bm-force-sync" size="small" :loading="syncing" @click="forceSync">
                  {{ t('booking.sync.forceSync') }}
                </a-button>
              </section>

              <!-- Actions -->
              <section class="bm-section bm-section-actions">
                <h3 class="bm-section-title">{{ t('booking.sections.actions') }}</h3>
                <div class="bm-action-btns">
                  <a-button
                    v-if="detail.availableActions.includes('check-in')"
                    v-perm="'mch:order:check-in'"
                    type="primary"
                    block
                    @click="openAction('checkIn', detail.order)"
                  >{{ t('booking.actions.checkIn') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('confirm')"
                    v-perm="'mch:order:confirm'"
                    type="primary"
                    block
                    @click="openAction('confirm', detail.order)"
                  >{{ t('booking.actions.confirm') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('check-out')"
                    v-perm="'mch:order:check-out'"
                    type="primary"
                    block
                    @click="openAction('checkOut', detail.order)"
                  >{{ t('booking.actions.checkOut') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('refund')"
                    v-perm="'mch:order:refund'"
                    block
                    @click="openAction('refund', detail.order)"
                  >{{ t('booking.actions.refund') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('cancel')"
                    v-perm="'mch:order:cancel'"
                    block
                    class="bm-btn-danger"
                    @click="openAction('cancel', detail.order)"
                  >{{ t('booking.actions.cancel') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('no-show')"
                    v-perm="'mch:order:no-show'"
                    block
                    class="bm-btn-warning"
                    @click="openAction('noShow', detail.order)"
                  >{{ t('booking.actions.noShow') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('voucher')"
                    v-perm="'mch:order:voucher'"
                    block
                    class="bm-btn-ghost"
                    @click="openAction('voucher', detail.order)"
                  >{{ t('booking.actions.voucher') }}</a-button>
                  <a-button
                    v-if="detail.availableActions.includes('message')"
                    v-perm="'mch:order:message'"
                    block
                    class="bm-btn-ghost"
                    @click="openMessageDrawer"
                  >{{ t('booking.actions.messageGuest') }}</a-button>
                </div>
              </section>
            </div>
          </a-spin>
        </div>
      </div>
    </div>

    <!-- 操作确认弹窗 -->
    <a-modal
      v-model:open="actionOpen"
      :title="actionTitle"
      :width="action === 'voucher' ? 560 : 480"
      :footer="action === 'guestContact' || action === 'voucher' ? null : undefined"
      :confirm-loading="submitting"
      :ok-button-props="{ style: action === 'voucher' ? { display: 'none' } : {} }"
      @ok="submitAction"
    >
      <template v-if="action === 'confirm'">
        <p class="bm-modal-text">{{ t('booking.modal.confirmText') }}</p>
        <p class="bm-modal-target">{{ targetNo }}</p>
      </template>

      <template v-else-if="action === 'checkIn'">
        <p class="bm-modal-target">{{ targetNo }}</p>
        <a-form layout="vertical">
          <a-form-item :label="t('booking.modal.roomNoLabel')">
            <a-input v-model:value="roomNoDraft" :maxlength="50" :placeholder="t('booking.modal.roomNoPlaceholder')" />
          </a-form-item>
        </a-form>
      </template>

      <template v-else-if="action === 'checkOut'">
        <p class="bm-modal-text">{{ t('booking.modal.checkOutText') }}</p>
        <p class="bm-modal-target">{{ targetNo }}</p>
      </template>

      <template v-else-if="action === 'cancel'">
        <p class="bm-modal-text">{{ t('booking.modal.cancelText') }}</p>
        <p class="bm-modal-target">{{ targetNo }}</p>
        <a-form layout="vertical">
          <a-form-item :label="t('booking.modal.reasonLabel')">
            <a-textarea v-model:value="reasonDraft" :rows="3" :maxlength="500" :placeholder="t('booking.modal.reasonPlaceholder')" />
          </a-form-item>
        </a-form>
      </template>

      <template v-else-if="action === 'noShow'">
        <p class="bm-modal-text">{{ t('booking.modal.noShowText') }}</p>
        <p class="bm-modal-target">{{ targetNo }}</p>
        <a-checkbox v-model:checked="waiveFee">{{ t('booking.modal.waiveLabel') }}</a-checkbox>
        <a-form v-if="waiveFee" layout="vertical" style="margin-top: 12px">
          <a-form-item :label="t('booking.modal.waiveReasonLabel')" required>
            <a-textarea v-model:value="waiveReasonDraft" :rows="2" :maxlength="500" :placeholder="t('booking.modal.waiveReasonPlaceholder')" />
          </a-form-item>
        </a-form>
      </template>

      <template v-else-if="action === 'refund'">
        <p class="bm-modal-target">{{ targetNo }}</p>
        <a-spin :spinning="!refundQuote">
          <div v-if="refundQuote" class="bm-quote">
            <div class="bm-quote-row"><span>{{ t('booking.modal.payAmountLabel') }}</span><AmountText :value="refundQuote.payAmount" /></div>
            <div class="bm-quote-row"><span>{{ t('booking.modal.cancellationFeeLabel') }}</span><AmountText :value="refundQuote.cancellationFee" type="expense" /></div>
            <div class="bm-quote-row"><span>{{ t('booking.modal.refundedAlreadyLabel') }}</span><AmountText :value="refundQuote.refundedAlready" /></div>
            <div class="bm-quote-row bm-quote-strong"><span>{{ t('booking.modal.refundableLabel') }}</span><AmountText :value="refundQuote.refundable" type="income" /></div>
          </div>
        </a-spin>
        <a-form layout="vertical" style="margin-top: 12px">
          <a-form-item :label="t('booking.modal.amountLabel')">
            <a-input-number
              v-model:value="refundAmount"
              :min="0.01"
              :max="refundQuote?.remainingRefundable ?? undefined"
              :precision="2"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item :label="t('booking.modal.reasonLabel')">
            <a-textarea v-model:value="refundReason" :rows="2" :maxlength="500" :placeholder="t('booking.modal.reasonPlaceholder')" />
          </a-form-item>
        </a-form>
        <p class="bm-hint">{{ t('booking.modal.fullRefundNote') }}</p>
      </template>

      <template v-else-if="action === 'voucher'">
        <div v-if="voucher" id="voucher-print-area" class="bm-voucher">
          <div class="bm-voucher-brand">mTrip</div>
          <h2 class="bm-voucher-title">{{ t('booking.modal.voucherTitle') }}</h2>
          <div class="bm-voucher-no">{{ voucher.orderNo }}</div>
          <div class="bm-fields">
            <div class="bm-field"><span class="bm-label">{{ t('booking.summary.hotel') }}</span><span class="bm-value">{{ voucher.goodsName }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.summary.roomType') }}</span><span class="bm-value">{{ voucher.skuName }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.modal.guest') }}</span><span class="bm-value">{{ voucher.guestName }} · {{ voucher.guestPhone }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.summary.checkIn') }}</span><span class="bm-value">{{ fmtDate(voucher.useDate) }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.summary.checkOut') }}</span><span class="bm-value">{{ fmtDate(voucher.endDate) }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.summary.guests') }}</span><span class="bm-value">{{ voucher.quantity }}</span></div>
            <div v-if="voucher.roomNo" class="bm-field"><span class="bm-label">{{ t('booking.stay.roomNo') }}</span><span class="bm-value">{{ voucher.roomNo }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.pay.payAmount') }}</span><AmountText class="bm-value" :value="voucher.payAmount" /></div>
            <div v-if="voucher.verifyCode" class="bm-field"><span class="bm-label">{{ t('order.verifyCode') }}</span><span class="bm-value bm-voucher-code">{{ voucher.verifyCode }}</span></div>
            <div class="bm-field"><span class="bm-label">{{ t('booking.modal.issuedAt') }}</span><span class="bm-value">{{ voucher.issuedAt }}</span></div>
          </div>
        </div>
        <a-button type="primary" block style="margin-top: 12px" @click="printVoucher">{{ t('booking.modal.print') }}</a-button>
      </template>

      <template v-else-if="action === 'guestContact'">
        <div v-if="guestContact" class="bm-fields">
          <div class="bm-field"><span class="bm-label">{{ t('booking.columns.guest') }}</span><span class="bm-value">{{ guestContact.name }}</span></div>
          <div class="bm-field"><span class="bm-label">{{ t('booking.guest.phone') }}</span><span class="bm-value">{{ guestContact.phone }}</span></div>
        </div>
        <p class="bm-hint" style="margin-top: 8px">{{ t('booking.guest.revealTip') }}</p>
      </template>
    </a-modal>

    <!-- 住客消息抽屉(§9.2:气泡会话 + 底部输入,会话结束禁发) -->
    <a-drawer
      v-model:open="msgDrawerOpen"
      :title="msgThread ? `${t('booking.msg.title')} · ${msgThread.guestName}` : t('booking.msg.title')"
      :width="420"
      class="bm-msg-drawer"
    >
      <a-spin :spinning="msgLoading">
        <div ref="msgListRef" class="bm-msg-body">
          <template v-if="msgThread">
            <div v-if="!msgThread.messages.length" class="bm-hint">{{ t('booking.msg.empty') }}</div>
            <div
              v-for="m in msgThread.messages"
              :key="m.id"
              class="bm-msg-row"
              :class="{ 'bm-msg-mine': m.sender_type === 2 }"
            >
              <div class="bm-msg-bubble">{{ m.content }}</div>
              <div class="bm-msg-time">{{ m.created_at }}</div>
            </div>
          </template>
        </div>
      </a-spin>
      <template #footer>
        <div v-if="msgThread && msgThread.status === 1" class="bm-hint">{{ t('booking.msg.closed') }}</div>
        <div v-else class="bm-msg-input">
          <a-textarea
            v-model:value="msgDraft"
            :rows="2"
            :maxlength="2000"
            :placeholder="t('booking.msg.placeholder')"
            style="flex: 1"
          />
          <a-button type="primary" :loading="msgSending" :disabled="!msgDraft.trim()" @click="sendGuestMessage">
            {{ t('booking.msg.send') }}
          </a-button>
        </div>
      </template>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
/* Booking Management:按 Figma 原型实测值还原(色值/尺寸见原型测量基线) */
.bm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.bm-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}
.bm-header-actions {
  display: flex;
  gap: 8px;
}
.bm-btn {
  height: 37px;
  border-radius: 8px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
}

/* 工具条 */
.bm-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;

  :deep(.ant-input-affix-wrapper),
  :deep(.ant-picker),
  :deep(.ant-select-selector) {
    border-radius: 8px !important;
    border-color: #e2e8f0;
    font-size: 13px;
  }
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-picker) {
    height: 37px;
  }
  :deep(.ant-select-selector) {
    height: 37px !important;

    .ant-select-selection-item,
    .ant-select-selection-placeholder {
      line-height: 35px;
    }
  }
}

/* More Filters 弹层内容 */
.bm-more {
  width: 260px;
}
.bm-more-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #94a3b8;
  margin-bottom: 10px;
}
.bm-more-field {
  margin-bottom: 10px;
}
.bm-more-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}
.bm-more-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

/* 页签 */
.bm-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
  overflow-x: auto;
}
.bm-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 2px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;

  &.active {
    color: #1d4ed8;
    font-weight: 600;
    border-bottom-color: #2563eb;

    .bm-tab-count {
      background: #dbeafe;
      color: #1d4ed8;
    }
  }
}
.bm-tab-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
}

/* 表格 + 面板并排 */
.bm-body {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.bm-table-card {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 4px 12px 8px;

  :deep(.ant-table) {
    font-size: 12px;
  }
  :deep(.ant-table-thead > tr > th) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
  }
  :deep(.ant-table-tbody > tr > td) {
    border-bottom: 1px solid #f1f5f9;
  }
  :deep(.ant-table-tbody > tr:hover > td) {
    background: #f8fafc;
  }
  :deep(.ant-table-tbody > tr.bm-row-active > td) {
    background: #eff6ff;
  }
}
.bm-booking-id {
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}
.bm-guest {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bm-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bm-dates {
  font-size: 12px;
  color: #334155;
  line-height: 1.6;
}
.bm-row-actions {
  display: inline-flex;
  gap: 2px;
  flex-wrap: wrap;
}
.bm-row-btn {
  padding: 0 4px;
  height: 22px;
  font-size: 12px;
  color: #2563eb;
}

/* 状态标签(原型实测色值) */
.btag {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
}
.btag-confirmed {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.btag-pending {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
}
.btag-checkedin {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
}
.btag-checkedout {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}
.btag-cancelled {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}
.btag-noshow {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}
.btag-pay-paid {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
}
.btag-pay-pending {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
}
.btag-pay-refunded {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}
.btag-pay-failed {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

/* 右侧详情面板(430px,与表格并排) */
.bm-panel {
  width: 430px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  position: sticky;
  top: 12px;
}
.bm-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.bm-panel-no {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}
.bm-panel-close {
  margin-left: auto;
  color: #94a3b8;
}
.bm-panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.bm-section-title {
  margin: 0 0 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bm-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bm-field {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.bm-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}
.bm-value {
  font-size: 12px;
  font-weight: 500;
  color: #0f172a;
  text-align: right;
  word-break: break-word;
}
.bm-field-strong .bm-label,
.bm-field-strong .bm-value {
  font-weight: 700;
}
.bm-hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
}
.bm-refunds {
  margin-top: 8px;
}
.bm-refund-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #334155;
  padding: 4px 0;
  border-top: 1px dashed #f1f5f9;
}
.bm-requests {
  text-align: left;
  margin-top: 4px;
}
.bm-note-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.bm-notes {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bm-note-item {
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
}
.bm-note-meta {
  font-size: 10px;
  color: #94a3b8;
  margin-bottom: 2px;
}
.bm-note-content {
  font-size: 12px;
  color: #334155;
  white-space: pre-wrap;
}
.bm-timeline {
  display: flex;
  flex-direction: column;
}
.bm-timeline-item {
  display: flex;
  gap: 8px;
  padding: 6px 0;
}
.bm-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2563eb;
  margin-top: 4px;
  flex-shrink: 0;
}
.bm-dot-fail {
  background: #dc2626;
}
.bm-timeline-title {
  font-size: 12px;
  font-weight: 500;
  color: #0f172a;
}
.bm-timeline-op {
  font-size: 11px;
  font-weight: 400;
  color: #94a3b8;
}
.bm-timeline-time {
  font-size: 11px;
  color: #94a3b8;
}
.bm-sync-off {
  color: #dc2626;
}
.bm-force-sync {
  margin-top: 8px;
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
  border-radius: 8px;
}
.bm-link {
  padding: 0;
  height: auto;
  font-size: 11px;
}

/* Actions 区按钮(原型配色) */
.bm-action-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;

  :deep(.ant-btn) {
    height: 37px;
    border-radius: 8px;
    font-size: 13px;
  }
  :deep(.ant-btn-primary) {
    background: #2563eb;
    border-color: #2563eb;

    &:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }
  }
}
.bm-btn-danger {
  border-color: #fecaca !important;
  color: #dc2626 !important;
}
.bm-btn-warning {
  border-color: #fed7aa !important;
  color: #ea580c !important;
}
.bm-btn-ghost {
  border-color: #e2e8f0;
  color: #475569;
}

/* 住客消息抽屉 */
.bm-msg-body {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 8px;
}
.bm-msg-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.bm-msg-mine {
  align-items: flex-end;
}
.bm-msg-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.bm-msg-mine .bm-msg-bubble {
  background: #2563eb;
  color: #fff;
}
.bm-msg-time {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}
.bm-msg-input {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

/* 弹窗内容 */
.bm-modal-text {
  margin: 0 0 8px;
  font-size: 13px;
  color: #334155;
}
.bm-modal-target {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}
.bm-quote {
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px 12px;
}
.bm-quote-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: #334155;
}
.bm-quote-strong {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  font-weight: 700;
  color: #0f172a;
}

/* 凭证 */
.bm-voucher {
  padding: 8px;
}
.bm-voucher-brand {
  font-size: 14px;
  font-weight: 700;
  color: #2563eb;
}
.bm-voucher-title {
  margin: 8px 0 2px;
  font-size: 16px;
  color: #0f172a;
}
.bm-voucher-no {
  margin-bottom: 12px;
  color: #2563eb;
  font-weight: 600;
}
.bm-voucher-code {
  font-family: monospace;
  letter-spacing: 2px;
  font-size: 14px;
}

/* 窄屏:面板转为下方堆叠 */
@media (max-width: 1366px) {
  .bm-body {
    flex-wrap: wrap;
  }
  .bm-panel {
    width: 100%;
    position: static;
    max-height: none;
  }
}
</style>

<!-- 凭证打印:弹窗传送至 body,需全局规则隐藏其余内容 -->
<style>
@media print {
  body * {
    visibility: hidden;
  }
  #voucher-print-area,
  #voucher-print-area * {
    visibility: visible;
  }
  #voucher-print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 24px;
  }
}
</style>
