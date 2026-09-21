<template>
  <PageContainer>
    <div class="avail-page">
      <header class="avail-heading">
        <h1>{{ t('availability.title') }}</h1>
        <p>{{ t('availability.subtitle') }}</p>
      </header>

      <section class="controls-row">
        <div class="controls-left">
          <div class="control">
            <span class="control-label">{{ mode === 'bulk' ? t('availability.filters.quickRoomType') : t('availability.filters.roomType') }}</span>
            <RoomTypeSelect v-model="filterRoomId" :options="roomOptions" :variant="mode === 'bulk' ? 'default' : 'primary'" :placeholder="t('availability.filters.selectRoom')" />
          </div>
          <div class="control">
            <span class="control-label">{{ mode === 'bulk' ? t('availability.filters.bulkDateRange') : t('availability.filters.selectPeriod') }}</span>
            <MonthNavigator v-if="mode === 'calendar'" v-model="month" />
            <div v-else class="range-control">
              <button type="button" class="range-trigger" @click="rangeOpen = !rangeOpen">
                <AvIcon name="calendar" />
                <span class="range-text">{{ rangeLabel }}</span>
                <AvIcon name="chevron-down" />
              </button>
              <!-- 稿面触发器是自绘按钮(日历图标 + 区间文本 + chevron),面板沿用 antd 原生区间选择器 -->
              <a-range-picker
                v-model:value="bulkRange"
                v-model:open="rangeOpen"
                class="range-proxy"
                value-format="YYYY-MM-DD"
                :allow-clear="false"
                :format="'MMM D, YYYY'"
                @change="onRangeChange"
              />
            </div>
          </div>
        </div>
        <button v-if="mode === 'calendar'" v-perm="'mch:availability:bulk-update'" type="button" class="mode-btn primary" @click="enterBulk">
          <AvIcon name="edit" />
          <span>{{ t('availability.actions.bulkUpdate') }}</span>
        </button>
        <button v-else type="button" class="mode-btn" @click="exitBulk">
          <span>{{ t('availability.actions.cancelBulkUpdate') }}</span>
        </button>
      </section>

      <section class="workspace">
        <div class="workspace-main">
          <a-spin :spinning="loading">
            <a-empty v-if="!loading && rooms.length === 0" :description="t('availability.errors.noRooms')" />
            <template v-else-if="mode === 'calendar'">
              <CalendarGrid
                :days="calendarDays"
                :month="month"
                :selected-date="selectedDate"
                :currency="currency"
                @select="selectDate"
              />
            </template>
            <template v-else>
              <BulkGrid
                :rows="bulkRows"
                :dates="bulkDates"
                :currency="currency"
                :selected="selection"
                @toggle="toggleCell"
              />
            </template>
          </a-spin>
        </div>

        <EditPanel
          v-if="panelOpen"
          v-model:status="form.status"
          v-model:rooms="form.rooms"
          v-model:price="form.price"
          :variant="mode === 'bulk' ? 'bulk' : 'normal'"
          :date-label="selectedLabel"
          :selected-count="selection.length"
          :currency="currency"
          :save-perm="mode === 'bulk' ? 'mch:availability:bulk-update' : 'mch:availability:edit'"
          :saving="saving"
          @close="clearSelection"
          @save="mode === 'bulk' ? saveBulk() : saveCalendar()"
        />
      </section>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import AvIcon from './components/AvIcon.vue';
import BulkGrid from './components/BulkGrid.vue';
import CalendarGrid from './components/CalendarGrid.vue';
import EditPanel from './components/EditPanel.vue';
import MonthNavigator from './components/MonthNavigator.vue';
import RoomTypeSelect from './components/RoomTypeSelect.vue';
import {
  apiAvailabilityBatchSet,
  apiAvailabilityCalendar,
  apiAvailabilityOptions,
  apiAvailabilitySaveDay,
  type AvailabilityDay,
  type AvailabilityRoom,
} from '@/api/availability';

const { t } = useI18n();

/** 全部已授权房型(来自 options 接口,不随视图刷新) */
const rooms = ref<AvailabilityRoom[]>([]);
/** 当前模式下的日单元:`roomId → (date → day)` */
const daysByRoom = ref<Record<number, Record<string, AvailabilityDay>>>({});
const mode = ref<'calendar' | 'bulk'>('calendar');
const loading = ref(false);
const saving = ref(false);

/** 日历模式:选中的房型与月份 */
const activeRoomId = ref<number | null>(null);
const month = ref(dayjs().format('YYYY-MM'));
const selectedDate = ref<string | null>(null);

/** 批量模式:房型筛选(0 = 全部)、日期区间、选中的 `roomId_date` 键 */
const bulkRoomFilter = ref(0);
const bulkRange = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().add(4, 'day').format('YYYY-MM-DD')]);
const rangeOpen = ref(false);
const selection = ref<string[]>([]);

const form = reactive<{ status: 'open' | 'blocked'; rooms: number; price: number }>({ status: 'open', rooms: 0, price: 0 });
/** 面板每次“从无到有”打开时用选中数据回填,之后沿用用户输入(补选格子不重置) */
let panelWasOpen = false;
/** 首屏 options → calendar 的串联加载完成前,抑制 activeRoomId 的重复请求 */
let booted = false;

/** 批量模式多一个「全部房型」筛选项;日历模式必须落到具体房型,故不提供 */
const roomOptions = computed(() => {
  const list = rooms.value.map((room) => ({ id: room.id, name: room.name }));
  return mode.value === 'bulk' ? [{ id: 0, name: t('availability.filters.allRooms') }, ...list] : list;
});
/** Room Type 控件两种模式共用:日历模式选具体房型,批量模式选筛选(0 = 全部) */
const filterRoomId = computed<number | null>({
  get: () => (mode.value === 'bulk' ? bulkRoomFilter.value : activeRoomId.value),
  set: (value) => {
    if (mode.value === 'bulk') bulkRoomFilter.value = value ?? 0;
    else activeRoomId.value = value;
  },
});
const activeRoom = computed(() => rooms.value.find((room) => room.id === activeRoomId.value) ?? null);
/** 日历模式取当前房型的日单元;未选中房型时退回第一个,保留稿面“总有选中房型”的形态 */
const calendarRoom = computed(() => activeRoom.value ?? rooms.value[0] ?? null);
const calendarDays = computed(() => (calendarRoom.value ? (daysByRoom.value[calendarRoom.value.id] ?? {}) : {}));
const selectedDay = computed(() => (selectedDate.value ? (calendarDays.value[selectedDate.value] ?? null) : null));
const selectedLabel = computed(() => (selectedDate.value ? dayjs(selectedDate.value).format('MMM D, YYYY') : ''));

const bulkDates = computed(() => {
  const [start, end] = bulkRange.value;
  if (!start || !end) return [];
  const total = dayjs(end).diff(dayjs(start), 'day') + 1;
  return Array.from({ length: Math.max(total, 0) }, (_, index) => dayjs(start).add(index, 'day').format('YYYY-MM-DD'));
});
const bulkRows = computed(() =>
  rooms.value
    .filter((room) => bulkRoomFilter.value === 0 || room.id === bulkRoomFilter.value)
    .map((room) => ({ room, days: daysByRoom.value[room.id] ?? {} })),
);
const panelOpen = computed(() => (mode.value === 'bulk' ? selection.value.length > 0 : !!selectedDate.value));
/**
 * 页面级只读币种:日历模式取当前房型,批量模式取当前筛选下首个房型。
 * 后端 calendar 按房型返回 currency;同一物业下的房型币种一致,故整页共用一个。
 */
const currency = computed(() => {
  const room = mode.value === 'bulk' ? (bulkRows.value[0]?.room ?? null) : calendarRoom.value;
  return room?.currency ?? 'THB';
});
const rangeLabel = computed(() => {
  const [start, end] = bulkRange.value;
  if (!start || !end) return '';
  return `${dayjs(start).format('MMM D, YYYY')} – ${dayjs(end).format('MMM D, YYYY')}`;
});

/** 稿面网格覆盖整月所在周:回退到 1 日所在周的周日,前进到月末所在周的周六 */
function monthRange(value: string): [string, string] {
  const first = dayjs(`${value}-01`);
  const last = first.endOf('month');
  return [first.subtract(first.day(), 'day').format('YYYY-MM-DD'), last.add(6 - last.day(), 'day').format('YYYY-MM-DD')];
}

function collectDays(hotels: { rooms: AvailabilityRoom[] }[]): void {
  const next: Record<number, Record<string, AvailabilityDay>> = {};
  for (const hotel of hotels) {
    for (const room of hotel.rooms) {
      const map: Record<string, AvailabilityDay> = {};
      for (const day of room.days ?? []) map[day.date] = day;
      next[room.id] = map;
    }
  }
  daysByRoom.value = next;
}

async function loadOptions(): Promise<void> {
  const tree = await apiAvailabilityOptions();
  rooms.value = tree.flatMap((hotel) => hotel.rooms);
}

async function loadCalendar(): Promise<void> {
  const room = calendarRoom.value;
  if (!room) return;
  const [start, end] = monthRange(month.value);
  loading.value = true;
  try {
    const data = await apiAvailabilityCalendar({ propertyId: room.property_id, roomId: room.id, startDate: start, endDate: end });
    collectDays(data.hotels);
  } finally {
    loading.value = false;
  }
}

async function loadBulk(): Promise<void> {
  const [start, end] = bulkRange.value;
  if (!start || !end) return;
  loading.value = true;
  try {
    const data = await apiAvailabilityCalendar({ roomId: bulkRoomFilter.value || undefined, startDate: start, endDate: end });
    collectDays(data.hotels);
  } finally {
    loading.value = false;
  }
}

function selectDate(date: string): void {
  if (date < dayjs().format('YYYY-MM-DD')) {
    message.warning(t('availability.errors.pastDate'));
    return;
  }
  selectedDate.value = date;
}

function toggleCell(roomId: number, date: string): void {
  if (date < dayjs().format('YYYY-MM-DD')) {
    message.warning(t('availability.errors.pastDate'));
    return;
  }
  const key = `${roomId}_${date}`;
  selection.value = selection.value.includes(key) ? selection.value.filter((item) => item !== key) : [...selection.value, key];
}

function clearSelection(): void {
  selectedDate.value = null;
  selection.value = [];
}

/**
 * 面板从关闭变为打开时回填(单日取当日值,批量取首个选中格的值)。
 * ⚠ 「Available Rooms」回填的是 `stockTotal`(库存总量)而不是 `stockLeft`(剩余):
 * 保存写回的是 `goods_daily_stock.stock_total`,回填剩余量会把已售间夜永久扣掉。
 */
function prefill(): void {
  const day = mode.value === 'bulk' ? firstSelectedDay() : selectedDay.value;
  form.status = day?.isClosed === 1 ? 'blocked' : 'open';
  form.rooms = day?.stockTotal ?? calendarRoom.value?.base_stock ?? 0;
  form.price = day?.price ?? calendarRoom.value?.base_price ?? 0;
}

function firstSelectedDay(): AvailabilityDay | null {
  for (const key of selection.value) {
    const [roomId, date] = key.split('_');
    const day = daysByRoom.value[Number(roomId)]?.[date];
    if (day) return day;
  }
  return null;
}

watch(panelOpen, (open) => {
  if (open && !panelWasOpen) prefill();
  panelWasOpen = open;
});
watch(selectedDate, () => {
  if (mode.value === 'calendar' && selectedDate.value) prefill();
});
watch(month, () => {
  selectedDate.value = null;
  void loadCalendar();
});
watch(activeRoomId, () => {
  selectedDate.value = null;
  // onMounted 里首次赋值由下方显式 loadCalendar 负责,避免重复请求
  if (booted) void loadCalendar();
});
watch(bulkRoomFilter, () => {
  selection.value = [];
  void loadBulk();
});

function enterBulk(): void {
  mode.value = 'bulk';
  clearSelection();
  void loadBulk();
}

function exitBulk(): void {
  mode.value = 'calendar';
  clearSelection();
  void loadCalendar();
}

function onRangeChange(): void {
  rangeOpen.value = false;
  const [start, end] = bulkRange.value;
  // 区间过长会让表格横向铺出上百列,收敛到 31 天(稿面样例为 5 列)
  if (start && end && dayjs(end).diff(dayjs(start), 'day') > 30) {
    bulkRange.value = [start, dayjs(start).add(30, 'day').format('YYYY-MM-DD')];
    message.warning(t('availability.errors.rangeTooLong', { count: 31 }));
  }
  selection.value = [];
  void loadBulk();
}

async function saveCalendar(): Promise<void> {
  const room = calendarRoom.value;
  const day = selectedDay.value;
  if (!room || !day) return;
  saving.value = true;
  try {
    await apiAvailabilitySaveDay({
      propertyId: room.property_id,
      roomTypeId: room.id,
      stockDate: day.date,
      price: form.price,
      stockTotal: form.rooms,
      // 面板只编辑状态/房量/价格,其余限制沿用当日原值,避免保存时被静默清零
      minStay: day.minStay,
      maxStay: day.maxStay,
      isClosed: form.status === 'blocked' ? 1 : 0,
      closedToArrival: day.closedToArrival,
      closedToDeparture: day.closedToDeparture,
      source: 'manual',
    });
    message.success(t('common.saveSuccess'));
    clearSelection();
    await loadCalendar();
  } finally {
    saving.value = false;
  }
}

/** 把某房型已选日期切成连续区间 —— 后端 batch-set 只接受 [startDate, endDate] 区间 */
function continuousRuns(dates: string[]): [string, string][] {
  const sorted = [...dates].sort();
  const runs: [string, string][] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && dayjs(date).diff(dayjs(last[1]), 'day') === 1) last[1] = date;
    else runs.push([date, date]);
  }
  return runs;
}

async function saveBulk(): Promise<void> {
  const grouped = new Map<number, string[]>();
  for (const key of selection.value) {
    const [roomId, date] = key.split('_');
    const id = Number(roomId);
    grouped.set(id, [...(grouped.get(id) ?? []), date]);
  }
  if (grouped.size === 0) return;
  saving.value = true;
  try {
    let affected = 0;
    for (const [roomId, dates] of grouped) {
      for (const [start, end] of continuousRuns(dates)) {
        const result = await apiAvailabilityBatchSet({
          startDate: start,
          endDate: end,
          roomIds: [roomId],
          price: form.price,
          stockTotal: form.rooms,
          isClosed: form.status === 'blocked' ? 1 : 0,
        });
        affected += result.affectedCells;
      }
    }
    message.success(t('availability.bulkSaved', { count: affected }));
    clearSelection();
    await loadBulk();
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadOptions();
    activeRoomId.value = rooms.value[0]?.id ?? null;
    booted = true;
    await loadCalendar();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="less">
@import './tokens.less';

.avail-page {
  color: @av-ink;
}

.avail-heading {
  h1 {
    margin: 0;
    color: @av-ink-page;
    font-family: @av-font-page;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.5;
  }
  p {
    margin: 2px 0 0;
    max-width: 487px;
    color: @av-ink-sub;
    font-family: @av-font-body;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
  }
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid @av-line;
  border-radius: 12px;
  background: #fff;
}
.controls-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.control-label {
  color: @av-ink-muted;
  font-family: @av-font-body;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
  text-transform: uppercase;
}

.range-control {
  position: relative;
}
.range-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 37px;
  padding: 8px 12px;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: @av-soft;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;
}
.range-text {
  white-space: nowrap;
}
/* 原生区间选择器只用于承载弹层,触发器由上方按钮承担 */
.range-proxy {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 10px 16px;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: #fff;
  color: @av-ink-muted;
  font-family: @av-font-body;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;

  &.primary {
    border-color: @av-primary;
    background: @av-primary-soft;
    color: @av-primary;
  }
}

.workspace {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 20px;
}
.workspace-main {
  min-width: 0;
  flex: 1;
}

@media (max-width: 1180px) {
  .workspace {
    flex-direction: column;
  }
  .workspace-main {
    width: 100%;
  }
}
</style>
