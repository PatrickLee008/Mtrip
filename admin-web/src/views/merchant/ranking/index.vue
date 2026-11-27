<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import DestinationRanking from './DestinationRanking.vue';
import HotelRanking from './HotelRanking.vue';

const { t } = useI18n();
const tab = ref('listing');
const busy = ref(false);
</script>

<template>
  <PageContainer>
    <div class="module-list-heading">
      <div>
        <div class="module-list-eyebrow">{{ t('menu.merchant') }}</div>
        <h1>{{ t('marketplace.title') }}</h1>
        <p>{{ t('marketplace.subtitle') }}</p>
      </div>
    </div>
    <a-tabs v-model:activeKey="tab">
      <a-tab-pane key="listing" :tab="t('marketplace.hotels')" :disabled="busy && tab !== 'listing'" />
      <a-tab-pane key="destination" :tab="t('marketplace.destinations')" :disabled="busy && tab !== 'destination'" />
    </a-tabs>
    <HotelRanking v-if="tab === 'listing'" @busy="busy = $event" />
    <DestinationRanking v-else @busy="busy = $event" />
  </PageContainer>
</template>

<style scoped lang="less">
@import '@/styles/module-list.less';
</style>
