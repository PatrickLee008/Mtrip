<template>
  <div>
    <div v-if="image" class="plan" @click="place">
      <img :src="image" :alt="label" draggable="false" />
      <button v-for="(pin, i) in hotspots" :key="pin.id" type="button" :class="['pin', { selected: selected === pin.id }]" :style="{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }" :aria-label="pin.title" @click.stop="select(pin.id)">{{ i + 1 }}</button>
    </div>
    <div v-if="!editing && current" class="pin-detail"><strong>{{ current.title }}</strong><p>{{ current.description }}</p><a-image v-if="current.image" :src="current.image" :width="160" /></div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
const props = defineProps<{ image: string; hotspots: { id: string; x: number; y: number; title: string; description: string; image: string }[]; editing?: boolean; selected?: string; label?: string }>();
const emit = defineEmits<{ position: [x: number, y: number]; select: [id: string] }>();
const active = ref(''); const current = computed(() => props.hotspots.find(p => p.id === active.value));
function select(id: string) { active.value = id; emit('select', id); }
function place(e: MouseEvent) { if (!props.editing) return; const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); emit('position', Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (e.clientY - box.top) / box.height))); }
</script>
<style scoped>
.plan{position:relative;width:100%;line-height:0}.plan>img{display:block;width:100%;height:auto;border-radius:10px}.pin{position:absolute;transform:translate(-50%,-50%);border:3px solid white;border-radius:50%;width:32px;height:32px;background:#4865ed;color:white;box-shadow:0 2px 8px #0004;cursor:pointer}.pin.selected{background:#ef8b23;outline:3px solid #ffce87}.pin-detail{padding:14px;background:#f5f7ff;border-radius:8px;margin-top:10px;line-height:1.6}.pin-detail p{white-space:pre-wrap}
</style>
