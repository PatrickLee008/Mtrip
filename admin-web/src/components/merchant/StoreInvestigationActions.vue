<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiFlagStoreInvestigation, type InvestigationCategory } from '@/api/merchant';

const props = defineProps<{ storeId: number; storeName: string; cardFooter?: boolean }>();
const { t } = useI18n();
const router = useRouter();
const open = ref(false);
const saving = ref(false);
const form = reactive({ category: 'suspected_fraud' as InvestigationCategory, reason: '', evidence: '' });
const categories: InvestigationCategory[] = ['suspected_fraud', 'serious_violation'];

function show() {
  Object.assign(form, { category: 'suspected_fraud', reason: '', evidence: '' });
  open.value = true;
}

async function save() {
  if (saving.value || !form.reason.trim()) return;
  saving.value = true;
  try {
    await apiFlagStoreInvestigation({ ...form, storeId: props.storeId, reason: form.reason.trim(), evidence: form.evidence.trim() });
    open.value = false;
    message.success(t('tip.saveSuccess'));
  } catch { /* The API client displays validation and conflict messages. */ }
  finally { saving.value = false; }
}
</script>

<template>
  <a-button v-perm="'merchant:store:flag'" :type="cardFooter ? 'default' : 'link'" :size="cardFooter ? 'middle' : 'small'"
    @click="show">{{ t('storeInvestigation.flag') }}</a-button>
  <a-button v-perm="'merchant:investigation:list'" :type="cardFooter ? 'default' : 'link'" :size="cardFooter ? 'middle' : 'small'"
    @click="router.push({ path: '/merchant/investigations', query: { storeId: String(storeId) } })">{{ t('storeInvestigation.history') }}</a-button>

  <a-modal v-model:open="open" :title="t('storeInvestigation.flag')" :confirm-loading="saving"
    :ok-button-props="{ disabled: !form.reason.trim() }" :cancel-button-props="{ disabled: saving }"
    :mask-closable="false" :closable="!saving" @ok="save">
    <p>{{ storeName }} · #{{ storeId }}</p>
    <a-alert type="info" show-icon :message="t('storeInvestigation.flagHint')" />
    <a-form layout="vertical" class="flag-form">
      <a-form-item :label="t('storeInvestigation.category')" required>
        <a-select v-model:value="form.category" :options="categories.map(value => ({ value, label: t('storeInvestigation.categories.' + value) }))" />
      </a-form-item>
      <a-form-item :label="t('storeInvestigation.reason')" required>
        <a-textarea v-model:value="form.reason" :maxlength="500" :rows="3" />
      </a-form-item>
      <a-form-item :label="t('storeInvestigation.evidence')">
        <a-textarea v-model:value="form.evidence" :maxlength="500" :rows="2" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.flag-form { margin-top: 16px; }
</style>
