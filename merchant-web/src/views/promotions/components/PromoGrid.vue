<script setup lang="ts">
/**
 * 卡片网格(Figma `2285:21516` 的 `grid`)。
 * 稿面为一行两张卡(gap 24),窄屏回落单列。
 */
import { useI18n } from 'vue-i18n';
import PromoCard from './PromoCard.vue';
import type { MerchantPromotion } from '@/api/promotions';

defineProps<{
  list: MerchantPromotion[];
  currency: string;
  propertyNames: Record<number, string>;
  roomNames: Record<number, string>;
}>();

defineEmits<{
  (e: 'edit', row: MerchantPromotion): void;
  (e: 'duplicate', row: MerchantPromotion): void;
  (e: 'toggle', row: MerchantPromotion): void;
  (e: 'publish', row: MerchantPromotion): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="promo-grid">
    <PromoCard
      v-for="row in list"
      :key="row.id"
      :promotion="row"
      :currency="currency"
      :property-names="propertyNames"
      :room-names="roomNames"
      @edit="$emit('edit', $event)"
      @duplicate="$emit('duplicate', $event)"
      @toggle="$emit('toggle', $event)"
      @publish="$emit('publish', $event)"
    />
    <p v-if="list.length === 0" class="grid-empty">{{ t('promotions.empty') }}</p>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.promo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.grid-empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 48px 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  text-align: center;
}

@media (max-width: 1100px) {
  .promo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
