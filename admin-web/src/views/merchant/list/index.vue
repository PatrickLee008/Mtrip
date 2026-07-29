<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiMerchantAdd,
  apiMerchantAudit,
  apiMerchantClose,
  apiMerchantCommission,
  apiMerchantDetail,
  apiMerchantList,
  apiMerchantToggleStatus,
  apiMerchantUpdate,
} from '@/api/merchant';

/** 商户列表:入驻审核/费率配置/启停/注销(文档 6.4.2;状态机 0→3/2,3⇄4,5终态) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待审核', color: 'warning' },
  2: { text: '审核驳回', color: 'error' },
  3: { text: '已启用', color: 'success' },
  4: { text: '已禁用', color: 'default' },
  5: { text: '已注销', color: 'default' },
};
const TYPE_TEXT: Record<number, string> = { 1: '酒店商户', 2: '门票商户', 3: '综合商户' };

const { loading, list, query, load, search, reset, pagination } = useTable(apiMerchantList, {
  merchantName: '',
  merchantType: undefined,
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '商户名称', dataIndex: 'merchant_name', width: 200, ellipsis: true },
  { title: '类型', dataIndex: 'merchant_type', width: 100 },
  { title: '联系人', dataIndex: 'contact_name', width: 100 },
  { title: '联系电话', dataIndex: 'contact_phone', width: 130 },
  { title: '抽佣(%)', dataIndex: 'commission_rate', width: 90 },
  { title: '结算周期', dataIndex: 'settlement_cycle', width: 90 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '入驻时间', dataIndex: 'created_at', width: 165 },
  { title: '操作', key: 'action_col', width: 300, fixed: 'right' as const },
];

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailAccounts = ref<TableRow[]>([]);
const detailAdmins = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiMerchantDetail(row.id);
    detail.value = data.merchant;
    detailAccounts.value = data.accounts;
    detailAdmins.value = data.admins;
  } finally {
    detailLoading.value = false;
  }
}

const accountColumns = [
  { title: '开户行', dataIndex: 'bank_name' },
  { title: '户名', dataIndex: 'account_name' },
  { title: '账号', dataIndex: 'account_no' },
  { title: '币种', dataIndex: 'currency', width: 70 },
  { title: '默认', dataIndex: 'is_default', width: 60 },
];
const adminColumns = [
  { title: '账号', dataIndex: 'username' },
  { title: '姓名', dataIndex: 'real_name' },
  { title: '主账号', dataIndex: 'is_owner', width: 70 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '最后登录', dataIndex: 'last_login_at', width: 160 },
];

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  merchantName: '',
  merchantType: 1,
  creditCode: '',
  legalPerson: '',
  legalIdCard: '',
  legalIdImages: [] as string[],
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  remark: '',
  siteId: 0,
});

function resetForm(): void {
  Object.assign(form, {
    merchantName: '',
    merchantType: 1,
    creditCode: '',
    legalPerson: '',
    legalIdCard: '',
    legalIdImages: [],
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    remark: '',
    siteId: 0,
  });
}

function openCreate(): void {
  editingId.value = 0;
  resetForm();
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    merchantName: row.merchant_name ?? '',
    merchantType: row.merchant_type ?? 1,
    creditCode: row.credit_code ?? '',
    legalPerson: row.legal_person ?? '',
    // 身份证号加密存储,留空表示保留原值
    legalIdCard: '',
    legalIdImages: [],
    contactName: row.contact_name ?? '',
    // 联系电话列表为脱敏值,留空保留原值
    contactPhone: '',
    contactEmail: row.contact_email ?? '',
    address: row.address ?? '',
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveMerchant(): Promise<void> {
  if (!form.merchantName.trim()) {
    message.warning('请输入商户名称');
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiMerchantUpdate({ id: editingId.value, ...form });
      message.success('商户已更新');
    } else {
      if (!form.creditCode.trim() || !form.legalPerson.trim() || !form.contactName.trim() || !form.contactPhone.trim()) {
        message.warning('请完整填写信用代码/法人/联系人/联系电话');
        return;
      }
      await apiMerchantAdd({ ...form });
      message.success('商户创建成功,待审核');
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 入驻审核 ----------
const auditOpen = ref(false);
const auditSaving = ref(false);
const auditTarget = ref<TableRow | null>(null);
const auditForm = reactive({ auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow): void {
  auditTarget.value = row;
  Object.assign(auditForm, { auditStatus: 1, auditRemark: '' });
  auditOpen.value = true;
}

async function doAudit(): Promise<void> {
  if (!auditTarget.value) {
    return;
  }
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning('驳回必须填写原因');
    return;
  }
  auditSaving.value = true;
  try {
    const account = await apiMerchantAudit({ id: auditTarget.value.id, ...auditForm });
    auditOpen.value = false;
    if (auditForm.auditStatus === 1 && account) {
      Modal.success({
        title: '审核通过,商户主账号已生成',
        content: `账号:${account.username}  初始密码:${account.password}(明文仅展示一次,请妥善传达商户)`,
        width: 520,
      });
    } else {
      message.success('已驳回,商户可修改后重新提交');
    }
    await load();
  } finally {
    auditSaving.value = false;
  }
}

// ---------- 费率配置 ----------
const commissionOpen = ref(false);
const commissionSaving = ref(false);
const commissionTarget = ref<TableRow | null>(null);
const commissionForm = reactive({ commissionRate: 0, settlementCycle: 15 });

function openCommission(row: TableRow): void {
  commissionTarget.value = row;
  Object.assign(commissionForm, {
    commissionRate: Number(row.commission_rate ?? 0),
    settlementCycle: Number(row.settlement_cycle ?? 15),
  });
  commissionOpen.value = true;
}

async function saveCommission(): Promise<void> {
  if (!commissionTarget.value) {
    return;
  }
  commissionSaving.value = true;
  try {
    await apiMerchantCommission({ id: commissionTarget.value.id, ...commissionForm });
    message.success('佣金设置已更新');
    commissionOpen.value = false;
    await load();
  } finally {
    commissionSaving.value = false;
  }
}

// ---------- 启停 / 注销 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiMerchantToggleStatus(row.id);
  message.success(result.status === 3 ? '商户已启用' : `商户已禁用,联动下架 ${result.offGoods} 个在售商品`);
  await load();
}

const closeOpen = ref(false);
const closeSaving = ref(false);
const closeTarget = ref<TableRow | null>(null);
const closeRemark = ref('');

function openClose(row: TableRow): void {
  closeTarget.value = row;
  closeRemark.value = '';
  closeOpen.value = true;
}

async function doClose(): Promise<void> {
  if (!closeTarget.value) {
    return;
  }
  if (!closeRemark.value.trim()) {
    message.warning('注销必须填写备注原因');
    return;
  }
  closeSaving.value = true;
  try {
    const result = await apiMerchantClose(closeTarget.value.id, closeRemark.value);
    message.success(`商户已注销,联动下架 ${result.offGoods} 个商品`);
    closeOpen.value = false;
    await load();
  } finally {
    closeSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="商户名称">
          <a-input v-model:value="query.merchantName" allow-clear placeholder="模糊搜索" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.merchantType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option :value="1">酒店商户</a-select-option>
            <a-select-option :value="2">门票商户</a-select-option>
            <a-select-option :value="3">综合商户</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option :value="0">待审核</a-select-option>
            <a-select-option :value="2">审核驳回</a-select-option>
            <a-select-option :value="3">已启用</a-select-option>
            <a-select-option :value="4">已禁用</a-select-option>
            <a-select-option :value="5">已注销</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>商户列表</template>
      <template #extra>
        <a-button v-perm="'merchant:list:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增商户
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_type'">
            {{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}
          </template>
          <template v-else-if="column.dataIndex === 'settlement_cycle'">
            {{ record.settlement_cycle === 30 ? '月结' : `T+${record.settlement_cycle}` }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.status !== 5"
                v-perm="'merchant:list:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >编辑</a-button>
              <a-button
                v-if="record.status === 0"
                v-perm="'merchant:list:audit'"
                type="link"
                size="small"
                style="color: var(--mtrip-warning, #faad14)"
                @click="openAudit(record)"
              >审核</a-button>
              <a-button
                v-if="record.status === 3 || record.status === 4"
                v-perm="'merchant:list:edit'"
                type="link"
                size="small"
                @click="openCommission(record)"
              >费率</a-button>
              <a-popconfirm
                v-if="record.status === 3 || record.status === 4"
                :title="record.status === 3 ? '确认禁用该商户?将联动下架其全部在售商品' : '确认启用该商户?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'merchant:list:status'" type="link" size="small" :danger="record.status === 3">
                  {{ record.status === 3 ? '禁用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-button
                v-if="record.status !== 5"
                v-perm="'merchant:list:delete'"
                type="link"
                size="small"
                danger
                @click="openClose(record)"
              >注销</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="商户详情" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="商户名称" :span="2">{{ detail.merchant_name }}</a-descriptions-item>
            <a-descriptions-item label="类型">{{ TYPE_TEXT[detail.merchant_type] ?? detail.merchant_type }}</a-descriptions-item>
            <a-descriptions-item label="状态"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="信用代码" :span="2">{{ detail.credit_code }}</a-descriptions-item>
            <a-descriptions-item label="法人">{{ detail.legal_person }}</a-descriptions-item>
            <a-descriptions-item label="法人身份证">{{ detail.legal_id_card || '-' }}</a-descriptions-item>
            <a-descriptions-item label="联系人">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item label="联系电话">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item label="邮箱" :span="2">{{ detail.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item label="地址" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item label="抽佣比例">{{ detail.commission_rate }}%</a-descriptions-item>
            <a-descriptions-item label="结算周期">{{ detail.settlement_cycle === 30 ? '月结' : `T+${detail.settlement_cycle}` }}</a-descriptions-item>
            <a-descriptions-item label="审核意见" :span="2">{{ detail.audit_remark || '-' }}</a-descriptions-item>
            <a-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
          </a-descriptions>

          <template v-if="detail.legal_id_images?.length">
            <a-divider orientation="left">资质图片</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.legal_id_images" :key="idx" :src="img" :width="96" />
              </a-space>
            </a-image-preview-group>
          </template>

          <a-divider orientation="left">结算账户</a-divider>
          <a-table :columns="accountColumns" :data-source="detailAccounts" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_default'">
                <a-tag v-if="record.is_default === 1" color="success">默认</a-tag>
                <span v-else>-</span>
              </template>
            </template>
          </a-table>

          <a-divider orientation="left">商户账号</a-divider>
          <a-table :columns="adminColumns" :data-source="detailAdmins" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_owner'">{{ record.is_owner === 1 ? '是' : '否' }}</template>
              <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" /></template>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑商户' : '新增商户(平台代录入)'"
      width="680px"
      :confirm-loading="modalSaving"
      @ok="saveMerchant"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="商户名称" required>
              <a-input v-model:value="form.merchantName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="商户类型" required>
              <a-select v-model:value="form.merchantType">
                <a-select-option :value="1">酒店商户</a-select-option>
                <a-select-option :value="2">门票商户</a-select-option>
                <a-select-option :value="3">综合商户</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="信用代码" :required="!editingId">
              <a-input v-model:value="form.creditCode" :disabled="!!editingId" placeholder="统一社会信用代码" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="法人" :required="!editingId">
              <a-input v-model:value="form.legalPerson" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="法人身份证">
              <a-input v-model:value="form.legalIdCard" :placeholder="editingId ? '留空保留原值' : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="资质图片">
              <a-select v-model:value="form.legalIdImages" mode="tags" placeholder="回车录入图片 URL" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系人" :required="!editingId">
              <a-input v-model:value="form.contactName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系电话" :required="!editingId">
              <a-input v-model:value="form.contactPhone" :placeholder="editingId ? '留空保留原值' : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱">
              <a-input v-model:value="form.contactEmail" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item v-if="isSuper && !editingId" label="归属站点" required>
              <SiteTreeSelect v-model:value="form.siteId" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="地址">
              <a-input v-model:value="form.address" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 入驻审核 -->
    <a-modal
      v-model:open="auditOpen"
      :title="`入驻审核:${auditTarget?.merchant_name ?? ''}`"
      width="480px"
      :confirm-loading="auditSaving"
      @ok="doAudit"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="审核结论" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1"><span style="color: #52c41a">通过(生成商户主账号并启用)</span></a-radio>
            <a-radio :value="2"><span style="color: #fa8c16">驳回(商户可修改后重提)</span></a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审核意见" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :placeholder="auditForm.auditStatus === 2 ? '驳回必须填写原因' : '选填'" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 费率配置 -->
    <a-modal
      v-model:open="commissionOpen"
      :title="`费率配置:${commissionTarget?.merchant_name ?? ''}`"
      width="420px"
      :confirm-loading="commissionSaving"
      @ok="saveCommission"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item label="抽佣比例" required>
          <a-input-number v-model:value="commissionForm.commissionRate" :min="0" :max="100" :step="0.1" addon-after="%" style="width: 100%" />
        </a-form-item>
        <a-form-item label="结算周期" required>
          <a-radio-group v-model:value="commissionForm.settlementCycle">
            <a-radio :value="7">T+7</a-radio>
            <a-radio :value="15">T+15</a-radio>
            <a-radio :value="30">月结</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 注销(高危) -->
    <a-modal
      v-model:open="closeOpen"
      :title="`注销商户:${closeTarget?.merchant_name ?? ''}`"
      width="480px"
      :confirm-loading="closeSaving"
      ok-text="确认注销"
      :ok-button-props="{ danger: true }"
      @ok="doClose"
    >
      <a-alert
        message="注销为终态不可恢复:将下架全部商品并停用商户全部账号;存在进行中订单时禁止注销"
        type="error"
        show-icon
        style="margin: 12px 0 16px"
      />
      <a-textarea v-model:value="closeRemark" :rows="3" placeholder="必填:注销原因备注" />
    </a-modal>
  </PageContainer>
</template>
