<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { formatAmount } from '@/utils/format';
import {
  apiGoodsList,
  apiRoomList,
  apiStockAdjust,
  apiStockBatchSet,
  apiStockCalendar,
  apiStockLogs,
  apiStockLowWarning,
  apiStockOverview,
  apiTicketList,
  type StockDay,
} from '@/api/goods';

/** 库存日历:SKU 价格库存日历(低库存标红)+ 区间批量设置 + 单日调整 + 总览/预警/流水 */
const { t } = useI18n();
const activeTab = ref('calendar');
const LOW_STOCK_THRESHOLD = 5;
const WEEKDAY_TEXT = computed<Record<number, string>>(() => ({
  0: t('goods.stock.weekday0'),
  1: t('goods.stock.weekday1'),
  2: t('goods.stock.weekday2'),
  3: t('goods.stock.weekday3'),
  4: t('goods.stock.weekday4'),
  5: t('goods.stock.weekday5'),
  6: t('goods.stock.weekday6'),
}));
const WEEKDAY_OPTIONS = computed(() => [0, 1, 2, 3, 4, 5, 6].map((idx) => ({ label: WEEKDAY_TEXT.value[idx], value: idx })));
const CHANGE_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.stock.changeType1'),
  2: t('goods.stock.changeType2'),
  3: t('goods.stock.changeType3'),
  4: t('goods.stock.changeType4'),
  5: t('goods.stock.changeType5'),
}));

function defaultRange(): string[] {
  const fmt = (date: Date): string => {
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  };
  const start = new Date();
  const end = new Date(Date.now() + 29 * 86400000);
  return [fmt(start), fmt(end)];
}

// ---------- 商品/SKU 选择 ----------
const goodsOptions = ref<{ label: string; value: number; goodsType: number }[]>([]);
const goodsSearching = ref(false);
const goodsId = ref<number>();
const skuOptions = ref<{ label: string; value: number }[]>([]);
const skuId = ref<number>();
const dateRange = ref<string[]>(defaultRange());

const selectedGoods = computed(() => goodsOptions.value.find((item) => item.value === goodsId.value));
const skuType = computed(() => selectedGoods.value?.goodsType ?? 0);

async function searchGoods(keyword: string): Promise<void> {
  goodsSearching.value = true;
  try {
    const data = await apiGoodsList({ goodsName: keyword, page: 1, pageSize: 20 });
    goodsOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} [${row.goods_type === 1 ? t('goods.common.typeHotel') : t('goods.common.typeTicket')}] ${row.goods_name}`,
      value: row.id,
      goodsType: row.goods_type,
    }));
  } finally {
    goodsSearching.value = false;
  }
}

async function onGoodsChange(): Promise<void> {
  skuId.value = undefined;
  skuOptions.value = [];
  if (!goodsId.value) {
    return;
  }
  const skus = skuType.value === 1 ? await apiRoomList(goodsId.value) : await apiTicketList(goodsId.value);
  skuOptions.value = skus.map((sku: TableRow) => ({
    label: `#${sku.id} ${sku.room_name ?? sku.ticket_name}`,
    value: sku.id,
  }));
}

// ---------- 日历 ----------
const calendarLoading = ref(false);
const days = ref<StockDay[]>([]);
const baseInfo = reactive({ basePrice: 0, baseStock: 0 });

async function loadCalendar(): Promise<void> {
  if (!goodsId.value || !skuId.value) {
    message.warning(t('goods.stock.warningSelectGoodsSku'));
    return;
  }
  if (dateRange.value.length !== 2) {
    message.warning(t('goods.stock.warningSelectDateRange'));
    return;
  }
  calendarLoading.value = true;
  try {
    const data = await apiStockCalendar({
      goodsId: goodsId.value,
      skuType: skuType.value,
      skuId: skuId.value,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
    });
    days.value = data.days;
    Object.assign(baseInfo, { basePrice: data.basePrice, baseStock: data.baseStock });
  } finally {
    calendarLoading.value = false;
  }
}

const calendarColumns = [
  { title: t('goods.stock.date'), dataIndex: 'date', width: 120 },
  { title: t('goods.stock.weekday'), key: 'weekday', width: 70 },
  { title: t('goods.stock.price'), dataIndex: 'price', width: 100 },
  { title: t('goods.stock.totalStock'), dataIndex: 'stockTotal', width: 90 },
  { title: t('goods.stock.sold'), dataIndex: 'stockSold', width: 80 },
  { title: t('goods.stock.locked'), dataIndex: 'stockLocked', width: 80 },
  { title: t('goods.stock.remaining'), dataIndex: 'stockLeft', width: 90 },
  { title: t('goods.stock.columns.isClosed'), dataIndex: 'isClosed', width: 90 },
  { title: t('goods.stock.columns.hasRecord'), dataIndex: 'hasRecord', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 90 },
];

function weekdayOf(date: string): string {
  return WEEKDAY_TEXT.value[new Date(`${date}T00:00:00`).getDay()] ?? '';
}

function rowClass(row: StockDay): string {
  if (row.isClosed === 1) {
    return 'row-closed';
  }
  return row.stockLeft <= LOW_STOCK_THRESHOLD ? 'row-low-stock' : '';
}

// ---------- 区间批量设置 ----------
const batchOpen = ref(false);
const batchSaving = ref(false);
const batchForm = reactive({
  range: [] as string[],
  weekdays: [] as number[],
  setPrice: false,
  price: 0,
  setStock: false,
  stockTotal: 0,
  closedAction: 0, // 0不变更 1关闭 2开放
});

function openBatch(): void {
  Object.assign(batchForm, {
    range: [...dateRange.value],
    weekdays: [],
    setPrice: false,
    price: baseInfo.basePrice,
    setStock: false,
    stockTotal: baseInfo.baseStock,
    closedAction: 0,
  });
  batchOpen.value = true;
}

async function saveBatch(): Promise<void> {
  if (!goodsId.value || !skuId.value) {
    return;
  }
  if (batchForm.range.length !== 2) {
    message.warning(t('goods.stock.warningSelectSetRange'));
    return;
  }
  if (!batchForm.setPrice && !batchForm.setStock && batchForm.closedAction === 0) {
    message.warning(t('goods.stock.warningSetOne'));
    return;
  }
  batchSaving.value = true;
  try {
    const result = await apiStockBatchSet({
      goodsId: goodsId.value,
      skuType: skuType.value,
      skuId: skuId.value,
      startDate: batchForm.range[0],
      endDate: batchForm.range[1],
      weekdays: batchForm.weekdays.length ? batchForm.weekdays : undefined,
      price: batchForm.setPrice ? batchForm.price : undefined,
      stockTotal: batchForm.setStock ? batchForm.stockTotal : undefined,
      isClosed: batchForm.closedAction === 0 ? undefined : batchForm.closedAction === 1 ? 1 : 0,
    });
    message.success(t('goods.stock.successBatchSet', { count: result.affectedDays }));
    batchOpen.value = false;
    await loadCalendar();
  } finally {
    batchSaving.value = false;
  }
}

// ---------- 单日调整 ----------
const adjustOpen = ref(false);
const adjustSaving = ref(false);
const adjustForm = reactive({ stockDate: '', changeQty: 0, remark: '' });

function openAdjust(row: StockDay): void {
  Object.assign(adjustForm, { stockDate: row.date, changeQty: 0, remark: '' });
  adjustOpen.value = true;
}

async function saveAdjust(): Promise<void> {
  if (!goodsId.value || !skuId.value) {
    return;
  }
  if (adjustForm.changeQty === 0) {
    message.warning(t('goods.stock.warningChangeQtyZero'));
    return;
  }
  adjustSaving.value = true;
  try {
    const result = await apiStockAdjust({
      goodsId: goodsId.value,
      skuType: skuType.value,
      skuId: skuId.value,
      ...adjustForm,
    });
    message.success(t('goods.stock.successAdjust', { left: result.stockLeft }));
    adjustOpen.value = false;
    await loadCalendar();
  } finally {
    adjustSaving.value = false;
  }
}

// ---------- 库存总览 / 低库存预警 / 变动流水 ----------
const overview = useTable(apiStockOverview, { goodsName: '', goodsType: undefined, daysAhead: 30 });
const warning = useTable(apiStockLowWarning, { threshold: LOW_STOCK_THRESHOLD, daysAhead: 30 });
const logs = useTable(
  (params) => apiStockLogs({ ...params, goodsId: goodsId.value || undefined }),
  { changeType: undefined, startDate: '', endDate: '' },
);
const logRange = ref<string[]>([]);

function searchLogs(): void {
  logs.query.startDate = logRange.value[0] ?? '';
  logs.query.endDate = logRange.value[1] ?? '';
  logs.search();
}

const overviewColumns = [
  { title: t('goods.stock.columns.goodsId'), dataIndex: 'id', width: 80 },
  { title: t('goods.stock.columns.goodsName'), dataIndex: 'goods_name', ellipsis: true },
  { title: t('goods.stock.columns.type'), dataIndex: 'goods_type', width: 80 },
  { title: t('goods.stock.totalStock'), dataIndex: 'stock_total', width: 100 },
  { title: t('goods.stock.sold'), dataIndex: 'stock_sold', width: 90 },
  { title: t('goods.stock.locked'), dataIndex: 'stock_locked', width: 90 },
  { title: t('goods.stock.remaining'), dataIndex: 'stock_left', width: 100 },
];
const warningColumns = [
  { title: t('goods.stock.date'), dataIndex: 'stock_date', width: 110 },
  { title: t('goods.stock.columns.goodsName'), dataIndex: 'goods_name', ellipsis: true },
  { title: t('goods.common.sku'), dataIndex: 'sku_id', width: 80 },
  { title: t('goods.stock.totalStock'), dataIndex: 'stock_total', width: 90 },
  { title: t('goods.stock.sold'), dataIndex: 'stock_sold', width: 80 },
  { title: t('goods.stock.locked'), dataIndex: 'stock_locked', width: 80 },
  { title: t('goods.stock.remaining'), dataIndex: 'stock_left', width: 90 },
];
const logColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('goods.stock.columns.goodsId'), dataIndex: 'goods_id', width: 90 },
  { title: t('goods.common.sku'), dataIndex: 'sku_id', width: 80 },
  { title: t('goods.stock.columns.stockDate'), dataIndex: 'stock_date', width: 110 },
  { title: t('goods.stock.columns.changeType'), dataIndex: 'change_type', width: 100 },
  { title: t('goods.stock.columns.changeQty'), dataIndex: 'change_qty', width: 90 },
  { title: t('goods.stock.columns.remark'), dataIndex: 'remark', ellipsis: true },
  { title: t('goods.stock.columns.time'), dataIndex: 'created_at', width: 165 },
];

onMounted(() => {
  void overview.load();
  void warning.load();
  void logs.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:active-key="activeTab">
        <!-- 价格库存日历 -->
        <a-tab-pane key="calendar" :tab="t('goods.stock.tabs.calendar')">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.stock.filter.goods')">
              <a-select
                v-model:value="goodsId"
                show-search
                :filter-option="false"
                :options="goodsOptions"
                :loading="goodsSearching"
                :placeholder="t('goods.stock.placeholderSearchGoods')"
                style="width: 300px"
                @search="searchGoods"
                @change="onGoodsChange"
              />
            </a-form-item>
            <a-form-item :label="skuType === 2 ? t('goods.common.ticketType') : t('goods.common.roomType')">
              <a-select v-model:value="skuId" :options="skuOptions" :placeholder="t('goods.stock.placeholderSelectSku')" style="width: 220px" />
            </a-form-item>
            <a-form-item :label="t('goods.stock.filter.dateRange')">
              <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadCalendar"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button v-perm="'goods:stock:edit'" :disabled="!skuId" @click="openBatch">{{ t('goods.stock.actions.batchSet') }}</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-alert
            v-if="days.length"
            type="info"
            show-icon
            style="margin-bottom: 12px"
            :message="t('goods.stock.alertBaseInfo', { price: formatAmount(baseInfo.basePrice), stock: baseInfo.baseStock, threshold: LOW_STOCK_THRESHOLD })"
          />
          <a-table
            :columns="calendarColumns"
            :data-source="days"
            :loading="calendarLoading"
            row-key="date"
            size="small"
            :pagination="{ pageSize: 31, showSizeChanger: false }"
            :row-class-name="rowClass"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'weekday'">{{ weekdayOf(record.date) }}</template>
              <template v-else-if="column.dataIndex === 'price'">{{ formatAmount(record.price) }}</template>
              <template v-else-if="column.dataIndex === 'stockLeft'">
                <span :style="record.stockLeft <= LOW_STOCK_THRESHOLD ? 'color: #f5222d; font-weight: 600' : ''">{{ record.stockLeft }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'isClosed'">
                <a-tag v-if="record.isClosed === 1" color="error">{{ t('goods.stock.tagClosed') }}</a-tag>
                <a-tag v-else color="success">{{ t('goods.stock.tagOpen') }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'hasRecord'">
                <a-tag v-if="record.hasRecord === 1" color="processing">{{ t('goods.stock.tagSet') }}</a-tag>
                <span v-else style="color: #909399">{{ t('goods.stock.tagBase') }}</span>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-button v-perm="'goods:stock:edit'" type="link" size="small" @click="openAdjust(record)">{{ t('goods.stock.actions.adjust') }}</a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 库存总览 -->
        <a-tab-pane key="overview" :tab="t('goods.stock.tabs.overview')">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.stock.columns.goodsName')">
              <a-input v-model:value="overview.query.goodsName" allow-clear style="width: 180px" @press-enter="overview.search()" />
            </a-form-item>
            <a-form-item :label="t('goods.stock.columns.type')">
              <a-select v-model:value="overview.query.goodsType" allow-clear :placeholder="t('common.all')" style="width: 110px">
                <a-select-option :value="1">{{ t('goods.common.typeHotel') }}</a-select-option>
                <a-select-option :value="2">{{ t('goods.common.typeTicket') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('goods.stock.fieldDaysAhead')">
              <a-input-number v-model:value="overview.query.daysAhead" :min="1" :max="90" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="overview.search()">{{ t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="overviewColumns"
            :data-source="overview.list.value"
            :loading="overview.loading.value"
            :pagination="overview.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'goods_type'">{{ record.goods_type === 1 ? t('goods.common.typeHotel') : t('goods.common.typeTicket') }}</template>
              <template v-else-if="column.dataIndex === 'stock_left'">
                <span :style="record.stock_left <= LOW_STOCK_THRESHOLD ? 'color: #f5222d; font-weight: 600' : ''">{{ record.stock_left }}</span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 低库存预警 -->
        <a-tab-pane key="warning" :tab="t('goods.stock.tabs.warning')">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.stock.fieldThreshold')">
              <a-input-number v-model:value="warning.query.threshold" :min="0" :max="999" />
            </a-form-item>
            <a-form-item :label="t('goods.stock.fieldDaysAhead')">
              <a-input-number v-model:value="warning.query.daysAhead" :min="1" :max="90" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="warning.search()">{{ t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="warningColumns"
            :data-source="warning.list.value"
            :loading="warning.loading.value"
            :pagination="warning.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'stock_left'">
                <span style="color: #f5222d; font-weight: 600">{{ record.stock_left }}</span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 变动流水 -->
        <a-tab-pane key="logs" :tab="t('goods.stock.tabs.logs')">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.stock.columns.changeType')">
              <a-select v-model:value="logs.query.changeType" allow-clear :placeholder="t('common.all')" style="width: 130px">
                <a-select-option v-for="(text, type) in CHANGE_TYPE_TEXT" :key="type" :value="Number(type)">{{ text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('goods.stock.columns.stockDate')">
              <a-range-picker v-model:value="logRange" value-format="YYYY-MM-DD" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="searchLogs">{{ t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="logColumns"
            :data-source="logs.list.value"
            :loading="logs.loading.value"
            :pagination="logs.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'change_type'">
                <a-tag :color="record.change_type === 5 ? 'blue' : 'default'">{{ CHANGE_TYPE_TEXT[record.change_type] ?? record.change_type }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'change_qty'">
                <span :style="record.change_qty < 0 ? 'color: #f5222d' : 'color: #52c41a'">
                  {{ record.change_qty > 0 ? `+${record.change_qty}` : record.change_qty }}
                </span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 区间批量设置 -->
    <a-modal v-model:open="batchOpen" :title="t('goods.stock.modalBatchSet')" width="560px" :confirm-loading="batchSaving" @ok="saveBatch">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('goods.stock.batchSetModal.dateRange')" required>
          <a-range-picker v-model:value="batchForm.range" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.stock.fieldWeekdays')">
          <a-checkbox-group
            v-model:value="batchForm.weekdays"
            :options="WEEKDAY_OPTIONS"
          />
          <div class="form-tip">{{ t('goods.stock.tipAllDays') }}</div>
        </a-form-item>
        <a-form-item :label="t('goods.stock.price')">
          <a-space>
            <a-checkbox v-model:checked="batchForm.setPrice">{{ t('common.optional') }}</a-checkbox>
            <a-input-number v-model:value="batchForm.price" :min="0" :precision="2" :disabled="!batchForm.setPrice" style="width: 160px" />
          </a-space>
        </a-form-item>
        <a-form-item :label="t('goods.stock.totalStock')">
          <a-space>
            <a-checkbox v-model:checked="batchForm.setStock">{{ t('common.optional') }}</a-checkbox>
            <a-input-number v-model:value="batchForm.stockTotal" :min="0" :disabled="!batchForm.setStock" style="width: 160px" />
          </a-space>
          <div class="form-tip">{{ t('goods.stock.tipStockMin') }}</div>
        </a-form-item>
        <a-form-item :label="t('goods.stock.fieldCloseOrOff')">
          <a-radio-group v-model:value="batchForm.closedAction">
            <a-radio :value="0">{{ t('goods.stock.optionNoChange') }}</a-radio>
            <a-radio v-perm="'goods:stock:close'" :value="1">{{ t('goods.stock.optionClose') }}</a-radio>
            <a-radio :value="2">{{ t('goods.stock.optionOpen') }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 单日调整 -->
    <a-modal v-model:open="adjustOpen" :title="t('goods.stock.modalAdjustTitle', { date: adjustForm.stockDate })" width="440px" :confirm-loading="adjustSaving" @ok="saveAdjust">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('goods.stock.fieldChangeQty')" required>
          <a-input-number v-model:value="adjustForm.changeQty" :min="-9999" :max="9999" style="width: 160px" />
          <div class="form-tip">{{ t('goods.stock.tipChangeQty') }}</div>
        </a-form-item>
        <a-form-item :label="t('goods.stock.adjustModal.reason')">
          <a-input v-model:value="adjustForm.remark" :maxlength="255" :placeholder="t('goods.stock.placeholderAdjustReason')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.form-tip {
  font-size: 12px;
  color: var(--mtrip-text-aux, #909399);
}

:deep(.row-low-stock) td {
  background-color: rgb(245 34 45 / 6%) !important;
}

:deep(.row-closed) td {
  color: #bfbfbf;
}
</style>
