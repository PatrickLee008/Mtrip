<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import {
  BgColorsOutlined,
  ClearOutlined,
  CoffeeOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HeartOutlined,
  HomeOutlined,
  PlusOutlined,
  RocketOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined,
  WifiOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { AmenityCategory, PropertyAmenity } from '@/api/properties';

const props = defineProps<{
  modelValue: PropertyAmenity[];
  editing?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: PropertyAmenity[]];
  editRequested: [];
}>();
const { t } = useI18n();

const categoryKeys: AmenityCategory[] = ['essential', 'reception', 'dining', 'tags'];
const iconComponents = {
  wifi: WifiOutlined,
  'air-conditioning': ClearOutlined,
  housekeeping: HomeOutlined,
  pool: BgColorsOutlined,
  spa: HeartOutlined,
  gym: RocketOutlined,
  restaurant: ShopOutlined,
  lounge: CustomerServiceOutlined,
  coffee: CoffeeOutlined,
  location: EnvironmentOutlined,
  breakfast: StarOutlined,
  rooms: TeamOutlined,
  sparkles: CompassOutlined,
};
const iconOptions = computed(() => Object.keys(iconComponents).map((key) => ({
  key,
  label: t(`properties.profile.amenityIcons.${key}`),
})));
const groups = computed(() => categoryKeys.map((key) => ({
  key,
  label: t(`properties.profile.amenityGroups.${key}`),
  items: props.modelValue.filter((item) => item.category === key),
})));
const amenityGroups = computed(() => groups.value.filter((group) => group.key !== 'tags'));
const tagGroup = computed(() => groups.value.find((group) => group.key === 'tags')!);
const modalOpen = ref(false);
const editingId = ref('');
const amenityForm = reactive<PropertyAmenity>(emptyAmenity('essential'));

function emptyAmenity(category: AmenityCategory): PropertyAmenity {
  return { id: '', category, name: '', icon: 'sparkles', description: '', enabled: true, highlighted: true };
}

function iconFor(key: string) {
  return iconComponents[key as keyof typeof iconComponents] || CompassOutlined;
}

function count(group: AmenityCategory, key: 'enabled' | 'highlighted'): number {
  return props.modelValue.filter((item) => item.category === group && item[key]).length;
}

function emitItems(items: PropertyAmenity[]): void {
  emit('update:modelValue', items.map((item) => ({ ...item })));
}

function openCreate(category: AmenityCategory): void {
  editingId.value = '';
  Object.assign(amenityForm, emptyAmenity(category));
  modalOpen.value = true;
}

function openEdit(item: PropertyAmenity): void {
  editingId.value = item.id;
  Object.assign(amenityForm, item);
  modalOpen.value = true;
}

function saveAmenity(): void {
  const name = amenityForm.name.trim();
  if (!name) {
    message.warning(t('properties.profile.amenityNameRequired'));
    return;
  }
  const duplicate = props.modelValue.some((item) => item.id !== editingId.value
    && item.category === amenityForm.category && item.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    message.warning(t('properties.profile.amenityDuplicate'));
    return;
  }
  const current = props.modelValue.find((item) => item.id === editingId.value);
  const existingEnabled = count(amenityForm.category, 'enabled') - (current?.enabled ? 1 : 0);
  const existingHighlighted = count(amenityForm.category, 'highlighted') - (current?.highlighted ? 1 : 0);
  if ((amenityForm.enabled && existingEnabled >= 5) || (amenityForm.highlighted && existingHighlighted >= 5)) {
    message.warning(t('properties.profile.amenityLimitReached'));
    return;
  }
  const item: PropertyAmenity = {
    ...amenityForm,
    id: editingId.value || `amenity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: amenityForm.description.trim(),
    highlighted: amenityForm.enabled && amenityForm.highlighted,
  };
  const items = editingId.value
    ? props.modelValue.map((current) => current.id === editingId.value ? item : current)
    : [...props.modelValue, item];
  emitItems(items);
  modalOpen.value = false;
}

function removeAmenity(item: PropertyAmenity): void {
  emitItems(props.modelValue.filter((current) => current.id !== item.id));
}

function changeFlag(item: PropertyAmenity, key: 'enabled' | 'highlighted', checkedValue: boolean | string | number): void {
  const checked = Boolean(checkedValue);
  if (checked && key === 'highlighted' && !item.enabled) {
    message.warning(t('properties.profile.enableBeforeHighlight'));
    return;
  }
  if (checked && count(item.category, key) >= 5) {
    message.warning(t('properties.profile.amenityLimitReached'));
    return;
  }
  emitItems(props.modelValue.map((current) => current.id === item.id
    ? { ...current, [key]: checked, ...(key === 'enabled' && !checked ? { highlighted: false } : {}) }
    : current));
}

function changeModalEnabled(checkedValue: boolean | string | number): void {
  amenityForm.enabled = Boolean(checkedValue);
  if (!amenityForm.enabled) amenityForm.highlighted = false;
}
</script>

<template>
  <template v-if="!editing">
    <section class="amenities-panel">
      <div class="panel-head">
        <h2>{{ t('properties.profile.amenities') }}</h2>
        <a-button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</a-button>
      </div>
      <template v-if="amenityGroups.some((group) => group.items.length)">
        <div v-for="group in amenityGroups" :key="group.key" class="view-group">
          <h3>{{ group.label }}</h3>
          <div v-if="group.items.length" class="view-grid">
            <article v-for="item in group.items" :key="item.id" class="view-amenity">
              <component :is="iconFor(item.icon)" /><span>{{ item.name }}</span><i :class="{ inactive: !item.enabled }" />
            </article>
          </div>
          <p v-else class="empty-row">{{ t('properties.profile.noAmenitiesInGroup') }}</p>
        </div>
      </template>
      <p v-else class="empty-row">{{ t('properties.profile.noAmenities') }}</p>
    </section>

    <section class="amenities-panel tags-panel">
      <div class="panel-head">
        <h2>{{ tagGroup.label }}</h2>
        <a-button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</a-button>
      </div>
      <div v-if="tagGroup.items.length" class="tag-grid">
        <article v-for="item in tagGroup.items" :key="item.id" class="tag-card">
          <component :is="iconFor(item.icon)" />
          <div><strong>{{ item.name }}</strong><small>{{ item.description || t('properties.profile.noTagDescription') }}</small></div>
          <i :class="{ inactive: !item.enabled }" />
        </article>
      </div>
      <p v-else class="empty-row">{{ t('properties.profile.noHotelTags') }}</p>
    </section>
  </template>

  <template v-else>
    <section v-for="group in groups" :key="group.key" class="amenity-edit-section">
      <div class="edit-section-head">
        <h2>{{ group.label }} <em>{{ t('properties.profile.amenityLimit', { active: count(group.key, 'enabled'), highlight: count(group.key, 'highlighted') }) }}</em></h2>
        <div><a-button type="primary" @click="openCreate(group.key)"><PlusOutlined />{{ t('properties.profile.addNewAmenity') }}</a-button><span>⌄</span></div>
      </div>
      <div v-if="group.items.length" :class="['amenity-edit-grid', { 'tag-edit-grid': group.key === 'tags' }]">
        <article v-for="item in group.items" :key="item.id" :class="['amenity-edit-card', { muted: !item.enabled }]">
          <div class="card-tools"><button type="button" :aria-label="t('common.edit')" @click="openEdit(item)"><EditOutlined /></button><button type="button" :aria-label="t('common.delete')" @click="removeAmenity(item)"><DeleteOutlined /></button></div>
          <div class="card-identity"><component :is="iconFor(item.icon)" /><strong>{{ item.name }}</strong><small v-if="item.description">{{ item.description }}</small></div>
          <div class="card-switch"><span>{{ t('properties.profile.amenityStatus') }}</span><a-switch :checked="item.enabled" @change="changeFlag(item, 'enabled', $event)" /></div>
          <div class="card-switch"><span>{{ t('properties.profile.addHighlight') }}</span><a-switch :checked="item.highlighted" :disabled="!item.enabled" @change="changeFlag(item, 'highlighted', $event)" /></div>
        </article>
      </div>
      <p v-else class="empty-row edit-empty">{{ t('properties.profile.noAmenitiesInGroup') }}</p>
    </section>
  </template>

  <a-modal v-model:open="modalOpen" :title="t(editingId ? 'properties.profile.editAmenity' : 'properties.profile.createAmenity', { category: t(`properties.profile.amenityModalGroups.${amenityForm.category}`) })" :footer="null" width="980px">
    <div class="modal-switches">
      <label><span>{{ t('properties.profile.amenityStatus') }}</span><a-switch :checked="amenityForm.enabled" @change="changeModalEnabled" /></label>
      <label><span>{{ t('properties.profile.addHighlight') }}</span><a-switch v-model:checked="amenityForm.highlighted" :disabled="!amenityForm.enabled" /></label>
    </div>
    <a-form layout="vertical" class="amenity-form">
      <a-form-item :label="t('properties.profile.amenityIcon')">
        <a-select v-model:value="amenityForm.icon">
          <a-select-option v-for="option in iconOptions" :key="option.key" :value="option.key"><component :is="iconFor(option.key)" /> {{ option.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="t('properties.profile.amenityName')" required><a-input v-model:value="amenityForm.name" :maxlength="80" /></a-form-item>
      <a-form-item v-if="amenityForm.category === 'tags'" :label="t('properties.profile.tagDescription')"><a-input v-model:value="amenityForm.description" :maxlength="160" /></a-form-item>
    </a-form>
    <div class="modal-actions"><a-button @click="modalOpen = false">{{ t('common.cancel') }}</a-button><a-button type="primary" @click="saveAmenity">{{ t(editingId ? 'properties.profile.saveAmenity' : 'properties.profile.createNow') }} →</a-button></div>
  </a-modal>
</template>

<style scoped lang="less">
.amenities-panel, .amenity-edit-section { margin-bottom: 16px; padding: 15px 16px; border: 1px solid #e9ebf2; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.panel-head, .edit-section-head, .card-tools, .card-switch, .modal-switches label, .modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.panel-head { min-height: 32px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
.panel-head h2, .edit-section-head h2 { margin: 0; font-size: 14px; line-height: 22px; }
.panel-head :deep(.ant-btn) { border-color: #4d6cf4; color: #4d6cf4; }
.view-group { padding-top: 14px; }.view-group h3 { margin: 0 0 9px; color: #9699a5; font-size: 11px; font-weight: 500; }
.view-grid, .tag-grid, .amenity-edit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 14px; }.tag-grid, .tag-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.view-amenity, .tag-card { position: relative; display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 13px; border: 1px solid #e5e9f2; border-radius: 20px; color: #496fe8; font-size: 13px; font-weight: 600; }
.view-amenity > svg, .tag-card > svg { flex: 0 0 auto; }.view-amenity > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.view-amenity i, .tag-card i { width: 8px; height: 8px; margin-left: auto; border-radius: 50%; background: #16c96b; box-shadow: 0 0 0 3px rgb(22 201 107 / 12%); }.view-amenity i.inactive, .tag-card i.inactive { background: #ff4d5d; box-shadow: 0 0 0 3px rgb(255 77 93 / 10%); }
.tags-panel { margin-top: 18px; }.tag-card { min-height: 54px; border-radius: 10px; }.tag-card > svg { font-size: 23px; opacity: .2; }.tag-card div { display: grid; min-width: 0; }.tag-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.tag-card small { margin-top: 2px; overflow: hidden; color: #a2a5ae; font-size: 10px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.empty-row { margin: 14px 0 0; color: #a5a8b1; font-size: 12px; }.edit-empty { padding-bottom: 4px; }
.edit-section-head { padding-bottom: 12px; border-bottom: 1px solid #edf0f4; }.edit-section-head h2 { display: flex; align-items: center; gap: 12px; }.edit-section-head em { color: #c87542; font-size: 11px; font-style: normal; font-weight: 600; }.edit-section-head > div { display: flex; align-items: center; gap: 20px; color: #9699a4; }
.amenity-edit-grid { padding-top: 14px; }.amenity-edit-card { overflow: hidden; border: 1px solid #4d6cf4; border-radius: 7px; background: #fff; }.amenity-edit-card.muted { border-color: #e1e4ec; }.card-tools { padding: 10px 11px 0; }.card-tools button { padding: 0; border: 0; background: transparent; color: #c66e35; cursor: pointer; }.card-tools button:last-child { color: #ff303f; }
.card-identity { display: grid; min-height: 90px; padding: 3px 15px 14px; place-items: center; align-content: center; color: #456de8; text-align: center; }.card-identity > svg { margin-bottom: 7px; font-size: 28px; }.card-identity strong { max-width: 100%; overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }.card-identity small { max-width: 100%; margin-top: 3px; overflow: hidden; color: #9a9da8; font-size: 10px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.card-switch { min-height: 32px; padding: 0 13px; border-top: 1px solid #eff1f5; color: #454956; font-size: 12px; font-weight: 600; }
.modal-switches { margin: -8px 0 20px; padding: 3px 0 16px; border-bottom: 1px solid #eceef3; }.modal-switches label { flex: 1; color: #414552; font-size: 13px; font-weight: 600; }.modal-switches label + label { padding-left: 20px; border-left: 1px solid #eceef3; }
.amenity-form :deep(.ant-form-item-label > label) { color: #686c78; font-size: 12px; font-weight: 600; }.amenity-form :deep(.ant-select) { width: 100%; }.modal-actions { justify-content: flex-end; padding-top: 10px; border-top: 1px solid #eceef3; }
@media (max-width: 900px) { .view-grid, .tag-grid, .amenity-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .view-grid, .tag-grid, .amenity-edit-grid { grid-template-columns: 1fr; }.edit-section-head { align-items: flex-start; flex-direction: column; }.edit-section-head > div { width: 100%; justify-content: space-between; }.modal-switches { align-items: stretch; flex-direction: column; }.modal-switches label + label { padding: 12px 0 0; border-top: 1px solid #eceef3; border-left: 0; } }
</style>
