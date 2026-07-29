<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
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

/**
 * 优惠券管理(文档 6.4.6):模板 + 领券记录双 Tab
 * 状态机:0未开始 →(发布)1进行中 ⇄(停发/恢复)2已停发;1/2 →(结束)3已结束(不可逆)
 * 编辑:仅未开始可改全部;进行中仅可调整发行总量(不得低于已领取)
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const activeTab = ref('coupon');

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '未开始', color: 'default' },
  1: { text: '进行中', color: 'success' },
  2: { text: '已停发', color: 'warning' },
  3: { text: '已结束', color: 'error' },
};
const TYPE_TEXT: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '无门槛券' };
const SCOPE_TEXT: Record<number, string> = { 0: '全部商品', 1: '仅酒店', 2: '仅门票', 3: '指定商品' };
const RECEIVE_STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '未使用', color: 'processing' },
  1: { text: '已使用', color: 'success' },
  2: { text: '已过期', color: 'default' },
  3: { text: '已作废', color: 'error' },
};

// ---------- Tab1 优惠券模板 ----------
const coupon = useTable(apiCouponList, {
  couponName: '',
  couponType: undefined,
  status: undefined,
  siteId: 0,
});

const couponColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '券名称', dataIndex: 'coupon_name', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'coupon_type', width: 90 },
  { title: '优惠内容', dataIndex: 'discount_value', width: 170 },
  { title: '适用范围', dataIndex: 'goods_scope', width: 100 },
  { title: '发行/领取/使用', dataIndex: 'total_count', width: 130 },
  { title: '有效期', dataIndex: 'valid_type', width: 220 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 250, fixed: 'right' as const },
];

/** 优惠内容文案 */
function discountText(row: TableRow): string {
  if (row.coupon_type === 2) {
    const cap = Number(row.max_discount) > 0 ? `,封顶${formatAmount(row.max_discount)}` : '';
    return `${Number(row.discount_value)}折${cap}`;
  }
  const threshold = Number(row.min_amount) > 0 ? `满${formatAmount(row.min_amount)}` : '无门槛';
  return `${threshold}减${formatAmount(row.discount_value)}`;
}

/** 有效期文案 */
function validText(row: TableRow): string {
  if (row.valid_type === 2) {
    return `领取后 ${row.valid_days} 天内有效`;
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
    goodsOptions.value = form.goodsIds.map((id) => ({ label: `商品 #${id}`, value: id }));
  }
  formOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (!form.couponName.trim()) {
    message.warning('请填写券名称');
    return;
  }
  if (form.discountValue <= 0) {
    message.warning('优惠值须大于0');
    return;
  }
  if (form.couponType === 2 && form.discountValue >= 10) {
    message.warning('折扣率须小于10(如8.50=85折)');
    return;
  }
  if (form.goodsScope === 3 && form.goodsIds.length === 0) {
    message.warning('指定商品范围必须选择商品');
    return;
  }
  if (form.validType === 1 && form.validRange.length !== 2) {
    message.warning('请选择固定有效期起止时间');
    return;
  }
  if (form.validType === 2 && form.validDays <= 0) {
    message.warning('领取后有效天数须大于0');
    return;
  }
  if (isSuper && editingId.value === 0 && form.siteId <= 0) {
    message.warning('请选择所属站点');
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
      message.success('优惠券已创建');
    } else {
      await apiCouponUpdate({ id: editingId.value, ...payload });
      message.success('优惠券已更新');
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
    message.warning('发行总量不得低于已领取数量');
    return;
  }
  totalSubmitting.value = true;
  try {
    await apiCouponUpdate({ id: totalForm.id, totalCount: totalForm.totalCount });
    message.success('发行总量已调整');
    totalOpen.value = false;
    void coupon.load();
  } finally {
    totalSubmitting.value = false;
  }
}

// ---------- 生命周期操作 ----------
async function publishCoupon(row: TableRow): Promise<void> {
  await apiCouponPublish({ id: row.id });
  message.success('优惠券已发布');
  void coupon.load();
}

async function toggleCoupon(row: TableRow): Promise<void> {
  const data = await apiCouponToggleStatus({ id: row.id });
  message.success(data.status === 2 ? '优惠券已停发' : '优惠券已恢复发放');
  void coupon.load();
}

async function finishCoupon(row: TableRow): Promise<void> {
  await apiCouponFinish({ id: row.id });
  message.success('优惠券已结束');
  void coupon.load();
}

async function deleteCoupon(row: TableRow): Promise<void> {
  await apiCouponDelete({ id: row.id });
  message.success('优惠券已删除');
  void coupon.load();
}

// ---------- Tab2 领券记录 ----------
const receive = useTable(apiCouponReceives, {
  couponId: undefined,
  userId: undefined,
  status: undefined,
  siteId: 0,
});

const receiveColumns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '券码', dataIndex: 'coupon_code', width: 180 },
  { title: '券模板ID', dataIndex: 'coupon_id', width: 100 },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '有效期', dataIndex: 'valid_start', width: 300 },
  { title: '使用订单', dataIndex: 'order_id', width: 100 },
  { title: '使用时间', dataIndex: 'used_time', width: 165 },
  { title: '领取时间', dataIndex: 'created_at', width: 165 },
];

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
        <a-tab-pane key="coupon" tab="优惠券">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item label="券名称">
              <a-input v-model:value="coupon.query.couponName" allow-clear placeholder="模糊匹配" style="width: 160px" @press-enter="coupon.search" />
            </a-form-item>
            <a-form-item label="类型">
              <a-select v-model:value="coupon.query.couponType" allow-clear placeholder="全部" style="width: 110px">
                <a-select-option v-for="(text, key) in TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="coupon.query.status" allow-clear placeholder="全部" style="width: 100px">
                <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="isSuper" label="站点">
              <SiteTreeSelect v-model:value="coupon.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="coupon.search"><template #icon><SearchOutlined /></template>查询</a-button>
                <a-button @click="coupon.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                <a-button v-perm="'marketing:coupon:add'" type="primary" ghost @click="openCreate">
                  <template #icon><PlusOutlined /></template>新增优惠券
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
                {{ record.total_count === 0 ? '不限' : record.total_count }} / {{ record.received_count }} / {{ record.used_count }}
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
                  >编辑</a-button>
                  <a-popconfirm v-if="record.status === 0" title="发布后进入进行中,用户可领取,确认发布?" @confirm="publishCoupon(record)">
                    <a-button v-perm="'marketing:coupon:edit'" type="link" size="small">发布</a-button>
                  </a-popconfirm>
                  <a-button
                    v-if="record.status === 1"
                    v-perm="'marketing:coupon:edit'"
                    type="link"
                    size="small"
                    @click="openTotal(record)"
                  >调整总量</a-button>
                  <a-popconfirm
                    v-if="record.status === 1 || record.status === 2"
                    :title="record.status === 1 ? '停发后用户不可再领取(已领取不受影响),确认?' : '恢复后用户可继续领取,确认?'"
                    @confirm="toggleCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:stop'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? '停发' : '恢复' }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="record.status === 1 || record.status === 2"
                    title="结束后不可逆,确认结束该优惠券?"
                    ok-text="结束"
                    :ok-button-props="{ danger: true }"
                    @confirm="finishCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:stop'" type="link" size="small" danger>结束</a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="record.status === 0 || record.status === 3"
                    title="确认删除该优惠券?"
                    ok-text="删除"
                    :ok-button-props="{ danger: true }"
                    @confirm="deleteCoupon(record)"
                  >
                    <a-button v-perm="'marketing:coupon:delete'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 领券记录 ========== -->
        <a-tab-pane key="receive" tab="领券记录">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item label="券模板ID">
              <a-input-number v-model:value="receive.query.couponId" :min="1" placeholder="精确匹配" style="width: 130px" />
            </a-form-item>
            <a-form-item label="用户ID">
              <a-input-number v-model:value="receive.query.userId" :min="1" placeholder="精确匹配" style="width: 130px" />
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="receive.query.status" allow-clear placeholder="全部" style="width: 100px">
                <a-select-option v-for="(item, key) in RECEIVE_STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="isSuper" label="站点">
              <SiteTreeSelect v-model:value="receive.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="receive.search"><template #icon><SearchOutlined /></template>查询</a-button>
                <a-button @click="receive.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
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
      :title="editingId === 0 ? '新增优惠券' : '编辑优惠券'"
      :confirm-loading="formSubmitting"
      width="640px"
      @ok="submitForm"
    >
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="券名称" required>
          <a-input v-model:value="form.couponName" :maxlength="100" placeholder="必填" />
        </a-form-item>
        <a-form-item label="券类型" required>
          <a-radio-group v-model:value="form.couponType">
            <a-radio :value="1">满减券</a-radio>
            <a-radio :value="2">折扣券</a-radio>
            <a-radio :value="3">无门槛券</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="form.couponType === 2 ? '折扣率' : '优惠金额'" required>
          <a-input-number v-model:value="form.discountValue" :min="0.01" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">
            {{ form.couponType === 2 ? '小于10,如 8.50 = 85折' : '单位:站点货币' }}
          </span>
        </a-form-item>
        <a-form-item v-if="form.couponType === 1" label="使用门槛" required>
          <a-input-number v-model:value="form.minAmount" :min="0" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">满该金额可用,0=无门槛</span>
        </a-form-item>
        <a-form-item v-if="form.couponType === 2" label="最高优惠">
          <a-input-number v-model:value="form.maxDiscount" :min="0" :precision="2" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">折扣封顶金额,0=不限</span>
        </a-form-item>
        <a-form-item label="适用范围" required>
          <a-select v-model:value="form.goodsScope" style="width: 180px">
            <a-select-option v-for="(text, key) in SCOPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="form.goodsScope === 3" label="指定商品" required>
          <a-select
            v-model:value="form.goodsIds"
            mode="multiple"
            show-search
            placeholder="输入商品名称搜索"
            :filter-option="false"
            :options="goodsOptions"
            :loading="goodsSearching"
            @search="searchGoods"
          />
        </a-form-item>
        <a-form-item label="发行总量" required>
          <a-input-number v-model:value="form.totalCount" :min="0" :precision="0" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">0=不限量</span>
        </a-form-item>
        <a-form-item label="每人限领" required>
          <a-input-number v-model:value="form.perUserLimit" :min="1" :precision="0" style="width: 180px" />
        </a-form-item>
        <a-form-item label="有效期类型" required>
          <a-radio-group v-model:value="form.validType">
            <a-radio :value="1">固定日期</a-radio>
            <a-radio :value="2">领取后N天</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="form.validType === 1" label="有效期" required>
          <a-range-picker v-model:value="form.validRange" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item v-if="form.validType === 2" label="有效天数" required>
          <a-input-number v-model:value="form.validDays" :min="1" :precision="0" style="width: 180px" />
        </a-form-item>
        <a-form-item v-if="isSuper && editingId === 0" label="所属站点" required>
          <SiteTreeSelect v-model:value="form.siteId" style="width: 240px" />
        </a-form-item>
        <a-form-item label="使用说明">
          <a-textarea v-model:value="form.remark" :rows="3" :maxlength="500" placeholder="选填,展示给用户" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 调整发行总量 Modal -->
    <a-modal v-model:open="totalOpen" title="调整发行总量" :confirm-loading="totalSubmitting" @ok="submitTotal">
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="优惠券">{{ totalForm.couponName }}</a-form-item>
        <a-form-item label="已领取">{{ totalForm.receivedCount }} 张</a-form-item>
        <a-form-item label="发行总量" required>
          <a-input-number v-model:value="totalForm.totalCount" :min="0" :precision="0" style="width: 180px" />
          <span style="margin-left: 8px; color: rgba(0, 0, 0, 0.45)">0=不限量,不得低于已领取</span>
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
