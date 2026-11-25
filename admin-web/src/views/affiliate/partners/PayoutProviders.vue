<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiAffiliatePayoutProviders, apiSaveAffiliatePayoutProvider, type AffiliatePayoutProvider } from '@/api/affiliate';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';

const { t } = useI18n();
const siteId = ref<number>();
const providers = ref<AffiliatePayoutProvider[]>([]);
const loadedSite = ref<number>();
const kind = ref<'bank' | 'wallet'>('bank');
const name = ref('');
const busy = ref(false);

async function load(): Promise<void> {
  if (!siteId.value || busy.value) return;
  const requested = siteId.value;
  busy.value = true;
  providers.value = [];
  loadedSite.value = undefined;
  try {
    providers.value = await apiAffiliatePayoutProviders(requested);
    loadedSite.value = requested;
  } finally {
    busy.value = false;
  }
}

async function save(provider?: AffiliatePayoutProvider): Promise<void> {
  const site = loadedSite.value;
  if (!site || busy.value) return;
  busy.value = true;
  try {
    await apiSaveAffiliatePayoutProvider(provider
      ? { siteId: site, id: provider.id, enabled: provider.enabled ? 0 : 1 }
      : { siteId: site, kind: kind.value, name: name.value.trim(), enabled: 1 });
    name.value = '';
    providers.value = await apiAffiliatePayoutProviders(site);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <a-card v-perm="'affiliate:payout-provider:manage'" :title="t('affiliatePayout.providers')" :bordered="false" style="margin-bottom: 16px">
    <a-form layout="inline" @submit.prevent="load">
      <a-form-item :label="t('common.site')">
        <SiteTreeSelect v-model:value="siteId" :disabled="busy" style="width: 180px" />
      </a-form-item>
      <a-form-item>
        <a-button html-type="submit" :loading="busy" :disabled="!siteId">{{ t('common.search') }}</a-button>
      </a-form-item>
    </a-form>
    <template v-if="loadedSite && loadedSite === siteId">
      <a-form layout="inline" style="margin-top: 12px" @submit.prevent="save()">
        <a-form-item :label="t('affiliatePayout.providerName')">
          <a-input v-model:value="name" :maxlength="80" :disabled="busy" />
        </a-form-item>
        <a-form-item>
          <a-select v-model:value="kind" :disabled="busy" style="width: 140px">
            <a-select-option value="bank">{{ t('affiliatePayout.bank') }}</a-select-option>
            <a-select-option value="wallet">{{ t('affiliatePayout.wallet') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :disabled="!name.trim()" :loading="busy">{{ t('common.add') }}</a-button>
        </a-form-item>
      </a-form>
      <a-list size="small" :data-source="providers">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-space>{{ item.name }} · {{ t('affiliatePayout.' + item.kind) }}</a-space>
            <template #actions>
              <a-button type="link" :disabled="busy" @click="save(item)">
                {{ t(item.enabled ? 'affiliatePayout.disableProvider' : 'affiliatePayout.enableProvider') }}
              </a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </template>
  </a-card>
</template>
