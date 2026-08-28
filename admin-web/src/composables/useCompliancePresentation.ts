import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { StatusItem } from '@/components/StatusTag.vue';
export function useCompliancePresentation() {
  const { t } = useI18n();
  const ruleStatus = computed<Record<number, StatusItem>>(() => ({ 1: { text: t('complianceS6.statuses.active'), color: 'success' }, 2: { text: t('complianceS6.statuses.draft'), color: 'default' }, 3: { text: t('complianceS6.statuses.archived'), color: 'default' } }));
  const caseStatus = computed<Record<number, StatusItem>>(() => ({ 1: { text: t('complianceS6.statuses.open'), color: 'warning' }, 2: { text: t('complianceS6.statuses.resolved'), color: 'success' } }));
  const warningStatus = computed<Record<number, StatusItem>>(() => ({ 1: { text: t('complianceS6.statuses.warning'), color: 'warning' }, 2: { text: t('complianceS6.statuses.revoked'), color: 'default' }, 3: { text: t('complianceS6.statuses.expired'), color: 'default' } }));
  return { ruleStatus, caseStatus, warningStatus };
}
