<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
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
  StarFilled,
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
/** 图标下拉:选中项按稿面只显示图标(居中),下拉列表里再带名称 */
const iconSelectOptions = computed(() => iconOptions.value.map((option) => ({ value: option.key, label: h(iconFor(option.key)) })));
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
        <button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
      </div>
      <template v-if="amenityGroups.some((group) => group.items.length)">
        <div v-for="group in amenityGroups" :key="group.key" class="view-group">
          <h3>{{ group.label }}</h3>
          <div v-if="group.items.length" class="view-grid">
            <article v-for="item in group.items" :key="item.id" class="view-amenity">
              <component :is="iconFor(item.icon)" /><span>{{ item.name }}</span>
              <i class="flags">
                <StarFilled v-if="item.highlighted" class="on" />
                <StarOutlined v-else class="off" />
                <i :class="{ inactive: !item.enabled }" />
              </i>
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
        <button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
      </div>
      <div v-if="tagGroup.items.length" class="tag-grid">
        <article v-for="item in tagGroup.items" :key="item.id" class="tag-card">
          <component :is="iconFor(item.icon)" />
          <div><strong>{{ item.name }}</strong><small>{{ item.description || t('properties.profile.noTagDescription') }}</small></div>
          <i class="flags">
            <StarFilled v-if="item.highlighted" class="on" />
            <StarOutlined v-else class="off" />
            <i :class="{ inactive: !item.enabled }" />
          </i>
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
          <div class="card-identity"><component :is="iconFor(item.icon)" /><strong>{{ item.name }}</strong></div>
          <div class="card-switch"><span>{{ t('properties.profile.amenityStatus') }}</span><a-switch :checked="item.enabled" @change="changeFlag(item, 'enabled', $event)" /></div>
          <div class="card-switch"><span>{{ t('properties.profile.addHighlight') }}</span><a-switch :checked="item.highlighted" :disabled="!item.enabled" @change="changeFlag(item, 'highlighted', $event)" /></div>
        </article>
      </div>
      <p v-else class="empty-row edit-empty">{{ t('properties.profile.noAmenitiesInGroup') }}</p>
    </section>
  </template>

  <a-modal v-model:open="modalOpen" :footer="null" width="980px">
    <template #title><span class="mtrip-modal-title">{{ t(editingId ? 'properties.profile.editAmenity' : 'properties.profile.createAmenity', { category: t(`properties.profile.amenityModalGroups.${amenityForm.category}`) }) }}</span></template>
    <div class="modal-switches">
      <label><span>{{ t('properties.profile.amenityStatus') }}</span><a-switch :checked="amenityForm.enabled" @change="changeModalEnabled" /></label>
      <label><span>{{ t('properties.profile.addHighlight') }}</span><a-switch v-model:checked="amenityForm.highlighted" :disabled="!amenityForm.enabled" /></label>
    </div>
    <a-form layout="vertical" class="amenity-form">
      <a-form-item :label="t('properties.profile.amenityIcon')">
        <a-select v-model:value="amenityForm.icon" class="amenity-icon-select" :options="iconSelectOptions" :dropdown-match-select-width="false">
          <template #option="{ value }"><component :is="iconFor(value)" /> {{ t(`properties.profile.amenityIcons.${value}`) }}</template>
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
.view-group { padding-top: 16px; }.view-group h3 { margin: 0 0 12px; color: rgb(25 26 37 / 50%); font-size: 16px; font-weight: 500; }
.view-grid, .tag-grid, .amenity-edit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }.tag-grid, .tag-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
/* 设施胶囊(Figma EL-802870b8):padding 12x16 / gap 16 / 圆角 32 / 白底 1px #E2E8F0;名称 600/16 主色(字距 .0088em) */
.view-amenity, .tag-card { position: relative; display: flex; align-items: center; gap: 16px; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 32px; background: #fefefe; color: #4d6cf4; font-size: 16px; font-weight: 600; letter-spacing: .0088em; }
.view-amenity > svg, .tag-card > svg { flex: 0 0 auto; }.view-amenity > svg { font-size: 24px; }.view-amenity > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 行尾「星 + 状态点」(Figma EL-235879b0:row gap 8;星 12x12 —— 加亮=实心主色、未加亮=描边灰;点 12x12 绿 #00A63E / 停用红 #EC1317) */
.flags { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; margin-left: auto; }
.flags > .on, .flags > .off { font-size: 12px; }.flags > .on { color: #4d6cf4; }.flags > .off { color: #a5a8b1; }
.flags > i { width: 12px; height: 12px; border-radius: 50%; background: #00a63e; }
.flags > i.inactive { background: #ec1317; }
.tags-panel { margin-top: 18px; }
/* 标签卡(Figma EL-2deb2dc1):padding 16 / gap 16 / 高 84 / 圆角 32 / 白底 1px 边 + 0 1 2 阴影 */
.tag-card { min-height: 84px; border-radius: 32px; box-shadow: 0 1px 2px rgb(0 0 0 / 8%); }
.tag-card > svg { font-size: 40px; opacity: .18; }
.tag-card div { display: grid; flex: 1; gap: 2px; min-width: 0; }
.tag-card strong { overflow: hidden; font-size: 16px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.tag-card small { overflow: hidden; color: rgb(25 26 37 / 50%); font-size: 14px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.empty-row { margin: 14px 0 0; color: #a5a8b1; font-size: 12px; }.edit-empty { padding-bottom: 4px; }
.edit-section-head { padding-bottom: 12px; border-bottom: 1px solid #edf0f4; }.edit-section-head h2 { display: flex; align-items: center; gap: 12px; }.edit-section-head em { color: #c87542; font-size: 11px; font-style: normal; font-weight: 600; }.edit-section-head > div { display: flex; align-items: center; gap: 20px; color: #9699a4; }
/* 编辑卡(Figma 743:4446):与儿童/规则/长住卡同壳 —— 主色 1.5px 描边 / 圆角 8 / padding 0 0 24px / gap 16,
   一屏 3 张并排(gap 16);顶部铅笔左·垃圾桶右;内容行 padding 16 16 24 + 底部 1px 分隔线(图标 20 + 名称 16 居中);
   底部两行「标签 + 开关」,标签 16/600 */
.amenity-edit-grid { margin-top: 16px; }
.amenity-edit-card { display: grid; gap: 16px; padding: 0 0 24px; overflow: hidden; border: 1.5px solid #4d6cf4; border-radius: 8px; background: #fff; }
.amenity-edit-card.muted { border-color: #e1e4ec; }
.card-tools { justify-content: space-between; }
.card-tools button { display: grid; padding: 12px; border: 0; background: transparent; color: #c66e35; cursor: pointer; place-items: center; }
.card-tools button:last-child { color: #ff303f; }
.card-tools :deep(svg) { font-size: 24px; }
.card-identity { display: grid; gap: 8px; padding: 0 16px 24px; border-bottom: 1px solid #e2e8f0; justify-items: center; color: #4d6cf4; text-align: center; }
.card-identity > svg { font-size: 20px; }
.card-identity strong { max-width: 100%; overflow: hidden; font-size: 16px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.card-switch { padding: 0 16px; color: #1b1d30; font-size: 16px; font-weight: 600; }
/* 开关行按稿(Figma 869:12478):Amenity Status 与 Add Highlight **同一行左右分列**,中间 1px 竖分隔 */
.modal-switches { display: flex; gap: 24px; align-items: center; margin: -8px 0 20px; padding: 3px 0 16px; border-bottom: 1px solid #eceef3; }
.modal-switches label { flex: 1; color: #1b1d30; font-size: 16px; font-weight: 600; }
/* 中间那根竖线两侧要各留 24:label 用 space-between 时开关是贴右的,只加 padding-left 会让线紧贴开关(用户截图报的缺陷) */
.modal-switches label + label { padding-left: 24px; border-left: 1px solid #eceef3; }
.amenity-form :deep(.ant-form-item-label > label) { color: #686c78; font-size: 12px; font-weight: 600; }
.amenity-form :deep(.ant-select) { width: 100%; }
/* 图标下拉:稿面是一只 **60 高**的框,选中项**只显示图标**(32px 居中、主色),右侧才是 chevron */
.amenity-form :deep(.ant-input) { height: 44px !important; min-height: 44px !important; border-radius: 8px; }
.amenity-icon-select :deep(.ant-select-selector) {
  display: flex;
  height: 60px !important;
  min-height: 60px !important;
  align-items: center;
  justify-content: center;
  border-color: #e2e8f0 !important;
  border-radius: 8px !important;
  background: #fff !important;
}
.amenity-icon-select :deep(.ant-select-selection-item) { display: flex; align-items: center; justify-content: center; color: #4d6cf4 !important; font-size: 32px !important; line-height: 1 !important; }
.modal-actions { justify-content: flex-end; padding-top: 10px; border-top: 1px solid #eceef3; }
@media (max-width: 900px) { .view-grid, .tag-grid, .amenity-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .view-grid, .tag-grid, .amenity-edit-grid { grid-template-columns: 1fr; }.edit-section-head { align-items: flex-start; flex-direction: column; }.edit-section-head > div { width: 100%; justify-content: space-between; }.modal-switches { gap: 0; align-items: stretch; flex-direction: column; }.modal-switches label + label { padding: 12px 0 0; border-top: 1px solid #eceef3; border-left: 0; } }
</style>
