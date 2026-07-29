<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import {
  apiCategoryList,
  apiGoodsAdd,
  apiGoodsDelete,
  apiGoodsDetail,
  apiGoodsList,
  apiGoodsSubmit,
  apiGoodsToggleStatus,
  apiGoodsUpdate,
  apiRefundRuleList,
  apiRefundRuleSave,
  apiRoomDelete,
  apiRoomList,
  apiRoomSave,
  apiTicketDelete,
  apiTicketList,
  apiTicketSave,
} from '@/api/goods';

/**
 * 商品管理通用页(酒店 goodsType=1 / 门票 goodsType=2 复用)
 * 状态机:0草稿→(提交)1待审核→(通过)3已上架/(驳回)2驳回;3⇄4下架;5软删终态
 */
const props = defineProps<{
  goodsType: number;
  permPrefix: string; // goods:hotel / goods:ticket
  skuPerm: string; // goods:hotel:room / goods:ticket:type
}>();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const isHotel = computed(() => props.goodsType === 1);
const skuLabel = computed(() => (isHotel.value ? '房型' : '票种'));

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '待审核', color: 'warning' },
  2: { text: '审核驳回', color: 'error' },
  3: { text: '已上架', color: 'success' },
  4: { text: '已下架', color: 'default' },
};

// 分类筛选用级联路径,取末级 id 传后端
const filterCategory = ref<number[]>();

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiGoodsList({
    ...params,
    goodsType: props.goodsType,
    categoryId: filterCategory.value?.length ? filterCategory.value[filterCategory.value.length - 1] : undefined,
  }),
  { goodsName: '', merchantId: undefined, status: undefined, siteId: 0 },
);

function doReset(): void {
  filterCategory.value = undefined;
  reset();
}

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '商品名称', dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: '分类', dataIndex: 'category_name', width: 110, ellipsis: true },
  { title: '商户', dataIndex: 'merchant_name', width: 140, ellipsis: true },
  { title: '销量', dataIndex: 'sales_count', width: 80 },
  { title: '权重', dataIndex: 'sort_weight', width: 70 },
  { title: '标记', key: 'flags', width: 100 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updated_at', width: 165 },
  { title: '操作', key: 'action_col', width: 320, fixed: 'right' as const },
];

// ---------- 分类树 / 商户远程搜索 ----------
const categoryTree = ref<TableRow[]>([]);

async function loadCategories(): Promise<void> {
  categoryTree.value = await apiCategoryList({ goodsType: props.goodsType, status: 1 });
}

const categoryOptions = computed(() =>
  categoryTree.value.map((root: TableRow) => ({
    label: root.category_name,
    value: root.id,
    children: (root.children ?? []).map((child: TableRow) => ({ label: child.category_name, value: child.id })),
  })),
);

const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantSearching = ref(false);

async function searchMerchant(keyword: string): Promise<void> {
  merchantSearching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    merchantSearching.value = false;
  }
}

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailSkus = ref<TableRow[]>([]);
const detailRules = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiGoodsDetail(row.id);
    detail.value = data.goods;
    detailSkus.value = data.skus;
    detailRules.value = data.refundRules;
  } finally {
    detailLoading.value = false;
  }
}

const RULE_TYPE_TEXT: Record<number, string> = { 1: '免费退', 2: '阶梯退', 3: '不可退' };

function ruleScope(rule: TableRow): string {
  if (Number(rule.sku_type) === 0) {
    return '商品级';
  }
  const sku = detailSkus.value.find((item) => item.id === rule.sku_id);
  return `${skuLabel.value}#${rule.sku_id} ${sku ? (sku.room_name ?? sku.ticket_name ?? '') : ''}`;
}

// ---------- 新增/编辑商品 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const formCategory = ref<number[]>();
const form = reactive({
  goodsName: '',
  merchantId: undefined as number | undefined,
  siteId: 0,
  coverImage: '',
  imagesText: '',
  address: '',
  starLevel: 0,
  openTime: '',
  closeTime: '',
  goodsBrief: '',
  goodsDetail: '',
  sortWeight: 0,
  isRecommend: 0,
  isHot: 0,
});

function resetForm(): void {
  formCategory.value = undefined;
  Object.assign(form, {
    goodsName: '',
    merchantId: undefined,
    siteId: 0,
    coverImage: '',
    imagesText: '',
    address: '',
    starLevel: 0,
    openTime: '',
    closeTime: '',
    goodsBrief: '',
    goodsDetail: '',
    sortWeight: 0,
    isRecommend: 0,
    isHot: 0,
  });
}

function openCreate(): void {
  editingId.value = 0;
  resetForm();
  modalOpen.value = true;
}

/** 根据分类 id 反查级联路径(两级) */
function categoryPath(categoryId: number): number[] | undefined {
  if (!categoryId) {
    return undefined;
  }
  for (const root of categoryTree.value) {
    if (root.id === categoryId) {
      return [root.id];
    }
    const child = (root.children ?? []).find((item: TableRow) => item.id === categoryId);
    if (child) {
      return [root.id, child.id];
    }
  }
  return [categoryId];
}

async function openEdit(row: TableRow): Promise<void> {
  // 编辑取详情回显(列表无图文字段)
  const data = await apiGoodsDetail(row.id);
  const goods = data.goods;
  editingId.value = row.id;
  formCategory.value = categoryPath(Number(goods.category_id ?? 0));
  Object.assign(form, {
    goodsName: goods.goods_name ?? '',
    merchantId: goods.merchant_id || undefined,
    siteId: goods.site_id ?? 0,
    coverImage: goods.cover_image ?? '',
    imagesText: Array.isArray(goods.images) ? goods.images.join('\n') : '',
    address: goods.address ?? '',
    starLevel: goods.star_level ?? 0,
    openTime: goods.open_time ?? '',
    closeTime: goods.close_time ?? '',
    goodsBrief: goods.goods_brief ?? '',
    goodsDetail: goods.goods_detail ?? '',
    sortWeight: goods.sort_weight ?? 0,
    isRecommend: goods.is_recommend ?? 0,
    isHot: goods.is_hot ?? 0,
  });
  if (goods.merchant_id) {
    merchantOptions.value = [{ label: `#${goods.merchant_id} ${row.merchant_name ?? ''}`, value: goods.merchant_id }];
  }
  modalOpen.value = true;
}

async function saveGoods(): Promise<void> {
  if (!form.goodsName.trim()) {
    message.warning('请输入商品名称');
    return;
  }
  if (!editingId.value && isSuper && !form.siteId) {
    message.warning('请选择所属站点');
    return;
  }
  const { imagesText, ...rest } = form;
  const payload: Record<string, unknown> = {
    ...rest,
    goodsType: props.goodsType,
    categoryId: formCategory.value?.length ? formCategory.value[formCategory.value.length - 1] : 0,
    images: imagesText.split('\n').map((line) => line.trim()).filter((line) => line !== ''),
  };
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiGoodsUpdate({ id: editingId.value, ...payload });
      message.success('商品已更新');
    } else {
      await apiGoodsAdd(payload);
      message.success('商品已保存为草稿');
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 提交审核 / 上下架 / 删除 ----------
async function submitAudit(row: TableRow): Promise<void> {
  await apiGoodsSubmit(row.id);
  message.success('已提交审核');
  await load();
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiGoodsToggleStatus(row.id);
  message.success(result.status === 3 ? '商品已上架' : '商品已下架');
  await load();
}

async function removeGoods(row: TableRow): Promise<void> {
  await apiGoodsDelete(row.id);
  message.success('商品已删除');
  await load();
}

// ---------- SKU 管理抽屉(房型/票种) ----------
const skuOpen = ref(false);
const skuLoading = ref(false);
const skuGoods = ref<TableRow | null>(null);
const skuList = ref<TableRow[]>([]);

async function openSku(row: TableRow): Promise<void> {
  skuGoods.value = row;
  skuOpen.value = true;
  await loadSkus();
}

async function loadSkus(): Promise<void> {
  if (!skuGoods.value) {
    return;
  }
  skuLoading.value = true;
  try {
    skuList.value = isHotel.value ? await apiRoomList(skuGoods.value.id) : await apiTicketList(skuGoods.value.id);
  } finally {
    skuLoading.value = false;
  }
}

const roomColumns = [
  { title: 'ID', dataIndex: 'id', width: 60 },
  { title: '房型', dataIndex: 'room_name', ellipsis: true },
  { title: '床型', dataIndex: 'bed_type', width: 90 },
  { title: '人数', dataIndex: 'max_guests', width: 60 },
  { title: '早餐', dataIndex: 'breakfast', width: 70 },
  { title: '门市价', dataIndex: 'base_price', width: 90 },
  { title: '基础库存', dataIndex: 'base_stock', width: 80 },
  { title: '状态', dataIndex: 'status', width: 70 },
  { title: '操作', key: 'action_col', width: 110 },
];
const ticketColumns = [
  { title: 'ID', dataIndex: 'id', width: 60 },
  { title: '票种', dataIndex: 'ticket_name', ellipsis: true },
  { title: '类型', dataIndex: 'ticket_kind', width: 80 },
  { title: '门市价', dataIndex: 'base_price', width: 90 },
  { title: '基础库存', dataIndex: 'base_stock', width: 80 },
  { title: '有效天数', dataIndex: 'valid_days', width: 80 },
  { title: '可核销次数', dataIndex: 'verify_times', width: 90 },
  { title: '状态', dataIndex: 'status', width: 70 },
  { title: '操作', key: 'action_col', width: 110 },
];
const BREAKFAST_TEXT: Record<number, string> = { 0: '无早', 1: '单早', 2: '双早' };
const TICKET_KIND_TEXT: Record<number, string> = { 1: '普通票', 2: '分时票', 3: '联票' };

const skuModalOpen = ref(false);
const skuSaving = ref(false);
const skuEditingId = ref(0);
const skuForm = reactive({
  name: '',
  bedType: '',
  area: '',
  maxGuests: 2,
  breakfast: 0,
  ticketKind: 1,
  validDays: 1,
  bookLimit: 0,
  advanceHours: 0,
  verifyTimes: 1,
  timeSlotsText: '',
  basePrice: 0,
  baseStock: 0,
  sort: 0,
  status: 1,
});

function openSkuCreate(): void {
  skuEditingId.value = 0;
  Object.assign(skuForm, {
    name: '',
    bedType: '',
    area: '',
    maxGuests: 2,
    breakfast: 0,
    ticketKind: 1,
    validDays: 1,
    bookLimit: 0,
    advanceHours: 0,
    verifyTimes: 1,
    timeSlotsText: '',
    basePrice: 0,
    baseStock: 0,
    sort: 0,
    status: 1,
  });
  skuModalOpen.value = true;
}

function openSkuEdit(row: TableRow): void {
  skuEditingId.value = row.id;
  Object.assign(skuForm, {
    name: row.room_name ?? row.ticket_name ?? '',
    bedType: row.bed_type ?? '',
    area: row.area ?? '',
    maxGuests: row.max_guests ?? 2,
    breakfast: row.breakfast ?? 0,
    ticketKind: row.ticket_kind ?? 1,
    validDays: row.valid_days ?? 1,
    bookLimit: row.book_limit ?? 0,
    advanceHours: row.advance_hours ?? 0,
    verifyTimes: row.verify_times ?? 1,
    timeSlotsText: Array.isArray(row.time_slots) ? row.time_slots.join('\n') : '',
    basePrice: Number(row.base_price ?? 0),
    baseStock: row.base_stock ?? 0,
    sort: row.sort ?? 0,
    status: row.status ?? 1,
  });
  skuModalOpen.value = true;
}

async function saveSku(): Promise<void> {
  if (!skuGoods.value) {
    return;
  }
  if (!skuForm.name.trim()) {
    message.warning(`请输入${skuLabel.value}名称`);
    return;
  }
  const base = {
    goodsId: skuGoods.value.id,
    id: skuEditingId.value || undefined,
    basePrice: skuForm.basePrice,
    baseStock: skuForm.baseStock,
    sort: skuForm.sort,
    status: skuForm.status,
  };
  skuSaving.value = true;
  try {
    if (isHotel.value) {
      await apiRoomSave({
        ...base,
        roomName: skuForm.name,
        bedType: skuForm.bedType,
        area: skuForm.area,
        maxGuests: skuForm.maxGuests,
        breakfast: skuForm.breakfast,
      });
    } else {
      const timeSlots = skuForm.timeSlotsText.split('\n').map((line) => line.trim()).filter((line) => line !== '');
      if (skuForm.ticketKind === 2 && timeSlots.length === 0) {
        message.warning('分时票必须配置时段(每行一个,如 09:00-11:00)');
        return;
      }
      await apiTicketSave({
        ...base,
        ticketName: skuForm.name,
        ticketKind: skuForm.ticketKind,
        validDays: skuForm.validDays,
        bookLimit: skuForm.bookLimit,
        advanceHours: skuForm.advanceHours,
        verifyTimes: skuForm.verifyTimes,
        timeSlots,
      });
    }
    message.success(`${skuLabel.value}已保存`);
    skuModalOpen.value = false;
    await loadSkus();
  } finally {
    skuSaving.value = false;
  }
}

async function removeSku(row: TableRow): Promise<void> {
  if (!skuGoods.value) {
    return;
  }
  if (isHotel.value) {
    await apiRoomDelete(skuGoods.value.id, row.id);
  } else {
    await apiTicketDelete(skuGoods.value.id, row.id);
  }
  message.success(`${skuLabel.value}已删除`);
  await loadSkus();
}

// ---------- 退改规则 ----------
const ruleOpen = ref(false);
const ruleLoading = ref(false);
const ruleSaving = ref(false);
const ruleGoods = ref<TableRow | null>(null);
const ruleList = ref<TableRow[]>([]);
const ruleSkus = ref<TableRow[]>([]);
const ruleForm = reactive({
  skuScope: 0, // 0=商品级,>0=SKU id
  ruleType: 1,
  steps: [] as { hoursBefore: number; refundRate: number }[],
  remark: '',
});

async function openRule(row: TableRow): Promise<void> {
  ruleGoods.value = row;
  ruleOpen.value = true;
  Object.assign(ruleForm, { skuScope: 0, ruleType: 1, steps: [], remark: '' });
  ruleLoading.value = true;
  try {
    [ruleList.value, ruleSkus.value] = await Promise.all([
      apiRefundRuleList(row.id),
      isHotel.value ? apiRoomList(row.id) : apiTicketList(row.id),
    ]);
  } finally {
    ruleLoading.value = false;
  }
}

function addStep(): void {
  ruleForm.steps.push({ hoursBefore: 24, refundRate: 100 });
}

async function saveRule(): Promise<void> {
  if (!ruleGoods.value) {
    return;
  }
  if (ruleForm.ruleType === 2 && ruleForm.steps.length === 0) {
    message.warning('阶梯退款至少配置一档');
    return;
  }
  ruleSaving.value = true;
  try {
    await apiRefundRuleSave({
      goodsId: ruleGoods.value.id,
      skuType: ruleForm.skuScope > 0 ? props.goodsType : 0,
      skuId: ruleForm.skuScope > 0 ? ruleForm.skuScope : 0,
      ruleType: ruleForm.ruleType,
      rules: ruleForm.ruleType === 2 ? ruleForm.steps : undefined,
      remark: ruleForm.remark,
    });
    message.success('退改规则已保存');
    ruleList.value = await apiRefundRuleList(ruleGoods.value.id);
  } finally {
    ruleSaving.value = false;
  }
}

onMounted(() => {
  void load();
  void loadCategories();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="商品名称">
          <a-input v-model:value="query.goodsName" allow-clear placeholder="模糊搜索" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="分类">
          <a-cascader
            v-model:value="filterCategory"
            :options="categoryOptions"
            change-on-select
            allow-clear
            placeholder="全部"
            style="width: 180px"
          />
        </a-form-item>
        <a-form-item label="商户">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            placeholder="输入名称搜索"
            style="width: 180px"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 110px">
            <a-select-option :value="0">草稿</a-select-option>
            <a-select-option :value="1">待审核</a-select-option>
            <a-select-option :value="2">审核驳回</a-select-option>
            <a-select-option :value="3">已上架</a-select-option>
            <a-select-option :value="4">已下架</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ isHotel ? '酒店商品' : '门票商品' }}</template>
      <template #extra>
        <a-button v-perm="permPrefix + ':add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增商品
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'goods_name'">
            <a-space>
              <a-image v-if="record.cover_image" :src="record.cover_image" :width="36" :height="28" style="object-fit: cover; border-radius: 4px" />
              <span>{{ record.goods_name }}</span>
            </a-space>
          </template>
          <template v-else-if="column.key === 'flags'">
            <a-tag v-if="record.is_recommend === 1" color="blue">推荐</a-tag>
            <a-tag v-if="record.is_hot === 1" color="red">热门</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tooltip v-if="record.status === 2 && record.audit_remark" :title="`驳回原因:${record.audit_remark}`">
              <span><StatusTag :value="record.status" :map="STATUS_MAP" /></span>
            </a-tooltip>
            <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.status !== 1 && record.status !== 3"
                v-perm="permPrefix + ':edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >编辑</a-button>
              <a-button v-perm="skuPerm" type="link" size="small" @click="openSku(record)">{{ skuLabel }}</a-button>
              <a-button v-perm="permPrefix + ':edit'" type="link" size="small" @click="openRule(record)">退改</a-button>
              <a-popconfirm
                v-if="record.status === 0 || record.status === 2"
                title="确认提交审核?"
                @confirm="submitAudit(record)"
              >
                <a-button v-perm="permPrefix + ':edit'" type="link" size="small" style="color: var(--mtrip-warning, #faad14)">提审</a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status === 3 || record.status === 4"
                :title="record.status === 3 ? '确认下架该商品?' : '确认重新上架?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="permPrefix + ':edit'" type="link" size="small" :danger="record.status === 3">
                  {{ record.status === 3 ? '下架' : '上架' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status !== 3"
                title="确认删除该商品?删除后不可恢复(存在进行中订单将被拒绝)"
                :ok-button-props="{ danger: true }"
                @confirm="removeGoods(record)"
              >
                <a-button v-perm="permPrefix + ':delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="商品详情" width="760">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="商品名称" :span="2">{{ detail.goods_name }}</a-descriptions-item>
            <a-descriptions-item label="状态"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="销量">{{ detail.sales_count }}</a-descriptions-item>
            <a-descriptions-item v-if="isHotel" label="星级">{{ detail.star_level }} 星</a-descriptions-item>
            <a-descriptions-item v-else label="营业时间">{{ detail.open_time }} ~ {{ detail.close_time }}</a-descriptions-item>
            <a-descriptions-item label="排序权重">{{ detail.sort_weight }}</a-descriptions-item>
            <a-descriptions-item label="地址" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item label="简介" :span="2">{{ detail.goods_brief || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.audit_remark" label="审核意见" :span="2">{{ detail.audit_remark }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider orientation="left">图集</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <a-divider orientation="left">{{ skuLabel }}({{ detailSkus.length }})</a-divider>
          <a-table
            :columns="isHotel ? roomColumns.slice(0, 8) : ticketColumns.slice(0, 8)"
            :data-source="detailSkus"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'breakfast'">{{ BREAKFAST_TEXT[record.breakfast] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'ticket_kind'">{{ TICKET_KIND_TEXT[record.ticket_kind] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'base_price'">{{ formatAmount(record.base_price) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '在售' : '停售' }}</a-tag>
              </template>
            </template>
          </a-table>
          <a-divider orientation="left">退改规则({{ detailRules.length }})</a-divider>
          <a-table
            :columns="[
              { title: '适用', key: 'scope' },
              { title: '类型', dataIndex: 'rule_type', width: 90 },
              { title: '阶梯', key: 'steps' },
              { title: '备注', dataIndex: 'remark', ellipsis: true },
            ]"
            :data-source="detailRules"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'scope'">{{ ruleScope(record) }}</template>
              <template v-else-if="column.dataIndex === 'rule_type'">{{ RULE_TYPE_TEXT[record.rule_type] ?? '-' }}</template>
              <template v-else-if="column.key === 'steps'">
                <template v-if="Array.isArray(record.rules)">
                  <div v-for="(step, idx) in record.rules" :key="idx">提前 {{ step.hours_before }}h 退 {{ step.refund_rate }}%</div>
                </template>
                <span v-else>-</span>
              </template>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑商品 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑商品' : '新增商品(保存为草稿)'"
      width="680px"
      :confirm-loading="modalSaving"
      @ok="saveGoods"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item label="商品名称" required>
          <a-input v-model:value="form.goodsName" :maxlength="100" />
        </a-form-item>
        <a-form-item v-if="isSuper && !editingId" label="所属站点" required>
          <SiteTreeSelect v-model:value="form.siteId" style="width: 100%" />
        </a-form-item>
        <a-form-item label="所属商户">
          <a-select
            v-model:value="form.merchantId"
            show-search
            allow-clear
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            placeholder="输入商户名称搜索"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item label="分类">
          <a-cascader v-model:value="formCategory" :options="categoryOptions" change-on-select placeholder="选择分类" />
        </a-form-item>
        <a-form-item label="封面图">
          <a-input v-model:value="form.coverImage" placeholder="图片 URL" />
        </a-form-item>
        <a-form-item label="图集">
          <a-textarea v-model:value="form.imagesText" :rows="3" placeholder="每行一个图片 URL" />
        </a-form-item>
        <a-form-item label="地址">
          <a-input v-model:value="form.address" />
        </a-form-item>
        <a-form-item v-if="isHotel" label="星级">
          <a-rate v-model:value="form.starLevel" :count="5" />
        </a-form-item>
        <a-form-item v-else label="营业时间">
          <a-space>
            <a-input v-model:value="form.openTime" placeholder="09:00" style="width: 120px" />
            <span>~</span>
            <a-input v-model:value="form.closeTime" placeholder="18:00" style="width: 120px" />
          </a-space>
        </a-form-item>
        <a-form-item label="简介">
          <a-textarea v-model:value="form.goodsBrief" :rows="2" :maxlength="500" />
        </a-form-item>
        <a-form-item label="详情">
          <a-textarea v-model:value="form.goodsDetail" :rows="4" placeholder="图文详情(支持富文本 HTML)" />
        </a-form-item>
        <a-form-item label="运营设置">
          <a-space size="large">
            <a-input-number v-model:value="form.sortWeight" :min="0" :max="9999" addon-before="权重" style="width: 160px" />
            <a-checkbox :checked="form.isRecommend === 1" @change="form.isRecommend = form.isRecommend === 1 ? 0 : 1">推荐</a-checkbox>
            <a-checkbox :checked="form.isHot === 1" @change="form.isHot = form.isHot === 1 ? 0 : 1">热门</a-checkbox>
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- SKU 管理抽屉 -->
    <a-drawer v-model:open="skuOpen" :title="`${skuLabel}管理 - ${skuGoods?.goods_name ?? ''}`" width="820">
      <a-space style="margin-bottom: 12px">
        <a-button v-perm="skuPerm" type="primary" @click="openSkuCreate">
          <template #icon><PlusOutlined /></template>新增{{ skuLabel }}
        </a-button>
        <a-button @click="loadSkus"><template #icon><ReloadOutlined /></template>刷新</a-button>
      </a-space>
      <a-table
        :columns="isHotel ? roomColumns : ticketColumns"
        :data-source="skuList"
        :loading="skuLoading"
        row-key="id"
        size="small"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'breakfast'">{{ BREAKFAST_TEXT[record.breakfast] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'ticket_kind'">{{ TICKET_KIND_TEXT[record.ticket_kind] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'base_price'">{{ formatAmount(record.base_price) }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '在售' : '停售' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="skuPerm" type="link" size="small" @click="openSkuEdit(record)">编辑</a-button>
            <a-popconfirm title="确认删除?存在进行中订单将被拒绝" :ok-button-props="{ danger: true }" @confirm="removeSku(record)">
              <a-button v-perm="skuPerm" type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-drawer>

    <!-- SKU 新增/编辑 -->
    <a-modal
      v-model:open="skuModalOpen"
      :title="`${skuEditingId ? '编辑' : '新增'}${skuLabel}`"
      width="560px"
      :confirm-loading="skuSaving"
      @ok="saveSku"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item :label="`${skuLabel}名称`" required>
          <a-input v-model:value="skuForm.name" :maxlength="100" />
        </a-form-item>
        <template v-if="isHotel">
          <a-form-item label="床型">
            <a-input v-model:value="skuForm.bedType" placeholder="如 大床 1.8m / 双床 1.2m×2" />
          </a-form-item>
          <a-form-item label="面积">
            <a-input v-model:value="skuForm.area" placeholder="如 32㎡" style="width: 160px" />
          </a-form-item>
          <a-form-item label="入住人数">
            <a-input-number v-model:value="skuForm.maxGuests" :min="1" :max="10" />
          </a-form-item>
          <a-form-item label="早餐">
            <a-radio-group v-model:value="skuForm.breakfast">
              <a-radio :value="0">无早</a-radio>
              <a-radio :value="1">单早</a-radio>
              <a-radio :value="2">双早</a-radio>
            </a-radio-group>
          </a-form-item>
        </template>
        <template v-else>
          <a-form-item label="票种类型">
            <a-radio-group v-model:value="skuForm.ticketKind">
              <a-radio :value="1">普通票</a-radio>
              <a-radio :value="2">分时票</a-radio>
              <a-radio :value="3">联票</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="skuForm.ticketKind === 2" label="分时时段" required>
            <a-textarea v-model:value="skuForm.timeSlotsText" :rows="3" placeholder="每行一个时段,如 09:00-11:00" />
          </a-form-item>
          <a-form-item label="有效天数">
            <a-input-number v-model:value="skuForm.validDays" :min="1" :max="365" addon-after="天" />
          </a-form-item>
          <a-form-item label="预订限制">
            <a-space>
              <a-input-number v-model:value="skuForm.bookLimit" :min="0" addon-before="单人限购" placeholder="0 不限" style="width: 170px" />
              <a-input-number v-model:value="skuForm.advanceHours" :min="0" addon-before="提前预订" addon-after="小时" style="width: 200px" />
            </a-space>
          </a-form-item>
          <a-form-item label="可核销次数">
            <a-input-number v-model:value="skuForm.verifyTimes" :min="1" :max="99" />
          </a-form-item>
        </template>
        <a-form-item label="门市价" required>
          <a-input-number v-model:value="skuForm.basePrice" :min="0" :precision="2" style="width: 160px" />
        </a-form-item>
        <a-form-item label="基础库存" required>
          <a-input-number v-model:value="skuForm.baseStock" :min="0" style="width: 160px" />
          <div class="form-tip">未单独设置日历的日期按基础库存售卖</div>
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="skuForm.sort" :min="0" />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="skuForm.status">
            <a-radio :value="1">在售</a-radio>
            <a-radio :value="2">停售</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 退改规则抽屉 -->
    <a-drawer v-model:open="ruleOpen" :title="`退改规则 - ${ruleGoods?.goods_name ?? ''}`" width="640">
      <a-spin :spinning="ruleLoading">
        <a-table
          :columns="[
            { title: '适用', key: 'scope' },
            { title: '类型', dataIndex: 'rule_type', width: 90 },
            { title: '阶梯', key: 'steps' },
          ]"
          :data-source="ruleList"
          row-key="id"
          size="small"
          :pagination="false"
          style="margin-bottom: 16px"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'scope'">
              {{ Number(record.sku_type) === 0 ? '商品级' : `${skuLabel}#${record.sku_id}` }}
            </template>
            <template v-else-if="column.dataIndex === 'rule_type'">{{ RULE_TYPE_TEXT[record.rule_type] ?? '-' }}</template>
            <template v-else-if="column.key === 'steps'">
              <template v-if="Array.isArray(record.rules)">
                <div v-for="(step, idx) in record.rules" :key="idx">提前 {{ step.hours_before }}h 退 {{ step.refund_rate }}%</div>
              </template>
              <span v-else>-</span>
            </template>
          </template>
        </a-table>

        <a-divider orientation="left">新增 / 覆盖规则</a-divider>
        <a-form :label-col="{ style: { width: '90px' } }">
          <a-form-item label="适用范围">
            <a-select v-model:value="ruleForm.skuScope" style="width: 100%">
              <a-select-option :value="0">商品级(全部 SKU 默认)</a-select-option>
              <a-select-option v-for="sku in ruleSkus" :key="sku.id" :value="sku.id">
                {{ skuLabel }}#{{ sku.id }} {{ sku.room_name ?? sku.ticket_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="规则类型">
            <a-radio-group v-model:value="ruleForm.ruleType">
              <a-radio :value="1">免费退</a-radio>
              <a-radio :value="2">阶梯退</a-radio>
              <a-radio :value="3">不可退</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="ruleForm.ruleType === 2" label="退款阶梯">
            <div v-for="(step, idx) in ruleForm.steps" :key="idx" style="margin-bottom: 8px">
              <a-space>
                <a-input-number v-model:value="step.hoursBefore" :min="0" addon-before="提前" addon-after="小时" style="width: 180px" />
                <a-input-number v-model:value="step.refundRate" :min="0" :max="100" addon-before="退" addon-after="%" style="width: 160px" />
                <a-button type="link" danger size="small" @click="ruleForm.steps.splice(idx, 1)">删除</a-button>
              </a-space>
            </div>
            <a-button type="dashed" size="small" @click="addStep"><PlusOutlined />添加阶梯</a-button>
          </a-form-item>
          <a-form-item label="备注">
            <a-input v-model:value="ruleForm.remark" :maxlength="500" />
          </a-form-item>
          <a-form-item :wrapper-col="{ offset: 4 }">
            <a-button v-perm="permPrefix + ':edit'" type="primary" :loading="ruleSaving" @click="saveRule">保存规则</a-button>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.form-tip {
  font-size: 12px;
  color: var(--mtrip-text-aux, #909399);
}
</style>
