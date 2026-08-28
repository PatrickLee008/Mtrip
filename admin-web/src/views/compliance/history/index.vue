<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import ComplianceFilters from '@/components/merchant/ComplianceFilters.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import { useTable } from '@/composables/useTable';
import { apiComplianceHistory } from '@/api/compliance';
const { t } = useI18n();
const route = useRoute();
const { list, loading, query, load, search, reset, pagination } = useTable(apiComplianceHistory, { merchantId: Number(route.query.merchantId) || undefined, violationId: Number(route.query.violationId) || undefined, warningId: Number(route.query.warningId) || undefined, siteId: undefined, keyword: '', category: undefined, action: undefined });
watch(() => route.query, (params) => { query.merchantId = Number(params.merchantId) || undefined; query.violationId = Number(params.violationId) || undefined; query.warningId = Number(params.warningId) || undefined; search(); });
const actions = ['record', 'warn', 'revoke', 'suspend', 'restore', 'resolve', 'reopen'];
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 }, { title: t('complianceS6.merchant'), dataIndex: 'merchant_name', width: 180 },
  { title: t('complianceS6.caseId'), dataIndex: 'violation_id', width: 90 }, { title: t('complianceS6.warningId'), dataIndex: 'warning_id', width: 90 },
  { title: t('complianceS6.category'), dataIndex: 'category_code', width: 110 }, { title: t('common.action'), dataIndex: 'action', width: 130 },
  { title: t('complianceS6.note'), dataIndex: 'note', width: 300 }, { title: t('complianceS6.version'), dataIndex: 'case_version', width: 75 },
  { title: t('complianceS6.reviewer'), dataIndex: 'reviewer', width: 130 }, { title: t('complianceS6.created'), dataIndex: 'created_at', width: 165 },
]);
onMounted(load);
</script>
<template>
  <PageContainer>
    <ComplianceLinks :merchant-id="query.merchantId" />
    <router-link v-perm="'merchant:activity:list'" :to="{ path: '/merchant/activities', query: { source: 'compliance', merchantId: query.merchantId } }" style="display: block; margin-bottom: 16px">{{ t('complianceS6.exportHistory') }}</router-link>
    <a-alert :message="t('complianceS6.historyHint')" type="info" style="margin-bottom: 16px" />
    <ComplianceFilters :query="query" @search="search" @reset="reset">
      <a-form-item :label="t('complianceS6.caseId')"><a-input-number v-model:value="query.violationId" :min="1" /></a-form-item>
      <a-form-item :label="t('complianceS6.warningId')"><a-input-number v-model:value="query.warningId" :min="1" /></a-form-item>
      <a-form-item :label="t('common.action')"><a-select v-model:value="query.action" allow-clear style="width: 130px"><a-select-option v-for="a in actions" :key="a" :value="a">{{ t(`complianceS6.actions.${a}`) }}</a-select-option></a-select></a-form-item>
    </ComplianceFilters>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1400 }">
        <template #expandedRowRender="{ record }"><p style="white-space: pre-wrap">{{ record.note || record.event }}</p><p>{{ t('complianceS6.ruleVersion') }}: {{ record.rule_revision_id || '-' }} · {{ record.actor_type }}</p></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">{{ record.merchant_name }} #{{ record.merchant_id }}</template>
          <template v-else-if="column.dataIndex === 'action'">{{ record.action ? t(`complianceS6.actions.${record.action}`) : t('complianceS6.legacy') }}</template>
          <template v-else-if="column.dataIndex === 'category_code'">{{ record.category_code ? t(`complianceS6.categories.${record.category_code}`) : '-' }}</template>
          <template v-else-if="column.dataIndex === 'note'">{{ record.note || record.event }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
