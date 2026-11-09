<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import { apiUserBalanceLogs } from '@/api/user';

/**
 * 钱包流水(终端用户管理 → 钱包流水,菜单 1016 / user:wallet:list)
 * 全平台(超管可按站点筛)/ 本站点的 C 端钱包流水:按用户ID / 手机号 / 昵称 / 类型 / 预订号 / 日期筛选,
 * 顶部汇总当前筛选下的入账、出账与净额(对账用)。change_type:1充值 2消费 3退款 4调账/奖励 5提现 6过期(预留)。
 * 支持 ?userId= 直达某个用户的流水(用户画像等页面跳转用)。
 */
const { t } = useI18n();
const route = useRoute();
const isSuper = useUserStore().profile?.isSuper === true;

const TYPE_KEYS = [1, 2, 3, 4, 5, 6];
const TYPE_COLORS: Record<number, string> = { 1: 'blue', 2: 'orange', 3: 'green', 4: 'purple', 5: 'cyan', 6: 'default' };

const dateRange = ref<string[]>([]);
const summary = ref({ credit: '0.00', debit: '0.00' });
const net = computed(() => Number(summary.value.credit) - Number(summary.value.debit));

const { loading, list, query, load, search, reset, pagination } = useTable(
  async (params) => {
    const data = await apiUserBalanceLogs({
      ...params,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    });
    summary.value = data.summary ?? { credit: '0.00', debit: '0.00' };
    return data;
  },
  { userId: undefined, mobile: '', nickname: '', changeType: undefined, bookingNo: '', siteId: 0 },
);

const initialUserId = Number(route.query.userId);
if (initialUserId > 0) query.userId = initialUserId;

function doReset(): void {
  dateRange.value = [];
  reset();
}

const columns = computed(() => [
  { title: t('user.walletPage.txnNo'), dataIndex: 'txn_no', width: 170 },
  { title: t('user.walletPage.user'), dataIndex: 'user_id', width: 190 },
  { title: t('user.walletPage.changeType'), dataIndex: 'change_type', width: 130 },
  { title: t('user.walletPage.amount'), dataIndex: 'amount', width: 130, align: 'right' as const },
  { title: t('user.walletPage.before'), dataIndex: 'before_balance', width: 120, align: 'right' as const },
  { title: t('user.walletPage.after'), dataIndex: 'after_balance', width: 120, align: 'right' as const },
  { title: t('user.walletPage.booking'), dataIndex: 'booking_no', width: 230 },
  { title: t('user.walletPage.remark'), dataIndex: 'remark', ellipsis: true },
  { title: t('user.walletPage.operator'), dataIndex: 'operator_name', width: 110 },
  { title: t('user.walletPage.time'), dataIndex: 'created_at', width: 165 },
]);

void load();
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('user.walletPage.userId')">
          <a-input-number v-model:value="query.userId" :min="1" :precision="0" :placeholder="t('common.pleaseInput')" style="width: 120px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.walletPage.mobile')">
          <a-input v-model:value="query.mobile" allow-clear :placeholder="t('common.pleaseInput')" style="width: 150px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.walletPage.nickname')">
          <a-input v-model:value="query.nickname" allow-clear :placeholder="t('common.pleaseInput')" style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.walletPage.changeType')">
          <a-select v-model:value="query.changeType" allow-clear :placeholder="t('common.all')" style="width: 150px">
            <a-select-option v-for="k in TYPE_KEYS" :key="k" :value="k">{{ t(`user.walletPage.types.${k}`) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('user.walletPage.bookingNo')">
          <a-input v-model:value="query.bookingNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('user.walletPage.date')">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('user.walletPage.title')">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="8">
          <a-statistic :title="t('user.walletPage.credit')" :value="formatAmount(summary.credit)" :value-style="{ color: '#00A66F' }" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="t('user.walletPage.debit')" :value="formatAmount(summary.debit)" :value-style="{ color: '#E53935' }" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="t('user.walletPage.net')" :value="formatAmount(net)" />
        </a-col>
      </a-row>
      <div class="summary-hint">{{ t('user.walletPage.summaryHint') }}</div>

      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'user_id'">
            <router-link :to="{ path: '/user/profile', query: { userId: record.user_id } }">
              #{{ record.user_id }} {{ record.nickname || '-' }}
            </router-link>
            <div class="sub">{{ record.mobile || '-' }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'change_type'">
            <a-tag :color="TYPE_COLORS[record.change_type] || 'default'">
              {{ t(`user.walletPage.types.${record.change_type}`) }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'amount'">
            <span :class="Number(record.amount) >= 0 ? 'credit' : 'debit'">
              {{ Number(record.amount) >= 0 ? '+' : '' }}{{ formatAmount(record.amount) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'before_balance'">{{ formatAmount(record.before_balance) }}</template>
          <template v-else-if="column.dataIndex === 'after_balance'">{{ formatAmount(record.after_balance) }}</template>
          <template v-else-if="column.dataIndex === 'booking_no'">
            <template v-if="record.booking_no">
              <div>{{ record.booking_no }}</div>
              <div class="sub">{{ record.property_name || '-' }}</div>
            </template>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.dataIndex === 'operator_name'">{{ record.operator_name || '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>

<style scoped lang="less">
.summary-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: var(--mtrip-text-secondary, #8c8c8c);
}

.sub {
  font-size: 12px;
  color: var(--mtrip-text-secondary, #8c8c8c);
}

.credit {
  color: #00a66f;
  font-weight: 600;
}

.debit {
  color: #e53935;
  font-weight: 600;
}
</style>
