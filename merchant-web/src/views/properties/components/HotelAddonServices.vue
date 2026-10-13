<script setup lang="ts">
/**
 * 酒店资料 · 附加服务页签(视图 + 编辑态)
 *
 * 服务项固定 7 个(早餐 / 机场接送 / SPA / 洗衣 / 客房服务 / 加床 / 延迟退房),商户逐项开关、填价格、
 * 选计价方式(按人 / 按晚 / 按间,可多选,金额 = 单价 × 选中维度的乘积;都不选 = 按次收一次)。
 * 配置随物业资料一起提交审核、审核通过后对住客生效;规则唯一实现是后端 shared `HotelAddons`。
 *
 * 契约与其它页签一致:modelValue / editing / disabled + editRequested。
 */
import { computed } from 'vue';
import { EditOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { ADDON_KEYS, ADDON_UNITS, type AddonUnit, type PropertyAddon } from '@/api/properties';

const props = defineProps<{
  modelValue: PropertyAddon[];
  editing?: boolean;
  disabled?: boolean;
  currency?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: PropertyAddon[]];
  editRequested: [];
}>();
const { t } = useI18n();

/** 固定 7 行,接口缺的项补成停用,顺序以 ADDON_KEYS 为准 */
const rows = computed<PropertyAddon[]>(() => ADDON_KEYS.map((key) => {
  const row = props.modelValue.find((item) => item.key === key);
  return row ? { ...row, units: [...row.units] } : { key, enabled: false, price: 0, units: [], description: '' };
}));
const enabledCount = computed(() => rows.value.filter((row) => row.enabled).length);
const currencyLabel = computed(() => (props.currency || 'MMK').toUpperCase());

function patch(key: string, value: Partial<PropertyAddon>): void {
  emit('update:modelValue', rows.value.map((row) => (row.key === key ? { ...row, ...value } : row)));
}

/** 多选结果按固定顺序(人 → 晚 → 间)存,与后端归一化一致 */
function setUnits(key: string, value: unknown): void {
  const picked = Array.isArray(value) ? value.map(String) : [];
  patch(key, { units: ADDON_UNITS.filter((unit) => picked.includes(unit)) });
}

function unitsLabel(units: AddonUnit[]): string {
  return units.length ? units.map((unit) => t(`properties.profile.addonsTab.units.${unit}`)).join(' × ') : t('properties.profile.addonsTab.perTime');
}

function formatPrice(price: number): string {
  return `${currencyLabel.value} ${Number(price || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
</script>

<template>
  <section class="ad-panel">
    <div class="panel-head">
      <h2>{{ t('properties.profile.addons') }} <em>{{ t('properties.profile.addonsTab.enabledCount', { count: enabledCount, total: rows.length }) }}</em></h2>
      <button v-if="!editing" v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
    </div>
    <p class="ad-hint">{{ t('properties.profile.addonsTab.hint') }}</p>

    <!-- 视图态:七行一览,未启用的灰显 -->
    <div v-if="!editing" class="ad-list">
      <div v-for="row in rows" :key="row.key" :class="['ad-row', { inactive: !row.enabled }]">
        <span class="ad-name">{{ t(`properties.profile.addonsTab.items.${row.key}`) }}</span>
        <span class="ad-status">{{ row.enabled ? t('properties.profile.addonsTab.on') : t('properties.profile.addonsTab.off') }}</span>
        <span class="ad-price">{{ row.enabled ? formatPrice(row.price) : '-' }}</span>
        <span class="ad-units">{{ row.enabled ? unitsLabel(row.units) : '' }}</span>
        <span class="ad-desc">{{ row.description }}</span>
      </div>
    </div>

    <!-- 编辑态:每行 开关 / 单价 / 计价方式(多选)/ 说明 -->
    <div v-else class="ad-edit-list">
      <article v-for="row in rows" :key="row.key" :class="['ad-edit-card', { inactive: !row.enabled }]">
        <div class="ad-edit-head">
          <strong>{{ t(`properties.profile.addonsTab.items.${row.key}`) }}</strong>
          <a-switch :checked="row.enabled" :aria-label="t(`properties.profile.addonsTab.items.${row.key}`)" @change="patch(row.key, { enabled: Boolean($event) })" />
        </div>
        <div class="ad-edit-grid">
          <a-form-item :label="t('properties.profile.addonsTab.price')" :required="row.enabled">
            <a-input-number :value="row.price" :min="0" :max="99999999.99" :precision="2" :disabled="!row.enabled" :addon-after="currencyLabel" @update:value="patch(row.key, { price: Number($event || 0) })" />
          </a-form-item>
          <a-form-item :label="t('properties.profile.addonsTab.pricing')" :extra="t('properties.profile.addonsTab.pricingHint')">
            <a-checkbox-group :value="row.units" :disabled="!row.enabled" @update:value="setUnits(row.key, $event)">
              <a-checkbox v-for="unit in ADDON_UNITS" :key="unit" :value="unit">{{ t(`properties.profile.addonsTab.units.${unit}`) }}</a-checkbox>
            </a-checkbox-group>
          </a-form-item>
          <a-form-item class="ad-desc-item" :label="t('properties.profile.addonsTab.description')">
            <a-input :value="row.description" :maxlength="200" :disabled="!row.enabled" @update:value="patch(row.key, { description: String($event || '') })" />
          </a-form-item>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="less">
.ad-panel { margin-bottom: 16px; padding: 15px 16px; border: 1px solid #e9ebf2; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 32px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
.panel-head h2 { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 14px; line-height: 22px; }
.panel-head em { color: #c87542; font-size: 11px; font-style: normal; font-weight: 600; }
.ad-hint { margin: 12px 0 0; color: #8a8d99; font-size: 12px; }
.ad-list { display: grid; margin-top: 8px; }
.ad-row { display: grid; grid-template-columns: 160px 80px 160px 200px minmax(0, 1fr); align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f1f2f6; font-size: 14px; }
.ad-row:last-child { border-bottom: 0; }
.ad-name { color: #181b2a; font-weight: 600; }
.ad-status { color: #00a63e; font-weight: 600; }
.ad-price { color: #181b2a; font-weight: 700; }
.ad-units, .ad-desc { color: #6b6e7b; }
.ad-row.inactive .ad-name, .ad-row.inactive .ad-status { color: #a5a8b1; }
.ad-edit-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.ad-edit-card { padding: 14px 16px 4px; border: 1.5px solid #4169ed; border-radius: 8px; }
.ad-edit-card.inactive { border-color: #e2e5ee; }
.ad-edit-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ad-edit-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 16px; }
.ad-edit-grid :deep(.ant-input-number) { width: 100%; }
.ad-desc-item { grid-column: 1 / -1; }
@media (max-width: 1100px) { .ad-edit-list { grid-template-columns: 1fr; } .ad-row { grid-template-columns: 120px 64px 140px 1fr; } .ad-desc { display: none; } }
</style>
