<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiLongstayDelete, apiLongstayList, apiLongstaySave } from '@/api/cops';

/** 长住折扣梯度:按住宿夜数配置折扣率(PRD 模块2.1) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiLongstayList, { siteId: 0 });

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '站点', dataIndex: 'site_id', width: 90 },
  { title: '酒店', dataIndex: 'property_id', width: 105 },
  { title: '最低夜数', dataIndex: 'min_nights', width: 120 },
  { title: '折扣率(%)', dataIndex: 'discount_rate', width: 120 },
  { title: '优先级', dataIndex: 'priority', width: 95 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const form = reactive({ siteId: 0, propertyId: 0, minNights: 7, discountRate: null as number | null, status: 2,
  priority: 0, startsAt: '', endsAt: '', couponStackable: 0 as 0 | 1 | null });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { siteId: query.siteId, propertyId: 0, minNights: 7, discountRate: null, status: 2,
    priority: 0, startsAt: '', endsAt: '', couponStackable: 0 });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, { siteId: Number(row.site_id), propertyId: Number(row.property_id), minNights: row.min_nights,
    discountRate: Number(row.discount_rate), status: row.status, priority: Number(row.priority),
    startsAt: row.starts_at ?? '', endsAt: row.ends_at ?? '', couponStackable: row.coupon_stackable === null ? null : Number(row.coupon_stackable) });
  modalOpen.value = true;
}

async function submit(): Promise<void> {
  if (form.discountRate === null || (isSuper && !editingId.value && !form.siteId)) {
    message.warning('请选择站点并填写折扣率');
    return;
  }
  submitting.value = true;
  try {
    await apiLongstaySave({ ...form, id: editingId.value || undefined });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiLongstayDelete({ id: row.id });
  message.success('已删除');
  void load();
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="长住梯度">
      <template #extra>
        <a-button v-perm="'marketing:longstay:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增梯度</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'property_id'">{{ record.property_id || '全站酒店' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '禁用' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'marketing:longstay:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除该梯度?" @confirm="remove(record)">
                <a-button v-perm="'marketing:longstay:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑梯度' : '新增梯度'" :confirm-loading="submitting" @ok="submit">
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 15 }">
        <a-form-item v-if="isSuper && !editingId" label="站点" required>
          <SiteTreeSelect v-model:value="form.siteId" />
        </a-form-item>
        <a-form-item label="酒店 ID">
          <a-input-number v-model:value="form.propertyId" :min="0" :precision="0" style="width: 100%" />
          <div class="tip">0 表示所选站点的全部酒店</div>
        </a-form-item>
        <a-form-item label="最低夜数" required>
          <a-input-number v-model:value="form.minNights" :min="1" :max="30" :precision="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="折扣率(%)" required>
          <a-input-number v-model:value="form.discountRate" :min="0.01" :max="99.99" :precision="2" style="width: 100%" />
          <div class="tip">立减百分比,如 30 表示满足夜数后减 30%</div>
        </a-form-item>
        <a-form-item label="优先级">
          <a-input-number v-model:value="form.priority" :precision="0" style="width: 100%" />
          <div class="tip">数值高的优先，同优先级取满足的最高夜数档</div>
        </a-form-item>
        <a-form-item label="开始时间 UTC">
          <a-date-picker v-model:value="form.startsAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item label="结束时间 UTC">
          <a-date-picker v-model:value="form.endsAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
        <a-form-item label="优惠券叠加">
          <a-radio-group v-model:value="form.couponStackable">
            <a-radio v-if="form.couponStackable === null" :value="null">沿用旧规则</a-radio>
            <a-radio :value="0">禁止</a-radio>
            <a-radio :value="1">允许可叠加的券</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="2">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.tip {
  font-size: 12px;
  color: var(--mtrip-text-aux);
  margin-top: 4px;
}
</style>
