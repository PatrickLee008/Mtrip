<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { BankOutlined, CheckCircleOutlined, CoffeeOutlined, EnvironmentOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { apiPropertyList, type PropertyRow } from '@/api/properties';
import { useUserStore } from '@/stores/user';
import resortImage from '@/assets/properties/hotel-resort.png';
import boutiqueImage from '@/assets/properties/hotel-boutique.png';
import villasImage from '@/assets/properties/hotel-villas.png';

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const properties = ref<PropertyRow[]>([]);
const hotels = computed(() => properties.value.filter((item) => item.business_type === 'hotel'));
const restaurants = computed(() => properties.value.filter((item) => item.business_type === 'restaurant'));
const other = computed(() => properties.value.filter((item) => !['hotel', 'restaurant'].includes(item.business_type)));

const canAdd = computed(() => userStore.hasPerm('mch:properties:add'));
const summary = computed(() => [
  { label: t('properties.total'), value: properties.value.length, sub: t('properties.acrossPortfolio'), icon: HomeOutlined, tone: 'blue' },
  { label: t('sidebar.hotels'), value: hotels.value.length, sub: t('properties.hotelSubtitle'), icon: BankOutlined, tone: 'blue' },
  { label: t('sidebar.restaurants'), value: restaurants.value.length, sub: t('properties.restaurantSubtitle'), icon: CoffeeOutlined, tone: 'orange' },
  { label: t('properties.verifiedBusinesses'), value: properties.value.filter((item) => item.kyc_status === 1).length, sub: t('properties.verifiedSubtitle'), icon: CheckCircleOutlined, tone: 'green' },
]);
const groups = computed(() => [
  { key: 'hotel', title: t('sidebar.hotels'), items: hotels.value },
  { key: 'restaurant', title: t('sidebar.restaurants'), items: restaurants.value },
  { key: 'other', title: t('sidebar.businessType.other'), items: other.value },
].filter((group) => group.items.length > 0));
const images = [resortImage, boutiqueImage, villasImage];

function imageFor(property: PropertyRow, index: number): string {
  return property.images[0] || (property.business_type === 'hotel' ? images[index % images.length] : '');
}

function isPublic(property: PropertyRow): boolean {
  if (property.business_type !== 'hotel') return property.kyc_status === 1;
  return property.kyc_status === 1 && property.content_status === 2 && property.content_approved_version > 0
    && property.publish_status === 1 && property.status === 1 && property.operating_status === 1
    && property.display_enabled === 1 && property.live_room_count > 0;
}

function publicationLabel(property: PropertyRow): string {
  if (property.business_type !== 'hotel') return t(`properties.kycStatus.${property.kyc_status}`);
  if (property.kyc_status !== 1) return t(`properties.kycStatus.${property.kyc_status}`);
  if (property.content_approved_version <= 0) {
    if (property.latest_content_review_status === 1) return t('properties.publication.profileReviewPending');
    if (property.latest_content_review_status === 3) return t('properties.publication.profileRejected');
    return t('properties.publication.profileIncomplete');
  }
  if (property.publish_status !== 1) return t('properties.publication.unpublished');
  if (property.status !== 1 || property.operating_status !== 1 || property.live_room_count <= 0) return t('properties.publication.offline');
  if (property.display_enabled !== 1) return t('properties.publication.platformHidden');
  return t('properties.publication.live');
}

function propertyActionLabel(property: PropertyRow): string {
  if (property.business_type !== 'hotel' || property.kyc_status !== 1 || property.content_approved_version > 0) {
    return t('properties.manage');
  }
  if (property.latest_content_review_status === 1) return t('properties.actions.reviewProgress');
  if (property.latest_content_review_status === 3) return t('properties.actions.resubmitProfile');
  return t('properties.actions.completeProfile');
}

function openProperty(property: PropertyRow, path: string): void {
  if (property.business_type === 'hotel' && property.kyc_status !== 1) {
    void router.push({ path: '/properties/new', query: { propertyId: property.id } });
    return;
  }
  void router.push({ path, query: { propertyId: property.id } });
}

function addProperty(): void {
  void router.push('/properties/new');
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    properties.value = (await apiPropertyList({ page: 1, pageSize: 200 })).list;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="properties-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('sidebar.allProperties') }}</h1>
        <p>{{ t('properties.subtitle') }}</p>
      </div>
      <button v-if="canAdd" class="add-button" type="button" @click="addProperty">
        <PlusOutlined /> {{ t('sidebar.addProperty') }}
      </button>
    </div>

    <div class="summary-grid">
      <div v-for="card in summary" :key="card.label" class="summary-card">
        <div class="summary-top">
          <span>{{ card.label }}</span>
          <span :class="['summary-icon', card.tone]"><component :is="card.icon" /></span>
        </div>
        <strong>{{ card.value }}</strong>
        <small>{{ card.sub }}</small>
      </div>
    </div>

    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <template v-else-if="groups.length">
      <section v-for="group in groups" :key="group.key" class="property-section">
        <div class="section-heading"><h2>{{ group.title }} ({{ group.items.length }})</h2><span /></div>
        <div class="property-grid">
          <article v-for="(property, index) in group.items" :key="property.id" class="property-card">
            <div :class="['property-image', { placeholder: !imageFor(property, index) }]">
              <img v-if="imageFor(property, index)" :src="imageFor(property, index)" alt="" />
              <CoffeeOutlined v-else />
              <span class="type-tag">{{ t('sidebar.businessType.' + property.business_type) }}</span>
            </div>
            <div class="property-details">
              <div class="property-title">
                <h3 :title="property.store_name">{{ property.store_name }}</h3>
                <span :class="['status-tag', { pending: !isPublic(property) }]">{{ publicationLabel(property) }}</span>
              </div>
              <p class="property-location"><EnvironmentOutlined /> {{ property.address || property.merchant_name }}</p>
              <div class="property-actions">
                <button class="manage-button" type="button" @click="openProperty(property, property.business_type === 'hotel' ? `/properties/${property.id}/profile` : '/store')">{{ propertyActionLabel(property) }}</button>
                <button v-if="property.kyc_status === 1" class="dashboard-button" type="button" @click="openProperty(property, '/dashboard')">{{ t('dashboard.title') }}</button>
              </div>
            </div>
          </article>
          <button v-if="canAdd && group.key === 'hotel'" class="add-card" type="button" @click="addProperty">
            <span><PlusOutlined /></span>
            {{ t('sidebar.addProperty') }}
          </button>
        </div>
      </section>
    </template>
    <div v-else class="empty-state">{{ t('sidebar.noBusinesses') }}</div>
  </main>
</template>

<style scoped lang="less">
.properties-page { min-height: calc(100vh - 56px); padding: 24px 28px 56px; background: #f7f8fa; color: #1b1d30; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-heading h1 { margin: 0; font-size: 20px; line-height: 30px; font-weight: 700; }
.page-heading p { margin: 0; color: #7b7d89; font-size: 12px; line-height: 22px; }
.add-button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; background: #4169ed; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.add-button:hover, .dashboard-button:hover { background: #335ad9; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 36px; }
.summary-card { display: flex; flex-direction: column; min-height: 138px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.summary-top { display: flex; align-items: center; justify-content: space-between; color: #7b7d89; font-size: 12px; }
.summary-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; font-size: 14px; }
.summary-icon.blue { color: #4169ed; background: #ebf0ff; }
.summary-icon.orange { color: #e17100; background: #fff2e7; }
.summary-icon.green { color: #00a63e; background: #eaf8ef; }
.summary-card strong { margin-top: 14px; font-size: 24px; line-height: 32px; }
.summary-card small { color: #7b7d89; font-size: 12px; }
.property-section { margin-top: 36px; }
.section-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.section-heading h2 { flex-shrink: 0; margin: 0; font-size: 14px; line-height: 21px; font-weight: 700; text-transform: uppercase; }
.section-heading span { width: 100%; border-top: 1px solid #e2e8f0; }
.property-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.property-card { min-width: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.property-image { position: relative; height: 140px; background: #ebf0ff; }
.property-image img { width: 100%; height: 100%; object-fit: cover; }
.property-image.placeholder { display: flex; align-items: center; justify-content: center; color: #e17100; font-size: 38px; background: linear-gradient(135deg, #fff5e9, #ebf0ff); }
.type-tag { position: absolute; top: 0; right: 0; max-width: 55%; padding: 4px 12px; overflow: hidden; border-radius: 0 0 0 6px; background: #fff; color: #7b7d89; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.property-details { padding: 20px; }
.property-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
.property-title h3 { min-width: 0; margin: 0; overflow: hidden; font-size: 16px; line-height: 24px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.status-tag { flex-shrink: 0; padding: 2px 8px; border-radius: 30px; background: #eaf8ef; color: #00a63e; font-size: 12px; font-weight: 600; }
.status-tag.pending { background: #fff7e6; color: #c26a00; }
.property-location { margin: 4px 0 16px; overflow: hidden; color: #7b7d89; font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.property-location :deep(svg) { width: 10px; height: 10px; }
.property-actions { display: flex; gap: 8px; }
.property-actions button { flex: 1; min-height: 34px; border-radius: 6px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.manage-button { border: 1px solid #e2e8f0; background: #ebf0ff; color: #1b1d30; }
.manage-button:hover { background: #dce5ff; }
.dashboard-button { border: 1px solid #4169ed; background: #4169ed; color: #fff; }
.add-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 265px; border: 1px dashed #d8e1f3; border-radius: 12px; background: #fff; color: #687084; font: inherit; font-size: 13px; cursor: pointer; }
.add-card span { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #ebf0ff; color: #687084; font-size: 20px; }
.add-card:hover { border-color: #4169ed; color: #4169ed; }
.empty-state { margin-top: 28px; padding: 64px 24px; border: 1px dashed #d8e1f3; border-radius: 12px; background: #fff; color: #7b7d89; text-align: center; }
@media (max-width: 1200px) { .property-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .properties-page { padding: 16px; } .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .page-heading { flex-direction: column; } .summary-grid, .property-grid { grid-template-columns: 1fr; } }
</style>
