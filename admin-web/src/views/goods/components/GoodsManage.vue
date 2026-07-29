<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const isHotel = computed(() => props.goodsType === 1);
const skuLabel = computed(() => (isHotel.value ? t('goods.common.roomType') : t('goods.common.ticketType')));

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('goods.common.statusDraft'), color: 'default' },
  1: { text: t('goods.common.statusPending'), color: 'warning' },
  2: { text: t('goods.common.statusRejected'), color: 'error' },
  3: { text: t('goods.common.statusOnsale'), color: 'success' },
  4: { text: t('goods.common.statusOffshelf'), color: 'default' },
}));

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
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.common.goodsName'), dataIndex: 'goods_name', width: 220, ellipsis: true },
  { title: t('goods.category.name'), dataIndex: 'category_name', width: 110, ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 140, ellipsis: true },
  { title: t('goods.audit.columns.salesCount'), dataIndex: 'sales_count', width: 80 },
  { title: t('goods.common.weight'), dataIndex: 'sort_weight', width: 70 },
  { title: t('goods.common.flags'), key: 'flags', width: 100 },
  { title: t('common.status'), dataIndex: 'status', width: 90 },
  { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 320, fixed: 'right' as const },
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

const RULE_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.ruleTypeAny'),
  2: t('goods.common.ruleTypeStep'),
  3: t('goods.common.ruleTypeNo'),
}));

function ruleScope(rule: TableRow): string {
  if (Number(rule.sku_type) === 0) {
    return t('goods.common.ruleLevelGoods');
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
    message.warning(t('goods.common.inputGoodsName'));
    return;
  }
  if (!editingId.value && isSuper && !form.siteId) {
    message.warning(t('goods.category.selectSite'));
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
      message.success(t('goods.common.saveSuccess'));
    } else {
      await apiGoodsAdd(payload);
      message.success(t('goods.common.saveDraftSuccess'));
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
  message.success(t('goods.common.submitSuccess'));
  await load();
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiGoodsToggleStatus(row.id);
  message.success(result.status === 3 ? t('goods.common.onshelfSuccess') : t('goods.common.offshelfSuccess'));
  await load();
}

async function removeGoods(row: TableRow): Promise<void> {
  await apiGoodsDelete(row.id);
  message.success(t('goods.common.deleteSuccess'));
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
  { title: t('common.id'), dataIndex: 'id', width: 60 },
  { title: t('goods.common.roomType'), dataIndex: 'room_name', ellipsis: true },
  { title: t('goods.common.bedType'), dataIndex: 'bed_type', width: 90 },
  { title: t('goods.common.maxGuests'), dataIndex: 'max_guests', width: 60 },
  { title: t('goods.common.breakfast'), dataIndex: 'breakfast', width: 70 },
  { title: t('goods.common.basePrice'), dataIndex: 'base_price', width: 90 },
  { title: t('goods.common.baseStock'), dataIndex: 'base_stock', width: 80 },
  { title: t('common.status'), dataIndex: 'status', width: 70 },
  { title: t('common.action'), key: 'action_col', width: 110 },
];
const ticketColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 60 },
  { title: t('goods.common.ticketType'), dataIndex: 'ticket_name', ellipsis: true },
  { title: t('common.type'), dataIndex: 'ticket_kind', width: 80 },
  { title: t('goods.common.basePrice'), dataIndex: 'base_price', width: 90 },
  { title: t('goods.common.baseStock'), dataIndex: 'base_stock', width: 80 },
  { title: t('goods.common.validDays'), dataIndex: 'valid_days', width: 80 },
  { title: t('goods.common.verifyTimes'), dataIndex: 'verify_times', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 70 },
  { title: t('common.action'), key: 'action_col', width: 110 },
];
const BREAKFAST_TEXT = computed<Record<number, string>>(() => ({
  0: t('goods.common.breakfast0'),
  1: t('goods.common.breakfast1'),
  2: t('goods.common.breakfast2'),
}));
const TICKET_KIND_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.ticketKind1'),
  2: t('goods.common.ticketKind2'),
  3: t('goods.common.ticketKind3'),
}));

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
    message.warning(t('goods.common.inputSkuName', { skuLabel: skuLabel.value }));
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
        message.warning(t('goods.common.warningTicketSlots'));
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
    message.success(t('goods.common.skuSaveSuccess', { skuLabel: skuLabel.value }));
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
  message.success(t('goods.common.skuDeleteSuccess', { skuLabel: skuLabel.value }));
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
    message.warning(t('goods.common.warningNoRuleStep'));
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
    message.success(t('goods.common.ruleSaveSuccess'));
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
        <a-form-item :label="t('goods.common.goodsName')">
          <a-input v-model:value="query.goodsName" allow-clear :placeholder="t('goods.common.searchPlaceholder')" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('goods.category.name')">
          <a-cascader
            v-model:value="filterCategory"
            :options="categoryOptions"
            change-on-select
            allow-clear
            :placeholder="t('common.all')"
            style="width: 180px"
          />
        </a-form-item>
        <a-form-item :label="t('goods.audit.merchant')">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            :placeholder="t('goods.common.searchMerchantPlaceholder')"
            style="width: 180px"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option :value="0">{{ t('goods.common.statusDraft') }}</a-select-option>
            <a-select-option :value="1">{{ t('goods.common.statusPending') }}</a-select-option>
            <a-select-option :value="2">{{ t('goods.common.statusRejected') }}</a-select-option>
            <a-select-option :value="3">{{ t('goods.common.statusOnsale') }}</a-select-option>
            <a-select-option :value="4">{{ t('goods.common.statusOffshelf') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ isHotel ? t('goods.common.titleHotel') : t('goods.common.titleTicket') }}</template>
      <template #extra>
        <a-button v-perm="permPrefix + ':add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('goods.common.addGoods') }}
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
            <a-tag v-if="record.is_recommend === 1" color="blue">{{ t('goods.common.flagRecommend') }}</a-tag>
            <a-tag v-if="record.is_hot === 1" color="red">{{ t('goods.common.flagHot') }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tooltip v-if="record.status === 2 && record.audit_remark" :title="t('goods.common.auditRejectReasonTemplate', { reason: record.audit_remark })">
              <span><StatusTag :value="record.status" :map="STATUS_MAP" /></span>
            </a-tooltip>
            <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button
                v-if="record.status !== 1 && record.status !== 3"
                v-perm="permPrefix + ':edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >{{ t('common.edit') }}</a-button>
              <a-button v-perm="skuPerm" type="link" size="small" @click="openSku(record)">{{ skuLabel }}</a-button>
              <a-button v-perm="permPrefix + ':edit'" type="link" size="small" @click="openRule(record)">{{ t('goods.common.refund') }}</a-button>
              <a-popconfirm
                v-if="record.status === 0 || record.status === 2"
                :title="t('goods.common.confirmSubmitAudit')"
                @confirm="submitAudit(record)"
              >
                <a-button v-perm="permPrefix + ':edit'" type="link" size="small" style="color: var(--mtrip-warning, #faad14)">{{ t('goods.common.submitAudit') }}</a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status === 3 || record.status === 4"
                :title="record.status === 3 ? t('goods.common.confirmOffshelf') : t('goods.common.confirmOnshelf')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="permPrefix + ':edit'" type="link" size="small" :danger="record.status === 3">
                  {{ record.status === 3 ? t('goods.common.offshelf') : t('goods.common.onshelf') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status !== 3"
                :title="t('goods.common.confirmDeleteGoods')"
                :ok-button-props="{ danger: true }"
                @confirm="removeGoods(record)"
              >
                <a-button v-perm="permPrefix + ':delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('goods.common.goodsDetail')" width="760">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('goods.common.goodsName')" :span="2">{{ detail.goods_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.columns.salesCount')">{{ detail.sales_count }}</a-descriptions-item>
            <a-descriptions-item v-if="isHotel" :label="t('goods.common.starLevel')">{{ detail.star_level }} {{ t('goods.common.starUnit') }}</a-descriptions-item>
            <a-descriptions-item v-else :label="t('goods.common.businessHours')">{{ detail.open_time }} ~ {{ detail.close_time }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.common.weight')">{{ detail.sort_weight }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.address')" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.common.brief')" :span="2">{{ detail.goods_brief || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.audit_remark" :label="t('goods.common.auditOpinion')" :span="2">{{ detail.audit_remark }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider orientation="left">{{ t('goods.common.images') }}</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <a-divider orientation="left">{{ t('goods.common.breadcrumbSkuList', { skuLabel: skuLabel, count: detailSkus.length }) }}</a-divider>
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
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('goods.common.onSale') : t('goods.common.offSale') }}</a-tag>
              </template>
            </template>
          </a-table>
          <a-divider orientation="left">{{ t('goods.common.breadcrumbRuleList', { count: detailRules.length }) }}</a-divider>
          <a-table
            :columns="[
              { title: t('goods.common.ruleColumnScope'), key: 'scope' },
              { title: t('common.type'), dataIndex: 'rule_type', width: 90 },
              { title: t('goods.common.ruleColumnSteps'), key: 'steps' },
              { title: t('goods.common.ruleColumnRemark'), dataIndex: 'remark', ellipsis: true },
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
                  <div v-for="(step, idx) in record.rules" :key="idx">{{ t('goods.common.stepRefundText', { hours: step.hours_before, percent: step.refund_rate }) }}</div>
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
      :title="editingId ? t('goods.common.editGoods') : t('goods.common.modalAddGoods')"
      width="680px"
      :confirm-loading="modalSaving"
      @ok="saveGoods"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('goods.common.goodsName')" required>
          <a-input v-model:value="form.goodsName" :maxlength="100" />
        </a-form-item>
        <a-form-item v-if="isSuper && !editingId" :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="form.siteId" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('goods.audit.merchant')">
          <a-select
            v-model:value="form.merchantId"
            show-search
            allow-clear
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            :placeholder="t('goods.common.searchMerchantPlaceholder')"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('goods.category.name')">
          <a-cascader v-model:value="formCategory" :options="categoryOptions" change-on-select :placeholder="t('goods.common.selectCategory')" />
        </a-form-item>
        <a-form-item :label="t('goods.common.coverImage')">
          <a-input v-model:value="form.coverImage" :placeholder="t('goods.common.imagePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('goods.common.images')">
          <a-textarea v-model:value="form.imagesText" :rows="3" :placeholder="t('goods.common.imagesPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('common.address')">
          <a-input v-model:value="form.address" />
        </a-form-item>
        <a-form-item v-if="isHotel" :label="t('goods.common.starLevel')">
          <a-rate v-model:value="form.starLevel" :count="5" />
        </a-form-item>
        <a-form-item v-else :label="t('goods.common.businessHours')">
          <a-space>
            <a-input v-model:value="form.openTime" :placeholder="t('goods.common.openTimePlaceholder')" style="width: 120px" />
            <span>~</span>
            <a-input v-model:value="form.closeTime" :placeholder="t('goods.common.closeTimePlaceholder')" style="width: 120px" />
          </a-space>
        </a-form-item>
        <a-form-item :label="t('goods.common.brief')">
          <a-textarea v-model:value="form.goodsBrief" :rows="2" :maxlength="500" />
        </a-form-item>
        <a-form-item :label="t('goods.common.detailField')">
          <a-textarea v-model:value="form.goodsDetail" :rows="4" :placeholder="t('goods.common.detailPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('goods.common.operations')">
          <a-space size="large">
            <a-input-number v-model:value="form.sortWeight" :min="0" :max="9999" :addon-before="t('goods.common.weight')" style="width: 160px" />
            <a-checkbox :checked="form.isRecommend === 1" @change="form.isRecommend = form.isRecommend === 1 ? 0 : 1">{{ t('goods.common.flagRecommend') }}</a-checkbox>
            <a-checkbox :checked="form.isHot === 1" @change="form.isHot = form.isHot === 1 ? 0 : 1">{{ t('goods.common.flagHot') }}</a-checkbox>
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- SKU 管理抽屉 -->
    <a-drawer v-model:open="skuOpen" :title="t('goods.common.drawerSkuManageTitle', { skuLabel: skuLabel, name: skuGoods?.goods_name ?? '' })" width="820">
      <a-space style="margin-bottom: 12px">
        <a-button v-perm="skuPerm" type="primary" @click="openSkuCreate">
          <template #icon><PlusOutlined /></template>{{ t('goods.common.addSku', { skuLabel: skuLabel }) }}
        </a-button>
        <a-button @click="loadSkus"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
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
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('goods.common.onSale') : t('goods.common.offSale') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="skuPerm" type="link" size="small" @click="openSkuEdit(record)">{{ t('common.edit') }}</a-button>
            <a-popconfirm :title="t('goods.common.confirmDeleteSku')" :ok-button-props="{ danger: true }" @confirm="removeSku(record)">
              <a-button v-perm="skuPerm" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-drawer>

    <!-- SKU 新增/编辑 -->
    <a-modal
      v-model:open="skuModalOpen"
      :title="`${skuEditingId ? t('common.edit') : t('common.add')}${skuLabel}`"
      width="560px"
      :confirm-loading="skuSaving"
      @ok="saveSku"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item :label="`${skuLabel}${t('common.name')}`" required>
          <a-input v-model:value="skuForm.name" :maxlength="100" />
        </a-form-item>
        <template v-if="isHotel">
          <a-form-item :label="t('goods.common.bedType')">
            <a-input v-model:value="skuForm.bedType" :placeholder="t('goods.common.bedTypePlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('goods.common.area')">
            <a-input v-model:value="skuForm.area" :placeholder="t('goods.common.areaPlaceholder')" style="width: 160px" />
          </a-form-item>
          <a-form-item :label="t('goods.common.maxGuests')">
            <a-input-number v-model:value="skuForm.maxGuests" :min="1" :max="10" />
          </a-form-item>
          <a-form-item :label="t('goods.common.breakfast')">
            <a-radio-group v-model:value="skuForm.breakfast">
              <a-radio :value="0">{{ t('goods.common.breakfast0') }}</a-radio>
              <a-radio :value="1">{{ t('goods.common.breakfast1') }}</a-radio>
              <a-radio :value="2">{{ t('goods.common.breakfast2') }}</a-radio>
            </a-radio-group>
          </a-form-item>
        </template>
        <template v-else>
          <a-form-item :label="t('goods.common.ticketType')">
            <a-radio-group v-model:value="skuForm.ticketKind">
              <a-radio :value="1">{{ t('goods.common.ticketKind1') }}</a-radio>
              <a-radio :value="2">{{ t('goods.common.ticketKind2') }}</a-radio>
              <a-radio :value="3">{{ t('goods.common.ticketKind3') }}</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="skuForm.ticketKind === 2" :label="t('goods.common.timeSlots')" required>
            <a-textarea v-model:value="skuForm.timeSlotsText" :rows="3" :placeholder="t('goods.common.timeSlotsPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('goods.common.validDays')">
            <a-input-number v-model:value="skuForm.validDays" :min="1" :max="365" :addon-after="t('goods.common.daysUnit')" />
          </a-form-item>
          <a-form-item :label="t('common.sort')">
            <a-space>
              <a-input-number v-model:value="skuForm.bookLimit" :min="0" :addon-before="t('goods.common.bookLimitAddonBefore')" :placeholder="t('goods.common.bookLimitPlaceholder')" style="width: 170px" />
              <a-input-number v-model:value="skuForm.advanceHours" :min="0" :addon-before="t('goods.common.advanceHoursAddonBefore')" :addon-after="t('goods.common.hoursUnit')" style="width: 200px" />
            </a-space>
          </a-form-item>
          <a-form-item :label="t('goods.common.verifyTimes')">
            <a-input-number v-model:value="skuForm.verifyTimes" :min="1" :max="99" />
          </a-form-item>
        </template>
        <a-form-item :label="t('goods.common.basePrice')" required>
          <a-input-number v-model:value="skuForm.basePrice" :min="0" :precision="2" style="width: 160px" />
        </a-form-item>
        <a-form-item :label="t('goods.common.baseStock')" required>
          <a-input-number v-model:value="skuForm.baseStock" :min="0" style="width: 160px" />
          <div class="form-tip">{{ t('goods.common.baseStockTip') }}</div>
        </a-form-item>
        <a-form-item :label="t('common.sort')">
          <a-input-number v-model:value="skuForm.sort" :min="0" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="skuForm.status">
            <a-radio :value="1">{{ t('goods.common.onSale') }}</a-radio>
            <a-radio :value="2">{{ t('goods.common.offSale') }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 退改规则抽屉 -->
    <a-drawer v-model:open="ruleOpen" :title="t('goods.common.drawerRuleManageTitle', { name: ruleGoods?.goods_name ?? '' })" width="640">
      <a-spin :spinning="ruleLoading">
        <a-table
          :columns="[
            { title: t('goods.common.ruleColumnScope'), key: 'scope' },
            { title: t('common.type'), dataIndex: 'rule_type', width: 90 },
            { title: t('goods.common.ruleColumnSteps'), key: 'steps' },
          ]"
          :data-source="ruleList"
          row-key="id"
          size="small"
          :pagination="false"
          style="margin-bottom: 16px"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'scope'">
              {{ Number(record.sku_type) === 0 ? t('goods.common.ruleLevelGoods') : `${skuLabel}#${record.sku_id}` }}
            </template>
            <template v-else-if="column.dataIndex === 'rule_type'">{{ RULE_TYPE_TEXT[record.rule_type] ?? '-' }}</template>
            <template v-else-if="column.key === 'steps'">
              <template v-if="Array.isArray(record.rules)">
                <div v-for="(step, idx) in record.rules" :key="idx">{{ t('goods.common.stepRefundText', { hours: step.hours_before, percent: step.refund_rate }) }}</div>
              </template>
              <span v-else>-</span>
            </template>
          </template>
        </a-table>

        <a-divider orientation="left">{{ t('goods.common.breadcrumbAddRule') }}</a-divider>
        <a-form :label-col="{ style: { width: '90px' } }">
          <a-form-item :label="t('goods.common.ruleScope')">
            <a-select v-model:value="ruleForm.skuScope" style="width: 100%">
              <a-select-option :value="0">{{ t('goods.common.ruleScopeAll') }}</a-select-option>
              <a-select-option v-for="sku in ruleSkus" :key="sku.id" :value="sku.id">
                {{ skuLabel }}#{{ sku.id }} {{ sku.room_name ?? sku.ticket_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('goods.common.ruleType')">
            <a-radio-group v-model:value="ruleForm.ruleType">
              <a-radio :value="1">{{ t('goods.common.ruleTypeAny') }}</a-radio>
              <a-radio :value="2">{{ t('goods.common.ruleTypeStep') }}</a-radio>
              <a-radio :value="3">{{ t('goods.common.ruleTypeNo') }}</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="ruleForm.ruleType === 2" :label="t('goods.common.ruleSteps')">
            <div v-for="(step, idx) in ruleForm.steps" :key="idx" style="margin-bottom: 8px">
              <a-space>
                <a-input-number v-model:value="step.hoursBefore" :min="0" :addon-before="t('goods.common.advanceHoursAddonBefore')" :addon-after="t('goods.common.hoursUnit')" style="width: 180px" />
                <a-input-number v-model:value="step.refundRate" :min="0" :max="100" addon-before="%" addon-after="%" style="width: 160px" />
                <a-button type="link" danger size="small" @click="ruleForm.steps.splice(idx, 1)">{{ t('goods.common.deleteStep') }}</a-button>
              </a-space>
            </div>
            <a-button type="dashed" size="small" @click="addStep"><PlusOutlined />{{ t('goods.common.addStep') }}</a-button>
          </a-form-item>
          <a-form-item :label="t('common.remark')">
            <a-input v-model:value="ruleForm.remark" :maxlength="500" />
          </a-form-item>
          <a-form-item :wrapper-col="{ offset: 4 }">
            <a-button v-perm="permPrefix + ':edit'" type="primary" :loading="ruleSaving" @click="saveRule">{{ t('goods.common.saveRule') }}</a-button>
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
