<template>
  <PageContainer>
    <div class="availability-page">
      <div class="toolbar">
        <div class="selector-wrap">
          <HomeOutlined class="selector-icon" />
          <a-select v-model:value="filters.goodsId" class="hotel-filter" :placeholder="t('availability.filters.allHotels')" allow-clear @change="handleHotelChange">
            <a-select-option v-for="hotel in hotelOptions" :key="hotel.id" :value="hotel.id">{{ hotel.name }}</a-select-option>
          </a-select>
        </div>
        <span class="property-pill"><HomeOutlined />{{ t('availability.propertyCount', { count: hotelOptions.length }) }}</span>
        <a-select v-if="filters.goodsId" v-model:value="filters.roomId" class="room-filter" :placeholder="t('availability.filters.allRooms')" allow-clear @change="loadCalendar">
          <a-select-option v-for="room in roomsForSelectedHotel" :key="room.id" :value="room.id">{{ room.name }}</a-select-option>
        </a-select>
        <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" class="date-range" @change="loadCalendar" />
        <div class="spacer"></div>
        <div class="view-toggle"><button class="active">{{ t('availability.views.calendar') }}</button><button>{{ t('availability.views.list') }}</button></div>
        <a-button v-perm="'mch:availability:bulk-update'" @click="bulkOpen = true"><SlidersOutlined />{{ t('availability.actions.bulkUpdate') }}</a-button>
        <a-button v-perm="'mch:availability:sync'" :loading="syncing" @click="syncNow"><SyncOutlined />{{ t('availability.actions.syncNow') }}</a-button>
      </div>

      <div class="sync-row">
        <div class="sync-pill success"><span></span><strong>{{ t('availability.sync.pms') }}: {{ t('availability.sync.connected') }}</strong><em>{{ t('availability.sync.lastSync', { time: summary.lastSyncAt || '-' }) }}</em></div>
        <div class="sync-pill danger"><span></span><strong>{{ t('availability.sync.cm') }}: {{ t('availability.sync.disconnected') }}</strong><em>{{ t('availability.sync.pending', { count: summary.closedCells || 0 }) }}</em></div>
      </div>

      <div class="legend-row"><strong>{{ t('availability.legend.title') }}</strong><span class="dot available"></span>{{ t('availability.legend.available') }}<span class="dot low"></span>{{ t('availability.legend.low') }}<span class="dot sold"></span>{{ t('availability.legend.sold') }}<span class="dot closed"></span>{{ t('availability.legend.closed') }}</div>

      <div class="calendar-shell" :class="{ 'with-drawer': !!activeCell }">
        <div class="calendar-main">
          <a-spin :spinning="loading">
            <div class="calendar-card">
              <table class="calendar-table">
                <thead><tr><th class="sticky room-col">{{ filters.goodsId ? t('availability.columns.roomType') : t('availability.columns.hotelRoom') }}</th><th v-for="date in dates" :key="date" :class="{ weekend: isWeekend(date) }"><strong>{{ dayNumber(date) }}</strong><span>{{ weekdayLabel(date) }}</span></th></tr></thead>
                <tbody>
                  <template v-for="hotel in hotels" :key="hotel.id">
                    <tr v-if="!filters.goodsId" class="hotel-row"><td :colspan="dates.length + 1"><span></span><strong>{{ hotel.name }}</strong><em>{{ t('availability.roomTypeCount', { count: hotel.rooms.length }) }}</em></td></tr>
                    <tr v-for="room in hotel.rooms" :key="room.id">
                      <td class="sticky room-col room-cell"><strong>{{ room.name }}</strong><span>{{ t('availability.roomMeta', { total: room.base_stock, available: room.base_stock }) }}</span></td>
                      <td v-for="day in room.days || []" :key="day.date" :class="{ weekend: isWeekend(day.date) }" @click="openCell(hotel, room, day)">
                        <div :class="['day-cell', cellTone(day), isActiveCell(room.id, day.date) ? 'selected' : '']"><strong>{{ day.isClosed ? '-' : day.stockLeft }}</strong><span>{{ day.isClosed ? t('availability.cell.stop') : priceShort(day.price) }}</span></div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </a-spin>

          <div class="bottom-panels">
            <div class="panel-card"><div class="panel-head"><strong>{{ t('availability.rules.title') }}</strong><a-button type="text" size="small"><PlusOutlined />{{ t('availability.rules.add') }}</a-button></div><button v-for="rule in pricingRules" :key="rule.id" class="rule-row"><span :class="{ active: rule.active }"></span><em>{{ rule.label }}</em><strong>{{ rule.value }}</strong><RightOutlined /></button></div>
            <div class="panel-card"><div class="panel-head"><strong>{{ t('availability.alerts.title') }}</strong><a-tag color="warning">{{ t('availability.alerts.active', { count: activeAlertCount }) }}</a-tag></div><div v-for="alert in alerts" :key="alert.key" class="alert-row"><WarningOutlined /><div><strong>{{ alert.title }}</strong><p>{{ alert.desc }}</p></div><a-button size="small" type="text" @click="alert.resolved = true">{{ t('availability.alerts.resolve') }}</a-button></div></div>
          </div>
        </div>

        <aside v-if="activeCell" class="cell-drawer">
          <div class="drawer-head"><div><strong>{{ activeCell.room.name }}</strong><span>{{ activeCell.day.date }} · {{ isWeekend(activeCell.day.date) ? t('availability.weekend') : t('availability.weekday') }}</span><em>{{ activeCell.hotel.name }}</em></div><a-button type="text" @click="activeCell = null"><CloseOutlined /></a-button></div>
          <div class="drawer-section"><p>{{ t('availability.drawer.availabilityPricing') }}</p><div class="two-grid"><a-form-item :label="t('availability.fields.availableRooms')"><a-input-number v-model:value="cellForm.stockTotal" :min="0" class="full" /></a-form-item><a-form-item :label="t('availability.fields.price')"><a-input-number v-model:value="cellForm.price" :min="0" :precision="2" class="full" /></a-form-item><a-form-item :label="t('availability.fields.minStay')"><a-input-number v-model:value="cellForm.minStay" :min="1" class="full" /></a-form-item><a-form-item :label="t('availability.fields.maxStay')"><a-input-number v-model:value="cellForm.maxStay" :min="1" class="full" /></a-form-item></div></div>
          <div class="drawer-section"><p>{{ t('availability.drawer.restrictions') }}</p><div class="switch-row"><div><strong>{{ t('availability.fields.stopSell') }}</strong><span>{{ t('availability.hints.stopSell') }}</span></div><a-switch v-model:checked="cellForm.isClosed" /></div><div class="switch-row"><div><strong>{{ t('availability.fields.cta') }}</strong><span>{{ t('availability.hints.cta') }}</span></div><a-switch v-model:checked="cellForm.closedToArrival" /></div><div class="switch-row"><div><strong>{{ t('availability.fields.ctd') }}</strong><span>{{ t('availability.hints.ctd') }}</span></div><a-switch v-model:checked="cellForm.closedToDeparture" /></div></div>
          <div class="drawer-section"><p>{{ t('availability.drawer.source') }}</p><div class="source-row"><span>{{ t('availability.sync.pms') }}</span><a-tag color="success">{{ t('availability.sync.synced') }}</a-tag></div><div class="source-row"><span>{{ t('availability.sync.cm') }}</span><a-tag>{{ t('availability.sync.notConnected') }}</a-tag></div><div class="source-row"><span>{{ t('availability.sync.manual') }}</span><a-tag color="blue">{{ activeCell.day.hasRecord ? t('availability.sync.active') : t('availability.sync.off') }}</a-tag></div></div>
          <div class="drawer-section"><p>{{ t('availability.drawer.history') }}</p><div v-for="log in logs" :key="log.id" class="history-row"><ClockCircleOutlined /><div><strong>{{ log.remark }}</strong><span>{{ log.created_at }} · {{ log.change_qty }}</span></div></div><a-empty v-if="logs.length === 0" :description="t('availability.drawer.noHistory')" /></div>
          <div class="drawer-footer"><a-button @click="activeCell = null">{{ t('common.cancel') }}</a-button><a-button v-perm="'mch:availability:edit'" type="primary" :loading="saving" @click="saveCell"><CheckOutlined />{{ t('availability.actions.saveChanges') }}</a-button></div>
        </aside>
      </div>

      <a-modal v-model:open="bulkOpen" :title="t('availability.bulk.title')" :width="600" :confirm-loading="bulkSaving" @ok="applyBulk">
        <p class="modal-subtitle">{{ t('availability.bulk.subtitle') }}</p>
        <div class="modal-section"><p>{{ t('availability.bulk.dateRange') }}</p><a-range-picker v-model:value="bulkForm.range" value-format="YYYY-MM-DD" class="full" /></div>
        <div class="modal-section"><p>{{ t('availability.bulk.roomTypes') }}</p><a-select v-model:value="bulkForm.roomIds" mode="multiple" class="full" :placeholder="t('availability.bulk.selectRooms')"><a-select-option v-for="room in allRooms" :key="room.id" :value="room.id">{{ room.name }}</a-select-option></a-select></div>
        <a-tabs v-model:activeKey="bulkTab"><a-tab-pane key="prices" :tab="t('availability.bulk.tabs.prices')"><div class="two-grid"><a-form-item :label="t('availability.fields.price')"><a-input-number v-model:value="bulkForm.price" :min="0" :precision="2" class="full" /></a-form-item></div></a-tab-pane><a-tab-pane key="inventory" :tab="t('availability.bulk.tabs.inventory')"><a-form-item :label="t('availability.fields.availableRooms')"><a-input-number v-model:value="bulkForm.stockTotal" :min="0" class="full" /></a-form-item></a-tab-pane><a-tab-pane key="restrictions" :tab="t('availability.bulk.tabs.restrictions')"><div class="restriction-grid"><a-checkbox v-model:checked="bulkForm.isClosed">{{ t('availability.fields.stopSell') }}</a-checkbox><a-checkbox v-model:checked="bulkForm.closedToArrival">{{ t('availability.fields.cta') }}</a-checkbox><a-checkbox v-model:checked="bulkForm.closedToDeparture">{{ t('availability.fields.ctd') }}</a-checkbox></div></a-tab-pane></a-tabs>
      </a-modal>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';
import { CheckOutlined, ClockCircleOutlined, CloseOutlined, HomeOutlined, PlusOutlined, RightOutlined, SlidersOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { apiAvailabilityBatchSet, apiAvailabilityCalendar, apiAvailabilityLogs, apiAvailabilitySaveDay, apiAvailabilitySyncNow, type AvailabilityDay, type AvailabilityHotel, type AvailabilityRoom, type StockLogRow } from '@/api/availability';

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const syncing = ref(false);
const bulkOpen = ref(false);
const bulkSaving = ref(false);
const bulkTab = ref('prices');
const hotels = ref<AvailabilityHotel[]>([]);
const dates = ref<string[]>([]);
const summary = reactive({ hotelCount: 0, roomCount: 0, lowInventoryCells: 0, closedCells: 0, pms: '', channelManager: '', lastSyncAt: '' });
const filters = reactive<{ goodsId?: number; roomId?: number }>({});
const dateRange = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().add(13, 'day').format('YYYY-MM-DD')]);
const activeCell = ref<{ hotel: AvailabilityHotel; room: AvailabilityRoom; day: AvailabilityDay } | null>(null);
const logs = ref<StockLogRow[]>([]);
const cellForm = reactive({ price: 0, stockTotal: 0, minStay: 1, maxStay: 30, isClosed: false, closedToArrival: false, closedToDeparture: false });
const bulkForm = reactive<{ range?: [string, string]; roomIds: number[]; price?: number; stockTotal?: number; isClosed: boolean; closedToArrival: boolean; closedToDeparture: boolean }>({ roomIds: [], isClosed: false, closedToArrival: false, closedToDeparture: false });
const alerts = reactive([{ key: 'low', title: computed(() => t('availability.alerts.lowTitle')), desc: computed(() => t('availability.alerts.lowDesc')), resolved: false }, { key: 'sync', title: computed(() => t('availability.alerts.syncTitle')), desc: computed(() => t('availability.alerts.syncDesc')), resolved: false }]);
const pricingRules = computed(() => [{ id: 'weekend', label: t('availability.rules.weekend'), value: '1.28x', active: true }, { id: 'early', label: t('availability.rules.earlyBird'), value: '-10%', active: true }, { id: 'min', label: t('availability.rules.minStay'), value: '2', active: true }]);
const hotelOptions = computed(() => hotels.value.map(({ id, name }) => ({ id, name })));
const roomsForSelectedHotel = computed(() => hotels.value.find((hotel) => hotel.id === filters.goodsId)?.rooms || []);
const allRooms = computed(() => hotels.value.flatMap((hotel) => hotel.rooms));
const activeAlertCount = computed(() => alerts.filter((item) => !item.resolved).length);

async function loadCalendar() { loading.value = true; try { const data = await apiAvailabilityCalendar({ goodsId: filters.goodsId, roomId: filters.roomId, startDate: dateRange.value?.[0], endDate: dateRange.value?.[1] }); hotels.value = data.hotels; dates.value = data.dates; Object.assign(summary, data.summary); } finally { loading.value = false; } }
function handleHotelChange() { filters.roomId = undefined; void loadCalendar(); }
function isWeekend(date: string) { const day = dayjs(date).day(); return day === 5 || day === 6; }
function dayNumber(date: string) { return dayjs(date).format('DD'); }
function weekdayLabel(date: string) { return dayjs(date).format('ddd'); }
function priceShort(price: number) { return price >= 1000 ? `${(price / 1000).toFixed(1)}K` : String(price); }
function cellTone(day: AvailabilityDay) { if (day.isClosed) return 'closed'; if (day.stockLeft === 0) return 'sold'; if (day.stockLeft <= 2) return 'low'; return 'available'; }
function isActiveCell(roomId: number, date: string) { return activeCell.value?.room.id === roomId && activeCell.value?.day.date === date; }
async function openCell(hotel: AvailabilityHotel, room: AvailabilityRoom, day: AvailabilityDay) { activeCell.value = { hotel, room, day }; Object.assign(cellForm, { price: day.price, stockTotal: day.stockTotal, minStay: day.minStay, maxStay: day.maxStay, isClosed: day.isClosed === 1, closedToArrival: day.closedToArrival === 1, closedToDeparture: day.closedToDeparture === 1 }); logs.value = await apiAvailabilityLogs({ goodsId: hotel.id, skuId: room.id, stockDate: day.date }); }
async function saveCell() { if (!activeCell.value) return; saving.value = true; try { await apiAvailabilitySaveDay({ goodsId: activeCell.value.hotel.id, skuId: activeCell.value.room.id, stockDate: activeCell.value.day.date, price: cellForm.price, stockTotal: cellForm.stockTotal, minStay: cellForm.minStay, maxStay: cellForm.maxStay, isClosed: cellForm.isClosed ? 1 : 0, closedToArrival: cellForm.closedToArrival ? 1 : 0, closedToDeparture: cellForm.closedToDeparture ? 1 : 0, source: 'manual' }); message.success(t('common.saveSuccess')); await loadCalendar(); } finally { saving.value = false; } }
async function applyBulk() { if (!bulkForm.range?.[0] || !bulkForm.range?.[1] || bulkForm.roomIds.length === 0) { message.warning(t('availability.bulk.requiredTip')); return; } bulkSaving.value = true; try { const payload: Record<string, unknown> = { startDate: bulkForm.range[0], endDate: bulkForm.range[1], roomIds: bulkForm.roomIds }; if (bulkTab.value === 'prices') payload.price = bulkForm.price; if (bulkTab.value === 'inventory') payload.stockTotal = bulkForm.stockTotal; if (bulkTab.value === 'restrictions') { payload.isClosed = bulkForm.isClosed ? 1 : 0; payload.closedToArrival = bulkForm.closedToArrival ? 1 : 0; payload.closedToDeparture = bulkForm.closedToDeparture ? 1 : 0; } await apiAvailabilityBatchSet(payload); message.success(t('common.opSuccess')); bulkOpen.value = false; await loadCalendar(); } finally { bulkSaving.value = false; } }
async function syncNow() { syncing.value = true; try { const data = await apiAvailabilitySyncNow(); summary.lastSyncAt = data.lastSyncAt; message.success(t('common.opSuccess')); } finally { syncing.value = false; } }

onMounted(loadCalendar);
</script>

<style scoped lang="less">
.availability-page { color: #0f172a; }
.toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.selector-wrap { position: relative; } .selector-icon { position: absolute; left: 11px; top: 50%; z-index: 2; transform: translateY(-50%); color: #64748b; } .hotel-filter { width: 230px; } .selector-wrap :deep(.ant-select-selector) { padding-left: 28px !important; } .room-filter { width: 180px; } .date-range { width: 240px; } .spacer { flex: 1; }
.property-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 999px; background: #f1f5f9; color: #64748b; font-size: 10.5px; font-weight: 700; }
.view-toggle { display: flex; gap: 2px; padding: 4px; border-radius: 8px; background: #f1f5f9; } .view-toggle button { border: 0; border-radius: 6px; padding: 6px 12px; background: transparent; color: #64748b; font-size: 12px; font-weight: 700; cursor: pointer; } .view-toggle button.active { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, .08); }
.sync-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; } .sync-pill { display: flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 8px; font-size: 11px; } .sync-pill span { width: 6px; height: 6px; border-radius: 50%; } .sync-pill em { font-style: normal; } .sync-pill.success { border: 1px solid #bbf7d0; background: #f0fdf4; color: #15803d; } .sync-pill.success span { background: #22c55e; } .sync-pill.danger { border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; } .sync-pill.danger span { background: #f87171; }
.legend-row { display: flex; align-items: center; gap: 8px; margin: 0 0 12px 4px; color: #64748b; font-size: 11px; } .legend-row strong { color: #94a3b8; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; } .dot { width: 16px; height: 16px; border-radius: 4px; border: 1px solid; } .dot.available { background: #dcfce7; border-color: #86efac; } .dot.low { background: #fef3c7; border-color: #fcd34d; } .dot.sold { background: #fee2e2; border-color: #fca5a5; } .dot.closed { background: #f1f5f9; border-color: #cbd5e1; }
.calendar-shell { display: flex; align-items: flex-start; gap: 16px; } .calendar-main { flex: 1; min-width: 0; } .calendar-card { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.calendar-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; } .calendar-table th { min-width: 68px; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b; text-align: center; font-weight: 700; } .calendar-table th span { display: block; font-size: 10px; font-weight: 500; } .calendar-table th.weekend { background: #eff6ff; color: #1d4ed8; } .calendar-table td { padding: 4px; border-top: 1px solid #f1f5f9; text-align: center; cursor: pointer; } .calendar-table td.weekend { background: rgba(239, 246, 255, .45); }
.sticky { position: sticky; left: 0; z-index: 5; } .room-col { min-width: 180px !important; background: #fff; text-align: left !important; border-right: 1px solid #f1f5f9; } .room-cell { padding: 10px 16px !important; cursor: default !important; } .room-cell strong { display: block; font-size: 12px; } .room-cell span { display: block; margin-top: 2px; color: #94a3b8; font-size: 10px; }
.hotel-row td { position: sticky; left: 0; z-index: 4; padding: 8px 16px !important; background: #f8fafc; text-align: left; cursor: default; } .hotel-row span { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: #2563eb; } .hotel-row em { margin-left: 6px; color: #94a3b8; font-style: normal; font-size: 10px; }
.day-cell { border: 1px solid; border-radius: 5px; padding: 6px 4px; transition: all .18s ease; } .day-cell:hover, .day-cell.selected { box-shadow: 0 0 0 2px #93c5fd; } .day-cell strong { display: block; font-size: 11px; } .day-cell span { display: block; font-size: 9px; opacity: .78; } .day-cell.available { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; } .day-cell.low { border-color: #fde68a; background: #fffbeb; color: #b45309; } .day-cell.sold { border-color: #fecaca; background: #fef2f2; color: #b91c1c; } .day-cell.closed { border-color: #e2e8f0; background: #f1f5f9; color: #64748b; }
.bottom-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; } .panel-card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; } .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rule-row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fff; text-align: left; cursor: pointer; } .rule-row + .rule-row { margin-top: 6px; } .rule-row span { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; } .rule-row span.active { background: #22c55e; } .rule-row em { flex: 1; min-width: 0; color: #334155; font-style: normal; font-size: 12px; } .rule-row strong { color: #2563eb; }
.alert-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; color: #b45309; } .alert-row + .alert-row { margin-top: 8px; } .alert-row div { flex: 1; } .alert-row strong { font-size: 12px; } .alert-row p { margin: 2px 0 0; color: #64748b; font-size: 11px; }
.cell-drawer { width: 340px; flex-shrink: 0; max-height: calc(100vh - 118px); overflow: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; } .drawer-head { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #fff; } .drawer-head strong, .drawer-head span, .drawer-head em { display: block; } .drawer-head strong { font-size: 13px; } .drawer-head span { color: #64748b; font-size: 11.5px; } .drawer-head em { color: #94a3b8; font-size: 10.5px; font-style: normal; }
.drawer-section { padding: 16px; border-bottom: 1px solid #f1f5f9; } .drawer-section > p, .modal-section > p { margin: 0 0 12px; color: #94a3b8; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; } .two-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .full { width: 100%; }
.switch-row { display: flex; justify-content: space-between; gap: 12px; } .switch-row + .switch-row { margin-top: 14px; } .switch-row strong { display: block; font-size: 12px; } .switch-row span { display: block; color: #94a3b8; font-size: 10.5px; } .source-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; } .source-row + .source-row { margin-top: 8px; }
.history-row { display: flex; gap: 9px; font-size: 11px; } .history-row + .history-row { margin-top: 10px; } .history-row strong, .history-row span { display: block; } .history-row span { color: #94a3b8; } .drawer-footer { position: sticky; bottom: 0; display: flex; justify-content: space-between; padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #fff; }
.modal-subtitle { margin-top: -6px; color: #64748b; font-size: 12px; } .modal-section { margin-top: 18px; } .restriction-grid { display: grid; gap: 12px; }
@media (max-width: 1100px) { .calendar-shell { flex-direction: column; } .cell-drawer { width: 100%; max-height: none; } .bottom-panels { grid-template-columns: 1fr; } }
</style>

