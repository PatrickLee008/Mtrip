<template>
  <PageContainer>
    <a-spin :spinning="loading">
      <template v-if="detail">
        <div class="detail-head"><div><a-button type="text" @click="router.push('/rooms')"><LeftOutlined />{{ t('rooms.title') }}</a-button><h1>{{ detail.room.room_name }}</h1><p>{{ detail.room.goods_name }} · {{ detail.room.room_code || '-' }}</p></div><a-space><a-button v-if="detail.latestRevision?.status === 1" v-perm="'mch:rooms:edit'" @click="withdraw">{{ t('rooms.actions.withdraw') }}</a-button><a-button v-if="detail.latestRevision?.status !== 1" v-perm="'mch:rooms:edit'" type="primary" @click="router.push(`/rooms/${detail.room.id}/edit`)"><EditOutlined />{{ t('common.edit') }}</a-button></a-space></div>
        <a-alert v-if="detail.latestRevision?.status === 3" type="error" show-icon :message="t('rooms.review.rejected')" :description="detail.latestRevision.reject_reason" class="state-alert" />
        <a-alert v-else-if="detail.latestRevision?.status === 1" type="info" show-icon :message="t('rooms.review.pending')" :description="t('rooms.detail.pendingTip')" class="state-alert" />
        <div class="summary-grid"><a-card><a-statistic :title="t('rooms.columns.reviewStatus')" :value="reviewLabel(detail.latestRevision?.status ?? detail.room.review_status)" /></a-card><a-card><a-statistic :title="t('rooms.fields.baseStock')" :value="detail.room.base_stock" /></a-card><a-card><a-statistic :title="t('rooms.fields.basePrice')" :value="Number(detail.room.base_price)" :prefix="detail.room.currency" :precision="2" /></a-card></div>
        <a-tabs v-model:active-key="tab">
          <a-tab-pane key="effective" :tab="t('rooms.detail.effective')"><RoomSnapshot :room="detail.room" /></a-tab-pane>
          <a-tab-pane v-if="detail.latestRevision && detail.latestRevision.status !== 2" key="submitted" :tab="t('rooms.detail.submitted')"><RoomSnapshot :room="detail.latestRevision.payload" /></a-tab-pane>
          <a-tab-pane key="history" :tab="t('rooms.detail.history')"><a-timeline><a-timeline-item v-for="item in detail.history" :key="item.id" :color="timelineColor(item.status)"><strong>v{{ item.version }} · {{ reviewLabel(item.status) }}</strong><p>{{ item.submitted_at || item.reviewed_at || '-' }}</p><p v-if="item.reject_reason" class="reason">{{ item.reject_reason }}</p></a-timeline-item></a-timeline></a-tab-pane>
        </a-tabs>
      </template>
    </a-spin>
  </PageContainer>
</template>

<script setup lang="ts">
import { defineComponent, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { EditOutlined, LeftOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { apiRoomDetail, apiRoomWithdraw, type RoomDetailResult } from '@/api/rooms';

const { t } = useI18n(); const route = useRoute(); const router = useRouter(); const loading = ref(false); const detail = ref<RoomDetailResult>(); const tab = ref('effective');
const RoomSnapshot = defineComponent({ props: { room: { type: Object, required: true } }, setup(props) { return () => h('div', { class: 'snapshot' }, [h('div', { class: 'snapshot-grid' }, [['Room Type', props.room.room_name], ['Bed Type', `${props.room.bed_count || 1} ${props.room.bed_type || ''}`], ['Capacity', `${props.room.max_adults || 0}A ${props.room.max_children || 0}C`], ['Size', `${props.room.area || '-'} sqm`], ['Floor', props.room.floor_name || '-'], ['View', props.room.room_view || '-'], ['Smoking', Number(props.room.smoking) === 1 ? 'Allowed' : 'No Smoking'], ['Price', `${props.room.currency || 'THB'} ${props.room.base_price || 0}`], ['Weekend', `${props.room.currency || 'THB'} ${props.room.weekend_price || 0}`], ['Inventory', props.room.base_stock || 0]].map(([label, value]) => h('div', [h('span', label), h('strong', String(value))]))), h('h3', 'Facilities'), h('div', { class: 'tags' }, (props.room.facilities || []).map((item: string) => h('span', item))), h('h3', 'Media'), h('div', { class: 'photos' }, (props.room.images || []).map((url: string) => h('img', { src: url }))), h('h3', 'Description'), h('p', props.room.description || '-'), h('h3', 'Policies'), h('p', `${props.room.cancellation_policy || '-'} · ${props.room.meal_plan || '-'}`), h('p', props.room.checkin_notes || '-')]); } });
function reviewLabel(status: number) { return [t('rooms.review.draft'), t('rooms.review.pending'), t('rooms.review.approved'), t('rooms.review.rejected'), t('rooms.review.withdrawn')][status] || '-'; } function timelineColor(status: number) { return status === 2 ? 'green' : status === 3 ? 'red' : status === 1 ? 'blue' : 'gray'; }
async function load() { loading.value = true; try { detail.value = await apiRoomDetail(Number(route.params.id)); if (detail.value.latestRevision && detail.value.latestRevision.status !== 2) tab.value = 'submitted'; } finally { loading.value = false; } }
async function withdraw() { if (!detail.value?.latestRevision) return; await apiRoomWithdraw(detail.value.latestRevision.id); message.success(t('rooms.messages.withdrawn')); await load(); }
onMounted(load);
</script>

<style scoped lang="less">
.detail-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.detail-head h1{margin:8px 0 2px;font-size:24px}.detail-head p{margin:0;color:#64748b}.state-alert{margin-bottom:16px}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}:deep(.snapshot){padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}:deep(.snapshot-grid){display:grid;grid-template-columns:repeat(2,1fr);gap:12px}:deep(.snapshot-grid>div){padding:12px;border-radius:8px;background:#f8fafc}:deep(.snapshot-grid span),:deep(.snapshot-grid strong){display:block}:deep(.snapshot-grid span){font-size:11px;color:#64748b}:deep(.snapshot h3){margin:20px 0 8px;font-size:14px}:deep(.tags){display:flex;gap:6px;flex-wrap:wrap}:deep(.tags span){padding:4px 8px;border-radius:6px;background:#eff6ff;color:#1d4ed8}:deep(.photos){display:flex;gap:8px;flex-wrap:wrap}:deep(.photos img){width:120px;height:90px;object-fit:cover;border-radius:8px}.reason{color:#dc2626}@media(max-width:700px){.summary-grid,:deep(.snapshot-grid){grid-template-columns:1fr}.detail-head{display:block}}
</style>
