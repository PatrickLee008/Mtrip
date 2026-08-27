<script setup lang="ts">
import { useRouter } from 'vue-router';
import { get } from '@/utils/http';
const router = useRouter();
async function openDestination(): Promise<void> {
  if (!detail.value) return;
  const result = await get<{ path: string; query: Record<string, string> }>('/merchant/notifications/destination', { id: detail.value.id });
  if (result.path) { detailOpen.value = false; await router.push({ path: result.path, query: result.query }); }
}
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { BellOutlined, CheckCircleOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import {
  apiNotificationList,
  apiNotificationRead,
  apiNotificationSummary,
  type MerchantNotification,
  type NotificationSummary,
} from '@/api/notifications';

const { t } = useI18n();

const summary = ref<NotificationSummary>({ total: 0, unread: 0, categories: {} });
const summaryLoading = ref(false);
const detailOpen = ref(false);
const detail = ref<MerchantNotification | null>(null);

const { loading, list, query, load, search, reset, pagination } = useTable<MerchantNotification>(apiNotificationList, {
  keyword: '',
  category: undefined,
  isRead: undefined,
});

const categoryOptions = computed(() => [
  { value: 'booking', label: t('notifications.category.booking') },
  { value: 'promotion', label: t('notifications.category.promotion') },
  { value: 'refund', label: t('notifications.category.refund') },
  { value: 'account', label: t('notifications.category.account') },
  { value: 'security', label: t('notifications.category.security') },
  { value: 'support', label: t('notifications.category.support') },
  { value: 'system', label: t('notifications.category.system') },
]);

const columns = computed(() => [
  { title: t('notifications.titleColumn'), dataIndex: 'title', width: 280 },
  { title: t('notifications.categoryColumn'), dataIndex: 'category', width: 130 },
  { title: t('notifications.channels'), dataIndex: 'channels', width: 180 },
  { title: t('notifications.readStatus'), dataIndex: 'is_read', width: 120 },
  { title: t('notifications.sentAt'), dataIndex: 'send_at', width: 170 },
  { title: t('common.operation'), key: 'action', width: 170, fixed: 'right' as const },
]);

const cards = computed(() => [
  { key: 'total', label: t('notifications.cards.total'), value: summary.value.total, tone: 'blue' },
  { key: 'unread', label: t('notifications.cards.unread'), value: summary.value.unread, tone: 'orange' },
  { key: 'booking', label: t('notifications.category.booking'), value: summary.value.categories.booking ?? 0, tone: 'green' },
  { key: 'system', label: t('notifications.category.system'), value: summary.value.categories.system ?? 0, tone: 'slate' },
]);

async function loadSummary(): Promise<void> {
  summaryLoading.value = true;
  try {
    summary.value = await apiNotificationSummary();
  } finally {
    summaryLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadSummary(), load()]);
}

function categoryLabel(category: string): string {
  return categoryOptions.value.find((item) => item.value === category)?.label ?? category;
}

function channelList(channels: string): string[] {
  return channels ? channels.split(',').filter(Boolean) : [];
}

async function markRead(row?: MerchantNotification): Promise<void> {
  await apiNotificationRead(row?.id);
  message.success(t('notifications.readSuccess'));
  await refreshAll();
}

async function openDetail(row: MerchantNotification): Promise<void> {
  detail.value = row;
  detailOpen.value = true;
  if (!row.is_read) {
    await apiNotificationRead(row.id);
    row.is_read = true;
    row.read_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await loadSummary();
  }
}

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <PageContainer>
    <div class="page-head">
      <div>
        <h1>{{ t('notifications.title') }}</h1>
        <p>{{ t('notifications.subtitle') }}</p>
      </div>
      <a-space>
        <a-button @click="refreshAll">
          <template #icon><ReloadOutlined /></template>{{ t('common.reset') }}
        </a-button>
        <a-button v-perm="'mch:notifications:read'" type="primary" @click="markRead()">
          <template #icon><CheckCircleOutlined /></template>{{ t('notifications.markAllRead') }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="summaryLoading">
      <div class="metric-grid">
        <a-card v-for="card in cards" :key="card.key" :bordered="false" class="mtrip-card-shadow metric-card" :class="`tone-${card.tone}`">
          <div class="metric-icon"><BellOutlined /></div>
          <div class="metric-label">{{ card.label }}</div>
          <div class="metric-value">{{ card.value }}</div>
        </a-card>
      </div>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow filter-card">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('notifications.keywordPlaceholder')" style="width: 240px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('notifications.categoryColumn')">
          <a-select v-model:value="query.category" allow-clear :placeholder="t('common.all')" style="width: 170px">
            <a-select-option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('notifications.readStatus')">
          <a-select v-model:value="query.isRead" allow-clear :placeholder="t('common.all')" style="width: 140px">
            <a-select-option :value="0">{{ t('notifications.unread') }}</a-select-option>
            <a-select-option :value="1">{{ t('notifications.read') }}</a-select-option>
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" :scroll="{ x: 980 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="notice-title" :class="{ unread: !record.is_read }">
              <span class="read-dot" />
              <div>
                <strong>{{ record.title }}</strong>
                <p>{{ record.message }}</p>
              </div>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'category'">
            <a-tag color="blue">{{ categoryLabel(record.category) }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'channels'">
            <a-space :size="4" wrap>
              <a-tag v-for="channel in channelList(record.channels)" :key="channel">{{ channel }}</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'is_read'">
            <a-tag :color="record.is_read ? 'green' : 'orange'">{{ record.is_read ? t('notifications.read') : t('notifications.unread') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">
                <template #icon><EyeOutlined /></template>{{ t('common.detail') }}
              </a-button>
              <a-button v-if="!record.is_read" v-perm="'mch:notifications:read'" type="link" size="small" @click="markRead(record)">
                {{ t('notifications.markRead') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:open="detailOpen" :title="detail?.title || t('notifications.detailTitle')" width="560">
      <template v-if="detail">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item :label="t('notifications.categoryColumn')">{{ categoryLabel(detail.category) }}</a-descriptions-item>
          <a-descriptions-item :label="t('notifications.sentAt')">{{ detail.send_at || detail.created_at }}</a-descriptions-item>
          <a-descriptions-item :label="t('notifications.channels')">{{ detail.channels || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('notifications.readStatus')">{{ detail.is_read ? t('notifications.read') : t('notifications.unread') }}</a-descriptions-item>
        </a-descriptions>
        <div class="notice-message">{{ detail.message }}</div>
      </template>
      <a-button v-if="detail && detail.deep_link_type !== 'none'" type="primary" @click="openDestination">{{ t('notifications.openDestination') }}</a-button>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  h1 {
    margin: 0;
    color: var(--mtrip-text-main);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  p {
    margin: 4px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.metric-card :deep(.ant-card-body) {
  position: relative;
  padding: 16px;
}

.metric-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eff6ff;
  color: var(--mtrip-primary);
}

.metric-label {
  color: var(--mtrip-text-aux);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.metric-value {
  margin-top: 10px;
  color: var(--mtrip-text-main);
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.tone-orange .metric-icon {
  background: #fffbeb;
  color: #d97706;
}

.tone-green .metric-icon {
  background: #ecfdf3;
  color: #059669;
}

.tone-slate .metric-icon {
  background: #f1f5f9;
  color: #64748b;
}

.filter-card {
  margin-bottom: 16px;
}

.notice-title {
  display: flex;
  gap: 10px;
  min-width: 0;

  strong {
    display: block;
    color: var(--mtrip-text-main);
    font-size: 13px;
  }

  p {
    max-width: 520px;
    margin: 3px 0 0;
    overflow: hidden;
    color: var(--mtrip-text-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .read-dot {
    width: 7px;
    height: 7px;
    margin-top: 6px;
    border-radius: 50%;
    background: #cbd5e1;
    flex-shrink: 0;
  }

  &.unread .read-dot {
    background: #2563eb;
    box-shadow: 0 0 0 4px #eff6ff;
  }
}

.notice-message {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid var(--mtrip-border);
  border-radius: 10px;
  background: var(--mtrip-bg-soft);
  color: var(--mtrip-text-main);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
