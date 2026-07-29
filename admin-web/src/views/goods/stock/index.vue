<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { SearchOutlined } from '@ant-design/icons-vue';
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
const activeTab = ref('calendar');
const LOW_STOCK_THRESHOLD = 5;
const WEEKDAY_TEXT = ['日', '一', '二', '三', '四', '五', '六'];
const CHANGE_TYPE_TEXT: Record<number, string> = { 1: '下单锁定', 2: '支付扣减', 3: '释放', 4: '退款回补', 5: '手动调整' };

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
      label: `#${row.id} [${row.goods_type === 1 ? '酒店' : '门票'}] ${row.goods_name}`,
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
    message.warning('请先选择商品与 SKU');
    return;
  }
  if (dateRange.value.length !== 2) {
    message.warning('请选择日期区间');
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
  { title: '日期', dataIndex: 'date', width: 120 },
  { title: '星期', key: 'weekday', width: 70 },
  { title: '价格', dataIndex: 'price', width: 100 },
  { title: '总库存', dataIndex: 'stockTotal', width: 90 },
  { title: '已售', dataIndex: 'stockSold', width: 80 },
  { title: '锁定', dataIndex: 'stockLocked', width: 80 },
  { title: '剩余', dataIndex: 'stockLeft', width: 90 },
  { title: '关房/停售', dataIndex: 'isClosed', width: 90 },
  { title: '来源', dataIndex: 'hasRecord', width: 90 },
  { title: '操作', key: 'action_col', width: 90 },
];

function weekdayOf(date: string): string {
  return `周${WEEKDAY_TEXT[new Date(`${date}T00:00:00`).getDay()]}`;
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
    message.warning('请选择设置区间');
    return;
  }
  if (!batchForm.setPrice && !batchForm.setStock && batchForm.closedAction === 0) {
    message.warning('价格/库存/关房 至少设置一项');
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
    message.success(`已批量设置 ${result.affectedDays} 天`);
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
    message.warning('调整数量不能为 0');
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
    message.success(`库存已调整,当前剩余 ${result.stockLeft}`);
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
  { title: '商品ID', dataIndex: 'id', width: 80 },
  { title: '商品名称', dataIndex: 'goods_name', ellipsis: true },
  { title: '类型', dataIndex: 'goods_type', width: 80 },
  { title: '总库存', dataIndex: 'stock_total', width: 100 },
  { title: '已售', dataIndex: 'stock_sold', width: 90 },
  { title: '锁定', dataIndex: 'stock_locked', width: 90 },
  { title: '剩余', dataIndex: 'stock_left', width: 100 },
];
const warningColumns = [
  { title: '日期', dataIndex: 'stock_date', width: 110 },
  { title: '商品', dataIndex: 'goods_name', ellipsis: true },
  { title: 'SKU', dataIndex: 'sku_id', width: 80 },
  { title: '总库存', dataIndex: 'stock_total', width: 90 },
  { title: '已售', dataIndex: 'stock_sold', width: 80 },
  { title: '锁定', dataIndex: 'stock_locked', width: 80 },
  { title: '剩余', dataIndex: 'stock_left', width: 90 },
];
const logColumns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '商品ID', dataIndex: 'goods_id', width: 90 },
  { title: 'SKU', dataIndex: 'sku_id', width: 80 },
  { title: '库存日期', dataIndex: 'stock_date', width: 110 },
  { title: '变动类型', dataIndex: 'change_type', width: 100 },
  { title: '变动数量', dataIndex: 'change_qty', width: 90 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '时间', dataIndex: 'created_at', width: 165 },
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
        <a-tab-pane key="calendar" tab="价格库存日历">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="商品">
              <a-select
                v-model:value="goodsId"
                show-search
                :filter-option="false"
                :options="goodsOptions"
                :loading="goodsSearching"
                placeholder="输入商品名称搜索"
                style="width: 300px"
                @search="searchGoods"
                @change="onGoodsChange"
              />
            </a-form-item>
            <a-form-item :label="skuType === 2 ? '票种' : '房型'">
              <a-select v-model:value="skuId" :options="skuOptions" placeholder="选择 SKU" style="width: 220px" />
            </a-form-item>
            <a-form-item label="日期区间">
              <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadCalendar"><template #icon><SearchOutlined /></template>查询</a-button>
                <a-button v-perm="'goods:stock:edit'" :disabled="!skuId" @click="openBatch">批量设置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-alert
            v-if="days.length"
            type="info"
            show-icon
            style="margin-bottom: 12px"
            :message="`基础价 ${formatAmount(baseInfo.basePrice)} / 基础库存 ${baseInfo.baseStock};未单独设置的日期按基础值售卖;剩余 ≤ ${LOW_STOCK_THRESHOLD} 标红`"
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
                <a-tag v-if="record.isClosed === 1" color="error">已关闭</a-tag>
                <a-tag v-else color="success">开放</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'hasRecord'">
                <a-tag v-if="record.hasRecord === 1" color="processing">已设置</a-tag>
                <span v-else style="color: #909399">基础值</span>
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-button v-perm="'goods:stock:edit'" type="link" size="small" @click="openAdjust(record)">调整</a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 库存总览 -->
        <a-tab-pane key="overview" tab="库存总览">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="商品名称">
              <a-input v-model:value="overview.query.goodsName" allow-clear style="width: 180px" @press-enter="overview.search()" />
            </a-form-item>
            <a-form-item label="类型">
              <a-select v-model:value="overview.query.goodsType" allow-clear placeholder="全部" style="width: 110px">
                <a-select-option :value="1">酒店</a-select-option>
                <a-select-option :value="2">门票</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="未来天数">
              <a-input-number v-model:value="overview.query.daysAhead" :min="1" :max="90" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="overview.search()">查询</a-button>
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
              <template v-if="column.dataIndex === 'goods_type'">{{ record.goods_type === 1 ? '酒店' : '门票' }}</template>
              <template v-else-if="column.dataIndex === 'stock_left'">
                <span :style="record.stock_left <= LOW_STOCK_THRESHOLD ? 'color: #f5222d; font-weight: 600' : ''">{{ record.stock_left }}</span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 低库存预警 -->
        <a-tab-pane key="warning" tab="低库存预警">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="剩余阈值 ≤">
              <a-input-number v-model:value="warning.query.threshold" :min="0" :max="999" />
            </a-form-item>
            <a-form-item label="未来天数">
              <a-input-number v-model:value="warning.query.daysAhead" :min="1" :max="90" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="warning.search()">查询</a-button>
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
        <a-tab-pane key="logs" tab="变动流水">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="变动类型">
              <a-select v-model:value="logs.query.changeType" allow-clear placeholder="全部" style="width: 130px">
                <a-select-option v-for="(text, type) in CHANGE_TYPE_TEXT" :key="type" :value="Number(type)">{{ text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="库存日期">
              <a-range-picker v-model:value="logRange" value-format="YYYY-MM-DD" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="searchLogs">查询</a-button>
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
    <a-modal v-model:open="batchOpen" title="区间批量设置" width="560px" :confirm-loading="batchSaving" @ok="saveBatch">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item label="日期区间" required>
          <a-range-picker v-model:value="batchForm.range" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="仅限星期">
          <a-checkbox-group
            v-model:value="batchForm.weekdays"
            :options="WEEKDAY_TEXT.map((text, idx) => ({ label: `周${text}`, value: idx }))"
          />
          <div class="form-tip">不勾选表示区间内每天生效</div>
        </a-form-item>
        <a-form-item label="价格">
          <a-space>
            <a-checkbox v-model:checked="batchForm.setPrice">设置</a-checkbox>
            <a-input-number v-model:value="batchForm.price" :min="0" :precision="2" :disabled="!batchForm.setPrice" style="width: 160px" />
          </a-space>
        </a-form-item>
        <a-form-item label="总库存">
          <a-space>
            <a-checkbox v-model:checked="batchForm.setStock">设置</a-checkbox>
            <a-input-number v-model:value="batchForm.stockTotal" :min="0" :disabled="!batchForm.setStock" style="width: 160px" />
          </a-space>
          <div class="form-tip">不可低于当日已售+锁定,否则该日报错回滚</div>
        </a-form-item>
        <a-form-item label="关房/停售">
          <a-radio-group v-model:value="batchForm.closedAction">
            <a-radio :value="0">不变更</a-radio>
            <a-radio v-perm="'goods:stock:close'" :value="1">关闭</a-radio>
            <a-radio :value="2">开放</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 单日调整 -->
    <a-modal v-model:open="adjustOpen" :title="`调整库存 - ${adjustForm.stockDate}`" width="440px" :confirm-loading="adjustSaving" @ok="saveAdjust">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item label="调整数量" required>
          <a-input-number v-model:value="adjustForm.changeQty" :min="-9999" :max="9999" style="width: 160px" />
          <div class="form-tip">正数增加,负数减少;下限=已售+锁定</div>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="adjustForm.remark" :maxlength="255" placeholder="调整原因" />
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
