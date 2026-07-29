<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiGoodsList } from '@/api/goods';
import {
  apiCouponAdd,
  apiCouponDelete,
  apiCouponFinish,
  apiCouponList,
  apiCouponPublish,
  apiCouponReceives,
  apiCouponToggleStatus,
  apiCouponUpdate,
} from '@/api/marketing';

const { t } = useI18n();

/**
 * 优惠券管理(文档 6.4.6):模板 + 领券记录双 Tab
 * 状态机:0未开始 →(发布)1进行中 ⇄(停发/恢复)2已停发;1/2 →(结束)3已结束(不可逆)
 * 编辑:仅未开始可改全部;进行中仅可调整发行总量(不得低于已领取)
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const activeTab = ref('coupon');

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('marketing.coupon.statusDraft'), color: 'default' },
  1: { text: t('marketing.coupon.statusOngoing'), color: 'success' },
  2: { text: t('marketing.coupon.statusPaused'), color: 'warning' },
  3: { text: t('marketing.coupon.statusFinished'), color: 'error' },
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('marketing.coupon.typeThreshold'),
  2: t('marketing.coupon.typeDiscount'),
  3: t('marketing.coupon.typeCash'),
}));
const SCOPE_TEXT = computed<Record<number, string>>(() => ({
  0: t('marketing.coupon.scopeAll'),
  1: t('marketing.coupon.scopeCategory'),
  2: t('marketing.coupon.scopeGoods'),
  3: t('marketing.coupon.scopeGoods'),
}));
const RECEIVE_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('marketing.coupon.receiveLog.unused'), color: 'processing' },
  1: { text: t('marketing.coupon.receiveLog.used'), color: 'success' },
  2: { text: t('marketing.coupon.receiveLog.expired'), color: 'default' },
  3: { text: t('common.disabled'), color: 'error' },
}));

// ---------- Tab1 优惠券模板 ----------
const coupon = useTable(apiCouponList, {
  couponName: '',
  couponType: undefined,
  status: undefined,
  siteId: 0,
});

const couponColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('marketing.coupon.name'), dataIndex: 'coupon_name', width: 180, ellipsis: true },
  { title: t('marketing.coupon.type'), dataIndex: 'coupon_type', width: 90 },
  { title: t('marketing.coupon.discount'), dataIndex: 'discount_value', width: 170 },
  { title: t('marketing.coupon.scope'), dataIndex: 'goods_scope', width: 100 },
  { title: t('marketing.coupon.totalCount') + '/' + t('marketing.coupon.receiveLog.title') + '/' + t('marketing.coupon.usedCount'), dataIndex: 'total_count', width: 130 },
  { title: t('marketing.coupon.validRange'), dataIndex: 'valid_type', width: 220 },
  { title: t('marketing.coupon.status'), dataIndex: 'status', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 250, fixed: 'right' as const },
]);

/** 优惠内容文案 */
function discountText(row: TableRow): string {
  if (row.coupon_type === 2) {
    const cap = Number(row.max_discount) > 0 ? `,${t('marketing.coupon.maxDiscount')}${formatAmount(row.max_discount)}` : '';
    return `${Number(row.discount_value)}${cap}`;
  }
  const threshold = Number(row.min_amount) > 0 ? `${t('marketing.coupon.threshold')}${formatAmount(row.min_amount)}` : t('marketing.coupon.scopeAll');
  return `${threshold}-${formatAmount(row.discount_value)}`;
}

/** 有效期文案 */
function validText(row: TableRow): string {
  if (row.valid_type === 2) {
    return `${t('marketing.coupon.validFrom')} ${row.valid_days} ${t('marketing.coupon.validTo')}`;
  }
  return `${row.valid_start || '-'} ~ ${row.valid_end || '-'}`;
}

// ---------- 新增/编辑 Modal(仅未开始可全量编辑) ----------
const formOpen = ref(false);
const formSubmitting = ref(false);
const editingId = ref(0);
const form = reactive({
  couponName: '',
  couponType: 1,
  discountValue: 0,
  minAmount: 0,
  maxDiscount: 0,
  goodsScope: 0,
  goodsIds: [] as number[],
  totalCount: 0,
  perUserLimit: 1,
  validType: 1,
  validRange: [] as string[],
  validDays: 30,
  remark: '',
  siteId: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    couponName: '',
    couponType: 1,
    discountValue: 0,
    minAmount: 0,
    maxDiscount: 0,
    goodsScope: 0,
    goodsIds: [],
    totalCount: 0,
    perUserLimit: 1,
    validType: 1,
    validRange: [],
    validDays: 30,
    remark: '',
    siteId: 0,
  });
  formOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    couponName: row.coupon_name,
    couponType: row.coupon_type,
    discountValue: Number(row.discount_value),
    minAmount: Number(row.min_amount),
    maxDiscount: Number(row.max_discount),
    goodsScope: row.goods_scope,
    goodsIds: Array.isArray(row.goods_ids) ? row.goods_ids : [],
    totalCount: row.total_count,
    perUserLimit: row.per_user_limit,
    validType: row.valid_type,
    validRange: row.valid_type === 1 && row.valid_start ? [row.valid_start, row.valid_end] : [],
    validDays: row.valid_days || 30,
    remark: row.remark || '',
    siteId: row.site_id,
  });
  if (form.goodsScope === 3 && form.goodsIds.length > 0) {
    // 编辑回显:指定商品选项用 ID 占位
    goodsOptions.value = form.goodsIds.map((id) => ({ label: `${id}`, value: id }));
  }
  formOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (!form.couponName.trim()) {
    message.warning(t('marketing.coupon.form.inputName'));
    return;
  }
  if (form.discountValue <= 0) {
    message.warning(t('marketing.coupon.form.inputValue'));
    return;
  }
  if (form.couponType === 2 && form.discountValue >= 10) {
    message.warning(t('marketing.coupon.form.inputDiscount'));
    return;
  }
  if (form.goodsScope === 3 && form.goodsIds.length === 0) {
    message.warning(t('marketing.coupon.form.inputValue'));
    return;
  }
  if (form.validType === 1 && form.validRange.length !== 2) {
    message.warning(t('marketing.coupon.form.inputValue'));
    return;
  }
  if (form.validType === 2 && form.validDays <= 0) {
    message.warning(t('marketing.coupon.form.inputValue'));
    return;
  }
  if (isSuper && editingId.value === 0 && form.siteId <= 0) {
    message.warning(t('marketing.coupon.form.selectType'));
    return;
  }
  formSubmitting.value = true;
  try {
    const payload = {
      couponName: form.couponName.trim(),
      couponType: form.couponType,
      discountValue: form.discountValue,
      minAmount: form.couponType === 3 ? 0 : form.minAmount,
      maxDiscount: form.couponType === 2 ? form.maxDiscount : 0,
      goodsScope: form.goodsScope,
      goodsIds: form.goodsScope === 3 ? form.goodsIds : undefined,
      totalCount: form.totalCount,
      perUserLimit: form.perUserLimit,
      validType: form.validType,
      validStart: form.validType === 1 ? form.validRange[0] : undefined,
      validEnd: form.validType === 1 ? form.validRange[1] : undefined,
      validDays: form.validType === 2 ? form.validDays : undefined,
      remark: form.remark.trim(),
    };
    if (editingId.value === 0) {
      await apiCouponAdd({ ...payload, siteId: isSuper ? form.siteId : undefined });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiCouponUpdate({ id: editingId.value, ...payload });
      message.success(t('tip.saveSuccess'));
    }
    formOpen.value = false;
    void coupon.load();
  } finally {
    formSubmitting.value = false;
  }
}

// ---------- 商品远程搜索(指定商品范围) ----------
const goodsOptions = ref<{ label: string; value: number }[]>([]);
const goodsSearching = ref(false);

async function searchGoods(keyword: string): Promise<void> {
  goodsSearching.value = true;
  try {
    const data = await apiGoodsList({ goodsName: keyword, page: 1, pageSize: 20 });
    goodsOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.goods_name}`,
      value: row.id,
    }));
  } finally {
    goodsSearching.value = false;
  }
}

// ---------- 调整发行总量(进行中) ----------
const totalOpen = ref(false);
const totalSubmitting = ref(false);
const totalForm = reactive({ id: 0, couponName: '', receivedCount: 0, totalCount: 0 });

function openTotal(row: TableRow): void {
  totalForm.id = row.id;
  totalForm.couponName = row.coupon_name;
  totalForm.receivedCount = row.received_count;
  totalForm.totalCount = row.total_count;
  totalOpen.value = true;
}

async function submitTotal(): Promise<void> {
  if (totalForm.totalCount !== 0 && totalForm.totalCount < totalForm.receivedCount) {
    message.warning(t('marketing.coupon.totalCount'));
    return;
  }
  totalSubmitting.value = true;
  try {
    await apiCouponUpdate({ id: totalForm.id, totalCount: totalForm.totalCount });
    message.success(t('tip.saveSuccess'));
    totalOpen.value = false;
    void coupon.load();
  } finally {
    totalSubmitting.value = false;
  }
}

// ---------- 生命周期操作 ----------
async function publishCoupon(row: TableRow): Promise<void> {
  await apiCouponPublish({ id: row.id });
  message.success(t('tip.saveSuccess'));
  void coupon.load();
}

async function toggleCoupon(row: TableRow): Promise<void> {
  const data = await apiCouponToggleStatus({ id: row.id });
  message.success(data.status === 2 ? t('common.disable') : t('common.enable'));
  void coupon.load();
}

async function finishCoupon(row: TableRow): Promise<void> {
  await apiCouponFinish({ id: row.id });
  message.success(t('common.confirm'));
  void coupon.load();
}

async function deleteCoupon(row: TableRow): Promise<void> {
  await apiCouponDelete({ id: row.id });
  message.success(t('tip.deleteSuccess'));
  void coupon.load();
}

// ---------- Tab2 领券记录 ----------
const receive = useTable(apiCouponReceives, {
  couponId: undefined,
  userId: undefined,
  status: undefined,
  siteId: 0,
});

const receiveColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('marketing.coupon.code'), dataIndex: 'coupon_code', width: 180 },
  { title: t('common.id'), dataIndex: 'coupon_id', width: 100 },
  { title: t('user.realName'), dataIndex: 'user_id', width: 90 },
  { title: t('marketing.coupon.status'), dataIndex: 'status', width: 90 },
  { title: t('marketing.coupon.validRange'), dataIndex: 'valid_start', width: 300 },
  { title: t('marketing.coupon.code'), dataIndex: 'order_id', width: 100 },
  { title: t('marketing.coupon.receiveLog.useTime'), dataIndex: 'used_time', width: 165 },
  { title: t('marketing.coupon.receiveLog.time'), dataIndex: 'created_at', width: 165 },
]);

// 非顶层 useTable 不自动加载:优惠券立即,领券记录首次切换时加载
onMounted(() => {
  void coupon.load();
});
let receiveLoaded = false;
watch(activeTab, (tab) => {
  if (tab === 'receive' && !receiveLoaded) {
    receiveLoaded = true;
    void receive.load();
  }
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:active-key="activeTab">
        <!-- ========== 优惠券模板 ========== -->
        <a-tab-pane key="coupon" :tab="t('marketing.coupon.title')">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item :label="t('marketing.coupon.name')">
              <a-input v-model:value="coupon.query.couponName" allow-clear :placeholder="t('common.pleaseInput')" style="width: 160px" @press-enter="coupon.search" />
            </a-form-item>
            <a-form-item :label="t('marketing.coupon.type')">
              <a-select v-model:value="coupon.query.couponType" allow-clear :placeholder="t('common.all')" style="width: 110px">
                <a-select-option v-for="(text, key) in TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('marketing.coupon.status')">
              <a-select v-model:value="coupon.query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
                <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="isSuper" :label="t('common.site')">
              <SiteTreeSelect v-model:value="coupon.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="coupon.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button @click="coupon.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
                <a-button v-perm="'marketing:coupon:add'" type="primary" ghost @click="openCreate">
                  <template #icon><PlusOutlined /></template>{{ t('marketing.coupon.actions.add') }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-table
            :columns="couponColumns"
            :data-source="coupon.list.value"
            :loading="coupon.loading.value"
            :pagination="coupon.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1500 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'coupon_type'">{{ TYPE_TEXT[record.coupon_type] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'discount_value'">{{ discountText(record) }}</template>
              <template v-else-if="column.dataIndex === 'goods_scope'">{{ SCOPE_TEXT[record.goods_scope] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'total_count'">
                {{ record.total_count === 0 ? t('marketing.coupon.scopeAll') : record.total_count }} / {{ record.received_count }} / {{ record.used_count }}
              </template>
              <template v-else-if="column.dataIndex === 'valid_type'">{{ validText(record) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="STATUS_MAP" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button
                    v-if="record.status === 0"
                    v-perm="'marketing:coupon:edit'"
                    type="link"
                    size="small"
                    @click="openEdit(record)"
                  >{{ t('common.edit') }}</a-button>
                  <a-popconfirm v-if="record.status === 0" :title="t('marketing.coupon.confirmDelete')" @confirm="publishCoupon(record)">
                    <a-button v-perm="'marketing:coupon:edit'" type="link" size="small">{{ t('marketing.coupon.actions.enable') }}</a-button>
                  </a-popconfirm>
                  <a-button
                    v-if="record.status === 1"
                    v-perm="'marketing:coupon:edit'"
                    type="link"
                    size="small"
                    @click="openTotal(record)"
                  >{{ t('marketing.coupon.totalCount') }}</a-button>
                  <a-popconfirm
                    v-if="record.status === 1 || record.status === 2"
                    :title="record.status === 1 ? t('marketing.coupon.statusPaused') : t('marketing.coupon.statusOngoing')"
                    @confirm="toggleCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:stop'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? t('marketing.coupon.actions.pause') : t('marketing.coupon.actions.enable') }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="record.status === 1 || record.status === 2"
                    :title="t('marketing.coupon.confirmDelete')"
                    :ok-text="t('common.confirm')"
                    :ok-button-props="{ danger: true }"
                    @confirm="finishCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:stop'" type="link" size="small" danger>{{ t('common.confirm') }}</a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="record.status === 0 || record.status === 3"
                    :title="t('marketing.coupon.confirmDelete')"
                    :ok-text="t('common.delete')"
                    :ok-button-props="{ danger: true }"
                    @confirm="deleteCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 领券记录 ========== -->
        <a-tab-pane key="receive" :tab="t('marketing.coupon.receiveLog.title')">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item :label="t('common.id')">
              <a-input-number v-model:value="receive.query.couponId" :min="1" :placeholder="t('common.pleaseInput')" style="width: 130px" />
            </a-form-item>
            <a-form-item :label="t('user.realName')">
              <a-input-number v-model:value="receive.query.userId" :min="1" :placeholder="t('common.pleaseInput')" style="width: 130px" />
            </a-form-item>
            <a-form-item :label="t('marketing.coupon.status')">
              <a-select v-model:value="receive.query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
                <a-select-option v-for="(item, key) in RECEIVE_STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="isSuper" :label="t('common.site')">
              <SiteTreeSelect v-model:value="receive.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="receive.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                <a-button @click="receive.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-table
            :columns="receiveColumns"
            :data-source="receive.list.value"
            :loading="receive.loading.value"
            :pagination="receive.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1300 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="RECEIVE_STATUS_MAP" />
              </template>
              <template v-else-if="column.dataIndex === 'valid_start'">
                {{ record.valid_start || '-' }} ~ {{ record.valid_end || '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'order_id'">{{ record.order_id || '-' }}</template>
              <template v-else-if="column.dataIndex === 'used_time'">{{ record.used_time || '-' }}</template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="formOpen"
      :title="editingId === 0 ? t('marketing.coupon.actions.add') : t('common.edit')"
      :confirm-loading="formSubmitting"
      width="640px"
      @ok="submitForm"
    >
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('marketing.coupon.name')" required>
          <a-input v-model:value="form.couponName" :maxlength="100" :placeholder="t('common.required')" />
        </a-form-item>
        <a-form-item :label="t('marketing.coupon.type')" required>
          <a-radio-group v-model:value="form.couponType">
            <a-radio :value="1">{{ t('marketing.coupon.typeThreshold') }}</a-radio>
            <a-radio :value="2">{{ t('marketing.coupon.typeDiscount') }}</a-radio>
            <a-radio :value="3">{{ t('marketing.coupon.typeCash') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="form.couponType === 2 ? t('marketing.coupon.discount') : t('marketing.coupon.value')" required>
          <a-input-number v-model:value="form.discountValue" :min="0.01" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">
            {{ form.couponType === 2 ? t('marketing.coupon.discountTip') : t('marketing.coupon.value') }}
          </span>
        </a-form-item>
        <a-form-item v-if="form.couponType === 1" :label="t('marketing.coupon.threshold')" required>
          <a-input-number v-model:value="form.minAmount" :min="0" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">{{ t('marketing.coupon.perUserLimitTip') }}</span>
        </a-form-item>
        <a-form-item v-if="form.couponType === 2" :label="t('marketing.coupon.value')">
          <a-input-number v-model:value="form.maxDiscount" :min="0" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">{{ t('marketing.coupon.perUserLimitTip') }}</span>
        </a-form-item>
        <a-form-item :label="t('marketing.coupon.scope')" required>
          <a-select v-model:value="form.goodsScope" style="width: 180px">
            <a-select-option v-for="(text, key) in SCOPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="form.goodsScope === 3" :label="t('marketing.coupon.scopeGoods')" required>
          <a-select
            v-model:value="form.goodsIds"
            mode="multiple"
            show-search
            :placeholder="t('common.pleaseInput')"
            :filter-option="false"
            :options="goodsOptions"
            :loading="goodsSearching"
            @search="searchGoods"
          />
        </a-form-item>
        <a-form-item :label="t('marketing.coupon.totalCount')" required>
          <a-input-number v-model:value="form.totalCount" :min="0" :precision="0" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">{{ t('marketing.coupon.perUserLimitTip') }}</span>
        </a-form-item>
        <a-form-item :label="t('marketing.coupon.perUserLimit')" required>
          <a-input-number v-model:value="form.perUserLimit" :min="1" :precision="0" style="width: 180px" />
        </a-form-item>
        <a-form-item :label="t('marketing.coupon.validRange')" required>
          <a-radio-group v-model:value="form.validType">
            <a-radio :value="1">{{ t('marketing.coupon.validFrom') }}</a-radio>
            <a-radio :value="2">{{ t('marketing.coupon.receiveRange') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="form.validType === 1" :label="t('marketing.coupon.validRange')" required>
          <a-range-picker v-model:value="form.validRange" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item v-if="form.validType === 2" :label="t('marketing.coupon.validTo')" required>
          <a-input-number v-model:value="form.validDays" :min="1" :precision="0" style="width: 180px" />
        </a-form-item>
        <a-form-item v-if="isSuper && editingId === 0" :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="form.siteId" style="width: 240px" />
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-textarea v-model:value="form.remark" :rows="3" :maxlength="500" :placeholder="t('common.optional')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 调整发行总量 Modal -->
    <a-modal v-model:open="totalOpen" :title="t('marketing.coupon.totalCount')" :confirm-loading="totalSubmitting" @ok="submitTotal">
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('marketing.coupon.name')">{{ totalForm.couponName }}</a-form-item>
        <a-form-item :label="t('marketing.coupon.usedCount')">{{ totalForm.receivedCount }}</a-form-item>
        <a-form-item :label="t('marketing.coupon.totalCount')" required>
          <a-input-number v-model:value="totalForm.totalCount" :min="0" :precision="0" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">{{ t('marketing.coupon.perUserLimitTip') }}</span>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 16px;
}
</style>
