<script setup lang="ts">
/**
 * 酒店资料 · Nearby Attraction 页签(视图 + 编辑态)
 *
 * 设计源:Figma `696:4914`(视图卡)/ 弹窗 `772:6252`(Edit)/ `814:13351`(Create)
 * 规格落档:.figma-cache/696-6334.md
 *
 * 一张卡 = 一张图片 + 若干「地点」(`stops`):图片顶部有 50% 黑色渐变蒙层、左上角是绿色状态圆点;
 * 卡面每个地点一行(36 圆形图标 + 名称 + 路程),地点之间用竖直虚线相连(机场 → 景点 这类行程写法);
 * 底部是整宽的 `Edit Details` 按钮。弹窗里每个地点是一组 `Mark N` 字段,底部可 `Add More`。
 */
import { reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  BankOutlined,
  BgColorsOutlined,
  CoffeeOutlined,
  CompassOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  PlusOutlined,
  RocketOutlined,
  ShoppingOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { apiPropertyProfileImageUpload, type NearbyAttraction, type NearbyStop } from '@/api/properties';

const CARD_LIMIT = 20;
const STOP_LIMIT = 8;

const locationIcons = {
  location: EnvironmentOutlined,
  landmark: BankOutlined,
  temple: HomeOutlined,
  restaurant: CoffeeOutlined,
  shopping: ShoppingOutlined,
  beach: CompassOutlined,
  airport: RocketOutlined,
  park: BgColorsOutlined,
};
const iconOptions = Object.keys(locationIcons);
const modeOptions = ['drive', 'walk', 'bicycle', 'taxi', 'boat', 'train'];

const props = defineProps<{
  modelValue: NearbyAttraction[];
  propertyId: number;
  editing?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: NearbyAttraction[]];
  editRequested: [];
}>();
const { t } = useI18n();

const modalOpen = ref(false);
const editingId = ref('');
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
const form = reactive<NearbyAttraction>(emptyCard());
/** 视图态点「Add New / Edit Details」时先切到编辑态,切完再自动把弹窗打开 */
const pending = ref<{ type: 'create' } | { type: 'edit'; id: string } | null>(null);

function emptyStop(): NearbyStop {
  return { id: '', icon: 'temple', name: '', travelTime: '', travelMode: 'drive', distance: '' };
}

function emptyCard(): NearbyAttraction {
  return { id: '', image: '', status: true, stops: [emptyStop()] };
}

function iconFor(key: string) {
  return locationIcons[key as keyof typeof locationIcons] || EnvironmentOutlined;
}

function emitItems(items: NearbyAttraction[]): void {
  emit('update:modelValue', items.map((item) => ({ ...item, stops: item.stops.map((stop) => ({ ...stop })) })));
}

function openCreate(): void {
  if (!props.editing) { pending.value = { type: 'create' }; emit('editRequested'); return; }
  startCreate();
}

function startCreate(): void {
  if (props.modelValue.length >= CARD_LIMIT) {
    message.warning(t('properties.profile.nearbyTab.limitReached', { limit: CARD_LIMIT }));
    return;
  }
  editingId.value = '';
  Object.assign(form, emptyCard());
  modalOpen.value = true;
}

function openCard(card: NearbyAttraction): void {
  if (!props.editing) { pending.value = { type: 'edit', id: card.id }; emit('editRequested'); return; }
  editingId.value = card.id;
  Object.assign(form, {
    id: card.id, image: card.image, status: card.status,
    stops: (card.stops.length ? card.stops : [emptyStop()]).map((stop) => ({ ...stop })),
  });
  modalOpen.value = true;
}

watch(() => props.editing, (value) => {
  if (!value || !pending.value) return;
  const action = pending.value;
  pending.value = null;
  if (action.type === 'create') { startCreate(); return; }
  const card = props.modelValue.find((item) => item.id === action.id);
  if (card) openCard(card);
});

function addStop(): void {
  if (form.stops.length >= STOP_LIMIT) {
    message.warning(t('properties.profile.nearbyTab.stopLimitReached', { limit: STOP_LIMIT }));
    return;
  }
  form.stops.push({ ...emptyStop(), id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
}

function removeStop(index: number): void {
  form.stops.splice(index, 1);
}

function chooseImage(): void {
  fileInput.value?.click();
}

async function uploadImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    message.warning(t('properties.profile.invalidImage'));
    return;
  }
  uploading.value = true;
  try {
    const uploaded = await apiPropertyProfileImageUpload(props.propertyId, file);
    form.image = uploaded.url;
  } finally {
    uploading.value = false;
  }
}

function save(): void {
  const stops = form.stops
    .map((stop, index) => ({
      ...stop,
      id: stop.id || `stop-${Date.now()}-${index}`,
      name: stop.name.trim(),
      travelTime: stop.travelTime.trim(),
      distance: stop.distance.trim(),
    }))
    .filter((stop) => stop.name || stop.distance);
  if (!stops.length) {
    message.warning(t('properties.profile.nearbyTab.nameRequired'));
    return;
  }
  const card: NearbyAttraction = {
    id: editingId.value || `nby-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    image: form.image,
    status: form.status,
    stops,
  };
  emitItems(editingId.value
    ? props.modelValue.map((current) => current.id === editingId.value ? card : current)
    : [...props.modelValue, card]);
  modalOpen.value = false;
}

function removeCard(): void {
  if (!editingId.value) { modalOpen.value = false; return; }
  emitItems(props.modelValue.filter((item) => item.id !== editingId.value));
  modalOpen.value = false;
}

/** 卡面上的「20 mins drive (12 km)」 */
function summary(stop: NearbyStop): string {
  const time = stop.travelTime ? `${stop.travelTime} ${t(`properties.profile.nearbyTab.modes.${stop.travelMode}`)}` : '';
  const distance = stop.distance ? `(${stop.distance})` : '';
  return [time, distance].filter(Boolean).join(' ') || t('properties.profile.notProvided');
}
</script>

<template>
  <section class="nb-panel">
    <div class="panel-head">
      <h2>{{ t('properties.profile.nearby') }}</h2>
      <!-- 视图态且没有数据时给「编辑」(与其它页签同款,先切编辑态);
           编辑态一律是「Add New」—— 否则空列表进编辑态后又渲染回「编辑」,就没有新增入口了 -->
      <button v-if="!editing && !modelValue.length" v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
      <a-button v-else v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" @click="openCreate"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button>
    </div>
    <div v-if="modelValue.length" class="nb-grid">
      <article v-for="card in modelValue" :key="card.id" :class="['nb-card', { inactive: !card.status }]">
        <div class="nb-media">
          <img v-if="card.image" :src="card.image" :alt="card.stops[0]?.name || t('properties.profile.nearby')" />
          <div v-else class="nb-media-empty"><component :is="iconFor(card.stops[0]?.icon || 'location')" /></div>
          <i class="nb-scrim" />
          <i class="nb-dot" />
        </div>
        <div class="nb-body">
          <div class="nb-stops">
            <div v-for="(stop, index) in card.stops" :key="stop.id" class="nb-stop">
              <i v-if="index > 0" class="nb-connector" />
              <span class="nb-stop-icon"><component :is="iconFor(stop.icon)" /></span>
              <div class="nb-stop-text">
                <strong>{{ stop.name || t('properties.profile.notProvided') }}</strong>
                <small>{{ summary(stop) }}</small>
              </div>
            </div>
          </div>
          <button type="button" class="nb-edit-details" @click="openCard(card)"><EditOutlined />{{ t('properties.profile.nearbyTab.editDetails') }}</button>
        </div>
      </article>
    </div>
    <p v-else class="empty-row">{{ t('properties.profile.nearbyTab.empty') }}</p>
  </section>

  <a-modal v-model:open="modalOpen" :title="t(editingId ? 'properties.profile.nearbyTab.editTitle' : 'properties.profile.nearbyTab.createTitle')" :footer="null" width="980px">
    <div class="modal-switches">
      <label><span>{{ t('properties.profile.nearbyTab.status') }}</span><a-switch v-model:checked="form.status" /></label>
    </div>
    <div class="nb-upload">
      <input ref="fileInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="uploadImage" />
      <div v-if="form.image" class="nb-upload-preview">
        <img :src="form.image" :alt="t('properties.profile.nearby')" />
        <button type="button" :aria-label="t('common.delete')" @click="form.image = ''"><DeleteOutlined /></button>
      </div>
      <button v-else type="button" class="nb-upload-empty" :disabled="uploading" @click="chooseImage">
        <PlusOutlined /><span>{{ t('properties.profile.nearbyTab.chooseImage') }}</span><small>{{ t('properties.profile.uploadHint') }}</small>
      </button>
    </div>
    <section v-for="(stop, index) in form.stops" :key="stop.id || index" class="nb-stop-form">
      <div class="nb-stop-form-head">
        <span>{{ t('properties.profile.nearbyTab.mark', { index: index + 1 }) }}</span>
        <a-button v-if="form.stops.length > 1" type="text" danger :aria-label="t('common.delete')" @click="removeStop(index)"><DeleteOutlined /></a-button>
      </div>
      <a-form layout="vertical" class="nb-form-grid">
        <a-form-item :label="t('properties.profile.nearbyTab.locationIcon')">
          <a-select v-model:value="stop.icon" :dropdown-match-select-width="false">
            <a-select-option v-for="icon in iconOptions" :key="icon" :value="icon"><component :is="iconFor(icon)" /> {{ t(`properties.profile.nearbyTab.icons.${icon}`) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('properties.profile.nearbyTab.locationName')" required><a-input v-model:value="stop.name" :maxlength="80" /></a-form-item>
        <a-form-item :label="t('properties.profile.nearbyTab.travelTime')"><a-input v-model:value="stop.travelTime" :maxlength="40" :placeholder="t('properties.profile.nearbyTab.travelTimeHint')" /></a-form-item>
        <a-form-item :label="t('properties.profile.nearbyTab.travelMode')">
          <a-select v-model:value="stop.travelMode" :dropdown-match-select-width="false">
            <a-select-option v-for="mode in modeOptions" :key="mode" :value="mode">{{ t(`properties.profile.nearbyTab.modes.${mode}`) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('properties.profile.nearbyTab.distance')"><a-input v-model:value="stop.distance" :maxlength="40" :placeholder="t('properties.profile.nearbyTab.distanceHint')" /></a-form-item>
      </a-form>
    </section>
    <div class="nb-modal-actions">
      <a-button type="dashed" @click="addStop"><PlusOutlined />{{ t('properties.profile.nearbyTab.addMore') }}</a-button>
      <span class="nb-modal-actions-right">
        <a-button v-if="editingId" danger type="text" @click="removeCard"><DeleteOutlined />{{ t('common.delete') }}</a-button>
        <a-button @click="modalOpen = false">{{ t('common.cancel') }}</a-button>
        <a-button type="primary" @click="save">{{ t('common.save') }}</a-button>
      </span>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.nb-panel { margin-bottom: 16px; padding: 15px 16px; border: 1px solid #e9ebf2; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.panel-head, .nb-stop, .nb-edit-details, .modal-switches label, .nb-modal-actions, .nb-modal-actions-right, .nb-stop-form-head { display: flex; align-items: center; }
.panel-head { min-height: 32px; justify-content: space-between; gap: 14px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
.panel-head h2 { margin: 0; font-size: 14px; line-height: 22px; }
/* 一屏 3 张并排卡(Figma 696:4991 row + gap 24) */
.nb-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin-top: 16px; }
.nb-card { display: grid; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.nb-card.inactive { opacity: .6; }
.nb-media { position: relative; background: #eef0f4; aspect-ratio: 388 / 201; }
.nb-media img { width: 100%; height: 100%; object-fit: cover; }
.nb-media-empty { display: grid; height: 100%; color: #b6bac5; font-size: 34px; place-items: center; }
/* 图片顶部渐变蒙层(稿面 696:4994:388x68,0deg 透明 → 50% 黑)+ 左上角绿色状态圆点(696:4995) */
.nb-scrim { position: absolute; top: 0; right: 0; left: 0; height: 68px; background: linear-gradient(0deg, rgb(65 105 237 / 0%) 0%, rgb(0 0 0 / 50%) 100%); }
.nb-dot { position: absolute; top: 13px; left: 12px; width: 12px; height: 12px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgb(34 197 94 / 25%); }
.nb-card.inactive .nb-dot { background: #cbd5e1; box-shadow: 0 0 0 4px rgb(148 163 184 / 22%); }
.nb-body { display: grid; gap: 24px; padding: 20px; }
.nb-stops { display: grid; gap: 40px; }
.nb-stop { position: relative; gap: 16px; }
.nb-stop-icon { display: grid; flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; background: rgb(31 78 211 / 8%); color: #4d6cf4; font-size: 20px; place-items: center; }
.nb-stop-text { display: grid; gap: 2px; min-width: 0; }
.nb-stop-text strong { color: #1b1d30; font-size: 16px; font-weight: 600; line-height: 24px; overflow-wrap: anywhere; }
.nb-stop-text small { color: rgb(25 26 37 / 50%); font-size: 14px; line-height: 21px; }
/* 地点之间的竖直虚线(稿面 696:5018:2px 主色 40%,4/4 虚线);跨越整个行间距,首行不画 */
.nb-connector { position: absolute; top: -40px; left: 17px; width: 2px; height: 40px; background: repeating-linear-gradient(180deg, rgb(65 105 237 / 40%) 0 4px, transparent 4px 8px); }
.nb-edit-details { justify-content: center; gap: 8px; width: 100%; height: 34px; padding: 0 16px; border: 1px solid #4d6cf4; border-radius: 8px; background: transparent; color: #4d6cf4; font-size: 14px; font-weight: 600; cursor: pointer; }
.nb-edit-details:hover { background: rgb(65 105 237 / 6%); }
.empty-row { margin: 14px 0 0; color: #a5a8b1; font-size: 12px; }
.modal-switches { margin: -8px 0 20px; padding: 3px 0 16px; border-bottom: 1px solid #eceef3; }
.modal-switches label { flex: 1; justify-content: space-between; gap: 14px; color: #414552; font-size: 13px; font-weight: 600; }
.nb-upload { margin-bottom: 18px; }
.file-input { display: none; }
.nb-upload-empty { display: grid; width: 100%; gap: 6px; padding: 26px; border: 1px dashed #ccd3e0; border-radius: 8px; background: #f8fafc; color: #8c8f9b; cursor: pointer; place-items: center; }
.nb-upload-empty span { color: #4d6cf4; font-size: 13px; font-weight: 600; }.nb-upload-empty small { font-size: 11px; }
.nb-upload-preview { position: relative; overflow: hidden; max-width: 380px; border-radius: 8px; aspect-ratio: 388 / 201; }
.nb-upload-preview img { width: 100%; height: 100%; object-fit: cover; }
.nb-upload-preview button { position: absolute; top: 8px; right: 8px; display: grid; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: rgb(255 255 255 / 92%); color: #ff3b4d; cursor: pointer; place-items: center; }
.nb-stop-form { padding: 14px 0 4px; border-top: 1px solid #eceef3; }.nb-stop-form:first-of-type { border-top: 0; }
.nb-stop-form-head { justify-content: space-between; gap: 14px; margin-bottom: 4px; color: #8c8f9b; font-size: 13px; font-weight: 600; }
.nb-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
.nb-form-grid :deep(.ant-form-item-label > label) { color: #686c78; font-size: 12px; font-weight: 600; }
.nb-modal-actions { justify-content: space-between; gap: 16px; padding-top: 14px; border-top: 1px solid #eceef3; }
.nb-modal-actions-right { gap: 14px; }
@media (max-width: 900px) { .nb-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .nb-grid, .nb-form-grid { grid-template-columns: 1fr; } }
</style>
