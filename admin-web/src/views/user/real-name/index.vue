<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  IdcardOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { StatusItem } from '@/components/StatusTag.vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { exportCsv } from '@/utils/exportCsv';
import {
  apiRealNameApprove,
  apiRealNameDetail,
  apiRealNameList,
  apiRealNameQueues,
  apiRealNameReject,
  type RealNameTab,
} from '@/api/user';

/**
 * 实名审核(App 资料向导第 2 步 Identity Verification 的后台审核)
 *
 * 版式照「商户验证」页(views/merchant/verify):页头 eyebrow/标题/副标题 + 导出、状态卡片导航、
 * SearchFilterBar、表格、760 宽详情抽屉(分区标题 + 信息网格 + 材料 + 最终决定 + 时间线,操作固定在抽屉底部)。
 * 三个队列共用一个菜单(/user/real-name),卡片切换写到 ?tab= 便于刷新 / 分享。
 * real_name_status:3待审核 1已通过 2已驳回;只有待审核可操作。
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const RP = (k: string, params?: Record<string, unknown>): string => t(`user.realNamePage.${k}`, params ?? {});

const TAB_KEYS: RealNameTab[] = ['pending', 'approved', 'rejected'];
function tabFromQuery(): RealNameTab {
  const tab = String(route.query.tab ?? '');
  return (TAB_KEYS as string[]).includes(tab) ? (tab as RealNameTab) : 'pending';
}
const activeTab = ref<RealNameTab>(tabFromQuery());

const CARDS = computed(() => [
  { key: 'pending' as RealNameTab, label: RP('queuePending'), color: '#D97706' },
  { key: 'approved' as RealNameTab, label: RP('queueApproved'), color: '#059669' },
  { key: 'rejected' as RealNameTab, label: RP('queueRejected'), color: '#DC2626' },
]);
const counts = ref<Record<string, number>>({});
async function loadCounts(): Promise<void> {
  try {
    counts.value = await apiRealNameQueues();
  } catch {
    counts.value = {};
  }
}
const countTotal = computed(() => CARDS.value.reduce((s, c) => s + (counts.value[c.key] ?? 0), 0) || 1);
function percent(key: string): number {
  return Math.min(100, Math.round(((counts.value[key] ?? 0) / countTotal.value) * 100));
}
function switchTab(key: RealNameTab): void {
  if (key === activeTab.value) return;
  activeTab.value = key;
  void router.replace({ query: { ...route.query, tab: key } });
}

const pageTitle = computed(() => RP(`title${activeTab.value[0].toUpperCase()}${activeTab.value.slice(1)}`));
const pageSubtitle = computed(() => RP(`${activeTab.value}Subtitle`));

const REAL_NAME_BADGE = computed<Record<number, StatusItem>>(() => ({
  3: { text: RP('statusPending'), color: 'warning' },
  1: { text: RP('statusApproved'), color: 'success' },
  2: { text: RP('statusRejected'), color: 'error' },
}));
const GENDER_TEXT = computed<Record<number, string>>(() => ({
  1: RP('genderMale'),
  2: RP('genderFemale'),
  3: RP('genderOther'),
}));
const COUNTRY_CODES = ['MM', 'TH', 'CN', 'IN', 'SG', 'MY', 'JP', 'KR', 'US', 'GB'];
function countryName(code: string): string {
  return code && COUNTRY_CODES.includes(code) ? RP(`countries.${code}`) : code || '-';
}

// ---------- 列表 ----------
const { loading, list, query, search, pagination } = useTable(apiRealNameList, {
  tab: activeTab.value,
  keyword: '',
  nationality: '',
});
const sfbFilters = reactive<Record<string, string | number | undefined>>({ nationality: undefined });
const SEARCH_FILTERS = computed<FilterConfig[]>(() => [
  {
    key: 'nationality',
    label: RP('filterNationality'),
    allLabel: RP('allNationalities'),
    options: COUNTRY_CODES.map((c) => ({ value: c, label: countryName(c) })),
  },
]);
function handleSfbSearch(): void {
  query.nationality = String(sfbFilters.nationality ?? '');
  search();
}
watch(activeTab, (tab) => {
  query.tab = tab;
  search();
});

const tablePagination = computed<TablePaginationConfig>(() => ({
  ...pagination.value,
  showSizeChanger: false,
  showQuickJumper: false,
  showTotal: (count: number, range?: [number, number]) => {
    const [from, to] = range ?? [0, 0];
    return RP('paginationInfo', { from, to, total: count });
  },
}));

const columns = computed(() => [
  { title: RP('colUserId'), dataIndex: 'id', width: 100 },
  { title: RP('colUser'), dataIndex: 'nickname', width: 200 },
  { title: RP('colRealName'), dataIndex: 'real_name', width: 160 },
  { title: RP('colNationality'), dataIndex: 'nationality', width: 120 },
  { title: RP('colIdNumber'), dataIndex: 'id_card', width: 180 },
  { title: RP('colSubmitted'), dataIndex: 'real_name_submit_at', width: 165 },
  { title: RP('colStatus'), dataIndex: 'real_name_status', width: 120 },
  { title: RP('colReviewer'), dataIndex: 'real_name_audit_by', width: 140 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

async function doExport(): Promise<void> {
  const data = await apiRealNameList({ ...query, page: 1, pageSize: 200 });
  exportCsv(`identity-verification-${activeTab.value}-${Date.now()}.csv`, [
    { key: 'id', label: 'User ID' },
    { key: 'nickname', label: 'Nickname' },
    { key: 'real_name', label: 'Name on ID' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'id_card', label: 'ID Number (masked)' },
    { key: 'real_name_submit_at', label: 'Submitted' },
    { key: 'real_name_audit_by', label: 'Reviewed By' },
    { key: 'real_name_audit_at', label: 'Reviewed At' },
    { key: 'real_name_reject_reason', label: 'Reject Reason' },
  ], data.list);
}

/** 审核后刷新:列表 + 计数;抽屉里的详情也重拉 */
async function refreshAll(): Promise<void> {
  await Promise.all([search(), loadCounts()]);
  if (drawerOpen.value && detail.value) await loadDetail(Number(detail.value.id));
}

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

async function loadDetail(id: number): Promise<void> {
  detailLoading.value = true;
  try {
    detail.value = await apiRealNameDetail(id);
  } finally {
    detailLoading.value = false;
  }
}
function openDetail(record: TableRow): void {
  drawerOpen.value = true;
  detail.value = null;
  void loadDetail(Number(record.id));
}

const isPending = computed(() => Number(detail.value?.real_name_status) === 3);
const isNrc = computed(() => detail.value?.nationality === 'MM');
const documents = computed(() => {
  const d = detail.value;
  if (!d) return [];
  const docs = [{ key: 'front', label: isNrc.value ? RP('docFront') : RP('docPassport'), url: String(d.id_card_front || '') }];
  if (isNrc.value || d.id_card_back) docs.push({ key: 'back', label: RP('docBack'), url: String(d.id_card_back || '') });
  docs.push({ key: 'selfie', label: RP('docSelfie'), url: String(d.selfie_image || '') });
  return docs;
});
const decisionSubtitle = computed(() => {
  const d = detail.value;
  if (!d) return '';
  const status = Number(d.real_name_status);
  if (status === 1) return RP('decisionApproved', { by: d.real_name_audit_by || '-', at: d.real_name_audit_at || '-' });
  if (status === 2) return RP('decisionRejected', { by: d.real_name_audit_by || '-', at: d.real_name_audit_at || '-' });
  return RP('decisionPending');
});
const TIMELINE_TEXT: Record<string, string> = {
  submitted: 'timelineSubmitted',
  approved: 'timelineApproved',
  rejected: 'timelineRejected',
};
const timeline = computed<TableRow[]>(() => (Array.isArray(detail.value?.timeline) ? detail.value.timeline : []));

// ---------- 通过 / 驳回 ----------
const actionTarget = ref<TableRow | null>(null);

function openApprove(record: TableRow): void {
  Modal.confirm({
    title: RP('approveConfirmTitle'),
    content: `${record.real_name || record.nickname} · ID ${record.id} — ${RP('approveConfirmContent')}`,
    okText: RP('footerApprove'),
    onOk: async () => {
      await apiRealNameApprove(Number(record.id));
      message.success(RP('approveSuccess'));
      await refreshAll();
    },
  });
}

const rejectOpen = ref(false);
const rejectSaving = ref(false);
const rejectReason = ref<string | undefined>(undefined);
const rejectNote = ref('');
const REJECT_REASON_KEYS = ['blurry', 'mismatch', 'incomplete', 'selfie', 'expired', 'other'];
const REJECT_REASONS = computed(() => REJECT_REASON_KEYS.map((k) => ({ value: k, label: RP(`rejectReasons.${k}`) })));

function openReject(record: TableRow): void {
  actionTarget.value = record;
  rejectReason.value = undefined;
  rejectNote.value = '';
  rejectOpen.value = true;
}
async function doReject(): Promise<void> {
  if (!actionTarget.value) return;
  if (!rejectReason.value) {
    message.warning(RP('rejectReasonRequired'));
    return;
  }
  // 落库的是给用户看的一句话:预设原因 + 补充说明
  const label = RP(`rejectReasons.${rejectReason.value}`);
  const note = rejectNote.value.trim();
  const reason = rejectReason.value === 'other' && note ? note : note ? `${label}: ${note}` : label;
  rejectSaving.value = true;
  try {
    await apiRealNameReject({ id: Number(actionTarget.value.id), reason });
    message.success(RP('rejectSuccess'));
    rejectOpen.value = false;
    await refreshAll();
  } finally {
    rejectSaving.value = false;
  }
}

onMounted(() => {
  void loadCounts();
});
</script>

<template>
  <PageContainer>
    <!-- 页头(同商户验证页:eyebrow → 主标题 → 副标题,右侧导出) -->
    <div class="rn-header">
      <div>
        <div class="verify-eyebrow">{{ RP('pageKicker') }}</div>
        <h1 class="verify-page-title">{{ pageTitle }}</h1>
        <p class="verify-subtitle">{{ pageSubtitle }}</p>
      </div>
      <a-button class="verify-export-btn" @click="doExport"><template #icon><DownloadOutlined /></template>{{ RP('exportCsv') }}</a-button>
    </div>

    <!-- 状态卡片导航(同 MerchantVerifyNav) -->
    <div class="mv-nav">
      <div
        v-for="card in CARDS"
        :key="card.key"
        class="mv-card"
        :class="{ 'is-active': activeTab === card.key }"
        :style="activeTab === card.key ? { background: card.color + '14', borderColor: card.color + '55', boxShadow: `0 0 0 1px ${card.color}55` } : undefined"
        @click="switchTab(card.key)"
      >
        <div class="mv-card__label">{{ card.label }}</div>
        <div class="mv-card__value" :style="{ color: card.color }">{{ counts[card.key] ?? 0 }}</div>
        <div class="mv-card__bar">
          <div class="mv-card__bar-fill" :style="{ width: percent(card.key) + '%', background: card.color }" />
        </div>
      </div>
    </div>

    <SearchFilterBar
      v-model="query.keyword"
      v-model:filter-values="sfbFilters"
      :filters="SEARCH_FILTERS"
      :placeholder="RP('keywordPlaceholder')"
      :total="pagination.total"
      :result-label="RP('resultCount')"
      @search="handleSfbSearch"
    />

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="tablePagination"
      row-key="id"
      size="middle"
      :scroll="{ x: 1320 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'id'">
          <span class="rn-mono rn-id">{{ record.id }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'nickname'">
          <div class="rn-user">
            <a-avatar :size="32" :src="record.avatar || undefined"><template #icon><UserOutlined /></template></a-avatar>
            <div>
              <div class="rn-user__name">{{ record.nickname || '-' }}</div>
              <div class="rn-user__sub">{{ record.mobile || '-' }}</div>
            </div>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'real_name'">
          <span class="rn-strong">{{ record.real_name || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'nationality'">{{ countryName(record.nationality) }}</template>
        <template v-else-if="column.dataIndex === 'id_card'">
          <span class="rn-mono">{{ record.id_card || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'real_name_submit_at'">
          <span class="rn-mono rn-time">{{ record.real_name_submit_at || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'real_name_status'">
          <StatusTag :value="record.real_name_status" :map="REAL_NAME_BADGE" />
        </template>
        <template v-else-if="column.dataIndex === 'real_name_audit_by'">
          <span :class="{ 'rn-muted': !record.real_name_audit_by }">{{ record.real_name_audit_by || RP('unassigned') }}</span>
        </template>
        <template v-else-if="column.key === 'action_col'">
          <a-space :size="0">
            <a-tooltip :title="t('common.detail')">
              <a-button type="link" size="small" @click="openDetail(record)"><EyeOutlined /></a-button>
            </a-tooltip>
            <template v-if="Number(record.real_name_status) === 3">
              <a-tooltip :title="RP('btnApprove')">
                <a-button v-perm="'user:realname:approve'" type="link" size="small" style="color: #059669" @click="openApprove(record)"><CheckCircleOutlined /></a-button>
              </a-tooltip>
              <a-tooltip :title="RP('btnReject')">
                <a-button v-perm="'user:realname:reject'" type="link" size="small" style="color: #c01048" @click="openReject(record)"><CloseCircleOutlined /></a-button>
              </a-tooltip>
            </template>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :width="760">
      <template #title>
        <div class="verify-drawer-title">
          <div>{{ RP('drawerTitle') }}</div>
          <span v-if="detail">ID {{ detail.id }} · {{ detail.real_name || detail.nickname }}</span>
        </div>
      </template>
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <div v-if="isPending" class="fd-review-mode">
            <div class="fd-review-mode__title">{{ RP('reviewModeTitle') }}</div>
            <div class="fd-review-mode__desc">{{ RP('reviewModeDesc') }}</div>
          </div>

          <!-- §1 实名信息 -->
          <div class="co-section-heading">
            <IdcardOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ RP('sectionIdentity') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div class="verify-info-stack">
            <div class="verify-info-grid verify-info-grid--3">
              <div class="verify-info-cell"><span>{{ RP('realName') }}</span><strong>{{ detail.real_name || '-' }}</strong></div>
              <div class="verify-info-cell"><span>{{ RP('nationality') }}</span><strong>{{ countryName(detail.nationality) }}</strong></div>
              <div class="verify-info-cell">
                <span>{{ RP('idNumber') }} · {{ isNrc ? RP('idTypeNrc') : RP('idTypePassport') }}</span>
                <strong class="rn-mono">{{ detail.id_card || '-' }}</strong>
              </div>
            </div>
          </div>

          <!-- §2 证件材料(点击放大) -->
          <div class="co-section-heading">
            <PictureOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ RP('sectionDocuments') }}</h4>
            <div class="co-heading-line" />
          </div>
          <a-image-preview-group>
            <div class="rn-docs">
              <div v-for="doc in documents" :key="doc.key" class="rn-doc">
                <div class="rn-doc__media">
                  <a-image v-if="doc.url" :src="doc.url" :height="150" width="100%" class="rn-doc__img" />
                  <div v-else class="rn-doc__empty"><PictureOutlined />{{ RP('docMissing') }}</div>
                </div>
                <div class="rn-doc__label">{{ doc.label }}</div>
              </div>
            </div>
          </a-image-preview-group>

          <!-- §3 个人资料(资料向导第 1 步) -->
          <div class="co-section-heading">
            <UserOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ RP('sectionProfile') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div class="verify-info-stack">
            <div class="verify-info-grid verify-info-grid--3">
              <div class="verify-info-cell"><span>{{ RP('gender') }}</span><strong>{{ GENDER_TEXT[Number(detail.gender)] || '-' }}</strong></div>
              <div class="verify-info-cell"><span>{{ RP('birthday') }}</span><strong>{{ detail.birthday || '-' }}</strong></div>
              <div class="verify-info-cell"><span>{{ RP('city') }}</span><strong>{{ detail.city || '-' }}</strong></div>
            </div>
            <div class="verify-info-grid verify-info-grid--1">
              <div class="verify-info-cell"><span>{{ RP('homeAddress') }}</span><strong>{{ detail.home_address || '-' }}</strong></div>
            </div>
          </div>

          <!-- §4 账户信息 -->
          <div class="co-section-heading">
            <UserOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ RP('sectionAccount') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div class="verify-info-grid verify-info-grid--2">
            <div class="verify-info-cell"><span>{{ RP('nickname') }}</span><strong>{{ detail.nickname || '-' }}</strong></div>
            <div class="verify-info-cell"><span>{{ RP('mobile') }}</span><strong>{{ detail.mobile || '-' }}</strong></div>
            <div class="verify-info-cell"><span>{{ RP('registered') }}</span><strong>{{ detail.register_time || '-' }}</strong></div>
            <div class="verify-info-cell"><span>{{ RP('site') }}</span><strong>{{ detail.site_id }}</strong></div>
          </div>

          <!-- 最终决定(摘要在内容区,操作固定在抽屉底部) -->
          <div class="fd-card">
            <div class="fd-head">
              <span class="fd-title">{{ RP('finalDecision') }}</span>
              <span class="fd-subtitle">{{ decisionSubtitle }}</span>
            </div>
            <span class="fd-count"><StatusTag :value="detail.real_name_status" :map="REAL_NAME_BADGE" /></span>
            <div v-if="Number(detail.real_name_status) === 2 && detail.real_name_reject_reason" class="rn-reject-box">
              <strong>{{ RP('rejectReasonShown') }}</strong>
              <span>{{ detail.real_name_reject_reason }}</span>
            </div>
          </div>

          <!-- 时间线 -->
          <div class="co-section-heading">
            <h4 class="co-heading-text">{{ RP('sectionTimeline') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div v-if="timeline.length" class="onb-tl">
            <div v-for="(ev, idx) in timeline" :key="idx" class="onb-tl-item">
              <div class="onb-tl-dot" :style="ev.action === 'rejected' ? 'background:#dc2626;box-shadow:0 0 0 2px #dc2626' : 'background:#1664ff;box-shadow:0 0 0 2px #1664ff'" />
              <div class="onb-tl-row">
                <span class="onb-tl-date">{{ String(ev.at || '').slice(0, 10) }}</span>
                <span class="onb-tl-tag" :style="ev.action === 'rejected' ? 'color:#dc2626;background:#dc262615' : 'color:#1664ff;background:#1664ff15'">{{ ev.operator || '-' }}</span>
              </div>
              <div class="onb-tl-action">{{ RP(TIMELINE_TEXT[ev.action] || 'timelineSubmitted') }}<template v-if="ev.note"> — {{ ev.note }}</template></div>
              <div class="onb-tl-by">by {{ ev.operator || '-' }} · {{ ev.at }}</div>
            </div>
          </div>
          <a-empty v-else :description="RP('emptyNoTimeline')" :image="undefined" style="margin: 12px 0" />
        </template>
      </a-spin>
      <template #footer>
        <div v-if="detail && isPending" class="fd-actions">
          <a-button v-perm="'user:realname:reject'" class="resub-footer-action--reject" @click="openReject(detail)"><template #icon><CloseCircleOutlined /></template>{{ RP('footerReject') }}</a-button>
          <a-button v-perm="'user:realname:approve'" type="primary" class="resub-footer-action--approve" @click="openApprove(detail)"><template #icon><CheckCircleOutlined /></template>{{ RP('footerApprove') }}</a-button>
        </div>
      </template>
    </a-drawer>

    <!-- 驳回 -->
    <a-modal v-model:open="rejectOpen" :title="RP('rejectModalTitle')" :confirm-loading="rejectSaving" :ok-text="RP('footerReject')" :ok-button-props="{ danger: true }" @ok="doReject">
      <a-form layout="vertical">
        <a-form-item :label="RP('rejectReasonLabel')" required>
          <a-select v-model:value="rejectReason" :options="REJECT_REASONS" :placeholder="RP('rejectReasonPlaceholder')" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="RP('rejectNoteLabel')">
          <a-textarea v-model:value="rejectNote" :rows="3" :maxlength="300" :placeholder="RP('rejectNotePlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
/* 以下样式照搬商户验证页(views/merchant/verify)与 MerchantVerifyNav,保持两类审核页观感一致 */
.rn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 16px;
}
.verify-eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #94a3b8;
}
.verify-page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
  color: #1a2332;
}
.verify-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 19.5px;
  color: #94a3b8;
}
.verify-export-btn {
  height: 34px;
  font-size: 13px;
  color: #475569;
  border: 1px solid #e3e8f0;
  background: #fff;
}
.verify-export-btn:hover {
  background: #f8fafc !important;
  border-color: #e3e8f0 !important;
  color: #475569 !important;
}

/* 状态卡片导航 */
.mv-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.mv-card {
  padding: 12px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mv-card:hover {
  box-shadow: 0 2px 8px rgba(26, 35, 50, 0.06);
}
.mv-card__label {
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
}
.mv-card__value {
  font-size: 26px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.2;
}
.mv-card__bar {
  width: 32px;
  height: 3px;
  margin-top: 6px;
  border-radius: 2px;
  background: #e3e8f0;
}
.mv-card__bar-fill {
  height: 100%;
  border-radius: 2px;
}

/* 表格单元 */
.rn-mono {
  font-family: monospace;
  font-size: 12px;
}
.rn-id {
  font-weight: 500;
  color: #2563eb;
}
.rn-time {
  color: #475569;
}
.rn-strong {
  font-weight: 600;
}
.rn-muted {
  color: var(--sap-muted);
}
.rn-user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rn-user__name {
  font-weight: 600;
}
.rn-user__sub {
  font-size: 11px;
  color: var(--sap-muted);
}

/* 抽屉 */
.verify-drawer-title > div {
  color: #1a2332;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
}
.verify-drawer-title > span {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}
.fd-review-mode {
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}
.fd-review-mode__title {
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
}
.fd-review-mode__desc {
  font-size: 11px;
  line-height: 1.5;
  color: #1e40af;
}
.co-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 10px;
}
.co-heading-icon {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 13px;
}
.co-heading-text {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: 0.84px;
  text-transform: uppercase;
  color: #64748b;
}
.co-heading-line {
  flex: 1;
  height: 1px;
  background: #f1f5f9;
}
.verify-info-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.verify-info-grid {
  display: grid;
  gap: 8px;
}
.verify-info-grid--1 {
  grid-template-columns: minmax(0, 1fr);
}
.verify-info-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.verify-info-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.verify-info-cell {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  background: #f8fafc;
}
.verify-info-cell > span {
  display: block;
  margin-bottom: 3px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 500;
}
.verify-info-cell > strong {
  display: block;
  overflow: hidden;
  color: #1a2332;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 证件材料:三格缩略图,点击走 a-image 的放大预览 */
.rn-docs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.rn-doc {
  overflow: hidden;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
}
.rn-doc__media {
  height: 150px;
  overflow: hidden;
  background: #f8fafc;
}
.rn-doc__media :deep(.ant-image),
.rn-doc__media :deep(.ant-image-img) {
  width: 100%;
  height: 150px;
  object-fit: cover;
}
.rn-doc__empty {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 11px;
}
.rn-doc__label {
  padding: 8px 10px;
  border-top: 1px solid #f1f5f9;
  color: #1a2332;
  font-size: 12px;
  font-weight: 600;
}

/* 最终决定卡 */
.fd-card {
  position: relative;
  margin-top: 18px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
}
.fd-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 110px 12px 14px;
}
.fd-title {
  font-size: 13px;
  font-weight: 700;
  color: #1a2332;
}
.fd-subtitle {
  font-size: 11px;
  color: #64748b;
}
.fd-count {
  position: absolute;
  top: 12px;
  right: 14px;
}
.rn-reject-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 14px 12px;
  padding: 8px 10px;
  border: 1px solid #fecdd3;
  border-radius: 6px;
  background: #fff1f2;
  font-size: 12px;
  color: #9f1239;
}
.rn-reject-box strong {
  font-size: 11px;
}
.fd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.resub-footer-action--reject {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}
.resub-footer-action--reject:hover,
.resub-footer-action--reject:focus {
  border-color: #fda4af;
  background: #ffe4e6;
  color: #9f1239;
}
.resub-footer-action--approve {
  border-color: #2463eb;
  background: #2463eb;
  color: #fff;
}
.resub-footer-action--approve:hover,
.resub-footer-action--approve:focus {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #fff;
}

/* 时间线 */
.onb-tl {
  position: relative;
  margin-top: 8px;
  margin-left: 5px;
  padding-left: 20px;
  border-left: 2px solid #e3e8f0;
}
.onb-tl-item {
  position: relative;
  margin-bottom: 14px;
}
.onb-tl-item:last-child {
  margin-bottom: 0;
}
.onb-tl-dot {
  position: absolute;
  top: 2px;
  left: -25px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
}
.onb-tl-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}
.onb-tl-date {
  font-family: monospace;
  font-size: 10px;
  white-space: nowrap;
  color: #94a3b8;
}
.onb-tl-tag {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.onb-tl-action {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  word-break: break-word;
  color: #1a2332;
}
.onb-tl-by {
  margin-top: 3px;
  font-size: 11px;
  color: #64748b;
}
</style>
