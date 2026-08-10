<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { apiAffiliateProgram, apiAffiliateProgramSave } from '@/api/affiliate';

/**
 * 联盟计划配置(Super Admin Portal 模块 06):佣金规则 + 奖励规则
 * kind: 1佣金 2奖励;config 为 JSON(佣金:{affiliateType,rate,minBookingValue};奖励:{trigger,target,rewardType,rewardValue})
 */
const { t } = useI18n();

interface Rule {
  id: number;
  kind: number;
  name: string;
  enabled: number;
  cfg: Record<string, any>;
}

const loading = ref(false);
const commissionRules = ref<Rule[]>([]);
const rewardRules = ref<Rule[]>([]);

function parseCfg(raw: unknown): Record<string, any> {
  if (raw && typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string' && raw !== '') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}
function toRule(r: Record<string, any>): Rule {
  return { id: r.id, kind: Number(r.kind), name: r.name ?? '', enabled: Number(r.enabled), cfg: parseCfg(r.config) };
}

async function loadProgram(): Promise<void> {
  loading.value = true;
  try {
    const data = await apiAffiliateProgram();
    commissionRules.value = (data.commissionRules ?? []).map(toRule);
    rewardRules.value = (data.rewardRules ?? []).map(toRule);
  } finally {
    loading.value = false;
  }
}

const AFFILIATE_TYPES = ['influencer', 'blogger', 'kol', 'ota_partner', 'corporate', 'user_referral'];
const TRIGGERS = ['registration', 'completed_payment', 'completed_stay'];
const TARGETS = ['referrer', 'referee', 'both'];
const REWARD_TYPES = ['credits', 'cashback', 'points'];

const commissionColumns = [
  { title: 'Name', dataIndex: 'name' },
  { title: 'Affiliate Type', dataIndex: 'affiliateType' },
  { title: 'Rate %', dataIndex: 'rate', width: 100 },
  { title: 'Min Booking', dataIndex: 'minBookingValue', width: 120 },
  { title: 'Enabled', dataIndex: 'enabled', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 90 },
];
const rewardColumns = [
  { title: 'Trigger', dataIndex: 'trigger' },
  { title: 'Target', dataIndex: 'target' },
  { title: 'Reward Type', dataIndex: 'rewardType' },
  { title: 'Value', dataIndex: 'rewardValue', width: 100 },
  { title: 'Enabled', dataIndex: 'enabled', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 90 },
];

// 编辑
const modalOpen = ref(false);
const saving = ref(false);
const editKind = ref(1);
const editingId = ref(0);
const form = reactive({
  name: '',
  enabled: 1,
  // commission
  affiliateType: 'influencer',
  rate: 0,
  minBookingValue: 0,
  // reward
  trigger: 'registration',
  target: 'referrer',
  rewardType: 'credits',
  rewardValue: 0,
});

function openNew(kind: number): void {
  editKind.value = kind;
  editingId.value = 0;
  Object.assign(form, {
    name: '', enabled: 1,
    affiliateType: 'influencer', rate: 0, minBookingValue: 0,
    trigger: 'registration', target: 'referrer', rewardType: 'credits', rewardValue: 0,
  });
  modalOpen.value = true;
}
function openEdit(rule: Rule): void {
  editKind.value = rule.kind;
  editingId.value = rule.id;
  Object.assign(form, {
    name: rule.name,
    enabled: rule.enabled,
    affiliateType: rule.cfg.affiliateType ?? 'influencer',
    rate: Number(rule.cfg.rate ?? 0),
    minBookingValue: Number(rule.cfg.minBookingValue ?? 0),
    trigger: rule.cfg.trigger ?? 'registration',
    target: rule.cfg.target ?? 'referrer',
    rewardType: rule.cfg.rewardType ?? 'credits',
    rewardValue: Number(rule.cfg.rewardValue ?? 0),
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  const config = editKind.value === 1
    ? { affiliateType: form.affiliateType, rate: form.rate, minBookingValue: form.minBookingValue }
    : { trigger: form.trigger, target: form.target, rewardType: form.rewardType, rewardValue: form.rewardValue };
  saving.value = true;
  try {
    await apiAffiliateProgramSave({
      id: editingId.value || undefined,
      kind: editKind.value,
      name: form.name,
      enabled: form.enabled,
      config,
    });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await loadProgram();
  } finally {
    saving.value = false;
  }
}
async function toggleEnabled(rule: Rule): Promise<void> {
  await apiAffiliateProgramSave({
    id: rule.id,
    kind: rule.kind,
    name: rule.name,
    enabled: rule.enabled === 1 ? 0 : 1,
    config: rule.cfg,
  });
  await loadProgram();
}

onMounted(() => {
  void loadProgram();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px" :loading="loading">
      <template #title>Commission Rules</template>
      <template #extra>
        <a-button v-perm="'affiliate:program:save'" type="primary" size="small" @click="openNew(1)">
          <template #icon><PlusOutlined /></template>New Rule
        </a-button>
      </template>
      <a-table :columns="commissionColumns" :data-source="commissionRules" row-key="id" size="middle" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'affiliateType'">{{ record.cfg.affiliateType }}</template>
          <template v-else-if="column.dataIndex === 'rate'">{{ record.cfg.rate }}%</template>
          <template v-else-if="column.dataIndex === 'minBookingValue'">{{ record.cfg.minBookingValue }}</template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-switch :checked="record.enabled === 1" size="small" @change="toggleEnabled(record)" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'affiliate:program:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
      <template #title>Reward Rules</template>
      <template #extra>
        <a-button v-perm="'affiliate:program:save'" type="primary" size="small" @click="openNew(2)">
          <template #icon><PlusOutlined /></template>New Rule
        </a-button>
      </template>
      <a-table :columns="rewardColumns" :data-source="rewardRules" row-key="id" size="middle" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'trigger'">{{ record.cfg.trigger }}</template>
          <template v-else-if="column.dataIndex === 'target'">{{ record.cfg.target }}</template>
          <template v-else-if="column.dataIndex === 'rewardType'">{{ record.cfg.rewardType }}</template>
          <template v-else-if="column.dataIndex === 'rewardValue'">{{ record.cfg.rewardValue }}</template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-switch :checked="record.enabled === 1" size="small" @change="toggleEnabled(record)" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'affiliate:program:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : t('common.add')" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '130px' } }" style="margin-top: 12px">
        <a-form-item label="Name"><a-input v-model:value="form.name" /></a-form-item>
        <template v-if="editKind === 1">
          <a-form-item label="Affiliate Type">
            <a-select v-model:value="form.affiliateType">
              <a-select-option v-for="tp in AFFILIATE_TYPES" :key="tp" :value="tp">{{ tp }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Rate %"><a-input-number v-model:value="form.rate" :min="0" :max="100" :step="0.5" style="width: 100%" /></a-form-item>
          <a-form-item label="Min Booking"><a-input-number v-model:value="form.minBookingValue" :min="0" style="width: 100%" /></a-form-item>
        </template>
        <template v-else>
          <a-form-item label="Trigger">
            <a-select v-model:value="form.trigger">
              <a-select-option v-for="tg in TRIGGERS" :key="tg" :value="tg">{{ tg }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Target">
            <a-select v-model:value="form.target">
              <a-select-option v-for="tg in TARGETS" :key="tg" :value="tg">{{ tg }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Reward Type">
            <a-select v-model:value="form.rewardType">
              <a-select-option v-for="rt in REWARD_TYPES" :key="rt" :value="rt">{{ rt }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Reward Value"><a-input-number v-model:value="form.rewardValue" :min="0" style="width: 100%" /></a-form-item>
        </template>
        <a-form-item label="Enabled">
          <a-switch :checked="form.enabled === 1" @change="(v) => (form.enabled = v ? 1 : 0)" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
