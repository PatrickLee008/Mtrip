<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { formatAmount } from '@/utils/format';
import { apiGoodsAudit, apiGoodsDetail, apiGoodsList, apiGoodsToggleStatus, apiRoomReviewAudit, apiRoomReviewDetail, apiRoomReviewList } from '@/api/goods';
import { apiMerchantPropertyContentAudit, apiMerchantPropertyContentDetail, apiMerchantPropertyContentList } from '@/api/merchant';

/** 商品审核工作台:待审核队列(通过=直接上架/驳回必填原因)+ 已上架强制下架 */
const { t } = useI18n();
const activeTab = ref('pending');

const pending = useTable(
  (params) => apiGoodsList({ ...params, goodsType: 2, status: 1 }),
  { goodsName: '' },
);
const onsale = useTable(
  (params) => apiGoodsList({ ...params, goodsType: 2, status: 3 }),
  { goodsName: '' },
);
const roomReviews = useTable((params) => apiRoomReviewList({ ...params, status: 1 }), { keyword: '' });
const propertyReviews = useTable((params) => apiMerchantPropertyContentList({ ...params, status: 1 }), { keyword: '' });
const propertyReviewColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.audit.propertyReview.property'), dataIndex: 'store_name', ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 160, ellipsis: true },
  { title: t('goods.audit.roomReview.version'), dataIndex: 'version', width: 80 },
  { title: t('goods.audit.submitTime'), dataIndex: 'submitted_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 180 },
];
const roomReviewColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.audit.roomReview.roomType'), dataIndex: 'room_name', ellipsis: true },
  { title: t('goods.audit.roomReview.hotel'), dataIndex: 'property_name', ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 150, ellipsis: true },
  { title: t('goods.audit.roomReview.version'), dataIndex: 'version', width: 80 },
  { title: t('goods.audit.roomReview.action'), dataIndex: 'action', width: 90 },
  { title: t('goods.audit.submitTime'), dataIndex: 'submitted_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 180 },
];

const pendingColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.audit.goodsName'), dataIndex: 'goods_name', ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 150, ellipsis: true },
  { title: t('goods.audit.submitTime'), dataIndex: 'updated_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 160 },
];
const onsaleColumns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('goods.audit.goodsName'), dataIndex: 'goods_name', ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 150, ellipsis: true },
  { title: t('goods.audit.columns.salesCount'), dataIndex: 'sales_count', width: 80 },
  { title: t('goods.audit.onSaleTime'), dataIndex: 'updated_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 130 },
];

function reloadAll(): void {
  pending.search();
  onsale.search();
  roomReviews.search();
  propertyReviews.search();
}

const propertyDrawerOpen = ref(false);
const propertyDetailLoading = ref(false);
const propertyDetail = ref<TableRow | null>(null);
const propertyAuditOpen = ref(false);
const propertyAuditSaving = ref(false);
const propertyAuditTarget = ref<TableRow | null>(null);
const propertyAuditForm = reactive({ auditStatus: 1, auditRemark: '' });
const propertyDiffRows = computed(() => {
  const current = propertyDetail.value?.effective || {};
  const submitted = propertyDetail.value?.revision?.payload || {};
  const fields = ['store_name', 'address', 'country_code', 'city_key', 'description', 'star_level', 'facilities', 'images', 'website', 'checkin_time', 'checkout_time'];
  return fields.map((field) => ({ field, current: current[field], submitted: submitted[field], changed: JSON.stringify(current[field] ?? null) !== JSON.stringify(submitted[field] ?? null) }));
});
async function openPropertyDetail(row: TableRow): Promise<void> { propertyDrawerOpen.value = true; propertyDetailLoading.value = true; try { propertyDetail.value = await apiMerchantPropertyContentDetail(row.id); } finally { propertyDetailLoading.value = false; } }
function openPropertyAudit(row: TableRow, status: number): void { propertyAuditTarget.value = row; Object.assign(propertyAuditForm, { auditStatus: status, auditRemark: '' }); propertyAuditOpen.value = true; }
async function doPropertyAudit(): Promise<void> {
  if (!propertyAuditTarget.value) return;
  if (propertyAuditForm.auditStatus === 2 && !propertyAuditForm.auditRemark.trim()) { message.warning(t('goods.audit.auditModal.warningRejectReasonRequired')); return; }
  propertyAuditSaving.value = true;
  try {
    await apiMerchantPropertyContentAudit({ id: propertyAuditTarget.value.id, ...propertyAuditForm });
    message.success(t(propertyAuditForm.auditStatus === 1 ? 'goods.audit.propertyReview.successApprove' : 'goods.audit.propertyReview.successReject'));
    propertyAuditOpen.value = false;
    propertyDrawerOpen.value = false;
    propertyReviews.search();
  } finally { propertyAuditSaving.value = false; }
}
function propertyDiffRowClass(record: TableRow): string { return record.changed ? 'changed-row' : ''; }

const roomDrawerOpen = ref(false);
const roomDetailLoading = ref(false);
const roomDetail = ref<TableRow | null>(null);
const roomAuditOpen = ref(false);
const roomAuditSaving = ref(false);
const roomAuditTarget = ref<TableRow | null>(null);
const roomAuditForm = reactive({ auditStatus: 1, auditRemark: '' });
const roomDiffRows = computed(() => {
  const current = roomDetail.value?.effective || {};
  const submitted = roomDetail.value?.revision?.payload || {};
  const fields = ['room_name', 'room_code', 'description', 'bed_type', 'bed_count', 'area', 'max_adults', 'max_children', 'max_guests', 'floor_name', 'room_view', 'smoking', 'facilities', 'images', 'currency', 'base_price', 'weekend_price', 'extra_bed_price', 'base_stock', 'launch_stock', 'cancellation_policy', 'meal_plan', 'checkin_notes'];
  return fields.map((field) => ({ field, current: current[field], submitted: submitted[field], changed: JSON.stringify(current[field] ?? null) !== JSON.stringify(submitted[field] ?? null) }));
});
async function openRoomDetail(row: TableRow): Promise<void> { roomDrawerOpen.value = true; roomDetailLoading.value = true; try { roomDetail.value = await apiRoomReviewDetail(row.id); } finally { roomDetailLoading.value = false; } }
function openRoomAudit(row: TableRow, status: number): void { roomAuditTarget.value = row; Object.assign(roomAuditForm, { auditStatus: status, auditRemark: '' }); roomAuditOpen.value = true; }
async function doRoomAudit(): Promise<void> { if (!roomAuditTarget.value) return; if (roomAuditForm.auditStatus === 2 && !roomAuditForm.auditRemark.trim()) { message.warning(t('goods.audit.auditModal.warningRejectReasonRequired')); return; } roomAuditSaving.value = true; try { await apiRoomReviewAudit({ id: roomAuditTarget.value.id, ...roomAuditForm }); message.success(roomAuditForm.auditStatus === 1 ? t('goods.audit.roomReview.successApprove') : t('goods.audit.roomReview.successReject')); roomAuditOpen.value = false; roomDrawerOpen.value = false; roomReviews.search(); } finally { roomAuditSaving.value = false; } }
function roomDiffRowClass(record: TableRow): string { return record.changed ? 'changed-row' : ''; }

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailSkus = ref<TableRow[]>([]);
const detailRules = ref<TableRow[]>([]);
const RULE_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.ruleTypeAny'),
  2: t('goods.common.ruleTypeStep'),
  3: t('goods.common.ruleTypeNo'),
}));

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

// ---------- 审核 ----------
const auditOpen = ref(false);
const auditSaving = ref(false);
const auditTarget = ref<TableRow | null>(null);
const auditForm = reactive({ auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow, auditStatus: number): void {
  auditTarget.value = row;
  Object.assign(auditForm, { auditStatus, auditRemark: '' });
  auditOpen.value = true;
}

async function doAudit(): Promise<void> {
  if (!auditTarget.value) {
    return;
  }
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('goods.audit.auditModal.warningRejectReasonRequired'));
    return;
  }
  auditSaving.value = true;
  try {
    await apiGoodsAudit({ id: auditTarget.value.id, ...auditForm });
    message.success(
      auditForm.auditStatus === 1
        ? t('goods.audit.auditModal.successPass')
        : t('goods.audit.auditModal.successReject'),
    );
    auditOpen.value = false;
    drawerOpen.value = false;
    reloadAll();
  } finally {
    auditSaving.value = false;
  }
}

// ---------- 强制下架 ----------
const offOpen = ref(false);
const offSaving = ref(false);
const offTarget = ref<TableRow | null>(null);
const offRemark = ref('');

function openOff(row: TableRow): void {
  offTarget.value = row;
  offRemark.value = '';
  offOpen.value = true;
}

async function doOff(): Promise<void> {
  if (!offTarget.value) {
    return;
  }
  if (!offRemark.value.trim()) {
    message.warning(t('goods.audit.forceOffshelfModal.warningReasonRequired'));
    return;
  }
  offSaving.value = true;
  try {
    await apiGoodsToggleStatus(offTarget.value.id);
    message.success(t('goods.audit.forceOffshelfModal.success'));
    offOpen.value = false;
    onsale.search();
  } finally {
    offSaving.value = false;
  }
}

onMounted(() => {
  void pending.load();
  void onsale.load();
  void roomReviews.load();
  void propertyReviews.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra>
        <a-button @click="reloadAll"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
      </template>
      <a-tabs v-model:active-key="activeTab">
        <!-- 待审核队列 -->
        <a-tab-pane key="pending">
          <template #tab>
            <a-badge :count="pending.total.value" :offset="[10, -2]">{{ t('goods.audit.pending') }}</a-badge>
          </template>
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.audit.goodsName')">
              <a-input v-model:value="pending.query.goodsName" allow-clear style="width: 180px" @press-enter="pending.search()" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="pending.search()"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="pendingColumns"
            :data-source="pending.list.value"
            :loading="pending.loading.value"
            :pagination="pending.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
                  <a-button
                    v-perm="'goods:audit:audit'"
                    type="link"
                    size="small"
                    style="color: var(--mtrip-success, #52c41a)"
                    @click="openAudit(record, 1)"
                  >{{ t('goods.audit.columns.pass') }}</a-button>
                  <a-button
                    v-perm="'goods:audit:audit'"
                    type="link"
                    size="small"
                    style="color: var(--mtrip-warning, #faad14)"
                    @click="openAudit(record, 2)"
                  >{{ t('goods.audit.columns.reject') }}</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 已上架(强制下架) -->
        <a-tab-pane :key="t('goods.audit.onsale')" :tab="t('goods.audit.onsale')">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="t('goods.audit.goodsName')">
              <a-input v-model:value="onsale.query.goodsName" allow-clear style="width: 180px" @press-enter="onsale.search()" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="onsale.search()"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="onsaleColumns"
            :data-source="onsale.list.value"
            :loading="onsale.loading.value"
            :pagination="onsale.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
                  <a-button v-perm="'goods:audit:off'" type="link" size="small" danger @click="openOff(record)">{{ t('goods.audit.columns.forceOffshelf') }}</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="room-review">
          <template #tab><a-badge :count="roomReviews.total.value" :offset="[10, -2]">{{ t('goods.audit.roomReview.title') }}</a-badge></template>
          <a-form layout="inline" style="margin-bottom: 16px"><a-form-item :label="t('goods.audit.roomReview.searchLabel')"><a-input v-model:value="roomReviews.query.keyword" allow-clear style="width: 240px" @press-enter="roomReviews.search()" /></a-form-item><a-form-item><a-button type="primary" @click="roomReviews.search()"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button></a-form-item></a-form>
          <a-table :columns="roomReviewColumns" :data-source="roomReviews.list.value" :loading="roomReviews.loading.value" :pagination="roomReviews.pagination.value" row-key="id" size="middle">
            <template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'action'">{{ record.action === 'delete' ? t('goods.audit.roomReview.actionDelete') : t('goods.audit.roomReview.actionUpsert') }}</template><template v-else-if="column.key === 'action_col'"><a-space :size="0"><a-button type="link" size="small" @click="openRoomDetail(record)">{{ t('common.detail') }}</a-button><a-button v-perm="'goods:audit:audit'" type="link" size="small" style="color:var(--mtrip-success,#52c41a)" @click="openRoomAudit(record, 1)">{{ t('goods.audit.columns.pass') }}</a-button><a-button v-perm="'goods:audit:audit'" type="link" size="small" danger @click="openRoomAudit(record, 2)">{{ t('goods.audit.columns.reject') }}</a-button></a-space></template></template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="property-review">
          <template #tab><a-badge :count="propertyReviews.total.value" :offset="[10, -2]">{{ t('goods.audit.propertyReview.title') }}</a-badge></template>
          <a-form layout="inline" style="margin-bottom: 16px"><a-form-item :label="t('goods.audit.propertyReview.searchLabel')"><a-input v-model:value="propertyReviews.query.keyword" allow-clear style="width: 240px" @press-enter="propertyReviews.search()" /></a-form-item><a-form-item><a-button type="primary" @click="propertyReviews.search()"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button></a-form-item></a-form>
          <a-table :columns="propertyReviewColumns" :data-source="propertyReviews.list.value" :loading="propertyReviews.loading.value" :pagination="propertyReviews.pagination.value" row-key="id" size="middle">
            <template #bodyCell="{ column, record }"><template v-if="column.key === 'action_col'"><a-space :size="0"><a-button type="link" size="small" @click="openPropertyDetail(record)">{{ t('common.detail') }}</a-button><a-button v-perm="'merchant:property:content-audit'" type="link" size="small" style="color:var(--mtrip-success,#52c41a)" @click="openPropertyAudit(record, 1)">{{ t('goods.audit.columns.pass') }}</a-button><a-button v-perm="'merchant:property:content-audit'" type="link" size="small" danger @click="openPropertyAudit(record, 2)">{{ t('goods.audit.columns.reject') }}</a-button></a-space></template></template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-drawer v-model:open="roomDrawerOpen" :title="t('goods.audit.roomReview.title')" width="920"><a-spin :spinning="roomDetailLoading"><template v-if="roomDetail"><a-descriptions :column="2" bordered size="small"><a-descriptions-item :label="t('goods.audit.roomReview.roomType')">{{ roomDetail.revision.payload.room_name }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.roomReview.hotel')">{{ roomDetail.revision.property_name }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.merchant')">{{ roomDetail.revision.merchant_name }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.roomReview.version')">v{{ roomDetail.revision.version }} · {{ roomDetail.revision.action }}</a-descriptions-item></a-descriptions><a-divider orientation="left">{{ t('goods.audit.roomReview.submittedChanges') }}</a-divider><a-table :data-source="roomDiffRows" row-key="field" size="small" :pagination="false" :columns="[{ title: t('goods.audit.roomReview.field'), dataIndex: 'field', width: 180 }, { title: t('goods.audit.roomReview.currentLive'), dataIndex: 'current' }, { title: t('goods.audit.roomReview.submitted'), dataIndex: 'submitted' }]" :row-class-name="roomDiffRowClass"><template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'current'">{{ Array.isArray(record.current) ? record.current.join(', ') : (record.current ?? '-') }}</template><template v-else-if="column.dataIndex === 'submitted'">{{ Array.isArray(record.submitted) ? record.submitted.join(', ') : (record.submitted ?? '-') }}</template></template></a-table><template v-if="roomDetail.revision.payload.images?.length"><a-divider orientation="left">{{ t('goods.audit.roomReview.media') }}</a-divider><a-image-preview-group><a-space wrap><a-image v-for="url in roomDetail.revision.payload.images" :key="url" :src="url" :width="120" :height="90" style="object-fit:cover;border-radius:6px" /></a-space></a-image-preview-group></template><a-divider /><a-space><a-button v-perm="'goods:audit:audit'" type="primary" @click="openRoomAudit(roomDetail.revision, 1)">{{ t('goods.audit.columns.pass') }}</a-button><a-button v-perm="'goods:audit:audit'" danger @click="openRoomAudit(roomDetail.revision, 2)">{{ t('goods.audit.columns.reject') }}</a-button></a-space></template></a-spin></a-drawer>

    <a-modal v-model:open="roomAuditOpen" :title="roomAuditForm.auditStatus === 1 ? t('goods.audit.roomReview.approveTitle') : t('goods.audit.roomReview.rejectTitle')" width="480px" :confirm-loading="roomAuditSaving" :ok-button-props="roomAuditForm.auditStatus === 2 ? { danger: true } : undefined" @ok="doRoomAudit"><a-alert :type="roomAuditForm.auditStatus === 1 ? 'success' : 'warning'" :message="roomAuditForm.auditStatus === 1 ? t('goods.audit.roomReview.approveNotice') : t('goods.audit.roomReview.rejectNotice')" show-icon style="margin:16px 0" /><a-form><a-form-item :label="t('goods.audit.roomReview.reviewNote')" :required="roomAuditForm.auditStatus === 2"><a-textarea v-model:value="roomAuditForm.auditRemark" :rows="3" :maxlength="500" /></a-form-item></a-form></a-modal>

    <a-drawer v-model:open="propertyDrawerOpen" :title="t('goods.audit.propertyReview.title')" width="920"><a-spin :spinning="propertyDetailLoading"><template v-if="propertyDetail"><a-descriptions :column="2" bordered size="small"><a-descriptions-item :label="t('goods.audit.propertyReview.property')">{{ propertyDetail.revision.payload.store_name }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.merchant')">{{ propertyDetail.revision.merchant_name }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.roomReview.version')">v{{ propertyDetail.revision.version }}</a-descriptions-item><a-descriptions-item :label="t('goods.audit.submitTime')">{{ propertyDetail.revision.submitted_at }}</a-descriptions-item></a-descriptions><a-divider orientation="left">{{ t('goods.audit.roomReview.submittedChanges') }}</a-divider><a-table :data-source="propertyDiffRows" row-key="field" size="small" :pagination="false" :columns="[{ title: t('goods.audit.roomReview.field'), dataIndex: 'field', width: 180 }, { title: t('goods.audit.roomReview.currentLive'), dataIndex: 'current' }, { title: t('goods.audit.roomReview.submitted'), dataIndex: 'submitted' }]" :row-class-name="propertyDiffRowClass"><template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'current'">{{ Array.isArray(record.current) ? record.current.join(', ') : (record.current ?? '-') }}</template><template v-else-if="column.dataIndex === 'submitted'">{{ Array.isArray(record.submitted) ? record.submitted.join(', ') : (record.submitted ?? '-') }}</template></template></a-table><template v-if="propertyDetail.revision.payload.images?.length"><a-divider orientation="left">{{ t('goods.audit.roomReview.media') }}</a-divider><a-image-preview-group><a-space wrap><a-image v-for="url in propertyDetail.revision.payload.images" :key="url" :src="url" :width="120" :height="90" style="object-fit:cover;border-radius:6px" /></a-space></a-image-preview-group></template><a-divider /><a-space><a-button v-perm="'merchant:property:content-audit'" type="primary" @click="openPropertyAudit(propertyDetail.revision, 1)">{{ t('goods.audit.columns.pass') }}</a-button><a-button v-perm="'merchant:property:content-audit'" danger @click="openPropertyAudit(propertyDetail.revision, 2)">{{ t('goods.audit.columns.reject') }}</a-button></a-space></template></a-spin></a-drawer>
    <a-modal v-model:open="propertyAuditOpen" :title="propertyAuditForm.auditStatus === 1 ? t('goods.audit.propertyReview.approveTitle') : t('goods.audit.propertyReview.rejectTitle')" width="480px" :confirm-loading="propertyAuditSaving" :ok-button-props="propertyAuditForm.auditStatus === 2 ? { danger: true } : undefined" @ok="doPropertyAudit"><a-alert :type="propertyAuditForm.auditStatus === 1 ? 'success' : 'warning'" :message="propertyAuditForm.auditStatus === 1 ? t('goods.audit.propertyReview.approveNotice') : t('goods.audit.propertyReview.rejectNotice')" show-icon style="margin:16px 0" /><a-form><a-form-item :label="t('goods.audit.roomReview.reviewNote')" :required="propertyAuditForm.auditStatus === 2"><a-textarea v-model:value="propertyAuditForm.auditRemark" :rows="3" :maxlength="500" /></a-form-item></a-form></a-modal>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('goods.audit.detailModal.title', { name: detail?.goods_name ?? '' })" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('goods.audit.goodsName')" :span="2">{{ detail.goods_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.type')">{{ t('goods.category.ticket') }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.starBusiness')">
              {{ detail.open_time || '-' }} ~ {{ detail.close_time || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('common.address')" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.common.brief')" :span="2">{{ detail.goods_brief || '-' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider :orientation="'left'">{{ t('goods.common.breadcrumbImages') }}</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <a-divider :orientation="'left'">{{ t('goods.audit.skuBadge', { count: detailSkus.length }) }}</a-divider>
          <a-table
            :columns="[
              { title: t('goods.audit.detailSku.id'), dataIndex: 'id', width: 60 },
              { title: t('goods.audit.detailSku.name'), key: 'sku_name' },
              { title: t('goods.audit.detailSku.basePrice'), dataIndex: 'base_price', width: 100 },
              { title: t('goods.audit.detailSku.baseStock'), dataIndex: 'base_stock', width: 90 },
              { title: t('goods.audit.detailSku.status'), dataIndex: 'status', width: 80 },
            ]"
            :data-source="detailSkus"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'sku_name'">{{ record.room_name ?? record.ticket_name }}</template>
              <template v-else-if="column.dataIndex === 'base_price'">{{ formatAmount(record.base_price) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('goods.common.onSale') : t('goods.common.offSale') }}</a-tag>
              </template>
            </template>
          </a-table>
          <a-divider :orientation="'left'">{{ t('goods.audit.ruleBadge', { count: detailRules.length }) }}</a-divider>
          <a-table
            :columns="[
              { title: t('goods.audit.detailRule.scope'), key: 'scope', width: 120 },
              { title: t('goods.audit.detailRule.type'), dataIndex: 'rule_type', width: 90 },
              { title: t('goods.audit.detailRule.steps'), key: 'steps' },
            ]"
            :data-source="detailRules"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'scope'">
                {{ Number(record.sku_type) === 0 ? t('goods.common.ruleLevelGoods') : `SKU#${record.sku_id}` }}
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
          <template v-if="Number(detail.status) === 1">
            <a-divider />
            <a-space>
              <a-button v-perm="'goods:audit:audit'" type="primary" @click="openAudit(detail, 1)">{{ t('goods.audit.actions.pass') }}</a-button>
              <a-button v-perm="'goods:audit:audit'" danger @click="openAudit(detail, 2)">{{ t('goods.audit.actions.reject') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 审核确认 -->
    <a-modal
      v-model:open="auditOpen"
      :title="auditForm.auditStatus === 1 ? t('goods.audit.auditModal.passTitle') : t('goods.audit.auditModal.rejectTitle')"
      width="480px"
      :confirm-loading="auditSaving"
      :ok-button-props="auditForm.auditStatus === 2 ? { danger: true } : undefined"
      @ok="doAudit"
    >
      <a-alert
        :type="auditForm.auditStatus === 1 ? 'success' : 'warning'"
        :message="auditForm.auditStatus === 1 ? t('goods.audit.auditModal.passNotice') : t('goods.audit.auditModal.rejectNotice')"
        show-icon
        style="margin: 16px 0"
      />
      <a-form :label-col="{ style: { width: '90px' } }">
        <a-form-item :label="t('goods.audit.auditModal.opinion')" :required="auditForm.auditStatus === 2">
          <a-textarea
            v-model:value="auditForm.auditRemark"
            :rows="3"
            :maxlength="500"
            :placeholder="auditForm.auditStatus === 2 ? t('goods.audit.auditModal.requiredPlaceholder') : t('goods.audit.auditModal.optionalPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 强制下架 -->
    <a-modal
      v-model:open="offOpen"
      :title="t('goods.audit.forceOffshelfModal.title')"
      width="480px"
      :confirm-loading="offSaving"
      :ok-button-props="{ danger: true }"
      @ok="doOff"
    >
      <a-alert type="error" :message="t('goods.audit.forceOffshelfModal.notice')" show-icon style="margin: 16px 0" />
      <a-form :label-col="{ style: { width: '90px' } }">
        <a-form-item :label="t('goods.audit.forceOffshelfModal.reason')" required>
          <a-textarea v-model:value="offRemark" :rows="3" :maxlength="255" :placeholder="t('goods.audit.forceOffshelfModal.inputReason')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped>
:deep(.changed-row > td) {
  background: #fffbe6 !important;
}
</style>
