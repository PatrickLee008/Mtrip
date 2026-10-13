<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiClaimPhone, apiClaimEmail, apiClaimFinish } from '@/api/auth';
import PublicLanguageSwitcher from '@/components/PublicLanguageSwitcher.vue';

const { t } = useI18n();
const busy = ref(false);
const step = ref(0);
const form = reactive({ applicationNo: '', phone: '', code: '', token: '', recipient: '' });
const deliveryStatus = ref('');

async function submit(): Promise<void> {
  busy.value = true;
  try {
    if (step.value === 0) {
      const result = await apiClaimPhone(form.applicationNo, form.phone);
      form.token = result.challengeToken;
      form.recipient = result.recipient;
      step.value = 1;
    } else if (step.value === 1) {
      const result = await apiClaimEmail(form.token, form.code);
      form.token = result.challengeToken;
      form.recipient = result.recipient;
      form.code = '';
      step.value = 2;
    } else {
      const result = await apiClaimFinish(form.token, form.code);
      deliveryStatus.value = result.deliveries.some(item => item.channel === 'email' && ['accepted', 'delivered'].includes(item.status)) ? 'accepted' : 'pending';
      step.value = 3;
    }
  } finally { busy.value = false; }
}
</script>

<template>
  <main class="claim-page">
    <div class="claim-language"><PublicLanguageSwitcher /></div>
    <a-card class="claim-card" :title="t('credentialClaim.title')">
      <p>{{ t('credentialClaim.description') }}</p>
      <a-alert type="info" show-icon :message="t('credentialClaim.notice')" />
      <a-form v-if="step < 3" layout="vertical" @finish="submit">
        <template v-if="step === 0">
          <a-form-item :label="t('credentialClaim.applicationNo')" required><a-input v-model:value="form.applicationNo" :maxlength="30" /></a-form-item>
          <a-form-item :label="t('credentialClaim.phone')" required><a-input v-model:value="form.phone" placeholder="+959…" /></a-form-item>
        </template>
        <template v-else>
          <p>{{ t(step === 1 ? 'credentialClaim.phoneCode' : 'credentialClaim.emailCode') }} · {{ form.recipient }}</p>
          <a-form-item :label="t('contactSecurity.code')" required><a-input v-model:value="form.code" :maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></a-form-item>
        </template>
        <a-button type="primary" html-type="submit" :loading="busy" block>{{ t(step === 2 ? 'credentialClaim.claim' : 'contactSecurity.next') }}</a-button>
      </a-form>
      <a-alert v-else :type="deliveryStatus === 'accepted' ? 'success' : 'warning'" show-icon :message="t(`credentialClaim.${deliveryStatus}`)" />
      <a-button v-if="step > 0" class="restart" @click="step = 0; form.code = ''; form.token = ''">{{ t('credentialClaim.restart') }}</a-button>
      <router-link to="/activate">{{ t('credentialClaim.activate') }}</router-link>
      <router-link to="/login">{{ t('credentialClaim.login') }}</router-link>
    </a-card>
  </main>
</template>

<style scoped>
.claim-page { position: relative; min-height: 100vh; display: grid; place-items: center; padding: 76px 24px 24px; background: var(--mtrip-bg-soft); }
.claim-language { position: absolute; top: 20px; right: 24px; }
.claim-card { width: 100%; max-width: 480px; }
.claim-card form { margin-top: 20px; }
.claim-card a { display: inline-block; margin: 20px 20px 0 0; }
.restart { margin-top: 16px; }
</style>
