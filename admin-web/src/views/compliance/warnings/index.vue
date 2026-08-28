<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import ComplianceFilters from '@/components/merchant/ComplianceFilters.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import ComplianceActionModal from '@/components/merchant/ComplianceActionModal.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useCompliancePresentation } from '@/composables/useCompliancePresentation';
import { apiWarnings } from '@/api/compliance';
const { t } = useI18n();
const route = useRoute();
const { warningStatus } = useCompliancePresentation();
const { list, loading, query, load, search, reset, pagination } = useTable(apiWarnings, { merchantId: Number(route.query.merchantId) || undefined, siteId: undefined, keyword: '', category: undefined, status: undefined });
watch(() => route.query.merchantId, (id) => { query.merchantId = Number(id) || undefined; search(); });
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 }, { title: t('complianceS6.merchant'), dataIndex: 'merchant_name', width: 180 },
  { title: t('complianceS6.reason'), dataIndex: 'reason', width: 260 }, { title: t('complianceS6.level'), dataIndex: 'level', width: 90 },
  { title: t('complianceS6.category'), dataIndex: 'category_code', width: 100 }, { title: t('complianceS6.status'), dataIndex: 'status', width: 100 },
  { title: t('complianceS6.expires'), dataIndex: 'expires_at', width: 130 }, { title: t('complianceS6.reviewer'), dataIndex: 'issued_by', width: 130 },
  { title: t('complianceS6.created'), dataIndex: 'created_at', width: 165 }, { title: t('common.action'), key: 'actions', width: 220, fixed: 'right' as const },
]);
const selected = ref<TableRow>({});
const open = ref(false);
function revoke(row: TableRow): void { selected.value = row; open.value = true; }
onMounted(load);
</script>
<template>
  <PageContainer>
    <ComplianceLinks :merchant-id="query.merchantId" />
    <router-link v-perm="'merchant:activity:list'" :to="{ path: '/merchant/activities', query: { source: 'warning_events', merchantId: query.merchantId } }" style="display: block; margin-bottom: 16px">{{ t('complianceS6.warningEvents') }}</router-link>
    <a-alert :message="t('complianceS6.immutable')" type="info" style="margin-bottom: 16px" />
    <ComplianceFilters :query="query" @search="search" @reset="reset"><a-form-item :label="t('complianceS6.status')"><a-select v-model:value="query.status" allow-clear style="width: 130px"><a-select-option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ warningStatus[n].text }}</a-select-option></a-select></a-form-item></ComplianceFilters>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1550 }">
        <template #expandedRowRender="{ record }"><p>{{ t('complianceS6.caseId') }}: {{ record.violation_id || t('complianceS6.legacy') }} · {{ t('complianceS6.ruleVersion') }}: {{ record.rule_revision_id || '-' }}</p><p style="white-space: pre-wrap">{{ record.reason }}</p></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">{{ record.merchant_name }} #{{ record.merchant_id }}</template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="warningStatus" /></template>
          <template v-else-if="column.dataIndex === 'category_code'">{{ record.category_code ? t(`complianceS6.categories.${record.category_code}`) : t('complianceS6.legacy') }}</template>
          <template v-else-if="column.key === 'actions'"><a-space>
            <a-button v-if="Number(record.status) !== 2" v-perm="'platform:warning:revoke'" type="link" danger @click="revoke(record)">{{ t('complianceS6.actions.revoke') }}</a-button>
            <router-link v-perm="'platform:compliance:list'" :to="{ path: '/compliance/history', query: { merchantId: record.merchant_id, warningId: record.id } }">{{ t('complianceS6.history') }}</router-link>
          </a-space></template>
        </template>
      </a-table>
    </a-card>
    <ComplianceActionModal v-model:open="open" action="revoke" :row="selected" @changed="load" />
  </PageContainer>
</template>
