<template>
  <PageContainer>
    <div v-if="viewMode === 'list'" class="rooms-page">
      <div class="property-strip">
        <a-select v-model:value="query.goodsId" class="hotel-select" :placeholder="t('rooms.filters.hotel')" allow-clear @change="handleSearch">
          <a-select-option v-for="hotel in hotels" :key="hotel.id" :value="hotel.id">{{ hotel.goods_name }}</a-select-option>
        </a-select>
      </div>

      <div class="merchant-page-header compact">
        <div>
          <p class="eyebrow">{{ t('rooms.eyebrow') }}</p>
          <h1>{{ t('rooms.title') }}</h1>
          <p>{{ t('rooms.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <a-input-search v-model:value="query.keyword" :placeholder="t('rooms.filters.search')" allow-clear class="search-input" @search="handleSearch" />
          <a-select v-model:value="query.status" class="status-select" :placeholder="t('rooms.filters.status')" allow-clear @change="handleSearch">
            <a-select-option :value="1">{{ t('rooms.status.active') }}</a-select-option>
            <a-select-option :value="2">{{ t('rooms.status.inactive') }}</a-select-option>
          </a-select>
          <a-button v-perm="'mch:rooms:add'" type="primary" @click="openCreate"><PlusOutlined />{{ t('rooms.actions.add') }}</a-button>
        </div>
      </div>

      <a-card class="merchant-card room-table-card" :body-style="{ padding: 0 }">
        <a-table row-key="id" :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" @change="handleTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'cover'">
              <div class="room-thumb"><img v-if="record.images?.[0]" :src="record.images[0]" :alt="record.room_name" /><HomeOutlined v-else /></div>
            </template>
            <template v-else-if="column.key === 'room'">
              <div class="room-main"><strong>{{ record.room_name }}</strong><span>{{ record.goods_name }}</span></div>
            </template>
            <template v-else-if="column.key === 'capacity'">{{ t('rooms.capacityShort', { adults: record.max_adults || record.max_guests, children: record.max_children || 0 }) }}</template>
            <template v-else-if="column.key === 'facilities'">
              <div class="facility-tags"><span v-for="item in (record.facilities || []).slice(0, 3)" :key="item">{{ item }}</span><em v-if="(record.facilities || []).length > 3">+{{ record.facilities.length - 3 }}</em></div>
            </template>
            <template v-else-if="column.key === 'available'"><span :class="['stock-left', stockTone(record.today_stock_left ?? record.base_stock)]">{{ record.today_stock_left ?? record.base_stock }}</span></template>
            <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 1 ? 'success' : 'default'">{{ roomStatusLabel(record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'actions'">
              <a-space :size="4">
                <a-button v-perm="'mch:rooms:edit'" size="small" type="text" @click="openEdit(record)"><EditOutlined /></a-button>
                <a-button v-perm="'mch:rooms:status'" size="small" type="text" @click="toggleStatus(record)"><PoweroffOutlined /></a-button>
                <a-popconfirm :title="t('rooms.actions.deleteConfirm')" @confirm="removeRoom(record)"><a-button v-perm="'mch:rooms:delete'" size="small" type="text" danger><DeleteOutlined /></a-button></a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <div v-else class="room-form-page">
      <div class="context-banner"><HomeOutlined /><span>{{ t('rooms.form.hotel') }}</span><strong>{{ selectedHotelName }}</strong></div>
      <div class="form-breadcrumb"><a-button type="text" @click="backToList"><LeftOutlined />{{ t('rooms.title') }}</a-button><RightOutlined /><strong>{{ editingId ? t('rooms.form.editTitle') : t('rooms.form.createTitle') }}</strong></div>
      <div class="merchant-page-header compact"><div><p class="eyebrow">{{ t('rooms.form.eyebrow') }}</p><h1>{{ editingId ? t('rooms.form.editTitle') : t('rooms.form.createTitle') }}</h1><p>{{ t('rooms.form.subtitle', { hotel: selectedHotelName || '-' }) }}</p></div></div>

      <a-form layout="vertical" class="room-form-grid">
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.information') }}</p><div class="two-grid"><a-form-item :label="t('rooms.fields.roomName')" required><a-input v-model:value="form.roomName" :placeholder="t('rooms.placeholders.roomName')" /></a-form-item><a-form-item :label="t('rooms.fields.roomCode')"><a-input v-model:value="form.roomCode" :placeholder="t('rooms.placeholders.roomCode')" /></a-form-item><a-form-item class="span-2" :label="t('rooms.fields.description')"><a-textarea v-model:value="form.description" :rows="4" :placeholder="t('rooms.placeholders.description')" /></a-form-item></div></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.capacity') }}</p><div class="three-grid"><a-form-item :label="t('rooms.fields.maxAdults')" required><a-input-number v-model:value="form.maxAdults" :min="1" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.maxChildren')"><a-input-number v-model:value="form.maxChildren" :min="0" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.maxGuests')"><a-input-number v-model:value="form.maxGuests" :min="1" class="full" /></a-form-item></div></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.configuration') }}</p><div class="three-grid"><a-form-item :label="t('rooms.fields.bedType')" required><a-select v-model:value="form.bedType" :placeholder="t('rooms.placeholders.select')"><a-select-option v-for="item in bedTypes" :key="item" :value="item">{{ item }}</a-select-option></a-select></a-form-item><a-form-item :label="t('rooms.fields.bedCount')"><a-input-number v-model:value="form.bedCount" :min="1" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.area')" required><a-input v-model:value="form.area" :placeholder="t('rooms.placeholders.area')" /></a-form-item><a-form-item :label="t('rooms.fields.floorName')"><a-input v-model:value="form.floorName" :placeholder="t('rooms.placeholders.floor')" /></a-form-item><a-form-item :label="t('rooms.fields.roomView')"><a-select v-model:value="form.roomView" :options="viewOptions" :placeholder="t('rooms.placeholders.select')" allow-clear /></a-form-item><a-form-item :label="t('rooms.fields.smoking')"><a-radio-group v-model:value="form.smoking"><a-radio :value="0">{{ t('rooms.fields.noSmoking') }}</a-radio><a-radio :value="1">{{ t('rooms.fields.smokingAllowed') }}</a-radio></a-radio-group></a-form-item></div></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.facilities') }}</p><p class="card-desc">{{ t('rooms.sections.facilitiesDesc') }}</p><div class="facility-picker"><button v-for="item in facilityOptions" :key="item" type="button" :class="{ active: form.facilities.includes(item) }" @click="toggleFacility(item)"><CheckOutlined v-if="form.facilities.includes(item)" />{{ item }}</button></div><p class="selected-count">{{ t('rooms.form.facilitiesSelected', { count: form.facilities.length }) }}</p></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.media') }}</p><p class="card-desc">{{ t('rooms.sections.mediaDesc') }}</p><div class="media-grid"><div v-for="idx in 10" :key="idx" class="media-slot" :class="{ active: form.images[idx - 1] }"><CameraOutlined /><span>{{ form.images[idx - 1] ? t('rooms.form.photoIndex', { index: idx }) : t('rooms.form.clickToAdd') }}</span></div></div><a-input v-model:value="form.imagesText" class="media-input" :placeholder="t('rooms.placeholders.images')" @blur="syncImages" /><a-input v-model:value="form.videoUrl" class="media-input" :placeholder="t('rooms.placeholders.video')" /></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.pricing') }}</p><div class="two-grid"><a-form-item :label="t('rooms.fields.currency')"><a-select value="THB" disabled><a-select-option value="THB">THB - Thai Baht</a-select-option></a-select></a-form-item><div></div><a-form-item :label="t('rooms.fields.basePrice')" required><a-input-number v-model:value="form.basePrice" :min="0" :precision="2" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.weekendPrice')"><a-input-number v-model:value="form.weekendPrice" :min="0" :precision="2" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.extraBedPrice')"><a-input-number v-model:value="form.extraBedPrice" :min="0" :precision="2" class="full" /></a-form-item></div></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.inventory') }}</p><div class="two-grid"><a-form-item :label="t('rooms.fields.baseStock')" required><a-input-number v-model:value="form.baseStock" :min="0" class="full" /></a-form-item><a-form-item :label="t('rooms.fields.launchStock')"><a-input-number v-model:value="form.launchStock" :min="0" class="full" /></a-form-item></div><div class="workflow"><div v-for="(step, idx) in workflowSteps" :key="step.key" class="workflow-step" :class="{ active: idx === activeWorkflowIndex }"><span>{{ idx + 1 }}</span><strong>{{ step.label }}</strong><em>{{ step.desc }}</em></div></div><div class="info-note"><InfoCircleOutlined />{{ t('rooms.form.workflowTip') }}</div></div>
        <div class="proto-card"><p class="card-title">{{ t('rooms.sections.policies') }}</p><div class="two-grid"><a-form-item :label="t('rooms.fields.cancellationPolicy')"><a-select v-model:value="form.cancellationPolicy" :placeholder="t('rooms.placeholders.select')" allow-clear><a-select-option v-for="item in cancellationPolicies" :key="item" :value="item">{{ item }}</a-select-option></a-select></a-form-item><a-form-item :label="t('rooms.fields.mealPlan')"><a-select v-model:value="form.mealPlan" :placeholder="t('rooms.placeholders.select')" allow-clear><a-select-option v-for="item in mealPlans" :key="item" :value="item">{{ item }}</a-select-option></a-select></a-form-item><a-form-item class="span-2" :label="t('rooms.fields.checkinNotes')"><a-textarea v-model:value="form.checkinNotes" :rows="3" :placeholder="t('rooms.placeholders.checkinNotes')" /></a-form-item></div></div>
      </a-form>

      <div class="sticky-form-footer"><a-button @click="backToList">{{ t('common.cancel') }}</a-button><div><a-button v-perm="editingId ? 'mch:rooms:edit' : 'mch:rooms:add'" :loading="saving" @click="saveRoom(0)"><FileTextOutlined />{{ t('rooms.actions.saveDraft') }}</a-button><a-button v-perm="editingId ? 'mch:rooms:edit' : 'mch:rooms:add'" type="primary" :loading="saving" @click="saveRoom(1)">{{ t('rooms.actions.submitReview') }}<ArrowRightOutlined /></a-button></div></div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { ArrowRightOutlined, CameraOutlined, CheckOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, HomeOutlined, InfoCircleOutlined, LeftOutlined, PlusOutlined, PoweroffOutlined, RightOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { apiRoomDelete, apiRoomDetail, apiRoomHotels, apiRoomList, apiRoomSave, apiRoomToggleStatus, type MerchantRoom, type RoomHotelOption } from '@/api/rooms';

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const viewMode = ref<'list' | 'form'>('list');
const editingId = ref(0);
const hotels = ref<RoomHotelOption[]>([]);
const list = ref<MerchantRoom[]>([]);
const query = reactive({ page: 1, pageSize: 20, goodsId: undefined as number | undefined, keyword: '', status: undefined as number | undefined });
const pagination = reactive<TablePaginationConfig>({ current: 1, pageSize: 20, total: 0, showSizeChanger: true });

const emptyForm = () => ({ goodsId: undefined as number | undefined, roomName: '', roomCode: '', description: '', bedType: '', bedCount: 1, area: '', maxAdults: 2, maxChildren: 0, maxGuests: 2, floorName: '', roomView: undefined as string | undefined, smoking: 0, breakfast: 0, mealPlan: undefined as string | undefined, cancellationPolicy: undefined as string | undefined, checkinNotes: '', basePrice: 0, weekendPrice: 0, extraBedPrice: 0, baseStock: 0, launchStock: 0, images: [] as string[], imagesText: '', videoUrl: '', facilities: ['WiFi', 'Air Conditioning', 'TV'], status: 1, sort: 0 });
const form = reactive(emptyForm());

const columns = computed(() => [
  { title: '', key: 'cover', width: 78 },
  { title: t('rooms.columns.roomType'), key: 'room', width: 240 },
  { title: t('rooms.columns.bedType'), dataIndex: 'bed_type', width: 150 },
  { title: t('rooms.columns.capacity'), key: 'capacity', width: 110 },
  { title: t('rooms.columns.size'), dataIndex: 'area', width: 90 },
  { title: t('rooms.columns.facilities'), key: 'facilities', minWidth: 180 },
  { title: t('rooms.columns.total'), dataIndex: 'base_stock', width: 80 },
  { title: t('rooms.columns.available'), key: 'available', width: 90 },
  { title: t('common.status'), key: 'status', width: 100 },
  { title: t('common.operation'), key: 'actions', width: 130, fixed: 'right' as const },
]);

const bedTypes = computed(() => ['1 King Bed', '1 Queen Bed', '2 Single Beds', '1 King + Sofa Bed', '2 Double Beds', 'Bunk Beds']);
const facilityOptions = computed(() => ['WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Safe', 'Balcony', 'Bathtub', 'Kitchenette', 'Pool Access', 'Coffee Machine', 'Hair Dryer', 'Blackout Curtains']);
const mealPlans = computed(() => [t('rooms.meal.roomOnly'), t('rooms.meal.breakfast'), t('rooms.meal.halfBoard'), t('rooms.meal.fullBoard'), t('rooms.meal.allInclusive')]);
const cancellationPolicies = computed(() => [t('rooms.cancelPolicy.free48'), t('rooms.cancelPolicy.nonRefundable'), t('rooms.cancelPolicy.free7'), t('rooms.cancelPolicy.flexible')]);
const viewOptions = computed(() => ['Ocean View', 'City View', 'Garden View', 'Pool View', 'Mountain View', 'No Specific View'].map((value) => ({ label: value, value })));
const workflowSteps = computed(() => [{ key: 'draft', label: t('rooms.workflow.draft'), desc: t('rooms.workflow.draftDesc') }, { key: 'review', label: t('rooms.workflow.review'), desc: t('rooms.workflow.reviewDesc') }, { key: 'published', label: t('rooms.workflow.published'), desc: t('rooms.workflow.publishedDesc') }]);
const activeWorkflowIndex = computed(() => editingId.value ? 1 : 0);
const selectedHotelName = computed(() => hotels.value.find((item) => item.id === form.goodsId)?.goods_name || hotels.value.find((item) => item.id === query.goodsId)?.goods_name || '');

function roomStatusLabel(status: number) { return status === 1 ? t('rooms.status.active') : t('rooms.status.inactive'); }
function stockTone(value: number) { return value === 0 ? 'danger' : value <= 2 ? 'warning' : 'success'; }
function toggleFacility(item: string) { const idx = form.facilities.indexOf(item); idx >= 0 ? form.facilities.splice(idx, 1) : form.facilities.push(item); }
function syncImages() { form.images = form.imagesText.split('\n').map((item) => item.trim()).filter(Boolean); }

async function loadHotels() { hotels.value = await apiRoomHotels(); if (!query.goodsId && hotels.value.length > 0) query.goodsId = hotels.value[0].id; }
async function loadList() { loading.value = true; try { const data = await apiRoomList({ ...query }); list.value = data.list; pagination.current = data.page; pagination.pageSize = data.pageSize; pagination.total = data.total; } finally { loading.value = false; } }
function handleSearch() { query.page = 1; void loadList(); }
function handleTableChange(page: TablePaginationConfig) { query.page = Number(page.current || 1); query.pageSize = Number(page.pageSize || 20); void loadList(); }

function assignForm(row?: Partial<MerchantRoom>) { Object.assign(form, emptyForm()); form.goodsId = row?.goods_id || query.goodsId || hotels.value[0]?.id; if (!row) return; Object.assign(form, { roomName: row.room_name || '', roomCode: row.room_code || '', description: row.description || '', bedType: row.bed_type || '', bedCount: row.bed_count || 1, area: row.area || '', maxAdults: row.max_adults || row.max_guests || 2, maxChildren: row.max_children || 0, maxGuests: row.max_guests || 2, floorName: row.floor_name || '', roomView: row.room_view || undefined, smoking: row.smoking || 0, breakfast: row.breakfast || 0, mealPlan: row.meal_plan || undefined, cancellationPolicy: row.cancellation_policy || undefined, checkinNotes: row.checkin_notes || '', basePrice: Number(row.base_price || 0), weekendPrice: Number(row.weekend_price || 0), extraBedPrice: Number(row.extra_bed_price || 0), baseStock: row.base_stock || 0, launchStock: row.launch_stock || 0, images: row.images || [], imagesText: (row.images || []).join('\n'), videoUrl: row.video_url || '', facilities: row.facilities || [], status: row.status || 1, sort: row.sort || 0 }); }
function openCreate() { editingId.value = 0; assignForm(); viewMode.value = 'form'; }
async function openEdit(row: MerchantRoom) { editingId.value = row.id; const detail = await apiRoomDetail(row.id); assignForm(detail); viewMode.value = 'form'; }
function backToList() { viewMode.value = 'list'; }

async function saveRoom(publishStatus: number) { syncImages(); if (!form.goodsId || !form.roomName || !form.bedType || !form.area) { message.warning(t('rooms.form.requiredTip')); return; } saving.value = true; try { await apiRoomSave({ id: editingId.value || undefined, ...form, publishStatus }); message.success(t('common.saveSuccess')); viewMode.value = 'list'; await loadList(); } finally { saving.value = false; } }
async function toggleStatus(row: MerchantRoom) { await apiRoomToggleStatus(row.id); message.success(t('common.opSuccess')); await loadList(); }
async function removeRoom(row: MerchantRoom) { await apiRoomDelete(row.id); message.success(t('common.opSuccess')); await loadList(); }

onMounted(async () => { await loadHotels(); await loadList(); });
</script>

<style scoped lang="less">
.rooms-page, .room-form-page { color: #0f172a; }
.property-strip { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.hotel-select { min-width: 260px; }
.merchant-page-header.compact { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.merchant-page-header h1 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; }
.merchant-page-header p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
.eyebrow { margin: 0 0 4px !important; font-size: 11px !important; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8 !important; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.search-input { width: 220px; } .status-select { width: 150px; }
.room-table-card { overflow: hidden; }
.room-thumb { width: 48px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #64748b; background: linear-gradient(135deg, #f1f5f9, #e2e8f0); }
.room-thumb img { width: 100%; height: 100%; object-fit: cover; }
.room-main strong { display: block; color: #0f172a; font-size: 13px; } .room-main span { display: block; margin-top: 3px; color: #94a3b8; font-size: 11px; }
.facility-tags { display: flex; flex-wrap: wrap; gap: 4px; max-width: 180px; } .facility-tags span { padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; font-size: 10px; } .facility-tags em { color: #94a3b8; font-style: normal; font-size: 10px; }
.stock-left { font-weight: 800; } .stock-left.success { color: #059669; } .stock-left.warning { color: #d97706; } .stock-left.danger { color: #dc2626; }
.context-banner { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f1f5f9; color: #64748b; font-size: 12px; } .context-banner strong { color: #0f172a; }
.form-breadcrumb { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: #cbd5e1; } .form-breadcrumb strong { color: #0f172a; font-size: 14px; }
.room-form-grid { display: flex; flex-direction: column; gap: 20px; padding-bottom: 88px; }
.proto-card { padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.card-title { margin: 0 0 16px; color: #0f172a; font-size: 13px; font-weight: 800; } .card-desc { margin: -8px 0 16px; color: #64748b; font-size: 12px; }
.two-grid, .three-grid { display: grid; gap: 20px; } .two-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .three-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .span-2 { grid-column: span 2; } .full { width: 100%; }
.facility-picker { display: flex; flex-wrap: wrap; gap: 8px; } .facility-picker button { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 12px; background: #fff; color: #64748b; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .18s ease; } .facility-picker button.active { background: #2563eb; border-color: #2563eb; color: #fff; }
.selected-count { margin: 12px 0 0; color: #94a3b8; font-size: 11px; }
.media-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; } .media-slot { aspect-ratio: 1; border: 2px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #94a3b8; font-size: 9px; } .media-slot.active { border-color: #60a5fa; background: #eff6ff; color: #2563eb; } .media-input { margin-top: 12px; }
.workflow { display: flex; gap: 0; padding-top: 18px; margin-top: 12px; border-top: 1px solid #f1f5f9; } .workflow-step { flex: 1; position: relative; text-align: center; color: #94a3b8; } .workflow-step:not(:last-child)::after { content: ''; position: absolute; top: 14px; left: calc(50% + 18px); right: calc(-50% + 18px); height: 2px; background: #e2e8f0; } .workflow-step span { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 2px solid #e2e8f0; border-radius: 50%; background: #fff; font-size: 10px; font-weight: 800; } .workflow-step.active span { border-color: #2563eb; background: #2563eb; color: #fff; } .workflow-step strong { display: block; margin-top: 6px; font-size: 10.5px; } .workflow-step em { display: block; max-width: 140px; margin: 3px auto 0; font-size: 9.5px; font-style: normal; line-height: 1.25; }
.info-note { display: flex; gap: 8px; margin-top: 16px; padding: 10px 12px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; }
.sticky-form-footer { position: fixed; left: 228px; right: 0; bottom: 0; z-index: 20; display: flex; justify-content: space-between; align-items: center; padding: 12px 28px; border-top: 1px solid #e2e8f0; background: #fff; } .sticky-form-footer div { display: flex; gap: 8px; }
@media (max-width: 900px) { .merchant-page-header.compact { flex-direction: column; } .header-actions, .search-input, .status-select { width: 100%; } .two-grid, .three-grid, .media-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } .sticky-form-footer { left: 0; } }
</style>
