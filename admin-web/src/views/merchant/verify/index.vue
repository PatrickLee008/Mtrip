<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import MerchantVerifyNav from '@/components/MerchantVerifyNav.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiVerifyApprove,
  apiVerifyDetail,
  apiVerifyDocReview,
  apiVerifyList,
  apiVerifyReject,
  apiVerifyResubmit,
  apiVerifyResubmitReceived,
} from '@/api/merchant';

/**
 * 商户验证工作流(Super Admin Portal Phase 1)
 * 4 状态页共用本组件,tab 由路由末段决定:/merchant-verify/{pending|approved|rejected|resubmission}
 */
const { t } = useI18n();
const route = useRoute();

const TABS = [
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'resubmission', label: 'Resubmission' },
];

function tabFromPath(path: string): string {
  const seg = path.split('/').pop() || 'pending';
  return TABS.some((x) => x.key === seg) ? seg : 'pending';
}
const activeTab = computed(() => tabFromPath(route.path));

// merchant_info.status 语义(含 Phase 1 扩展 6=待重新提交)
const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: 'Pending', color: 'warning' },
  2: { text: 'Rejected', color: 'error' },
  3: { text: 'Approved', color: 'success' },
  4: { text: 'Suspended', color: 'orange' },
  5: { text: 'Closed', color: 'default' },
  6: { text: 'Resubmission', color: 'processing' },
};
const DOC_STATUS: Record<number, StatusItem> = {
  1: { text: 'Verified', color: 'success' },
  2: { text: 'Pending', color: 'warning' },
  3: { text: 'Rejected', color: 'error' },
  4: { text: 'Expired', color: 'error' },
  5: { text: 'Resubmission', color: 'processing' },
};
const TYPE_TEXT: Record<number, string> = { 1: 'Hotel', 2: 'Scenic', 3: 'Composite' };

/** 预置驳回原因(与后端 VerifyController::REJECT_REASONS 对齐) */
const REJECT_REASONS = [
  { code: 1, label: 'Expired business registration' },
  { code: 2, label: 'Invalid or missing operating license' },
  { code: 3, label: 'Incomplete documentation' },
  { code: 4, label: 'Identity verification failed' },
  { code: 5, label: 'Business does not meet platform requirements' },
  { code: 6, label: 'Premises / fleet documents invalid' },
  { code: 7, label: 'Insurance or safety certification missing' },
  { code: 8, label: 'Suspected fraudulent application' },
  { code: 9, label: 'Duplicate merchant account' },
];

const { loading, list, query, load, search, reset, pagination } = useTable(apiVerifyList, {
  tab: activeTab.value,
  keyword: '',
  merchantType: undefined,
});

// 路由切换(不同状态页)→ 同步 tab 并从第一页重查
watch(
  () => route.path,
  () => {
    query.tab = activeTab.value;
    search();
  },
);

const columns = computed(() => [
  { title: 'Lead ID', dataIndex: 'id', width: 90 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 220, ellipsis: true },
  { title: 'Contact', dataIndex: 'contact_name', width: 150 },
  { title: 'Type', dataIndex: 'merchant_type', width: 90 },
  { title: 'Submitted', dataIndex: 'created_at', width: 165 },
  { title: 'Status', dataIndex: 'status', width: 120 },
  { title: 'Reviewed', dataIndex: 'audit_time', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 260, fixed: 'right' as const },
]);

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const documents = ref<TableRow[]>([]);
const timeline = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiVerifyDetail(row.id);
    detail.value = data.merchant;
    documents.value = data.documents;
    timeline.value = data.timeline;
  } finally {
    detailLoading.value = false;
  }
}

const docColumns = computed(() => [
  { title: 'Document', dataIndex: 'name', ellipsis: true },
  { title: 'Status', dataIndex: 'status', width: 120 },
  { title: 'Expiry', dataIndex: 'expiry_date', width: 120 },
  { title: 'Reviewer', dataIndex: 'reviewer_name', width: 120 },
  { title: t('common.action'), key: 'doc_action', width: 150 },
]);

// ---------- 审核动作 ----------
const actionTarget = ref<TableRow | null>(null);

const approveOpen = ref(false);
const approveRemark = ref('');
const approveSaving = ref(false);
function openApprove(row: TableRow): void {
  actionTarget.value = row;
  approveRemark.value = '';
  approveOpen.value = true;
}
async function doApprove(): Promise<void> {
  if (!actionTarget.value) return;
  approveSaving.value = true;
  try {
    const account = await apiVerifyApprove(actionTarget.value.id, approveRemark.value);
    approveOpen.value = false;
    if (account) {
      Modal.success({
        title: 'Merchant Approved',
        content: `Username: ${account.username}  ·  Initial Password: ${account.password}`,
        width: 520,
      });
    }
    drawerOpen.value = false;
    await load();
  } finally {
    approveSaving.value = false;
  }
}

const rejectOpen = ref(false);
const rejectReasonCode = ref<number | undefined>(undefined);
const rejectNote = ref('');
const rejectSaving = ref(false);
function openReject(row: TableRow): void {
  actionTarget.value = row;
  rejectReasonCode.value = undefined;
  rejectNote.value = '';
  rejectOpen.value = true;
}
async function doReject(): Promise<void> {
  if (!actionTarget.value) return;
  if (!rejectReasonCode.value) {
    message.warning('Please select a rejection reason');
    return;
  }
  rejectSaving.value = true;
  try {
    await apiVerifyReject(actionTarget.value.id, rejectReasonCode.value, rejectNote.value.trim() || undefined);
    message.success('Application rejected');
    rejectOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    rejectSaving.value = false;
  }
}

const resubOpen = ref(false);
const resubComment = ref('');
const resubSaving = ref(false);
function openResub(row: TableRow): void {
  actionTarget.value = row;
  resubComment.value = '';
  resubOpen.value = true;
}
async function doResub(): Promise<void> {
  if (!actionTarget.value) return;
  if (!resubComment.value.trim()) {
    message.warning('Comment is required');
    return;
  }
  resubSaving.value = true;
  try {
    await apiVerifyResubmit(actionTarget.value.id, resubComment.value);
    message.success('Merchant notified to resubmit');
    resubOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    resubSaving.value = false;
  }
}

/** 确认商户已重新提交文件(重新提交 → 待验证闭环) */
const resubReceivedSaving = ref(false);
async function markResubmitted(row: TableRow): Promise<void> {
  resubReceivedSaving.value = true;
  try {
    await apiVerifyResubmitReceived(row.id);
    message.success('Resubmission confirmed, merchant returned to Pending Verification');
    drawerOpen.value = false;
    await load();
  } finally {
    resubReceivedSaving.value = false;
  }
}

// ---------- 文档核验 ----------
async function verifyDoc(row: TableRow): Promise<void> {
  await apiVerifyDocReview({ docId: row.id, action: 'verify' });
  message.success('Document verified');
  await refreshDocs();
}
const docRejectOpen = ref(false);
const docRejectReason = ref('');
const docRejectSaving = ref(false);
const docTarget = ref<TableRow | null>(null);
function openDocReject(row: TableRow): void {
  docTarget.value = row;
  docRejectReason.value = '';
  docRejectOpen.value = true;
}
async function doDocReject(): Promise<void> {
  if (!docTarget.value) return;
  if (!docRejectReason.value.trim()) {
    message.warning('Reason is required');
    return;
  }
  docRejectSaving.value = true;
  try {
    await apiVerifyDocReview({ docId: docTarget.value.id, action: 'reject', reason: docRejectReason.value });
    message.success('Document rejected');
    docRejectOpen.value = false;
    await refreshDocs();
  } finally {
    docRejectSaving.value = false;
  }
}
async function refreshDocs(): Promise<void> {
  if (!detail.value) return;
  const data = await apiVerifyDetail(detail.value.id);
  documents.value = data.documents;
  timeline.value = data.timeline;
}

const canAct = computed(() => activeTab.value === 'pending' || activeTab.value === 'resubmission');

onMounted(() => {
  query.tab = activeTab.value;
  void load();
});
</script>

<template>
  <PageContainer>
    <MerchantVerifyNav :active="activeTab" />
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Keyword">
          <a-input v-model:value="query.keyword" allow-clear placeholder="Name / credit code / contact" style="width: 220px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Type">
          <a-select v-model:value="query.merchantType" allow-clear placeholder="All" style="width: 120px">
            <a-select-option :value="1">Hotel</a-select-option>
            <a-select-option :value="2">Scenic</a-select-option>
            <a-select-option :value="3">Composite</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1260 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">
            <div style="font-weight: 500">{{ record.merchant_name }}</div>
            <div style="font-size: 12px; color: var(--sap-muted)">{{ record.credit_code }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'contact_name'">
            <div>{{ record.contact_name }}</div>
            <div style="font-size: 12px; color: var(--sap-muted)">{{ record.contact_phone }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'merchant_type'">
            {{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'audit_time'">
            {{ record.audit_time || '-' }}
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <template v-if="canAct">
                <a-button v-perm="'merchant:verify:approve'" type="link" size="small" style="color: var(--sap-success)" @click="openApprove(record)">Approve</a-button>
                <a-button v-perm="'merchant:verify:reject'" type="link" size="small" danger @click="openReject(record)">Reject</a-button>
                <a-button v-if="activeTab === 'pending'" v-perm="'merchant:verify:resubmit'" type="link" size="small" style="color: var(--sap-warning)" @click="openResub(record)">Resubmit</a-button>
                <a-button v-if="activeTab === 'resubmission'" v-perm="'merchant:verify:resubmit'" type="link" size="small" style="color: var(--sap-warning)" :loading="resubReceivedSaving" @click="markResubmitted(record)">Resubmitted</a-button>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 验证详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="Merchant Verification Details" width="760">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="Merchant" :span="2">{{ detail.merchant_name }}</a-descriptions-item>
            <a-descriptions-item label="Type">{{ TYPE_TEXT[detail.merchant_type] ?? detail.merchant_type }}</a-descriptions-item>
            <a-descriptions-item label="Status"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="Credit Code" :span="2">{{ detail.credit_code }}</a-descriptions-item>
            <a-descriptions-item label="Legal Person">{{ detail.legal_person }}</a-descriptions-item>
            <a-descriptions-item label="Contact">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item label="Phone">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item label="Email">{{ detail.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item label="Address" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item label="Review Note" :span="2">{{ detail.audit_remark || '-' }}</a-descriptions-item>
          </a-descriptions>

          <a-divider orientation="left">Submitted Documents</a-divider>
          <a-table :columns="docColumns" :data-source="documents" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'name'">
                <div>{{ record.name || record.doc_type }}</div>
                <div style="font-size: 12px; color: var(--sap-muted)">{{ record.doc_type }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="DOC_STATUS" />
              </template>
              <template v-else-if="column.dataIndex === 'expiry_date'">{{ record.expiry_date || '-' }}</template>
              <template v-else-if="column.dataIndex === 'reviewer_name'">{{ record.reviewer_name || '-' }}</template>
              <template v-else-if="column.key === 'doc_action'">
                <a-space :size="0">
                  <a-button v-if="record.status !== 1" v-perm="'merchant:verify:doc'" type="link" size="small" style="color: var(--sap-success)" @click="verifyDoc(record)">Verify</a-button>
                  <a-button v-if="record.status !== 3" v-perm="'merchant:verify:doc'" type="link" size="small" danger @click="openDocReject(record)">Reject</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-if="!documents.length" description="No documents uploaded yet" :image="undefined" style="margin: 12px 0" />

          <a-divider orientation="left">Activity Timeline</a-divider>
          <a-timeline>
            <a-timeline-item
              v-for="ev in timeline"
              :key="ev.id"
              :color="ev.is_exception === 1 ? 'red' : 'blue'"
            >
              <div style="font-weight: 500">{{ ev.action }}</div>
              <div v-if="ev.note" style="font-size: 12px; color: var(--sap-muted)">{{ ev.note }}</div>
              <div style="font-size: 12px; color: var(--sap-muted)">
                {{ ev.operator_name || 'System' }} · {{ ev.created_at }}
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-if="!timeline.length" description="No timeline yet" :image="undefined" style="margin: 12px 0" />

          <div v-if="canAct" style="margin-top: 16px; display: flex; gap: 8px">
            <a-button v-perm="'merchant:verify:approve'" type="primary" @click="openApprove(detail)">Approve Merchant</a-button>
            <a-button v-perm="'merchant:verify:reject'" danger @click="openReject(detail)">Reject</a-button>
            <a-button v-if="activeTab === 'pending'" v-perm="'merchant:verify:resubmit'" @click="openResub(detail)">Request Resubmission</a-button>
            <a-button v-if="activeTab === 'resubmission'" v-perm="'merchant:verify:resubmit'" type="primary" ghost :loading="resubReceivedSaving" @click="markResubmitted(detail)">Confirm Resubmission</a-button>
          </div>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 通过 -->
    <a-modal v-model:open="approveOpen" title="Approve Merchant Application" :confirm-loading="approveSaving" ok-text="Approve" @ok="doApprove">
      <p style="margin: 8px 0 12px">This grants the merchant full access to list and receive bookings, and generates their portal account.</p>
      <a-textarea v-model:value="approveRemark" :rows="3" placeholder="Review note (optional)" />
    </a-modal>

    <!-- 驳回 -->
    <a-modal v-model:open="rejectOpen" title="Reject Application" :confirm-loading="rejectSaving" ok-text="Reject" :ok-button-props="{ danger: true }" @ok="doReject">
      <a-form layout="vertical">
        <a-form-item label="Rejection Reason" required>
          <a-select v-model:value="rejectReasonCode" :options="REJECT_REASONS" placeholder="Select reason…" style="width: 100%" />
        </a-form-item>
        <a-form-item label="Additional Notes (optional)">
          <a-textarea v-model:value="rejectNote" :rows="3" placeholder="Additional notes for the merchant (optional)" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 要求重交 -->
    <a-modal v-model:open="resubOpen" title="Request Resubmission" :confirm-loading="resubSaving" ok-text="Send Notification" @ok="doResub">
      <a-textarea v-model:value="resubComment" :rows="4" placeholder="Explain what needs to be corrected (required)" />
    </a-modal>

    <!-- 文档驳回 -->
    <a-modal v-model:open="docRejectOpen" title="Reject Document" :confirm-loading="docRejectSaving" ok-text="Reject" :ok-button-props="{ danger: true }" @ok="doDocReject">
      <a-textarea v-model:value="docRejectReason" :rows="3" placeholder="Reason for the merchant (required)" />
    </a-modal>
  </PageContainer>
</template>
