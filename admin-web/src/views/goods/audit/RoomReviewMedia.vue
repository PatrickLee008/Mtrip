<template>
  <div class="review-media">
    <a-image-preview-group><a-space wrap><a-image v-for="url in room.images || []" :key="url" :src="url" :width="130" :height="95" style="object-fit:cover" /></a-space></a-image-preview-group>
    <video v-if="room.video_url" :src="room.video_url" controls preload="metadata" />
    <template v-if="room.panorama?.url"><h4>360° · {{ room.panorama.enabled ? tr('Enabled', '已启用') : tr('Disabled', '已关闭') }}</h4><RoomPanorama :src="room.panorama.url" :hint="tr('Drag to look around', '拖动查看全景')" :error-text="tr('Unable to load panorama', '全景加载失败')" /></template>
    <template v-if="room.vr_tour?.url || room.vr_tour?.cover"><h4>{{ tr('External VR · Not connected', '外部 VR · 未接入') }}</h4><p>{{ room.vr_tour.url }}</p><a-image v-if="room.vr_tour.cover" :src="room.vr_tour.cover" :width="240" /></template>
    <template v-if="room.floor_plan?.image"><h4>{{ tr('Floor Plan', '平面图') }} · {{ room.floor_plan.enabled ? tr('Enabled', '已启用') : tr('Disabled', '已关闭') }}</h4><RoomFloorPlan :image="room.floor_plan.image" :hotspots="room.floor_plan.hotspots || []" /></template>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import RoomPanorama from '../../../../../merchant-web/src/views/rooms/components/RoomPanorama.vue';
import RoomFloorPlan from '../../../../../merchant-web/src/views/rooms/components/RoomFloorPlan.vue';
import type { TableRow } from '@/composables/useTable';
defineProps<{ room: TableRow }>();
const { locale } = useI18n(); const tr = (en: string, zh: string) => locale.value.startsWith('zh') ? zh : en;
</script>
<style scoped>.review-media{margin:16px 0}.review-media video{display:block;max-width:100%;max-height:350px;margin:18px 0}.review-media h4{margin-top:24px}.review-media p{overflow-wrap:anywhere}</style>
