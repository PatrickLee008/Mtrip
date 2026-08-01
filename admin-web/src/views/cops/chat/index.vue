<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiChatClose, apiChatList, apiChatMessages, apiChatReply } from '@/api/cops';

/** 客服工作台:会话列表 + 坐席回复 / 结束会话(PRD 模块13) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiChatList, {
  type: undefined,
  status: undefined,
  siteId: 0,
});

const TYPE: Record<number, string> = { 1: '酒店咨询', 2: '客服' };
const SENDER: Record<number, string> = { 1: '用户', 2: '坐席', 3: '机器人' };

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '类型', dataIndex: 'type', width: 100 },
  { title: '标题', dataIndex: 'title', ellipsis: true },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '最后消息', dataIndex: 'last_message', width: 220, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 90, fixed: 'right' as const },
];

const drawerOpen = ref(false);
const current = ref<TableRow | null>(null);
const messages = ref<TableRow[]>([]);
const msgLoading = ref(false);
const replyText = ref('');
const sending = ref(false);

async function loadMessages(): Promise<void> {
  if (!current.value) return;
  msgLoading.value = true;
  try {
    const data = await apiChatMessages({ conversationId: current.value.id, page: 1, pageSize: 50 });
    messages.value = [...data.list].reverse();
  } finally {
    msgLoading.value = false;
  }
}

function openChat(row: TableRow): void {
  current.value = row;
  replyText.value = '';
  drawerOpen.value = true;
  void loadMessages();
}

async function send(): Promise<void> {
  if (!current.value || !replyText.value.trim()) return;
  sending.value = true;
  try {
    await apiChatReply({ conversationId: current.value.id, content: replyText.value });
    replyText.value = '';
    await loadMessages();
    void load();
  } finally {
    sending.value = false;
  }
}

async function closeConv(): Promise<void> {
  if (!current.value) return;
  await apiChatClose({ conversationId: current.value.id });
  message.success('会话已结束');
  drawerOpen.value = false;
  void load();
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="类型">
          <a-select v-model:value="query.type" placeholder="全部" allow-clear style="width: 130px">
            <a-select-option :value="1">酒店咨询</a-select-option>
            <a-select-option :value="2">客服</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" placeholder="全部" allow-clear style="width: 120px">
            <a-select-option :value="0">进行中</a-select-option>
            <a-select-option :value="1">已结束</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="会话列表">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'type'">
            <a-tag :color="record.type === 1 ? 'blue' : 'green'">{{ TYPE[record.type] ?? record.type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 0 ? 'processing' : 'default'">{{ record.status === 0 ? '进行中' : '已结束' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'user:chat:reply'" type="link" size="small" @click="openChat(record)">进入</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:open="drawerOpen" :title="current?.title || '会话'" width="520px">
      <a-spin :spinning="msgLoading">
        <div class="chat-box">
          <div v-for="m in messages" :key="m.id" class="msg" :class="{ mine: m.sender_type === 2 }">
            <div class="meta">{{ SENDER[m.sender_type] ?? m.sender_type }} · {{ m.created_at }}</div>
            <div class="bubble">{{ m.content }}</div>
          </div>
          <a-empty v-if="!messages.length" description="暂无消息" />
        </div>
      </a-spin>
      <template #footer>
        <div v-if="current && current.status === 0">
          <a-textarea v-model:value="replyText" :rows="2" placeholder="输入回复内容" style="margin-bottom: 8px" />
          <a-space>
            <a-button type="primary" :loading="sending" @click="send">发送</a-button>
            <a-popconfirm title="确认结束该会话?" @confirm="closeConv">
              <a-button danger>结束会话</a-button>
            </a-popconfirm>
          </a-space>
        </div>
        <a-tag v-else color="default">会话已结束</a-tag>
      </template>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.chat-box {
  min-height: 300px;
}

.msg {
  margin-bottom: 12px;

  &.mine {
    text-align: right;
  }

  .meta {
    font-size: 12px;
    color: var(--mtrip-text-aux);
    margin-bottom: 2px;
  }

  .bubble {
    display: inline-block;
    max-width: 80%;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--mtrip-bg-page);
    text-align: left;
    word-break: break-all;
  }

  &.mine .bubble {
    background: var(--mtrip-primary);
    color: #fff;
  }
}
</style>
