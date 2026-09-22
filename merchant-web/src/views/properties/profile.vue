<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { ArrowLeftOutlined, CoffeeOutlined, DeleteOutlined, EditOutlined, EnvironmentFilled, HomeOutlined, PlusOutlined, StarFilled } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { apiPropertyProfile, apiPropertyProfileImageUpload, apiPropertyProfileSave, apiPropertyPublish, emptyLongStay, emptyPolicies, type NearbyAttraction,
  type NearbyStop, type PropertyAmenity, type PropertyImage, type PropertyLongStay, type PropertyPolicies } from '@/api/properties';
import HotelAmenities from './components/HotelAmenities.vue';
import HotelLongStay from './components/HotelLongStay.vue';
import HotelNearby from './components/HotelNearby.vue';
import HotelPolicies from './components/HotelPolicies.vue';

/** 可停留的页签(rooms 走独立 `/rooms` 页,不在此列) */
type TabKey = 'details' | 'amenities' | 'long-stay' | 'policies' | 'nearby';

interface ProfileForm {
  propertyName: string;
  phoneNumber1: string;
  phoneNumber2: string;
  emailAddress: string;
  location: string;
  countryCode: string;
  cityKey: string;
  longitude: string;
  latitude: string;
  description: string;
  starLevel: number;
  website: string;
  checkinTime: string;
  checkoutTime: string;
  amenities: PropertyAmenity[];
  imageGallery: PropertyImage[];
  longStay: PropertyLongStay;
  hotelPolicies: PropertyPolicies;
  nearbyAttractions: NearbyAttraction[];
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
/** 物业 id 跟着路由参数走:同一条 `/properties/:id/profile` 路由切物业时组件会被复用,常量会停在旧值 */
const propertyId = computed(() => Number(route.params.id));
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const editing = ref(false);
const activeTab = ref<TabKey>('details');
const editingTab = ref<TabKey>('details');
const fileInput = ref<HTMLInputElement>();
const property = ref<Record<string, unknown>>({});
const latest = ref<(Record<string, unknown> & { status: number; reject_reason: string }) | null>(null);
const metrics = reactive({ roomTypes: [] as string[], totalRooms: 0, guestRating: 0, guestReviewCount: 0, currency: '' });
const form = reactive<ProfileForm>({
  propertyName: '', phoneNumber1: '', phoneNumber2: '', emailAddress: '', location: '',
  countryCode: '', cityKey: '', longitude: '', latitude: '', description: '', starLevel: 0,
  website: '', checkinTime: '', checkoutTime: '', amenities: [], imageGallery: [],
  longStay: emptyLongStay(), hotelPolicies: emptyPolicies(), nearbyAttractions: [],
});
let savedForm: ProfileForm = cloneForm(form);

const tabs = computed(() => [
  { key: 'details', label: t('properties.profile.details') },
  { key: 'amenities', label: t('properties.profile.amenities') },
  { key: 'long-stay', label: t('properties.profile.longStay') },
  { key: 'rooms', label: t('properties.profile.roomTypes') },
  { key: 'policies', label: t('properties.profile.policies') },
  { key: 'nearby', label: t('properties.profile.nearby') },
]);
const facilities = computed(() => Array.from(new Set(form.amenities
  .filter((item) => item.category !== 'tags' && item.enabled).map((item) => item.name.trim()).filter(Boolean))));
const activeImages = computed(() => form.imageGallery.filter((image) => image.enabled));
const isPublic = computed(() => Number(property.value.kyc_status) === 1 && Number(property.value.content_status) === 2
  && Number(property.value.content_approved_version) > 0 && Number(property.value.publish_status) === 1
  && Number(property.value.status) === 1 && Number(property.value.operating_status) === 1
  && Number(property.value.display_enabled) === 1 && Number(property.value.live_room_count) > 0);
const publicationLabel = computed(() => {
  if (Number(property.value.kyc_status) !== 1) return t(`properties.kycStatus.${Number(property.value.kyc_status || 0)}`);
  if (Number(property.value.content_approved_version) <= 0) {
    if (latest.value?.status === 1) return t('properties.publication.profileReviewPending');
    if (latest.value?.status === 3) return t('properties.publication.profileRejected');
    return t('properties.publication.profileIncomplete');
  }
  if (Number(property.value.publish_status) !== 1) return t('properties.publication.unpublished');
  if (Number(property.value.status) !== 1 || Number(property.value.operating_status) !== 1 || Number(property.value.live_room_count) <= 0) return t('properties.publication.offline');
  if (Number(property.value.display_enabled) !== 1) return t('properties.publication.platformHidden');
  return t('properties.publication.live');
});
const hasApprovedProfile = computed(() => Number(property.value.content_approved_version) > 0);

function cloneForm(source: ProfileForm): ProfileForm {
  return {
    ...source,
    amenities: source.amenities.map((item) => ({ ...item })),
    imageGallery: source.imageGallery.map((image) => ({ ...image })),
    longStay: {
      promotions: source.longStay.promotions.map((row) => ({ ...row })),
      benefits: source.longStay.benefits.map((row) => ({ ...row })),
    },
    hotelPolicies: {
      booking: { ...source.hotelPolicies.booking },
      checkIn: { ...source.hotelPolicies.checkIn, documents: [...source.hotelPolicies.checkIn.documents] },
      checkOut: { ...source.hotelPolicies.checkOut },
      pet: { ...source.hotelPolicies.pet },
      children: source.hotelPolicies.children.map((row) => ({ ...row })),
      rules: source.hotelPolicies.rules.map((row) => ({ ...row })),
    },
    nearbyAttractions: source.nearbyAttractions.map((item) => ({ ...item })),
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

/** 后端已归一化,这里只做「老响应缺字段时不炸」的兜底(HANDOFF 的前端兜底约定) */
function normalizeLongStay(value: unknown): PropertyLongStay {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    promotions: asArray(row.promotions).map((item) => ({
      id: String(item.id || ''), name: String(item.name || ''),
      discount: Number(item.discount || 0), status: item.status !== false,
    })),
    benefits: asArray(row.benefits).map((item) => ({
      id: String(item.id || ''), name: String(item.name || ''),
      status: item.status !== false, bold: item.bold === true,
    })),
  };
}

function normalizePolicies(value: unknown): PropertyPolicies {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const section = (key: string) => ((row[key] && typeof row[key] === 'object' ? row[key] : {}) as Record<string, unknown>);
  const booking = section('booking');
  const checkIn = section('checkIn');
  const checkOut = section('checkOut');
  const pet = section('pet');
  return {
    booking: {
      cancellation: String(booking.cancellation || ''), prepayment: String(booking.prepayment || ''),
      taxesFees: String(booking.taxesFees || ''),
    },
    checkIn: {
      time: String(checkIn.time || ''), description: String(checkIn.description || ''),
      documents: Array.isArray(checkIn.documents) ? checkIn.documents.map((item) => String(item)).filter(Boolean) : [],
    },
    checkOut: { time: String(checkOut.time || ''), description: String(checkOut.description || '') },
    pet: { description: String(pet.description || ''), status: pet.status !== false },
    children: asArray(row.children).map((item) => ({
      id: String(item.id || ''), name: String(item.name || ''), description: String(item.description || ''),
      amount: String(item.amount || ''), currency: String(item.currency || '').toUpperCase(),
      unit: String(item.unit || 'night'), status: item.status !== false,
    })),
    rules: asArray(row.rules).map((item) => ({
      id: String(item.id || ''), name: String(item.name || ''), description: String(item.description || ''),
      icon: String(item.icon || 'sparkles'), status: item.status !== false,
    })),
  };
}

function normalizeNearby(value: unknown): NearbyAttraction[] {
  const toStop = (row: Record<string, unknown>, index: number): NearbyStop => ({
    id: String(row.id || `stop-${index + 1}`), icon: String(row.icon || 'location'),
    name: String(row.name || ''), travelTime: String(row.travelTime || ''),
    travelMode: String(row.travelMode || 'drive'), distance: String(row.distance || ''),
  });
  return asArray(value).map((item) => {
    // 兼容第一版的扁平结构(景点字段直接挂在卡片上)
    const rawStops = asArray(item.stops);
    const stops = rawStops.length ? rawStops.map(toStop)
      : (item.name || item.distance ? [toStop(item, 0)] : []);
    return { id: String(item.id || ''), image: String(item.image || ''), status: item.status !== false, stops };
  });
}

function normalizeAmenities(value: unknown, legacyFacilities: unknown): PropertyAmenity[] {
  if (Array.isArray(value) && value.length) return value.map((item, index) => {
    const row = item as Partial<PropertyAmenity>;
    return {
      id: String(row.id || `amenity-${index + 1}`),
      category: ['essential', 'reception', 'dining', 'tags'].includes(String(row.category)) ? row.category! : 'essential',
      name: String(row.name || ''), icon: String(row.icon || 'sparkles'), description: String(row.description || ''),
      enabled: row.enabled !== false, highlighted: row.enabled !== false && row.highlighted === true,
    };
  }).filter((item) => item.name);
  if (!Array.isArray(legacyFacilities)) return [];
  return legacyFacilities.map((name, index) => ({
    id: `legacy-${index + 1}`, category: 'essential', name: String(name), icon: 'sparkles',
    description: '', enabled: true, highlighted: false,
  }));
}

function valueOrEmpty(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await apiPropertyProfile(propertyId.value);
    property.value = data.property;
    latest.value = data.latestRevision;
    Object.assign(metrics, data.metrics, { currency: valueOrEmpty(data.metrics?.currency) });
    const row = data.editable;
    Object.assign(form, {
      propertyName: valueOrEmpty(row.store_name), phoneNumber1: valueOrEmpty(row.contact_phone),
      phoneNumber2: valueOrEmpty(row.contact_phone2), emailAddress: valueOrEmpty(row.contact_email),
      location: valueOrEmpty(row.address), countryCode: valueOrEmpty(row.country_code),
      cityKey: valueOrEmpty(row.city_key), longitude: valueOrEmpty(row.longitude), latitude: valueOrEmpty(row.latitude),
      description: valueOrEmpty(row.description), starLevel: Number(row.star_level || 0),
      website: valueOrEmpty(row.website), checkinTime: valueOrEmpty(row.checkin_time), checkoutTime: valueOrEmpty(row.checkout_time),
      amenities: normalizeAmenities(row.amenities, row.facilities),
      imageGallery: Array.isArray(row.image_gallery)
        ? row.image_gallery.map((image) => ({ url: String(image.url || ''), enabled: image.enabled !== false })).filter((image) => image.url)
        : [],
      longStay: normalizeLongStay(row.long_stay),
      hotelPolicies: normalizePolicies(row.hotel_policies),
      nearbyAttractions: normalizeNearby(row.nearby_attractions),
    });
    savedForm = cloneForm(form);
  } finally {
    loading.value = false;
  }
}

function beginEdit(tab: TabKey): void {
  savedForm = cloneForm(form);
  activeTab.value = tab;
  editingTab.value = tab;
  editing.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function beginDetailsEdit(): void { beginEdit('details'); }
function beginAmenitiesEdit(): void { beginEdit('amenities'); }

function selectTab(key: string): void {
  if (key === 'rooms' && !editing.value) { void router.push({ path: '/rooms', query: { propertyId: propertyId.value } }); return; }
  if (!['details', 'amenities', 'long-stay', 'policies', 'nearby'].includes(key)) return;
  activeTab.value = key as TabKey;
  if (editing.value) editingTab.value = key as TabKey;
}

function cancelEdit(): void {
  Object.assign(form, cloneForm(savedForm));
  editing.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function save(submit: boolean): Promise<void> {
  if (!form.propertyName.trim() || !form.location.trim()) {
    message.warning(t('properties.profile.required'));
    return;
  }
  if (submit && (!form.countryCode.trim() || !form.cityKey.trim())) {
    message.warning(t('properties.profile.publishLocationRequired'));
    return;
  }
  saving.value = true;
  try {
    await apiPropertyProfileSave({
      propertyId: propertyId.value, submit: submit ? 1 : 0, propertyName: form.propertyName.trim(),
      phoneNumber1: form.phoneNumber1.trim(), phoneNumber2: form.phoneNumber2.trim(),
      emailAddress: form.emailAddress.trim(), location: form.location.trim(),
      countryCode: form.countryCode.trim().toUpperCase(), cityKey: form.cityKey.trim(),
      longitude: form.longitude.trim(), latitude: form.latitude.trim(), description: form.description.trim(),
      starLevel: form.starLevel, website: form.website.trim(), checkinTime: form.checkinTime.trim(),
      checkoutTime: form.checkoutTime.trim(), facilities: facilities.value,
      amenities: form.amenities.map((item) => ({ ...item, name: item.name.trim(), description: item.description.trim() })),
      imageGallery: form.imageGallery.map((image) => ({ url: image.url, enabled: image.enabled })),
      longStay: {
        promotions: form.longStay.promotions.map((row) => ({ ...row, name: row.name.trim() })),
        benefits: form.longStay.benefits.map((row) => ({ ...row, name: row.name.trim() })),
      },
      hotelPolicies: {
        booking: { ...form.hotelPolicies.booking },
        checkIn: { ...form.hotelPolicies.checkIn, documents: form.hotelPolicies.checkIn.documents.map((item) => item.trim()).filter(Boolean) },
        checkOut: { ...form.hotelPolicies.checkOut },
        pet: { ...form.hotelPolicies.pet },
        children: form.hotelPolicies.children.map((row) => ({ ...row, name: row.name.trim() })),
        rules: form.hotelPolicies.rules.map((row) => ({ ...row, name: row.name.trim() })),
      },
      nearbyAttractions: form.nearbyAttractions.map((card) => ({
        ...card,
        stops: card.stops.map((stop) => ({ ...stop, name: stop.name.trim(), travelTime: stop.travelTime.trim(), distance: stop.distance.trim() })),
      })),
    });
    message.success(t(submit ? 'properties.profile.submitted' : 'common.saveSuccess'));
    editing.value = false;
    await load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } finally {
    saving.value = false;
  }
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
    const uploaded = await apiPropertyProfileImageUpload(propertyId.value, file);
    if (!form.imageGallery.some((image) => image.url === uploaded.url)) form.imageGallery.push({ url: uploaded.url, enabled: true });
  } finally {
    uploading.value = false;
  }
}

function removeImage(index: number): void {
  form.imageGallery.splice(index, 1);
}

async function togglePublish(): Promise<void> {
  const enabled = Number(property.value.publish_status || 0) !== 1;
  await apiPropertyPublish(propertyId.value, enabled);
  message.success(t(enabled ? 'properties.profile.published' : 'properties.profile.offline'));
  await load();
}

onMounted(load);

/**
 * 左上角切换物业时,BasicLayout 会把路由推到新物业的 profile;组件被复用不会重挂载,
 * 所以这里必须自己跟着路由参数重新拉数据(否则一直显示旧物业的资料)。
 */
watch(propertyId, () => {
  if (!propertyId.value) { void router.push('/properties'); return; }
  editing.value = false;
  activeTab.value = 'details';
  editingTab.value = 'details';
  void load();
});
</script>

<template>
  <main class="profile-page">
    <a-spin :spinning="loading">
      <template v-if="!editing">
        <header class="profile-head">
          <div><h1>{{ t('properties.profile.title') }}</h1><p>{{ t('properties.profile.subtitle') }}</p></div>
          <a-button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="primary" :disabled="loading || latest?.status === 1" @click="beginDetailsEdit"><EditOutlined />{{ t('properties.profile.edit') }}</a-button>
        </header>

        <div class="summary-grid">
          <article class="summary-card"><div class="summary-label"><span>{{ t('properties.profile.roomTypesMetric') }}</span><CoffeeOutlined class="metric-icon amber" /></div><strong>{{ metrics.roomTypes.length ? metrics.roomTypes.join(', ') : '—' }}</strong></article>
          <article class="summary-card"><div class="summary-label"><span>{{ t('properties.profile.totalRooms') }}</span><HomeOutlined class="metric-icon blue" /></div><strong>{{ t('properties.profile.roomsCount', { count: metrics.totalRooms }) }}</strong></article>
          <article class="summary-card"><div class="summary-label"><span>{{ t('properties.profile.guestRating') }}</span><StarFilled class="metric-icon gold" /></div><strong>{{ metrics.guestReviewCount ? `${metrics.guestRating.toFixed(1)} ★` : '—' }}</strong></article>
        </div>
      </template>
      <header v-else class="edit-head">
        <button type="button" @click="cancelEdit"><ArrowLeftOutlined /> {{ form.propertyName || t('properties.profile.title') }}</button>
        <strong>{{ t('properties.profile.edit') }}</strong>
      </header>

      <nav class="profile-tabs" :aria-label="t('properties.profile.title')">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: tab.key === activeTab }" :aria-current="tab.key === activeTab ? 'page' : undefined" :disabled="editing && tab.key === 'rooms'" @click="selectTab(tab.key)">{{ tab.label }}</button>
      </nav>

      <a-alert v-if="latest?.status === 3" type="error" show-icon :message="t('properties.profile.rejected')" :description="hasApprovedProfile ? t('properties.profile.rejectedPreviousLive', { reason: latest.reject_reason || '-' }) : latest.reject_reason" class="state-alert" />
      <a-alert v-else-if="latest?.status === 1" type="info" show-icon :message="t('properties.profile.pending')" :description="hasApprovedProfile ? t('properties.profile.pendingPreviousLive') : undefined" class="state-alert" />
      <a-alert v-else-if="!hasApprovedProfile" type="warning" show-icon :message="t('properties.profile.incomplete')" :description="t('properties.profile.incompleteTip')" class="state-alert" />

      <template v-if="!editing && activeTab === 'details'">
        <section class="profile-card">
          <div class="section-head"><h2>{{ t('properties.profile.details') }}</h2><button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="loading || latest?.status === 1" @click="beginDetailsEdit"><EditOutlined />{{ t('common.edit') }}</button></div>
          <dl class="details-grid">
            <div><dt>{{ t('properties.new.name') }}</dt><dd>{{ form.propertyName || t('properties.profile.notProvided') }}</dd></div>
            <div><dt>{{ t('properties.profile.star') }}</dt><dd>{{ form.starLevel ? t('properties.profile.stars', { count: form.starLevel }) : t('properties.profile.notProvided') }}</dd></div>
            <div><dt>{{ t('properties.profile.phone') }}</dt><dd>{{ form.phoneNumber1 || t('properties.profile.notProvided') }}</dd></div>
            <div><dt>{{ t('properties.profile.email') }}</dt><dd>{{ form.emailAddress || t('properties.profile.notProvided') }}</dd></div>
            <div><dt>{{ t('properties.profile.website') }}</dt><dd>{{ form.website || t('properties.profile.notProvided') }}</dd></div>
            <div><dt>{{ t('properties.new.location') }}</dt><dd>{{ form.location || t('properties.profile.notProvided') }}</dd></div>
          </dl>
        </section>
        <section class="profile-card simple-card"><h2>{{ t('properties.profile.highlight') }}</h2><p :class="{ empty: !form.description }">{{ form.description || t('properties.profile.noDescription') }}</p></section>
        <section class="profile-card simple-card">
          <h2>{{ t('properties.profile.amenities') }}</h2>
          <div v-if="facilities.length" class="amenities-grid"><span v-for="(facility, index) in facilities" :key="`${facility}-${index}`" class="amenity">{{ facility }} <i /></span></div>
          <p v-else class="empty">{{ t('properties.profile.noAmenities') }}</p>
        </section>
        <section class="profile-card simple-card">
          <h2>{{ t('properties.profile.hotelImages') }}</h2>
          <div v-if="form.imageGallery.length" class="view-image-grid"><div v-for="(image, index) in form.imageGallery" :key="image.url" :class="['view-image', { disabled: !image.enabled }]"><img :src="image.url" :alt="t('properties.profile.imageAlt', { name: form.propertyName, index: index + 1 })" /><i v-if="image.enabled" /></div></div>
          <div v-else class="image-empty"><span>▧</span><p>{{ t('properties.profile.noImages') }}</p></div>
        </section>
        <footer class="actions">
          <div class="publication-state"><span :class="['status-dot', { live: isPublic }]" />{{ publicationLabel }}</div>
          <a-button v-if="Number(property.content_status) === 2" v-perm="'mch:properties:publish'" @click="togglePublish">{{ t(Number(property.publish_status) === 1 ? 'properties.profile.takeOffline' : 'properties.profile.publish') }}</a-button>
        </footer>
      </template>

      <HotelAmenities v-else-if="!editing && activeTab === 'amenities'" v-model="form.amenities" :disabled="loading || latest?.status === 1" @edit-requested="beginAmenitiesEdit" />
      <HotelLongStay v-else-if="!editing && activeTab === 'long-stay'" v-model="form.longStay" :disabled="loading || latest?.status === 1" @edit-requested="beginEdit('long-stay')" />
      <HotelPolicies v-else-if="!editing && activeTab === 'policies'" v-model="form.hotelPolicies" :currency="metrics.currency" :disabled="loading || latest?.status === 1" @edit-requested="beginEdit('policies')" />
      <HotelNearby v-else-if="!editing && activeTab === 'nearby'" v-model="form.nearbyAttractions" :property-id="propertyId" :disabled="loading || latest?.status === 1" @edit-requested="beginEdit('nearby')" />

      <template v-else-if="editing && editingTab === 'details'">
        <section class="profile-card edit-card">
          <h2>{{ t('properties.profile.hotelInformation') }} <span>⌄</span></h2>
          <a-form layout="vertical" class="form-grid">
            <a-form-item :label="t('properties.new.name')" required><a-input v-model:value="form.propertyName" :maxlength="100" /></a-form-item>
            <a-form-item :label="t('properties.profile.star')"><a-select v-model:value="form.starLevel"><a-select-option v-for="star in [0, 1, 2, 3, 4, 5]" :key="star" :value="star">{{ star ? t('properties.profile.stars', { count: star }) : t('properties.profile.notProvided') }}</a-select-option></a-select></a-form-item>
            <a-form-item :label="t('properties.profile.phone1')"><a-input v-model:value="form.phoneNumber1" :maxlength="50" /></a-form-item>
            <a-form-item :label="t('properties.profile.phone2')"><a-input v-model:value="form.phoneNumber2" :maxlength="50" /></a-form-item>
            <a-form-item :label="t('properties.profile.email')"><a-input v-model:value="form.emailAddress" type="email" :maxlength="100" /></a-form-item>
            <a-form-item :label="t('properties.profile.websiteLink')"><a-input v-model:value="form.website" :maxlength="255" /></a-form-item>
          </a-form>
        </section>

        <section class="profile-card edit-card">
          <h2>{{ t('properties.profile.hotelLocation') }} <span>⌄</span></h2>
          <a-form layout="vertical">
            <a-form-item :label="t('properties.profile.fullAddress')" required><a-textarea v-model:value="form.location" :rows="2" :maxlength="255" /></a-form-item>
            <a-form-item :label="t('properties.profile.exactCoordinates')">
              <div class="map-placeholder"><div class="map-grid" /><EnvironmentFilled class="map-pin" /><span>{{ t('properties.profile.mapTip') }}</span><b class="map-plus">+</b><b class="map-minus">−</b></div>
            </a-form-item>
            <div class="form-grid compact">
              <a-form-item :label="t('properties.profile.latitude')"><a-input v-model:value="form.latitude" inputmode="decimal" /></a-form-item>
              <a-form-item :label="t('properties.profile.longitude')"><a-input v-model:value="form.longitude" inputmode="decimal" /></a-form-item>
              <a-form-item :label="t('properties.profile.country')"><a-input v-model:value="form.countryCode" :maxlength="2" /></a-form-item>
              <a-form-item :label="t('properties.profile.city')"><a-input v-model:value="form.cityKey" :maxlength="80" /></a-form-item>
            </div>
          </a-form>
        </section>

        <section class="profile-card edit-card">
          <h2>{{ t('properties.profile.hotelHighlight') }} <span>⌄</span></h2>
          <a-form layout="vertical"><a-form-item :label="t('properties.profile.highlight')"><a-textarea v-model:value="form.description" :rows="4" /></a-form-item></a-form>
        </section>

        <section class="profile-card edit-card images-editor">
          <div class="section-head">
            <h2>{{ t('properties.profile.hotelImages') }} <em>{{ t('properties.profile.activeOnly', { active: activeImages.length, total: form.imageGallery.length }) }}</em></h2>
            <div><input ref="fileInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="uploadImage" /><a-button type="primary" :loading="uploading" @click="chooseImage"><PlusOutlined />{{ t('properties.profile.addNewImage') }}</a-button><span class="collapse-mark">⌄</span></div>
          </div>
          <p class="upload-hint">{{ t('properties.profile.uploadHint') }}</p>
          <div v-if="form.imageGallery.length" class="edit-image-grid">
            <article v-for="(image, index) in form.imageGallery" :key="`${image.url}-${index}`" class="image-editor-card">
              <div class="image-frame" :class="{ disabled: !image.enabled }"><img :src="image.url" :alt="t('properties.profile.imageAlt', { name: form.propertyName, index: index + 1 })" /><button type="button" :aria-label="t('common.delete')" @click="removeImage(index)"><DeleteOutlined /></button></div>
              <div class="image-status"><span>{{ t('properties.profile.imageStatus') }}</span><a-switch v-model:checked="image.enabled" /></div>
            </article>
          </div>
          <div v-else class="image-empty"><span>▧</span><p>{{ t('properties.profile.noImages') }}</p></div>
        </section>

      </template>
      <HotelAmenities v-else-if="editingTab === 'amenities'" v-model="form.amenities" editing />
      <HotelLongStay v-else-if="editingTab === 'long-stay'" v-model="form.longStay" editing />
      <HotelPolicies v-else-if="editingTab === 'policies'" v-model="form.hotelPolicies" :currency="metrics.currency" editing />
      <HotelNearby v-else-if="editingTab === 'nearby'" v-model="form.nearbyAttractions" :property-id="propertyId" editing />

      <footer v-if="editing" class="edit-actions">
        <a-button :disabled="saving" @click="cancelEdit">{{ t('common.cancel') }}</a-button>
        <a-button v-perm="'mch:properties:profile-edit'" :loading="saving" @click="save(false)">{{ t('rooms.actions.saveDraft') }}</a-button>
        <a-button v-perm="'mch:properties:profile-submit'" type="primary" :loading="saving" @click="save(true)">{{ t('rooms.actions.submitReview') }}</a-button>
      </footer>
    </a-spin>
  </main>
</template>

<style scoped lang="less">
.profile-page {
  --profile-primary: #4d6cf4;
  --profile-text: #181b2a;
  --profile-muted: #8c8f9b;
  --profile-border: #e9ebf2;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 56px);
  padding: 22px 28px 48px;
  background: #f7f8fc;
  color: var(--profile-text);
}
.profile-page :deep(.ant-btn-primary) { background: var(--profile-primary); border-color: var(--profile-primary); box-shadow: none; }
/* a-spin 的两层包裹容器也要撑满,底部操作栏才能被 margin-top:auto 顶到页面底部 */
.profile-page :deep(.ant-spin-nested-loading), .profile-page :deep(.ant-spin-container) { display: flex; flex: 1; flex-direction: column; }
.profile-head, .edit-head, .section-head, .actions, .edit-actions { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.profile-head { margin-bottom: 18px; }
.profile-head h1 { margin: 0 0 4px; font-size: 22px; line-height: 30px; font-weight: 700; }
.profile-head p { max-width: 600px; margin: 0; color: var(--profile-muted); font-size: 13px; line-height: 19px; }
.profile-head .ant-btn { height: 38px; border-radius: 6px; padding: 0 17px; }
.edit-head { justify-content: flex-start; margin: 0 0 18px; }
.edit-head button { border: 0; background: none; color: #7e8391; cursor: pointer; }
.edit-head strong { padding-left: 14px; border-left: 1px solid #dfe2ea; font-size: 15px; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
.summary-card, .profile-card, .profile-tabs { border: 1px solid var(--profile-border); border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.summary-card { min-height: 85px; padding: 15px 16px; }
.summary-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--profile-muted); font-size: 11px; }
.summary-card strong { display: block; margin-top: 15px; overflow: hidden; font-size: 16px; line-height: 22px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-size: 14px; }
.metric-icon.amber { color: #ed9a3a; background: #fff7e9; }.metric-icon.blue { color: #5b83f5; background: #eef4ff; }.metric-icon.gold { color: #f7bd22; background: #fffbea; }
.profile-tabs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-bottom: 16px; padding: 0 12px; overflow-x: auto; }
.profile-tabs button { position: relative; height: 48px; padding: 0 8px; border: 0; background: transparent; color: #858895; font-weight: 600; white-space: nowrap; cursor: pointer; }.profile-tabs button:disabled { cursor: not-allowed; }
.profile-tabs button.active { color: var(--profile-primary); }
.profile-tabs button.active::after { position: absolute; right: 6px; bottom: 0; left: 6px; height: 3px; border-radius: 3px 3px 0 0; background: var(--profile-primary); content: ''; }
.state-alert { margin-bottom: 16px; }
.profile-card { margin-bottom: 16px; padding: 15px 16px; }
.profile-card h2 { margin: 0; font-size: 14px; line-height: 22px; font-weight: 700; }
.section-head { min-height: 32px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
/* 只染「默认(描边)」按钮;主按钮被这条规则命中会把白字染成主色,在蓝底上几乎看不见
   —— Hotel Images 卡头的 Add New 就是这么被误伤的(用户截图) */
.section-head .ant-btn:not(.ant-btn-primary) { border-color: var(--profile-primary); color: var(--profile-primary); }
.details-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 26px; margin: 12px 0 0; }
.details-grid > div { min-height: 67px; padding: 9px 0; border-bottom: 1px solid #f1f2f6; }
.details-grid dt { margin-bottom: 8px; color: var(--profile-muted); font-size: 12px; }.details-grid dd { margin: 0; font-size: 14px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; }
.simple-card h2 { margin-bottom: 13px; color: #7d808b; font-weight: 500; }.simple-card p { margin: 0; font-size: 13px; line-height: 21px; }.empty { color: #a5a8b1; }
.amenities-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 14px; }
.amenity { display: flex; align-items: center; justify-content: space-between; min-height: 38px; padding: 0 13px; border: 1px solid #e5e9f2; border-radius: 20px; color: #496fe8; font-size: 13px; font-weight: 600; }
.amenity i, .view-image i { width: 8px; height: 8px; border-radius: 50%; background: #16c96b; box-shadow: 0 0 0 3px rgb(22 201 107 / 12%); }
.view-image-grid, .edit-image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.view-image, .image-frame { position: relative; overflow: hidden; border-radius: 3px; background: #edf0f4; aspect-ratio: 4 / 3; }.view-image img, .image-frame img { width: 100%; height: 100%; object-fit: cover; }.view-image.disabled img { filter: grayscale(1); opacity: .62; }.view-image i { position: absolute; top: 10px; left: 10px; }
.image-empty { display: grid; min-height: 150px; place-items: center; align-content: center; color: #a2a6b1; }.image-empty span { font-size: 34px; }.image-empty p { margin: 6px 0 0; }
.actions { margin-top: 22px; }.publication-state { display: flex; align-items: center; gap: 8px; color: #777b88; font-size: 13px; }.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #b9bdc8; }.status-dot.live { background: #16c96b; }
.edit-card > h2 { display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 11px; border-bottom: 1px solid #edf0f4; }.edit-card > h2 span { color: #90939c; font-weight: 400; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }.edit-card :deep(.ant-form-item) { margin-bottom: 14px; }.edit-card :deep(.ant-form-item-label > label) { color: #555a68; font-size: 12px; font-weight: 600; }
.edit-card :deep(.ant-input), .edit-card :deep(.ant-select-selector) { border-color: #e4e7ef; border-radius: 6px; }
.map-placeholder { position: relative; height: 215px; overflow: hidden; border-radius: 7px; background: #e7e9ed; }.map-grid { position: absolute; inset: -30px; transform: rotate(-8deg); opacity: .72; background: linear-gradient(90deg, transparent 45%, #c7d2d9 45%, #c7d2d9 52%, transparent 52%), linear-gradient(0deg, transparent 42%, #fff 42%, #fff 47%, transparent 47%); background-size: 180px 145px; }
.map-pin { position: absolute; top: 48%; left: 57%; transform: translate(-50%, -50%); color: var(--profile-primary); font-size: 38px; filter: drop-shadow(0 3px 3px rgb(77 108 244 / 20%)); }
.map-placeholder > span { position: absolute; bottom: 17px; left: 18px; padding: 10px 13px; border-radius: 6px; background: #fff; color: #d47842; font-size: 12px; font-weight: 600; box-shadow: 0 2px 8px rgb(24 27 42 / 10%); }.map-plus, .map-minus { position: absolute; right: 15px; display: grid; width: 34px; height: 34px; border-radius: 6px; background: #fff; place-items: center; font-size: 22px; font-weight: 400; box-shadow: 0 2px 8px rgb(24 27 42 / 8%); }.map-plus { top: 15px; }.map-minus { top: 57px; }
.images-editor .section-head h2 { display: flex; align-items: center; gap: 8px; }.images-editor em { color: #ca703c; font-size: 12px; font-style: normal; font-weight: 600; }.images-editor .section-head > div { display: flex; align-items: center; gap: 18px; }.collapse-mark { color: #8e929d; }.file-input { display: none; }.upload-hint { margin: 9px 0 14px; color: #969aa6; font-size: 11px; }
.image-frame.disabled img { filter: grayscale(1); opacity: .58; }.image-frame button { position: absolute; top: 8px; right: 8px; display: grid; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: rgb(255 255 255 / 90%); color: #ff3b4d; cursor: pointer; place-items: center; }.image-status { display: flex; align-items: center; justify-content: space-between; padding: 11px 2px 2px; color: #707480; font-size: 12px; font-weight: 600; }
/* margin-top:auto 负责「内容比视口短时也贴页面底」,sticky 负责「内容长时滚动中吸底」 */
.edit-actions { position: sticky; z-index: 3; bottom: 0; margin: auto -28px -48px; padding: 14px 28px; justify-content: flex-end; border-top: 1px solid #e5e8ef; background: rgb(255 255 255 / 96%); box-shadow: 0 -4px 14px rgb(24 27 42 / 5%); }

@media (max-width: 900px) {
  .profile-page { padding: 18px 16px 36px; }.profile-tabs { grid-template-columns: repeat(6, minmax(140px, 1fr)); }.summary-grid { grid-template-columns: 1fr; }.amenities-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.view-image-grid, .edit-image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.edit-actions { margin: auto -16px -36px; padding: 12px 16px; }
}
@media (max-width: 600px) {
  .profile-head { align-items: flex-start; flex-direction: column; }.profile-head .ant-btn { width: 100%; }.details-grid, .form-grid { grid-template-columns: 1fr; }.amenities-grid, .view-image-grid, .edit-image-grid { grid-template-columns: 1fr; }.map-placeholder { height: 180px; }.map-placeholder > span { right: 58px; font-size: 10px; }.images-editor .section-head { align-items: flex-start; flex-direction: column; }.edit-actions { flex-wrap: wrap; }
}
</style>
