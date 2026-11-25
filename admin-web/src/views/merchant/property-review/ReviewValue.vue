<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ value: unknown; field: string }>();
const { t, te } = useI18n();
const prefix = 'merchant.propertyReviewPage.';
const entries = computed(() => props.value && typeof props.value === 'object' && !Array.isArray(props.value)
  ? Object.entries(props.value).filter(([key]) => key !== 'id') : []);
const image = computed(() => ['image', 'images', 'url', 'image_gallery'].includes(props.field)
  && typeof props.value === 'string' && /^(?:https?:\/\/|\/[^/])/i.test(props.value) ? props.value : '');

function label(group: string, key: string): string {
  const path = prefix + group + '.' + key;
  return te(path) ? t(path) : key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

const display = computed(() => {
  if (typeof props.value === 'boolean') return t(props.value ? 'common.yes' : 'common.no');
  if (props.value === '' || props.value == null || typeof props.value === 'object') return '—';
  if (props.field === 'discount') return String(props.value) + '%';
  if (['category', 'key', 'units', 'unit', 'travelMode', 'icon'].includes(props.field)) return label('values', String(props.value));
  return String(props.value);
});
</script>

<template>
  <div class="review-value">
    <ul v-if="Array.isArray(value) && value.length">
      <li v-for="(item, index) in value" :key="index"><ReviewValue :value="item" :field="field" /></li>
    </ul>
    <dl v-else-if="entries.length">
      <template v-for="[key, item] in entries" :key="key">
        <dt>{{ label('fields', key) }}</dt>
        <dd><ReviewValue :value="item" :field="key" /></dd>
      </template>
    </dl>
    <a-image v-else-if="image" :src="image" :alt="t(prefix + 'fields.image')" />
    <span v-else>{{ display }}</span>
  </div>
</template>

<style scoped>
.review-value { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
ul { list-style: none; padding: 0; margin: 0; }
li + li { border-top: 1px solid #dbe3ed; padding-top: 6px; margin-top: 6px; }
dl { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); align-items: baseline; gap: 3px 12px; margin: 0; }
dt { color: #64748b; font-size: 12px; }
dd { margin: 0; min-width: 0; }
:deep(.ant-image-img) { max-width: 120px; max-height: 90px; object-fit: contain; border-radius: 4px; }
@media (max-width: 700px) { dl { display: block; } dd + dt { margin-top: 4px; } }
</style>
