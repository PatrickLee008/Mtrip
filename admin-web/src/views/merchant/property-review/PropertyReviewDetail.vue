<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { ArrowLeftOutlined, BankOutlined, CheckCircleOutlined, InfoCircleOutlined, LockOutlined, MessageOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { apiMerchantPropertyContentAudit, apiMerchantPropertyContentDetail } from '@/api/merchant';
import PageContainer from '@/components/PageContainer.vue';
import ReviewValue from './ReviewValue.vue';

const props = defineProps<{ revisionId: number }>();
const emit = defineEmits<{ close: []; reviewed: [] }>();
const { t } = useI18n();
const prefix = 'merchant.propertyReviewPage.';
const tabs = {
  profile: ['store_name', 'star_level', 'city_key', 'checkin_time', 'checkout_time', 'description', 'country_code',
    'address', 'latitude', 'longitude', 'contact_phone', 'contact_phone2', 'contact_email', 'website', 'nearby_attractions'],
  amenities: ['amenities', 'facilities', 'image_gallery', 'images', 'addons'],
  policies: ['hotel_policies.booking', 'hotel_policies.checkIn', 'hotel_policies.checkOut', 'hotel_policies.pet', 'hotel_policies.children', 'hotel_policies.rules'],
  longStay: ['long_stay.promotions', 'long_stay.benefits'],
};
type Tab = keyof typeof tabs;
const active = ref<Tab>('profile');
const detail = ref<Awaited<ReturnType<typeof apiMerchantPropertyContentDetail>> | null>(null);
const failed = ref(false);
const loading = ref(false);
const saving = ref(false);
const reason = ref('');
const reasonInput = ref<{ focus: () => void }>();
let request = 0;

// JSONObject key order and generated row IDs are not visible profile changes. List order is visible.
function comparable(value: unknown, field: string): unknown {
  if (typeof value === 'string' && value.trim() && ['latitude', 'longitude', 'star_level'].includes(field)) {
    return Number(value);
  }
  if (Array.isArray(value)) return value.map(item => comparable(item, field));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => key !== 'id').sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, comparable(item, key)]));
  }
  return value ?? '';
}

const rows = computed(() => {
  const baseline = detail.value?.baseline;
  const submitted = detail.value?.revision.payload;
  return Object.entries(tabs).flatMap(([tab, fields]) => fields.flatMap(path => {
    const [key, child] = path.split('.');
    const before = child ? baseline?.[key]?.[child] : baseline?.[key];
    const after = child ? submitted?.[key]?.[child] : submitted?.[key];
    if (before === undefined && after === undefined) return [];
    return [{ tab, field: child || key, before, after,
      changed: !!baseline && after !== undefined && JSON.stringify(comparable(before, key)) !== JSON.stringify(comparable(after, key)) }];
  }));
});
const changeCount = computed(() => rows.value.filter(row => row.changed).length);
const visible = computed(() => rows.value.filter(row => row.tab === active.value));
function changesIn(tab: string) {
  return rows.value.filter(row => row.tab === tab && row.changed).length;
}
const status = computed(() => Number(detail.value?.revision.status));
const colors: Record<number, string> = { 0: 'default', 1: 'warning', 2: 'success', 3: 'error' };

async function load() {
  const token = ++request;
  loading.value = true;
  failed.value = false;
  detail.value = null;
  try {
    const data = await apiMerchantPropertyContentDetail(props.revisionId);
    if (token === request) detail.value = data;
  } catch {
    if (token === request) failed.value = true;
  } finally {
    if (token === request) loading.value = false;
  }
}

watch(() => props.revisionId, () => {
  reason.value = '';
  active.value = 'profile';
  saving.value = false;
  void load();
}, { immediate: true });

async function audit(auditStatus: 1 | 2) {
  if (saving.value || status.value !== 1 || Number(detail.value?.revision.id) !== props.revisionId) return;
  const auditRemark = auditStatus === 2 ? reason.value.trim() : '';
  if (auditStatus === 2 && !auditRemark) {
    message.warning(t('goods.audit.auditModal.warningRejectReasonRequired'));
    reasonInput.value?.focus();
    return;
  }
  const id = props.revisionId;
  const token = request;
  saving.value = true;
  try {
    await apiMerchantPropertyContentAudit({ id, auditStatus, auditRemark });
    if (token !== request) return;
    message.success(t(auditStatus === 1 ? 'goods.audit.propertyReview.successApprove' : 'goods.audit.propertyReview.successReject'));
    emit('reviewed');
  } catch {
    // The server may already have applied the decision, even after a network error.
    if (token === request) await load();
  } finally {
    if (id === props.revisionId) saving.value = false;
  }
}
</script>

<template>
  <PageContainer class="review-page">
    <article class="review-detail" :aria-busy="loading">
      <header>
        <a-button type="text" size="small" :disabled="saving" @click="emit('close')">
          <template #icon><ArrowLeftOutlined /></template>{{ t('common.back') }}
        </a-button>
        <div v-if="detail" class="heading">
          <div class="identity">
            <span class="hotel-icon"><BankOutlined /></span>
            <div>
              <div class="title-line">
                <h1>{{ t(prefix + 'reviewTitle', { name: detail.revision.payload.store_name || detail.revision.store_name }) }}</h1>
                <a-tag :color="colors[status]">{{ t(prefix + 'status.' + status) }}</a-tag>
              </div>
              <div class="meta">
                <b>#{{ detail.revision.id }} · v{{ detail.revision.version }}</b>
                <span>{{ detail.revision.merchant_name }}</span>
                <span>{{ t('goods.audit.submitTime') }} {{ detail.revision.submitted_at || '—' }}</span>
                <span v-if="detail.revision.reviewed_at">{{ t(prefix + 'reviewedAt') }} {{ detail.revision.reviewed_at }}</span>
                <strong v-if="detail.baseline">{{ t(prefix + 'changes', { count: changeCount }) }}</strong>
              </div>
            </div>
          </div>
          <div v-if="status === 1" class="actions">
            <a-button v-perm="'merchant:property:content-audit'" danger :disabled="saving" @click="audit(2)">
              <template #icon><MessageOutlined /></template>{{ t(prefix + 'corrections') }}
            </a-button>
            <a-popconfirm :title="t('goods.audit.propertyReview.approveNotice')" @confirm="audit(1)">
              <a-button v-perm="'merchant:property:content-audit'" type="primary" :loading="saving">
                <template #icon><CheckCircleOutlined /></template>{{ t(prefix + 'approveChanges') }}
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </header>
      <a-tabs v-if="detail" v-model:activeKey="active" class="tabs">
        <a-tab-pane v-for="(_, tab) in tabs" :key="tab">
          <template #tab>
            {{ t(prefix + 'tabs.' + tab) }} <span v-if="changesIn(tab)" class="count">{{ changesIn(tab) }}</span>
          </template>
        </a-tab-pane>
      </a-tabs>
      <div class="review-scroll">
        <div v-if="loading" class="feedback"><a-spin /></div>
        <a-result v-else-if="failed" status="warning" :title="t(prefix + 'loadFailed')">
          <template #extra><a-button @click="load">{{ t('common.refresh') }}</a-button></template>
        </a-result>
        <template v-else-if="detail">
          <section class="body">
            <h2>{{ t(prefix + 'comparison', { section: t(prefix + 'tabs.' + active) }) }}</h2>
            <p class="legend"><span />{{ t(prefix + 'highlightHint') }}</p>
            <div class="compare">
              <div class="compare-row compare-head">
                <div><LockOutlined /> {{ t(prefix + 'approvedProfile') }}
                  <p v-if="!detail.baseline">{{ t(prefix + 'noBaseline') }}</p>
                </div>
                <div><LockOutlined /> {{ t(prefix + 'requested') }}</div>
              </div>
              <div v-for="row in visible" :key="row.field" class="compare-row">
                <div class="cell">
                  <label>{{ t(prefix + 'fields.' + row.field) }}</label>
                  <ReviewValue :value="row.before" :field="row.field" />
                </div>
                <div class="cell" :class="{ changed: row.changed }">
                  <label>{{ t(prefix + 'fields.' + row.field) }} <small v-if="row.changed">{{ t(prefix + 'changed') }}</small></label>
                  <ReviewValue :value="row.after" :field="row.field" />
                </div>
              </div>
              <a-empty v-if="!visible.length" :description="t('common.noData')" />
            </div>
            <a-alert v-if="detail.revision.reject_reason" type="warning" :message="t(prefix + 'rejectReason')" :description="detail.revision.reject_reason" show-icon />
          </section>
        </template>
      </div>
      <footer v-if="detail && status === 1" v-perm="'merchant:property:content-audit'" class="review-footer">
        <div class="correction-field">
          <div class="correction-heading">
            <MessageOutlined aria-hidden="true" />
            <label for="property-correction">{{ t(prefix + 'correctionReason') }}</label>
            <span id="property-correction-hint">{{ t(prefix + 'correctionHint') }}</span>
          </div>
          <a-textarea id="property-correction" ref="reasonInput" v-model:value="reason" :rows="2" :maxlength="500"
            aria-describedby="property-correction-hint" :disabled="saving" :placeholder="t(prefix + 'reasonPlaceholder')" />
        </div>
        <p class="approval-hint"><InfoCircleOutlined aria-hidden="true" /><span>{{ t(prefix + 'approvalHint') }}</span></p>
      </footer>
    </article>
  </PageContainer>
</template>

<style scoped>
.review-page :deep(.page-body) { display: flex; flex-direction: column; height: 100%; }
.review-detail {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  color: #1e293b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.review-scroll { flex: 1; min-height: 0; overflow: auto; }
header, .tabs { flex: none; background: #fff; }
header { padding: 12px 24px 18px; border-radius: 10px 10px 0 0; }
.heading, .identity, .title-line, .actions, .meta { display: flex; align-items: center; gap: 10px; }
.heading { justify-content: space-between; flex-wrap: wrap; margin-top: 12px; }
.identity { flex: 1 1 360px; min-width: 0; }
.identity > div { min-width: 0; }
.hotel-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 12px; background: #eff6ff; color: #2563eb; font-size: 21px; }
.title-line, .meta, .actions { flex-wrap: wrap; }
h1, h2, p { margin: 0; }
h1 { font-size: 20px; line-height: 1.35; overflow-wrap: anywhere; }
h2 { font-size: 16px; }
.meta { color: #64748b; font-size: 12px; margin-top: 5px; }
.meta strong { color: #a16207; }
.tabs { padding: 0 24px; border-top: 1px solid #e2e8f0; }
.tabs :deep(.ant-tabs-nav) { margin: 0; }
.body { padding: 20px 24px 28px; }
.legend, .compare-head p { font-size: 12px; font-weight: normal; color: #64748b; margin: 5px 0 16px; }
.legend span { display: inline-block; width: 10px; height: 10px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 2px; margin-right: 6px; }
.compare { background: #fff; border: 1px solid #dbe3ed; border-radius: 10px; overflow: hidden; }
.compare-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.compare-row + .compare-row { border-top: 1px solid #e2e8f0; }
.compare-row > div { min-width: 0; padding: 14px 18px; }
.compare-row > div:first-child { background: #f8fafc; border-right: 1px solid #e2e8f0; }
.compare-head > div { font-weight: 700; }
.compare-head p { margin-bottom: 0; }
.cell label { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: #64748b; font-weight: 650; font-size: 12px; margin-bottom: 8px; }
.cell > :last-child { background: #f1f5f9; border-left: 2px solid #cbd5e1; padding: 8px 10px; min-height: 36px; }
.cell.changed > :last-child { background: #fffbeb; border-color: #fbbf24; }
.cell small, .count { background: #fef3c7; border-radius: 12px; color: #854d0e; padding: 0 6px; font-size: 10px; }
.cell small { margin-left: auto; }
.review-footer {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 288px);
  align-items: end;
  gap: 16px;
  padding: 14px 24px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 9px 9px;
  box-shadow: 0 -6px 20px rgb(15 23 42 / 6%);
}
.correction-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin-bottom: 6px; font-size: 12px; }
.correction-heading .anticon { color: #e11d48; }
.correction-heading label { font-weight: 700; }
.correction-heading > span:last-child { color: #64748b; }
.correction-field :deep(textarea) { border-radius: 8px; padding: 9px 12px; resize: none; }
.approval-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #d6e6ff;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.approval-hint .anticon { margin-top: 3px; }
.feedback { display: grid; place-items: center; padding: 48px; }
.body :deep(.ant-alert) { margin-top: 16px; }
@media (max-width: 700px) {
  header, .tabs, .body, .review-footer { padding-left: 12px; padding-right: 12px; }
  .compare-row > div { padding: 10px 8px; }
  .hotel-icon { display: none; }
  .review-footer { grid-template-columns: minmax(0, 1fr); gap: 8px; padding-block: 10px; }
}
@media (max-height: 460px) {
  .review-detail { display: block; overflow: auto; }
  .review-scroll { overflow: visible; }
}
</style>
