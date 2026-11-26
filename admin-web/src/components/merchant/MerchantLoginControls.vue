<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { apiMerchantLoginControls, apiMerchantLoginControlChange, type MerchantLoginControls } from '@/api/merchant';

const props = defineProps<{ merchantId: number }>();
const { t } = useI18n();
const data = ref<MerchantLoginControls | null>(null);
const loading = ref(false);
const opened = ref(false);
const target = ref<{ action: string; deviceId?: number }>();
const reason = ref('');
const reviewed = ref(false);
const saving = ref(false);
const isEnable = computed(() => target.value?.action.startsWith('enable_') === true);
let request = 0;

async function load() {
  const current = ++request;
  loading.value = true;
  try {
    const result = await apiMerchantLoginControls(props.merchantId);
    if (request === current) data.value = result;
  } catch { /* The API client reports errors. */ }
  finally { if (request === current) loading.value = false; }
}

watch(() => props.merchantId, () => {
  ++request;
  data.value = null;
  target.value = undefined;
  loading.value = false;
  opened.value = false;
});

function choose(action: string, deviceId?: number) {
  target.value = { action, deviceId };
  reason.value = '';
  reviewed.value = false;
}

function labelMethod(method = ''): string {
  const key = 'merchantLoginControl.methods.' + method.split(':')[0];
  const label = t(key);
  return label === key ? method || '—' : label;
}

async function save() {
  if (!target.value || !reason.value.trim() || saving.value || (isEnable.value && !reviewed.value)) return;
  const merchantId = props.merchantId;
  saving.value = true;
  try {
    await apiMerchantLoginControlChange({ merchantId, ...target.value, reason: reason.value.trim(), reviewed: reviewed.value ? 1 : 0 });
    if (props.merchantId !== merchantId) return;
    target.value = undefined;
    message.success(t('tip.saveSuccess'));
    await load();
  } catch { /* Preserve the operator's input after a failed request. */ }
  finally { saving.value = false; }
}

function open() {
  opened.value = true;
  void load();
}
</script>

<template>
  <a-button v-perm="'merchant:list:security'" type="default" size="small" class="login-controls-trigger" @click="open">
    {{ t('merchantLoginControl.title') }}
  </a-button>
  <a-drawer v-model:open="opened" :title="t('merchantLoginControl.title')" width="min(740px, 100vw)">
    <a-spin :spinning="loading">
      <div v-if="data" class="login-controls">
        <section>
          <h3>{{ t('merchantLoginControl.loginMethods') }}</h3>
          <div v-for="method in data.methods" :key="method.method" class="control-row">
            <div><strong>{{ labelMethod(method.method) }}</strong>
              <div class="secondary">{{ method.identifier || '—' }}</div>
            </div>
            <a-space wrap>
              <a-tag :color="method.enabled ? 'success' : 'default'">{{ t(method.enabled ? 'common.enabled' : 'common.disabled') }}</a-tag>
              <a-button v-if="method.method !== 'access_code'" v-perm="'merchant:list:security'" size="small" :danger="method.allowed"
                @click="choose((method.allowed ? 'disable_' : 'enable_') + method.method)">
                {{ t(method.allowed ? 'merchantLoginControl.disable' : 'merchantLoginControl.enable') }}
              </a-button>
            </a-space>
          </div>
        </section>
        <section>
          <h3>{{ t('merchantLoginControl.lastLogin') }}</h3>
          <div v-if="data.lastLogin" class="control-row">
            <div><strong>{{ labelMethod(data.lastLogin.method) }}</strong>
              <div class="secondary">{{ data.lastLogin.device_name || data.lastLogin.client || '—' }} · {{ data.lastLogin.ip_address || '—' }}</div>
            </div>
            <span>{{ data.lastLogin.logged_in_at }} UTC</span>
          </div>
          <a-empty v-else :image="null" />
        </section>
        <section>
          <div class="section-heading">
            <h3>{{ t('merchantLoginControl.sessions') }} ({{ data.sessions.length }})</h3>
            <a-button v-perm="'merchant:list:security'" size="small" danger @click="choose('logout_all')">{{ t('merchantLoginControl.actions.logout_all') }}</a-button>
          </div>
          <div v-for="session in data.sessions" :key="session.id" class="control-row">
            <div><strong>{{ session.username }} · {{ labelMethod(session.method) }}</strong>
              <div class="secondary">{{ session.client }} · {{ session.device_name || '—' }} · {{ session.ip_address || '—' }}</div>
            </div>
            <span>{{ session.logged_in_at }} UTC</span>
          </div>
          <a-empty v-if="!data.sessions.length" :image="null" />
        </section>
        <section>
          <h3>{{ t('merchantLoginControl.devices') }} ({{ data.devices.length }})</h3>
          <div v-for="device in data.devices" :key="device.id" class="control-row">
            <div><strong>{{ device.device_name || device.platform }} · #{{ device.id }}</strong>
              <div class="secondary">{{ device.trusted_at }} UTC</div>
            </div>
            <a-button v-perm="'merchant:list:security'" size="small" danger @click="choose('revoke_device', device.id)">
              {{ t('merchantLoginControl.actions.revoke_device') }}
            </a-button>
          </div>
          <a-empty v-if="!data.devices.length" :image="null" />
        </section>
        <section>
          <h3>{{ t('merchantLoginControl.audit') }}</h3>
          <div v-for="entry in data.audit" :key="entry.id" class="control-row">
            <div><strong>{{ t('merchantLoginControl.actions.' + entry.action) }}</strong>
              <div class="secondary">{{ entry.actor_name }} · {{ entry.reason }}</div>
              <div class="secondary">{{ t('merchantLoginControl.impact', {
                sessions: entry.changes.sessions?.length || 0, devices: entry.changes.devices?.length || 0, pairings: entry.changes.pairings || 0,
              }) }}</div>
              <div v-if="entry.changes.before !== undefined" class="secondary">
                {{ t('merchantLoginControl.transition', {
                  before: t('merchantLoginControl.states.' + entry.changes.before), after: t('merchantLoginControl.states.' + entry.changes.after),
                }) }}
              </div>
            </div>
            <span>{{ entry.created_at }} UTC</span>
          </div>
          <a-empty v-if="!data.audit.length" :image="null" />
        </section>
      </div>
      <a-button v-else-if="!loading" @click="load">{{ t('common.refresh') }}</a-button>
    </a-spin>
  </a-drawer>
  <a-modal :open="!!target" :title="target ? t('merchantLoginControl.actions.' + target.action) : ''"
    :confirm-loading="saving" :ok-button-props="{ disabled: !reason.trim() || (isEnable && !reviewed), danger: !isEnable }"
    @ok="save" @cancel="target = undefined">
    <a-alert v-if="!isEnable" type="warning" show-icon
      :message="t(target?.action === 'revoke_device' ? 'merchantLoginControl.deviceImpact' : 'merchantLoginControl.logoutImpact')" />
    <a-form layout="vertical" class="confirmation">
      <a-form-item :label="t('merchantLoginControl.reason')" required>
        <a-textarea v-model:value="reason" :maxlength="500" :rows="3" show-count />
      </a-form-item>
      <a-checkbox v-if="isEnable" v-model:checked="reviewed">{{ t('merchantLoginControl.reviewed') }}</a-checkbox>
    </a-form>
  </a-modal>
</template>

<style scoped>
.login-controls-trigger { margin-inline-start: auto; font-size: 12px; }
.login-controls { display: grid; gap: 20px; }
.section-heading, .control-row { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
.control-row { border-top: 1px solid #e2e8f0; padding: 10px 0; overflow-wrap: anywhere; }
.secondary { color: #64748b; font-size: 12px; }
.confirmation { margin-top: 12px; }
</style>
