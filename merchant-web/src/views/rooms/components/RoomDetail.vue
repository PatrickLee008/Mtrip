<template>
  <a-modal :open="true" :width="1100" :footer="null" :title="t('rooms.detail.title')" class="room-detail-modal" @cancel="$emit('close')">
    <a-spin :spinning="loading"><template v-if="detail">
      <div class="detail-actions"><a-tag>{{ reviewLabel(detail.latestRevision?.status ?? 0) }}</a-tag><a-button v-if="detail.latestRevision?.status === 1" v-perm="'mch:rooms:edit'" @click="withdraw">{{ t('rooms.actions.withdraw') }}</a-button><a-button v-else v-perm="'mch:rooms:edit'" type="primary" @click="$emit('edit', detail.room.id, detail.room.property_id)"><EditOutlined />{{ tr('Edit Room', '编辑客房') }}</a-button></div>
      <a-alert v-if="detail.latestRevision?.status === 3" type="error" :message="detail.latestRevision.reject_reason" show-icon />
      <a-alert v-if="detail.latestRevision?.status === 1" :message="t('rooms.detail.pendingTip')" type="info" show-icon />
      <a-tabs v-model:active-key="tab"><a-tab-pane key="effective" :tab="t('rooms.detail.effective')"><RoomSnapshot :room="{ ...detail.room, refund_policy: detail.room.refund_policy?.ruleType ? detail.room.refund_policy : detail.currentRefundPolicy }" /></a-tab-pane><a-tab-pane v-if="detail.latestRevision && detail.latestRevision.status !== 2" key="submitted" :tab="t('rooms.detail.submitted')"><RoomSnapshot :room="detail.latestRevision.payload" /></a-tab-pane><a-tab-pane key="history" :tab="t('rooms.detail.history')"><a-collapse><a-collapse-panel v-for="item in detail.history" :key="item.id" :header="`v${item.version} · ${reviewLabel(item.status)} · ${item.action === 'delete' ? t('rooms.review.deleteRequest') : ''} ${item.submitted_at || ''}`"><p>{{ item.reject_reason || item.review_remark }}</p><RoomSnapshot :room="item.payload" /></a-collapse-panel></a-collapse></a-tab-pane></a-tabs>
    </template><a-result v-else-if="!loading" status="error" :title="tr('Unable to load room', '无法加载房型')"><template #extra><a-button @click="load">{{ tr('Retry', '重试') }}</a-button></template></a-result></a-spin>
  </a-modal>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EditOutlined } from '@ant-design/icons-vue';
import { apiRoomDetail, apiRoomWithdraw, type RoomDetailResult } from '@/api/rooms';
import { useRoomText } from '../presentation';
import RoomSnapshot from './RoomSnapshot.vue';
const props = defineProps<{ id: number; propertyId?: number }>(); const emit = defineEmits<{ close: []; edit: [id: number, propertyId: number]; changed: [] }>();
const { t } = useI18n(); const tr = useRoomText(); const loading = ref(false); const detail = ref<RoomDetailResult>(); const tab = ref('effective');
function reviewLabel(status: number) { return [t('rooms.review.draft'), t('rooms.review.pending'), t('rooms.review.approved'), t('rooms.review.rejected'), t('rooms.review.withdrawn')][status] || '-'; }
async function load() { loading.value = true; try { detail.value = await apiRoomDetail(props.id, props.propertyId); if (!detail.value.room.approved_version) tab.value = 'submitted'; } finally { loading.value = false; } }
async function withdraw() { if (!detail.value?.latestRevision) return; await apiRoomWithdraw(detail.value.latestRevision.id, detail.value.room.property_id); await load(); emit('changed'); }
onMounted(load);
</script>
<style scoped>.detail-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:10px 20px 16px}.detail-actions .ant-tag{margin-right:auto}</style>
