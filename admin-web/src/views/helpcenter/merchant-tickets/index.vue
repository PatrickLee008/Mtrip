<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { supportGet, type SupportOptions, type SupportPage, type SupportTicket } from '@/api/support';
import TicketDrawer from './TicketDrawer.vue';

const { t } = useI18n(); const route = useRoute(); const router = useRouter(); const user = useUserStore();
const options = ref<SupportOptions>(); const summary = ref<Record<string, number>>({}); const failed = ref(false);
const { loading, list, query, load, search, reset, pagination } = useTable<SupportTicket>(async params => {
  try { const result = await supportGet<SupportPage<SupportTicket>>('tickets', params); failed.value = false; return result; }
  catch (error) { failed.value = true; throw error; }
}, { keyword: '', status: undefined, category: undefined, priority: undefined, merchantId: undefined, propertyId: undefined, siteId: undefined, dateFrom: '', dateTo: '' });
const tablePagination = computed(() => ({ ...pagination.value, showTotal: (count: number) => t('support.total', { count }) }));
const drawer = ref(false); const ticketId = ref(0);
const filters = reactive({ merchantId: undefined as number | undefined, propertyId: undefined as number | undefined, siteId: undefined as number | undefined });
const columns = computed(() => ['ticket_no', 'merchant_name', 'property_name', 'subject', 'category', 'priority', 'status', 'assignee_name', 'updated_at'].map(key => ({ dataIndex: key, title: t('support.' + ({ ticket_no: 'number', merchant_name: 'merchant', property_name: 'property', assignee_name: 'agent', updated_at: 'updated' }[key] || key)), width: key === 'subject' ? 260 : 160 })));
async function counts() { summary.value = await supportGet('summary', { ...filters }); }
function show(id: number) { ticketId.value = id; drawer.value = true; void router.replace({ query: { ticketId: id } }); }
function apply() { Object.assign(query, filters); search(); void counts(); }
function clear() { filters.merchantId = undefined; filters.propertyId = undefined; filters.siteId = undefined; reset(); void counts(); }
async function refresh() { await Promise.all([load(), counts()]); }
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => { options.value = await supportGet('options'); await refresh(); const id = Number(route.query.ticketId); if (id > 0) show(id); timer = setInterval(() => { if (!document.hidden && route.path === '/helpcenter/merchant-tickets' && !drawer.value) void refresh().catch(() => {}); }, 15000); });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <PageContainer>
    <h2>{{ t('menu.supportTickets') }}</h2>
    <div class="summary"><a-card v-for="key in ['open','waiting_merchant','waiting_support','completed']" :key="key" size="small"><span>{{ t('support.cards.' + key) }}</span><strong>{{ failed ? '—' : summary[key] ?? 0 }}</strong></a-card></div>
    <a-card :bordered="false" class="mtrip-card-shadow filters"><a-form layout="inline" @finish="apply">
      <a-form-item><a-input v-model:value="query.keyword" :placeholder="t('support.search')" @press-enter="apply" /></a-form-item>
      <a-form-item><a-select v-model:value="query.category" allow-clear :placeholder="t('support.allCategories')"><a-select-option v-for="value in options?.categories" :key="value" :value="value">{{ t('support.categories.' + value) }}</a-select-option></a-select></a-form-item>
      <a-form-item><a-select v-model:value="query.priority" allow-clear :placeholder="t('support.allPriorities')"><a-select-option v-for="value in options?.priorities" :key="value" :value="value">{{ t('support.priorities.' + value) }}</a-select-option></a-select></a-form-item>
      <a-form-item><a-select v-model:value="query.status" allow-clear :placeholder="t('support.allStates')"><a-select-option v-for="value in options?.states" :key="value" :value="value">{{ t('support.states.' + value) }}</a-select-option></a-select></a-form-item>
      <a-form-item><a-input-number v-model:value="filters.merchantId" :min="1" :placeholder="t('support.merchant') + ' ID'" /></a-form-item><a-form-item><a-input-number v-model:value="filters.propertyId" :min="1" :placeholder="t('support.property') + ' ID'" /></a-form-item>
      <a-form-item v-if="user.isSuper"><a-input-number v-model:value="filters.siteId" :min="1" :placeholder="t('support.site') + ' ID'" /></a-form-item>
      <a-form-item :label="t('support.dateFrom')"><a-input v-model:value="query.dateFrom" type="date" /></a-form-item><a-form-item :label="t('support.dateTo')"><a-input v-model:value="query.dateTo" type="date" /></a-form-item>
      <a-form-item><a-space><a-button type="primary" @click="apply">{{ t('common.search') }}</a-button><a-button @click="clear">{{ t('common.reset') }}</a-button></a-space></a-form-item>
    </a-form></a-card>
    <a-alert v-if="failed" type="error" :message="t('support.failed')" show-icon><template #action><a-button @click="refresh">{{ t('support.retry') }}</a-button></template></a-alert>
    <a-card :bordered="false" class="mtrip-card-shadow"><a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="tablePagination" :scroll="{ x: 1550 }"><template #bodyCell="{ column, record }">
      <a-button v-if="column.dataIndex === 'ticket_no'" type="link" @click="show(record.id)">{{ record.ticket_no }}</a-button><a-tag v-else-if="column.dataIndex === 'status'">{{ t('support.states.' + record.status) }}</a-tag><span v-else-if="column.dataIndex === 'category'">{{ t('support.categories.' + record.category) }}</span><a-tag v-else-if="column.dataIndex === 'priority'">{{ t('support.priorities.' + record.priority) }}</a-tag><span v-else-if="column.dataIndex === 'property_name'">{{ record.property_name || t('support.general') }}</span><span v-else-if="column.dataIndex === 'assignee_name'">{{ record.assignee_name || t('support.unassigned') }}</span>
    </template></a-table></a-card>
    <TicketDrawer v-model:open="drawer" :ticket-id="ticketId" @changed="refresh" />
  </PageContainer>
</template>

<style scoped lang="less">
.summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin:20px 0; }.summary span { color:#64748b; }.summary strong { display:block; font-size:28px; margin-top:12px; }.filters { margin-bottom:16px; }.filters .ant-form { gap:12px; }.filters .ant-select { min-width:160px; }@media(max-width:800px) { .summary { grid-template-columns:1fr 1fr; } }
</style>
