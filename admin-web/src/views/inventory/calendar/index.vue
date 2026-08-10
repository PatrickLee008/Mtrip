<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import type { TableRow } from '@/composables/useTable';
import { apiInventoryCalendar } from '@/api/inventory';

/** 可用量日历(Super Admin Portal 模块 04b):单 SKU 分日库存/价格网格 */
const { t } = useI18n();

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const form = reactive({
  goodsId: undefined as number | undefined,
  skuId: undefined as number | undefined,
  startDate: todayPlus(0),
  endDate: todayPlus(30),
});
const loading = ref(false);
const loaded = ref(false);
const days = ref<TableRow[]>([]);
const meta = reactive({ basePrice: 0, baseStock: 0 });

async function loadCalendar(): Promise<void> {
  if (!form.goodsId || !form.skuId) {
    message.warning('Goods ID and SKU ID are required');
    return;
  }
  loading.value = true;
  try {
    const res = await apiInventoryCalendar({ ...form });
    days.value = res.days;
    meta.basePrice = res.basePrice;
    meta.baseStock = res.baseStock;
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}

function cellColor(day: TableRow): string {
  if (day.isClosed) return 'var(--sap-navy-hover)';
  if (day.stockLeft <= 0) return 'var(--sap-danger-bg)';
  if (day.stockLeft <= 5) return 'var(--sap-warning-bg)';
  return 'var(--sap-success-bg)';
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Goods ID"><a-input-number v-model:value="form.goodsId" :min="1" style="width: 120px" /></a-form-item>
        <a-form-item label="SKU ID"><a-input-number v-model:value="form.skuId" :min="1" style="width: 120px" /></a-form-item>
        <a-form-item label="From"><a-input v-model:value="form.startDate" placeholder="YYYY-MM-DD" style="width: 130px" /></a-form-item>
        <a-form-item label="To"><a-input v-model:value="form.endDate" placeholder="YYYY-MM-DD" style="width: 130px" /></a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadCalendar"><template #icon><SearchOutlined /></template>Load</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-spin :spinning="loading">
      <a-empty v-if="!loaded" description="Enter Goods ID + SKU ID to load the availability calendar" style="margin: 48px 0" />
      <a-card v-else :bordered="false" class="mtrip-card-shadow">
        <div style="margin-bottom: 12px; color: var(--sap-muted); font-size: 13px">
          Base price {{ meta.basePrice }} · Base stock {{ meta.baseStock }}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px">
          <div
            v-for="day in days"
            :key="day.date"
            :style="{
              background: cellColor(day),
              border: '1px solid var(--sap-border)',
              borderRadius: '6px',
              padding: '8px',
              minHeight: '78px',
              color: day.isClosed ? '#fff' : 'var(--sap-text)',
            }"
          >
            <div style="font-size: 12px; font-family: var(--sap-font-mono)">{{ day.date.slice(5) }}</div>
            <div v-if="day.isClosed" style="font-size: 12px; margin-top: 6px">Closed</div>
            <template v-else>
              <div style="font-weight: 700; margin-top: 4px">{{ day.stockLeft }}<span style="font-size: 11px; color: var(--sap-muted)"> / {{ day.stockTotal }}</span></div>
              <div style="font-size: 11px; color: var(--sap-muted)">¥{{ day.price }}</div>
              <div v-if="!day.hasRecord" style="font-size: 10px; color: var(--sap-muted)">(base)</div>
            </template>
          </div>
        </div>
      </a-card>
    </a-spin>
  </PageContainer>
</template>
