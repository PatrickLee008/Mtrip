<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { DownOutlined, InfoCircleOutlined, PlusOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import { supportGet, type SupportOptions, type SupportPage } from '@/api/support';

const props = defineProps<{ kind: string; options: SupportOptions }>();
const emit = defineEmits<{ create: [value?: { id: number; merchantId: number; subject: string }]; ticket: [id: number] }>();
const { t } = useI18n(); const user = useUserStore();
const keyword = ref(''); const categoryId = ref<number>(); const categories = ref<{ id: number; name: string; article_count: number }[]>([]);
const faqKeyword = ref(''); const openQuestion = ref<string[]>([]);
const faqs = ref<{ id: number; title: string; content: string; category_name: string }[]>([]); const total = ref(0); const page = ref(1);
const merchantId = ref<number>(); const rules = ref<Record<string, any>[]>([]); const violations = ref<Record<string, any>[]>([]); const warnings = ref<Record<string, any>[]>([]); const appeals = ref<Record<string, any>[]>([]);
const compliancePages = ref<Record<string, { page: number; total: number }>>({ violations: { page: 1, total: 0 }, warnings: { page: 1, total: 0 }, appeals: { page: 1, total: 0 } });
const summary = ref<Record<string, any>>({}); const loading = ref(false); const failed = ref(false);
const general = computed(() => props.options.capabilities['merchant-scope']);
let generation = 0;
function plain(value: string) { const doc = new DOMParser().parseFromString(value, 'text/html'); doc.querySelectorAll('script,style').forEach(el => el.remove()); return doc.body.textContent || ''; }
async function load(reset = false) {
  const current = ++generation; loading.value = true; failed.value = false;
  if (reset) page.value = 1;
  try {
    if (props.kind === 'faq') {
      const [groups, result] = await Promise.all([supportGet<typeof categories.value>('faq/categories'),
        faqKeyword.value || categoryId.value !== undefined
          ? supportGet<SupportPage<typeof faqs.value[number]>>('faq/list', { keyword: faqKeyword.value, categoryId: categoryId.value, page: page.value, pageSize: 20 })
          : Promise.resolve({ list: [], total: 0 })]);
      if (current !== generation) return;
      categories.value = groups; faqs.value = result.list; total.value = result.total;
    } else if (merchantId.value) {
      const data = await supportGet<{ list: typeof rules.value }>('compliance/rules', { merchantId: merchantId.value, keyword: keyword.value });
      if (current !== generation) return; rules.value = data.list;
      if (general.value) {
        const counts = await supportGet<typeof summary.value>('compliance/summary', { merchantId: merchantId.value });
        if (current !== generation) return; summary.value = counts;
        await Promise.all(['violations', 'warnings', 'appeals'].map(kind => cases(kind, 1, current)));
      }
    }
  } catch { if (current === generation) { failed.value = true; faqs.value = []; rules.value = []; violations.value = []; warnings.value = []; appeals.value = []; summary.value = {}; } }
  finally { if (current === generation) loading.value = false; }
}
function searchFaq() {
  faqKeyword.value = keyword.value.trim(); categoryId.value = undefined; openQuestion.value = [];
  void load(true);
}
function toggleCategory(id: number) {
  categoryId.value = categoryId.value === id ? undefined : id; openQuestion.value = []; faqs.value = []; total.value = 0;
  void load(true);
}
function faqPage() { openQuestion.value = []; void load(); }
async function cases(kind: string, nextPage: number, current = generation) {
  const result = await supportGet<SupportPage<Record<string, any>>>('compliance/' + kind, { merchantId: merchantId.value, keyword: keyword.value, page: nextPage, pageSize: 20 });
  if (current !== generation) return;
  const target = kind === 'violations' ? violations : kind === 'warnings' ? warnings : appeals;
  target.value = nextPage === 1 ? result.list : [...target.value, ...result.list]; compliancePages.value[kind] = { page: nextPage, total: result.total };
}
function moreCases(kind: string) { void cases(kind, compliancePages.value[kind].page + 1).catch(() => { failed.value = true; }); }
function appeal(row: Record<string, any>) { if (merchantId.value) emit('create', { id: row.id, merchantId: merchantId.value, subject: row.rule_title }); }
function chooseMerchant() {
  generation++; rules.value = []; summary.value = {}; violations.value = []; warnings.value = []; appeals.value = [];
  void load();
}
watch(() => [user.selectedPropertyId, props.options], () => { const selected = props.options.properties.find(row => row.id === user.selectedPropertyId); merchantId.value = selected?.merchant_id ?? (props.options.merchants.length === 1 ? props.options.merchants[0].id : undefined); chooseMerchant(); });
onMounted(() => { const selected = props.options.properties.find(row => row.id === user.selectedPropertyId); merchantId.value = selected?.merchant_id ?? (props.options.merchants.length === 1 ? props.options.merchants[0].id : undefined); void load(); });
onBeforeUnmount(() => generation++);
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="failed" type="error" show-icon :message="t('support.failed')"><template #action><a-button @click="load()">{{ t('support.retry') }}</a-button></template></a-alert>
    <template v-if="kind === 'faq'">
      <a-input v-model:value="keyword" :placeholder="t('support.faqSearch')" :aria-label="t('support.faqSearch')" class="faq-query" allow-clear @press-enter="searchFaq" @change="!keyword && searchFaq()"><template #prefix><SearchOutlined /></template></a-input>
      <div class="faq-groups">
        <a-empty v-if="!loading && !(faqKeyword ? faqs.length : categories.length)" class="faq-empty" :description="t('support.noFaq')" />
        <template v-if="!faqKeyword">
          <section v-for="group in categories" :key="group.id" class="faq-group">
            <button type="button" class="faq-category" :aria-expanded="categoryId === group.id" :aria-controls="'faq-category-' + group.id" @click="toggleCategory(group.id)">
              <QuestionCircleOutlined class="faq-category-icon" /><strong>{{ group.name }}</strong><span class="faq-count">{{ t('support.faqCount', { count: group.article_count }, Number(group.article_count)) }}</span><DownOutlined class="faq-chevron" :class="{ expanded: categoryId === group.id }" />
            </button>
            <div v-if="categoryId === group.id" :id="'faq-category-' + group.id" class="faq-category-body">
              <a-empty v-if="!faqs.length && !loading" :description="t('support.noFaq')" />
              <a-collapse v-model:active-key="openQuestion" ghost expand-icon-position="end" class="faq-questions">
                <template #expandIcon="{ isActive }"><DownOutlined class="faq-chevron" :class="{ expanded: isActive }" /></template>
                <a-collapse-panel v-for="faq in faqs" :key="String(faq.id)" :header="faq.title"><p class="faq-answer">{{ plain(faq.content) }}</p></a-collapse-panel>
              </a-collapse>
              <a-pagination v-if="total > 20" v-model:current="page" class="faq-pagination" :total="total" :page-size="20" :show-size-changer="false" responsive @change="faqPage" />
            </div>
          </section>
        </template>
        <template v-else>
          <a-collapse v-model:active-key="openQuestion" ghost expand-icon-position="end" class="faq-questions faq-results">
            <template #expandIcon="{ isActive }"><DownOutlined class="faq-chevron" :class="{ expanded: isActive }" /></template>
            <a-collapse-panel v-for="faq in faqs" :key="String(faq.id)"><template #header><span class="faq-result-title"><span class="faq-topic">{{ faq.category_name }}</span>{{ faq.title }}</span></template><p class="faq-answer">{{ plain(faq.content) }}</p></a-collapse-panel>
          </a-collapse>
          <a-pagination v-if="total > 20" v-model:current="page" class="faq-pagination" :total="total" :page-size="20" :show-size-changer="false" responsive @change="faqPage" />
        </template>
      </div>
      <div class="help-card"><InfoCircleOutlined class="help-icon" /><div class="help-copy"><strong>{{ t('support.needHelp') }}</strong><p>{{ t('support.helpHint') }}</p></div><a-button v-if="options.capabilities.create" v-perm="'mch:support:create'" type="primary" @click="emit('create')"><template #icon><PlusOutlined /></template>{{ t('support.create') }}</a-button></div>
    </template>
    <template v-else>
      <a-select v-if="options.merchants.length > 1" v-model:value="merchantId" :placeholder="t('support.merchant')" style="width:260px;margin:8px 0 20px" @change="chooseMerchant"><a-select-option v-for="merchant in options.merchants" :key="merchant.id" :value="merchant.id">{{ merchant.merchant_name }}</a-select-option></a-select>
      <a-alert v-if="!merchantId" type="info" :message="t('support.chooseMerchant')" />
      <template v-else>
        <a-input-search v-model:value="keyword" :placeholder="t('support.searchContent')" class="faq-search" allow-clear @search="load(true)" />
        <a-alert v-if="!general" type="info" :message="t('support.deniedCompliance')" show-icon />
        <div v-if="general" class="compliance-cards"><div><span>{{ t('support.score') }}</span><strong>{{ t('support.unconfigured') }}</strong></div><div v-for="key in ['violations', 'active_warnings', 'pending_appeal_tickets']" :key="key"><span>{{ t('support.' + (key === 'active_warnings' ? 'warnings' : key === 'pending_appeal_tickets' ? 'appeals' : key)) }}</span><strong>{{ summary[key] ?? '—' }}</strong></div></div>
        <section class="resource-card"><h3>{{ t('support.rules') }}</h3><a-empty v-if="!rules.length && !loading" :description="t('support.noRules')" /><a-collapse ghost><a-collapse-panel v-for="rule in rules" :key="rule.id" :header="rule.title"><p class="prose">{{ rule.body }}</p><small>{{ t('support.effective') }}: {{ rule.effective_at }}</small></a-collapse-panel></a-collapse></section>
        <template v-if="general"><section class="resource-card"><h3>{{ t('support.violation') }}</h3><a-empty v-if="!violations.length" /><article v-for="violation in violations" :key="violation.id" class="case-row"><div><strong>{{ violation.rule_title }}</strong><p>#{{ violation.id }} · {{ violation.detected_date || violation.created_at }} · {{ t('support.' + (violation.status === 1 ? 'openViolation' : 'resolvedViolation')) }}</p></div><a-button v-if="options.capabilities.create" v-perm="'mch:support:create'" @click="appeal(violation)">{{ t('support.appeal') }}</a-button></article><a-button v-if="violations.length < compliancePages.violations.total" @click="moreCases('violations')">{{ t('support.loadMore') }}</a-button></section>
        <section class="resource-card"><h3>{{ t('support.warning') }}</h3><a-empty v-if="!warnings.length" /><article v-for="warning in warnings" :key="warning.id" class="case-row"><span>{{ warning.reason }}</span><a-tag>{{ t('support.' + warning.effective_status) }}</a-tag></article><a-button v-if="warnings.length < compliancePages.warnings.total" @click="moreCases('warnings')">{{ t('support.loadMore') }}</a-button></section>
        <section class="resource-card"><h3>{{ t('support.appealTickets') }}</h3><a-alert :message="t('support.appealNote')" type="info" /><article v-for="item in appeals" :key="item.id" class="case-row"><a-button type="link" @click="emit('ticket', item.id)">{{ item.ticket_no }} · {{ item.subject }}</a-button><a-tag>{{ t('support.states.' + item.status) }}</a-tag></article><a-button v-if="appeals.length < compliancePages.appeals.total" @click="moreCases('appeals')">{{ t('support.loadMore') }}</a-button></section></template>
      </template>
    </template>
  </a-spin>
</template>

<style scoped lang="less">
.faq-search { max-width:600px; margin:8px 0 24px; }.resource-card { padding:20px; background:white; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:20px; }.resource-card h3 { font-size:16px; font-weight:600; margin:0 0 16px; }.prose { white-space:pre-wrap; line-height:1.8; overflow-wrap:anywhere; }.case-row p { color:#8b8c96; margin:6px 0 0; }.compliance-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin:16px 0 24px; }.compliance-cards>div { padding:20px; background:white; border:1px solid #e2e8f0; border-radius:12px; }.compliance-cards span { color:#8b8c96; font-size:12px; }.compliance-cards strong { display:block; margin-top:12px; font-size:24px; }.case-row { display:flex; gap:16px; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding:16px 0; }
@media(max-width:800px) { .compliance-cards { grid-template-columns:1fr 1fr; }.case-row { align-items:flex-start; flex-direction:column; } }
.faq-query { width:320px; max-width:100%; margin:8px 0 16px; }
.faq-query.ant-input-affix-wrapper { height:40px; background:#fff !important; }
.faq-query :deep(.ant-input-prefix) { margin-right:8px; color:#8b8c96; font-size:16px; }
.faq-groups { display:flex; flex-direction:column; gap:16px; }
.faq-group { overflow:hidden; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
.faq-category { display:flex; align-items:center; gap:12px; width:100%; min-height:50px; padding:14px 20px; border:0; background:transparent; color:var(--mtrip-text-main); font:inherit; text-align:left; cursor:pointer; }
.faq-category strong { min-width:0; font-size:13.5px; font-weight:600; overflow-wrap:anywhere; }
.faq-category-icon { flex-shrink:0; color:var(--mtrip-primary); font-size:15px; }
.faq-count { flex-shrink:0; color:#8b8c96; font-size:11.5px; }
.faq-chevron { flex-shrink:0; color:#8b8c96; font-size:13px; transition:transform .2s; }
.faq-category > .faq-chevron { margin-left:auto; font-size:15px; }
.faq-chevron.expanded { transform:rotate(180deg); }
.faq-category:hover { background:#f8fafc; }
.faq-category:focus-visible { outline:2px solid var(--mtrip-primary); outline-offset:-3px; }
.faq-category-body { border-top:1px solid #f1f5f9; }
.faq-questions :deep(.ant-collapse-item) { border-bottom:1px solid #f1f5f9; }
.faq-questions :deep(.ant-collapse-item:last-child) { border-bottom:0; }
.faq-questions :deep(.ant-collapse-header) { align-items:center; gap:16px; padding:14px 20px !important; color:#334155; font-size:13px; font-weight:500; line-height:20px; }
.faq-questions :deep(.ant-collapse-header-text) { min-width:0; overflow-wrap:anywhere; }
.faq-questions :deep(.ant-collapse-expand-icon) { height:20px; padding:0 !important; }
.faq-questions :deep(.ant-collapse-content-box) { padding:0 20px 16px !important; }
.faq-answer { margin:0; color:#64748b; font-size:12.5px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.faq-results :deep(.ant-collapse-item) { overflow:hidden; margin-bottom:8px; border:1px solid #e2e8f0 !important; border-radius:10px !important; background:#fff; }
.faq-results :deep(.ant-collapse-item:last-child) { margin-bottom:0; }
.faq-results :deep(.ant-collapse-header) { font-weight:600; }
.faq-results .faq-answer { padding-top:12px; border-top:1px solid #f1f5f9; }
.faq-result-title { display:flex; align-items:flex-start; gap:12px; }
.faq-topic { flex-shrink:0; max-width:45%; padding:1px 7px; border-radius:4px; background:#f1f5f9; color:#64748b; font-size:11px; font-weight:500; }
.faq-pagination { margin:16px 20px; text-align:right; }
.faq-empty { padding:24px 0; }
.help-card { display:flex; align-items:flex-start; gap:12px; margin-top:24px; padding:16px; border:1px solid var(--mtrip-primary); border-radius:12px; background:#e8ecfc; color:var(--mtrip-primary); }
.help-icon { flex-shrink:0; margin-top:2px; font-size:18px; }
.help-copy { flex:1; min-width:0; }
.help-copy strong { font-size:13px; font-weight:600; }
.help-copy p { max-width:580px; margin:4px 0 0; color:var(--mtrip-primary); font-size:12.5px; line-height:1.5; }
.help-card > .ant-btn.ant-btn-primary { flex-shrink:0; height:40px !important; }
@media(max-width:600px) {
  .faq-category { flex-wrap:wrap; gap:8px; padding:14px 16px; }
  .faq-category strong { flex:1; }
  .faq-count { order:1; flex-basis:100%; padding-left:23px; }
  .faq-questions :deep(.ant-collapse-header) { padding:14px 16px !important; }
  .faq-questions :deep(.ant-collapse-content-box) { padding:0 16px 16px !important; }
  .help-card { flex-wrap:wrap; }
  .help-copy { flex-basis:calc(100% - 30px); }
  .help-card > .ant-btn { margin-left:30px; }
  .faq-result-title { flex-direction:column; gap:6px; }
  .faq-topic { max-width:100%; }
}
</style>
