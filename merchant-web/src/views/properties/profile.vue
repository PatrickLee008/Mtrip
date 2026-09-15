<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { apiPropertyProfile, apiPropertyProfileSave, apiPropertyPublish } from '@/api/properties';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const propertyId = Number(route.params.id);
const loading = ref(false);
const saving = ref(false);
const property = ref<Record<string, unknown>>({});
const latest = ref<(Record<string, unknown> & { status: number; reject_reason: string }) | null>(null);
const form = reactive({ propertyName: '', location: '', countryCode: '', cityKey: '', description: '', starLevel: 0, website: '', checkinTime: '', checkoutTime: '', facilitiesText: '', imagesText: '' });
const reviewStatus = computed(() => latest.value?.status ?? Number(property.value.content_status || 0));
const reviewLabel = computed(() => t(`properties.profile.reviewStatus.${reviewStatus.value}`));
const isPublic = computed(() => Number(property.value.kyc_status) === 1 && Number(property.value.content_status) === 2
  && Number(property.value.content_approved_version) > 0 && Number(property.value.publish_status) === 1
  && Number(property.value.status) === 1 && Number(property.value.operating_status) === 1
  && Number(property.value.display_enabled) === 1 && Number(property.value.live_room_count) > 0);
const publicationLabel = computed(() => {
  if (Number(property.value.kyc_status) !== 1) return t(`properties.kycStatus.${Number(property.value.kyc_status || 0)}`);
  if (Number(property.value.content_status) !== 2 || Number(property.value.content_approved_version) <= 0) return t('properties.publication.profilePending');
  if (Number(property.value.publish_status) !== 1) return t('properties.publication.unpublished');
  if (Number(property.value.status) !== 1 || Number(property.value.operating_status) !== 1 || Number(property.value.live_room_count) <= 0) return t('properties.publication.offline');
  if (Number(property.value.display_enabled) !== 1) return t('properties.publication.platformHidden');
  return t('properties.publication.live');
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await apiPropertyProfile(propertyId);
    property.value = data.property;
    latest.value = data.latestRevision;
    const row = data.editable;
    Object.assign(form, {
      propertyName: String(row.store_name || ''), location: String(row.address || ''),
      countryCode: String(row.country_code || ''), cityKey: String(row.city_key || ''),
      description: String(row.description || ''), starLevel: Number(row.star_level || 0),
      website: String(row.website || ''), checkinTime: String(row.checkin_time || ''), checkoutTime: String(row.checkout_time || ''),
      facilitiesText: Array.isArray(row.facilities) ? row.facilities.join(', ') : '',
      imagesText: Array.isArray(row.images) ? row.images.join('\n') : '',
    });
  } finally { loading.value = false; }
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
      propertyId, submit: submit ? 1 : 0, propertyName: form.propertyName.trim(), location: form.location.trim(),
      countryCode: form.countryCode.trim().toUpperCase(), cityKey: form.cityKey.trim(), description: form.description.trim(),
      starLevel: form.starLevel, website: form.website.trim(), checkinTime: form.checkinTime.trim(), checkoutTime: form.checkoutTime.trim(),
      facilities: form.facilitiesText.split(',').map((item) => item.trim()).filter(Boolean),
      images: form.imagesText.split('\n').map((item) => item.trim()).filter(Boolean),
    });
    message.success(t(submit ? 'properties.profile.submitted' : 'common.saveSuccess'));
    await load();
  } finally { saving.value = false; }
}

async function togglePublish(): Promise<void> {
  const enabled = Number(property.value.publish_status || 0) !== 1;
  await apiPropertyPublish(propertyId, enabled);
  message.success(t(enabled ? 'properties.profile.published' : 'properties.profile.offline'));
  await load();
}

onMounted(load);
</script>

<template>
  <PageContainer>
    <a-spin :spinning="loading">
      <div class="profile-head">
        <div><a-button type="text" @click="router.push('/properties')"><ArrowLeftOutlined />{{ t('sidebar.allProperties') }}</a-button><h1>{{ t('properties.profile.title') }}</h1><p>{{ t('properties.profile.subtitle') }}</p></div>
        <a-space><a-tag :color="reviewStatus === 2 ? 'success' : reviewStatus === 3 ? 'error' : 'processing'">{{ reviewLabel }}</a-tag><a-tag :color="isPublic ? 'blue' : 'default'">{{ publicationLabel }}</a-tag></a-space>
      </div>
      <a-alert v-if="latest?.status === 3" type="error" show-icon :message="t('properties.profile.rejected')" :description="latest.reject_reason" class="state-alert" />
      <a-alert v-else-if="latest?.status === 1" type="info" show-icon :message="t('properties.profile.pending')" class="state-alert" />
      <a-card :title="t('properties.profile.basic')" class="profile-card">
        <a-form layout="vertical">
          <div class="form-grid">
            <a-form-item :label="t('properties.new.name')" required><a-input v-model:value="form.propertyName" :maxlength="100" /></a-form-item>
            <a-form-item :label="t('properties.new.location')" required><a-input v-model:value="form.location" :maxlength="255" /></a-form-item>
            <a-form-item :label="t('properties.profile.country')"><a-input v-model:value="form.countryCode" :maxlength="2" /></a-form-item>
            <a-form-item :label="t('properties.profile.city')"><a-input v-model:value="form.cityKey" :maxlength="80" /></a-form-item>
            <a-form-item :label="t('properties.profile.star')"><a-rate v-model:value="form.starLevel" /></a-form-item>
            <a-form-item :label="t('properties.profile.website')"><a-input v-model:value="form.website" :maxlength="255" /></a-form-item>
            <a-form-item :label="t('properties.profile.checkin')"><a-input v-model:value="form.checkinTime" :maxlength="20" /></a-form-item>
            <a-form-item :label="t('properties.profile.checkout')"><a-input v-model:value="form.checkoutTime" :maxlength="20" /></a-form-item>
            <a-form-item class="wide" :label="t('properties.profile.description')"><a-textarea v-model:value="form.description" :rows="5" /></a-form-item>
            <a-form-item class="wide" :label="t('properties.profile.facilities')"><a-input v-model:value="form.facilitiesText" /></a-form-item>
            <a-form-item class="wide" :label="t('properties.profile.images')"><a-textarea v-model:value="form.imagesText" :rows="4" :placeholder="t('properties.profile.imagesHint')" /></a-form-item>
          </div>
        </a-form>
      </a-card>
      <div class="actions">
        <a-button v-if="Number(property.content_status) === 2" v-perm="'mch:properties:publish'" @click="togglePublish">{{ t(Number(property.publish_status) === 1 ? 'properties.profile.takeOffline' : 'properties.profile.publish') }}</a-button>
        <a-space><a-button v-perm="'mch:properties:profile-edit'" :disabled="latest?.status === 1" :loading="saving" @click="save(false)">{{ t('rooms.actions.saveDraft') }}</a-button><a-button v-perm="'mch:properties:profile-submit'" type="primary" :disabled="latest?.status === 1" :loading="saving" @click="save(true)">{{ t('rooms.actions.submitReview') }}</a-button></a-space>
      </div>
    </a-spin>
  </PageContainer>
</template>

<style scoped lang="less">
.profile-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}.profile-head h1{margin:8px 0 2px;font-size:24px}.profile-head p{margin:0;color:#64748b}.state-alert{margin-bottom:16px}.profile-card{border-radius:12px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.wide{grid-column:1/-1}.actions{display:flex;justify-content:space-between;margin-top:16px}@media(max-width:700px){.profile-head,.actions{display:block}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.actions>:last-child{margin-top:12px}}
</style>
