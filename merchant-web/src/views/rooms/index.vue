<template>
  <PageContainer>
    <div class="property-strip"><a-select v-model:value="query.goodsId" class="hotel-select" :placeholder="t('rooms.filters.hotel')" allow-clear @change="search"><a-select-option v-for="hotel in hotels" :key="hotel.id" :value="hotel.id">{{ hotel.goods_name }}</a-select-option></a-select></div>
    <div class="merchant-page-header compact">
      <div><p class="eyebrow">{{ t('rooms.eyebrow') }}</p><h1>{{ t('rooms.title') }}</h1><p>{{ t('rooms.subtitle') }}</p></div>
      <div class="header-actions">
        <a-input-search v-model:value="query.keyword" :placeholder="t('rooms.filters.search')" allow-clear class="search-input" @search="search" />
        <a-select v-model:value="query.reviewStatus" class="status-select" :placeholder="t('rooms.filters.reviewStatus')" allow-clear @change="search"><a-select-option :value="0">{{ t('rooms.review.draft') }}</a-select-option><a-select-option :value="1">{{ t('rooms.review.pending') }}</a-select-option><a-select-option :value="2">{{ t('rooms.review.approved') }}</a-select-option><a-select-option :value="3">{{ t('rooms.review.rejected') }}</a-select-option></a-select>
        <a-button v-perm="'mch:rooms:add'" type="primary" @click="createRoom"><PlusOutlined />{{ t('rooms.actions.add') }}</a-button>
      </div>
    </div>
    <a-card class="merchant-card room-table-card" :body-style="{ padding: 0 }">
      <a-table row-key="id" :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" :custom-row="rowEvents" @change="changePage">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'cover'"><div class="room-thumb"><img v-if="record.images?.[0]" :src="record.images[0]" :alt="record.room_name" /><HomeOutlined v-else /></div></template>
          <template v-else-if="column.key === 'room'"><div class="room-main"><strong>{{ record.room_name }}</strong><span>{{ record.room_code || record.goods_name }}</span><small v-if="record.reject_reason">{{ record.reject_reason }}</small></div></template>
          <template v-else-if="column.key === 'capacity'">{{ t('rooms.capacityShort', { adults: record.max_adults, children: record.max_children }) }}</template>
          <template v-else-if="column.key === 'facilities'"><div class="facility-tags"><span v-for="item in record.facilities.slice(0, 3)" :key="item">{{ item }}</span><em v-if="record.facilities.length > 3">+{{ record.facilities.length - 3 }}</em></div></template>
          <template v-else-if="column.key === 'available'"><span :class="['stock-left', stockTone(record.today_stock_left ?? record.base_stock)]">{{ record.today_stock_left ?? record.base_stock }}</span></template>
          <template v-else-if="column.key === 'review'"><a-tag :color="reviewMeta(record.review_status).color">{{ reviewMeta(record.review_status).label }}</a-tag><div v-if="record.revision_action === 'delete'" class="delete-review">{{ t('rooms.review.deleteRequest') }}</div></template>
          <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('rooms.status.active') : t('rooms.status.inactive') }}</a-tag></template>
          <template v-else-if="column.key === 'actions'"><a-space :size="2" @click.stop><a-button size="small" type="text" @click="viewRoom(record)"><EyeOutlined /></a-button><a-button v-if="record.review_status !== 1" v-perm="'mch:rooms:edit'" size="small" type="text" @click="editRoom(record)"><EditOutlined /></a-button><a-button v-perm="'mch:rooms:add'" size="small" type="text" @click="copyRoom(record)"><CopyOutlined /></a-button><a-button v-if="record.approved_version > 0" v-perm="'mch:rooms:status'" size="small" type="text" @click="toggleRoom(record)"><PoweroffOutlined /></a-button><a-popconfirm :title="t('rooms.actions.deleteConfirm')" @confirm="removeRoom(record)"><a-button v-perm="'mch:rooms:delete'" size="small" type="text" danger><DeleteOutlined /></a-button></a-popconfirm></a-space></template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, HomeOutlined, PlusOutlined, PoweroffOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { apiRoomCopy, apiRoomDelete, apiRoomHotels, apiRoomList, apiRoomToggleStatus, type MerchantRoom, type RoomHotelOption } from '@/api/rooms';

const { t } = useI18n(); const router = useRouter(); const loading = ref(false); const hotels = ref<RoomHotelOption[]>([]); const list = ref<MerchantRoom[]>([]);
const query = reactive({ page: 1, pageSize: 20, goodsId: undefined as number | undefined, keyword: '', reviewStatus: undefined as number | undefined });
const pagination = reactive<TablePaginationConfig>({ current: 1, pageSize: 20, total: 0, showSizeChanger: true });
const columns = computed(() => [{ title: '', key: 'cover', width: 70 }, { title: t('rooms.columns.roomType'), key: 'room', width: 220 }, { title: t('rooms.columns.bedType'), dataIndex: 'bed_type', width: 145 }, { title: t('rooms.columns.capacity'), key: 'capacity', width: 100 }, { title: t('rooms.columns.size'), dataIndex: 'area', width: 80 }, { title: t('rooms.columns.facilities'), key: 'facilities', minWidth: 180 }, { title: t('rooms.columns.total'), dataIndex: 'base_stock', width: 70 }, { title: t('rooms.columns.available'), key: 'available', width: 75 }, { title: t('rooms.columns.reviewStatus'), key: 'review', width: 120 }, { title: t('rooms.columns.saleStatus'), key: 'status', width: 90 }, { title: t('common.operation'), key: 'actions', width: 190, fixed: 'right' as const }]);
function reviewMeta(status: number) { const map = [{ label: t('rooms.review.draft'), color: 'default' }, { label: t('rooms.review.pending'), color: 'processing' }, { label: t('rooms.review.approved'), color: 'success' }, { label: t('rooms.review.rejected'), color: 'error' }]; return map[status] || map[0]; }
function stockTone(value: number) { return value === 0 ? 'danger' : value <= 2 ? 'warning' : 'success'; }
async function loadHotels() { hotels.value = await apiRoomHotels(); if (!query.goodsId && hotels.value.length) query.goodsId = hotels.value[0].id; }
async function loadList() { loading.value = true; try { const data = await apiRoomList({ ...query }); list.value = data.list; Object.assign(pagination, { current: data.page, pageSize: data.pageSize, total: data.total }); } finally { loading.value = false; } }
function search() { query.page = 1; void loadList(); } function changePage(page: TablePaginationConfig) { query.page = Number(page.current || 1); query.pageSize = Number(page.pageSize || 20); void loadList(); }
function createRoom() { void router.push({ path: '/rooms/create', query: query.goodsId ? { goodsId: String(query.goodsId) } : {} }); } function viewRoom(row: MerchantRoom) { void router.push(`/rooms/${row.id}`); } function editRoom(row: MerchantRoom) { void router.push(`/rooms/${row.id}/edit`); } function rowEvents(row: MerchantRoom) { return { onClick: () => viewRoom(row) }; }
async function copyRoom(row: MerchantRoom) { const result = await apiRoomCopy(row.id); message.success(t('rooms.messages.copied')); await router.push(`/rooms/${result.id}/edit`); } async function toggleRoom(row: MerchantRoom) { await apiRoomToggleStatus(row.id); message.success(t('common.opSuccess')); await loadList(); } async function removeRoom(row: MerchantRoom) { const result = await apiRoomDelete(row.id); message.success(result.reviewRequired ? t('rooms.messages.deleteSubmitted') : t('rooms.messages.deleted')); await loadList(); }
onMounted(async () => { await loadHotels(); await loadList(); });
</script>

<style scoped lang="less">
.property-strip{margin-bottom:16px}.hotel-select{min-width:280px}.merchant-page-header.compact{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.merchant-page-header h1{margin:0;font-size:20px;font-weight:800;color:#0f172a}.merchant-page-header p{margin:3px 0 0;color:#64748b;font-size:13px}.eyebrow{font-size:11px!important;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8!important}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.search-input{width:220px}.status-select{width:160px}.room-table-card{overflow:hidden}.room-thumb{width:48px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#eef2f7;color:#64748b}.room-thumb img{width:100%;height:100%;object-fit:cover}.room-main strong,.room-main span,.room-main small{display:block}.room-main strong{color:#0f172a}.room-main span{font-size:11px;color:#94a3b8;margin-top:2px}.room-main small{font-size:11px;color:#dc2626;margin-top:3px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.facility-tags{display:flex;gap:4px;flex-wrap:wrap}.facility-tags span,.facility-tags em{padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#64748b;font-size:11px;font-style:normal}.stock-left.success{color:#16a34a}.stock-left.warning{color:#d97706}.stock-left.danger{color:#dc2626}.delete-review{font-size:10px;color:#dc2626;margin-top:3px}:deep(.ant-table-tbody>tr){cursor:pointer}@media(max-width:900px){.merchant-page-header.compact{display:block}.header-actions{margin-top:12px}.search-input{width:100%}}
</style>
