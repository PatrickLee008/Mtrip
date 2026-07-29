<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { formatAmount } from '@/utils/format';
import { apiGoodsAudit, apiGoodsDetail, apiGoodsList, apiGoodsToggleStatus } from '@/api/goods';

/** 商品审核工作台:待审核队列(通过=直接上架/驳回必填原因)+ 已上架强制下架 */
const activeTab = ref('pending');
const TYPE_TEXT: Record<number, string> = { 1: '酒店', 2: '门票' };

const pending = useTable(
  (params) => apiGoodsList({ ...params, status: 1 }),
  { goodsName: '', goodsType: undefined },
);
const onsale = useTable(
  (params) => apiGoodsList({ ...params, status: 3 }),
  { goodsName: '', goodsType: undefined },
);

const pendingColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '商品名称', dataIndex: 'goods_name', ellipsis: true },
  { title: '类型', dataIndex: 'goods_type', width: 80 },
  { title: '商户', dataIndex: 'merchant_name', width: 150, ellipsis: true },
  { title: '提交时间', dataIndex: 'updated_at', width: 165 },
  { title: '操作', key: 'action_col', width: 160 },
];
const onsaleColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '商品名称', dataIndex: 'goods_name', ellipsis: true },
  { title: '类型', dataIndex: 'goods_type', width: 80 },
  { title: '商户', dataIndex: 'merchant_name', width: 150, ellipsis: true },
  { title: '销量', dataIndex: 'sales_count', width: 80 },
  { title: '上架时间', dataIndex: 'updated_at', width: 165 },
  { title: '操作', key: 'action_col', width: 130 },
];

function reloadAll(): void {
  pending.search();
  onsale.search();
}

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailSkus = ref<TableRow[]>([]);
const detailRules = ref<TableRow[]>([]);
const RULE_TYPE_TEXT: Record<number, string> = { 1: '免费退', 2: '阶梯退', 3: '不可退' };

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiGoodsDetail(row.id);
    detail.value = data.goods;
    detailSkus.value = data.skus;
    detailRules.value = data.refundRules;
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 审核 ----------
const auditOpen = ref(false);
const auditSaving = ref(false);
const auditTarget = ref<TableRow | null>(null);
const auditForm = reactive({ auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow, auditStatus: number): void {
  auditTarget.value = row;
  Object.assign(auditForm, { auditStatus, auditRemark: '' });
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
    await apiGoodsAudit({ id: auditTarget.value.id, ...auditForm });
    message.success(auditForm.auditStatus === 1 ? '审核通过,商品已上架' : '已驳回,商户可修改后重新提交');
    auditOpen.value = false;
    drawerOpen.value = false;
    reloadAll();
  } finally {
    auditSaving.value = false;
  }
}

// ---------- 强制下架 ----------
const offOpen = ref(false);
const offSaving = ref(false);
const offTarget = ref<TableRow | null>(null);
const offRemark = ref('');

function openOff(row: TableRow): void {
  offTarget.value = row;
  offRemark.value = '';
  offOpen.value = true;
}

async function doOff(): Promise<void> {
  if (!offTarget.value) {
    return;
  }
  if (!offRemark.value.trim()) {
    message.warning('强制下架必须填写原因备注');
    return;
  }
  offSaving.value = true;
  try {
    await apiGoodsToggleStatus(offTarget.value.id);
    message.success('商品已强制下架');
    offOpen.value = false;
    onsale.search();
  } finally {
    offSaving.value = false;
  }
}

onMounted(() => {
  void pending.load();
  void onsale.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra>
        <a-button @click="reloadAll"><template #icon><ReloadOutlined /></template>刷新</a-button>
      </template>
      <a-tabs v-model:active-key="activeTab">
        <!-- 待审核队列 -->
        <a-tab-pane key="pending">
          <template #tab>
            <a-badge :count="pending.total.value" :offset="[10, -2]">待审核</a-badge>
          </template>
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="商品名称">
              <a-input v-model:value="pending.query.goodsName" allow-clear style="width: 180px" @press-enter="pending.search()" />
            </a-form-item>
            <a-form-item label="类型">
              <a-select v-model:value="pending.query.goodsType" allow-clear placeholder="全部" style="width: 110px">
                <a-select-option :value="1">酒店</a-select-option>
                <a-select-option :value="2">门票</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="pending.search()"><template #icon><SearchOutlined /></template>查询</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="pendingColumns"
            :data-source="pending.list.value"
            :loading="pending.loading.value"
            :pagination="pending.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'goods_type'">{{ TYPE_TEXT[record.goods_type] ?? '-' }}</template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
                  <a-button
                    v-perm="'goods:audit:audit'"
                    type="link"
                    size="small"
                    style="color: var(--mtrip-success, #52c41a)"
                    @click="openAudit(record, 1)"
                  >通过</a-button>
                  <a-button
                    v-perm="'goods:audit:audit'"
                    type="link"
                    size="small"
                    style="color: var(--mtrip-warning, #faad14)"
                    @click="openAudit(record, 2)"
                  >驳回</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 已上架(强制下架) -->
        <a-tab-pane key="onsale" tab="已上架">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="商品名称">
              <a-input v-model:value="onsale.query.goodsName" allow-clear style="width: 180px" @press-enter="onsale.search()" />
            </a-form-item>
            <a-form-item label="类型">
              <a-select v-model:value="onsale.query.goodsType" allow-clear placeholder="全部" style="width: 110px">
                <a-select-option :value="1">酒店</a-select-option>
                <a-select-option :value="2">门票</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="onsale.search()"><template #icon><SearchOutlined /></template>查询</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="onsaleColumns"
            :data-source="onsale.list.value"
            :loading="onsale.loading.value"
            :pagination="onsale.pagination.value"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'goods_type'">{{ TYPE_TEXT[record.goods_type] ?? '-' }}</template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
                  <a-button v-perm="'goods:audit:off'" type="link" size="small" danger @click="openOff(record)">强制下架</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="商品审核详情" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="商品名称" :span="2">{{ detail.goods_name }}</a-descriptions-item>
            <a-descriptions-item label="类型">{{ TYPE_TEXT[detail.goods_type] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="星级/营业">
              {{ detail.goods_type === 1 ? `${detail.star_level} 星` : `${detail.open_time || '-'} ~ ${detail.close_time || '-'}` }}
            </a-descriptions-item>
            <a-descriptions-item label="地址" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item label="简介" :span="2">{{ detail.goods_brief || '-' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider orientation="left">图集</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <a-divider orientation="left">SKU({{ detailSkus.length }})</a-divider>
          <a-table
            :columns="[
              { title: 'ID', dataIndex: 'id', width: 60 },
              { title: '名称', key: 'sku_name' },
              { title: '门市价', dataIndex: 'base_price', width: 100 },
              { title: '基础库存', dataIndex: 'base_stock', width: 90 },
              { title: '状态', dataIndex: 'status', width: 80 },
            ]"
            :data-source="detailSkus"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'sku_name'">{{ record.room_name ?? record.ticket_name }}</template>
              <template v-else-if="column.dataIndex === 'base_price'">{{ formatAmount(record.base_price) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '在售' : '停售' }}</a-tag>
              </template>
            </template>
          </a-table>
          <a-divider orientation="left">退改规则({{ detailRules.length }})</a-divider>
          <a-table
            :columns="[
              { title: '适用', key: 'scope', width: 120 },
              { title: '类型', dataIndex: 'rule_type', width: 90 },
              { title: '阶梯', key: 'steps' },
            ]"
            :data-source="detailRules"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'scope'">
                {{ Number(record.sku_type) === 0 ? '商品级' : `SKU#${record.sku_id}` }}
              </template>
              <template v-else-if="column.dataIndex === 'rule_type'">{{ RULE_TYPE_TEXT[record.rule_type] ?? '-' }}</template>
              <template v-else-if="column.key === 'steps'">
                <template v-if="Array.isArray(record.rules)">
                  <div v-for="(step, idx) in record.rules" :key="idx">提前 {{ step.hours_before }}h 退 {{ step.refund_rate }}%</div>
                </template>
                <span v-else>-</span>
              </template>
            </template>
          </a-table>
          <template v-if="Number(detail.status) === 1">
            <a-divider />
            <a-space>
              <a-button v-perm="'goods:audit:audit'" type="primary" @click="openAudit(detail, 1)">审核通过</a-button>
              <a-button v-perm="'goods:audit:audit'" danger @click="openAudit(detail, 2)">驳回</a-button>
            </a-space>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 审核确认 -->
    <a-modal
      v-model:open="auditOpen"
      :title="auditForm.auditStatus === 1 ? '审核通过' : '审核驳回'"
      width="480px"
      :confirm-loading="auditSaving"
      :ok-button-props="auditForm.auditStatus === 2 ? { danger: true } : undefined"
      @ok="doAudit"
    >
      <a-alert
        :type="auditForm.auditStatus === 1 ? 'success' : 'warning'"
        :message="auditForm.auditStatus === 1 ? '通过后商品将直接上架售卖' : '驳回后商户可修改后重新提交'"
        show-icon
        style="margin: 16px 0"
      />
      <a-form :label-col="{ style: { width: '90px' } }">
        <a-form-item label="审核意见" :required="auditForm.auditStatus === 2">
          <a-textarea
            v-model:value="auditForm.auditRemark"
            :rows="3"
            :maxlength="500"
            :placeholder="auditForm.auditStatus === 2 ? '必填:驳回原因' : '选填'"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 强制下架 -->
    <a-modal
      v-model:open="offOpen"
      title="强制下架"
      width="480px"
      :confirm-loading="offSaving"
      :ok-button-props="{ danger: true }"
      @ok="doOff"
    >
      <a-alert type="error" message="强制下架后商品立即停售,进行中订单不受影响" show-icon style="margin: 16px 0" />
      <a-form :label-col="{ style: { width: '90px' } }">
        <a-form-item label="下架原因" required>
          <a-textarea v-model:value="offRemark" :rows="3" :maxlength="255" placeholder="必填:违规原因/下架说明" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
