<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiSmsChannelAdd,
  apiSmsChannelDelete,
  apiSmsChannelList,
  apiSmsChannelToggleStatus,
  apiSmsChannelUpdate,
  apiSmsLogList,
  apiSmsTemplateAdd,
  apiSmsTemplateDelete,
  apiSmsTemplateList,
  apiSmsTemplateUpdate,
} from '@/api/config';

/** 短信配置:渠道(Twilio/MessageBird)+ 模板(${var} 占位符)+ 发送日志(手机号已脱敏) */
const activeTab = ref('channel');

const PROVIDER_TEXT: Record<string, string> = { twilio: 'Twilio', messagebird: 'MessageBird' };
const TPL_TYPE: Record<number, string> = { 1: '验证码', 2: '通知', 3: '营销', 4: '其他' };

// ---------- Tab1 渠道 ----------
const channel = useTable(apiSmsChannelList, { providerCode: undefined, status: undefined });

const channelColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '服务商', dataIndex: 'provider_code', width: 130 },
  { title: '渠道名称', dataIndex: 'provider_name', width: 150 },
  { title: '签名', dataIndex: 'sign_name', width: 120 },
  { title: '区域白名单', dataIndex: 'region_whitelist', ellipsis: true },
  { title: '验证码有效期(秒)', dataIndex: 'code_expire_sec', width: 140 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 220, fixed: 'right' as const },
];

const chModalOpen = ref(false);
const chSaving = ref(false);
const chEditingId = ref(0);
const chForm = reactive({
  providerCode: 'twilio',
  providerName: '',
  apiKey: '',
  accountSid: '',
  signName: '',
  regionWhitelist: [] as string[],
  codeExpireSec: 300,
  remark: '',
});

function openChannelCreate(): void {
  chEditingId.value = 0;
  Object.assign(chForm, {
    providerCode: 'twilio',
    providerName: '',
    apiKey: '',
    accountSid: '',
    signName: '',
    regionWhitelist: [],
    codeExpireSec: 300,
    remark: '',
  });
  chModalOpen.value = true;
}

function openChannelEdit(row: TableRow): void {
  chEditingId.value = row.id;
  Object.assign(chForm, {
    providerCode: row.provider_code ?? 'twilio',
    providerName: row.provider_name ?? '',
    // 密钥掩码回显,留空保留原值
    apiKey: '',
    accountSid: row.account_sid ?? '',
    signName: row.sign_name ?? '',
    regionWhitelist: String(row.region_whitelist ?? '').split(',').filter(Boolean),
    codeExpireSec: row.code_expire_sec ?? 300,
    remark: row.remark ?? '',
  });
  chModalOpen.value = true;
}

async function saveChannel(): Promise<void> {
  if (!chForm.providerName.trim()) {
    message.warning('请输入渠道名称');
    return;
  }
  chSaving.value = true;
  try {
    if (chEditingId.value) {
      await apiSmsChannelUpdate({ id: chEditingId.value, ...chForm });
      message.success('短信渠道已更新');
    } else {
      await apiSmsChannelAdd({ ...chForm });
      message.success('短信渠道已创建');
    }
    chModalOpen.value = false;
    await channel.load();
  } finally {
    chSaving.value = false;
  }
}

async function toggleChannel(row: TableRow): Promise<void> {
  const result = await apiSmsChannelToggleStatus(row.id);
  message.success(result.status === 1 ? '渠道已启用' : '渠道已停用');
  await channel.load();
}

async function removeChannel(row: TableRow): Promise<void> {
  // 后端校验:渠道下存在模板时拒绝删除
  await apiSmsChannelDelete(row.id);
  message.success('短信渠道已删除');
  await channel.load();
}

// ---------- Tab2 模板 ----------
const template = useTable(apiSmsTemplateList, { channelId: undefined, templateType: undefined, status: undefined });

const templateColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '模板名称', dataIndex: 'template_name', width: 160 },
  { title: '类型', dataIndex: 'template_type', width: 90 },
  { title: '所属渠道', dataIndex: 'provider_name', width: 140 },
  { title: '内容', dataIndex: 'content', ellipsis: true },
  { title: '变量', dataIndex: 'variables', width: 160, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const tplModalOpen = ref(false);
const tplSaving = ref(false);
const tplEditingId = ref(0);
const tplForm = reactive({
  channelId: undefined as number | undefined,
  templateName: '',
  templateType: 1,
  content: '',
  status: 1,
});

function openTplCreate(): void {
  tplEditingId.value = 0;
  Object.assign(tplForm, { channelId: undefined, templateName: '', templateType: 1, content: '', status: 1 });
  tplModalOpen.value = true;
}

function openTplEdit(row: TableRow): void {
  tplEditingId.value = row.id;
  Object.assign(tplForm, {
    channelId: row.channel_id,
    templateName: row.template_name ?? '',
    templateType: row.template_type ?? 1,
    content: row.content ?? '',
    status: row.status ?? 1,
  });
  tplModalOpen.value = true;
}

async function saveTpl(): Promise<void> {
  if (!tplForm.templateName.trim() || !tplForm.content.trim()) {
    message.warning('请填写模板名称与内容');
    return;
  }
  if (!tplEditingId.value && !tplForm.channelId) {
    message.warning('请选择所属渠道');
    return;
  }
  tplSaving.value = true;
  try {
    if (tplEditingId.value) {
      // channelId 仅创建时可指定
      const { channelId: _skip, ...rest } = tplForm;
      await apiSmsTemplateUpdate({ id: tplEditingId.value, ...rest });
      message.success('短信模板已更新');
    } else {
      await apiSmsTemplateAdd({ ...tplForm });
      message.success('短信模板已创建');
    }
    tplModalOpen.value = false;
    await template.load();
  } finally {
    tplSaving.value = false;
  }
}

async function removeTpl(row: TableRow): Promise<void> {
  await apiSmsTemplateDelete(row.id);
  message.success('短信模板已删除');
  await template.load();
}

// ---------- Tab3 发送日志(只读) ----------
const log = useTable(apiSmsLogList, { channelId: undefined, status: undefined });

const logColumns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '手机号(脱敏)', dataIndex: 'mobile', width: 140 },
  { title: '渠道', dataIndex: 'provider_name', width: 140 },
  { title: '模板', dataIndex: 'template_name', width: 160 },
  { title: '内容', dataIndex: 'content', ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '失败原因', dataIndex: 'fail_reason', width: 180, ellipsis: true },
  { title: '发送时间', dataIndex: 'created_at', width: 160 },
];

const LOG_STATUS = {
  1: { text: '成功', color: 'success' as const },
  2: { text: '失败', color: 'error' as const },
  3: { text: '发送中', color: 'processing' as const },
};

// 渠道下拉(模板/日志筛选共用,取渠道 Tab 当前列表)
onMounted(() => {
  void channel.load();
  void template.load();
  void log.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:active-key="activeTab">
        <!-- ========== 渠道 ========== -->
        <a-tab-pane key="channel" tab="短信渠道">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item label="服务商">
                <a-select v-model:value="channel.query.providerCode" allow-clear placeholder="全部" style="width: 150px">
                  <a-select-option value="twilio">Twilio</a-select-option>
                  <a-select-option value="messagebird">MessageBird</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="状态">
                <a-select v-model:value="channel.query.status" allow-clear placeholder="全部" style="width: 100px">
                  <a-select-option :value="1">启用</a-select-option>
                  <a-select-option :value="2">停用</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="channel.search"><template #icon><SearchOutlined /></template>查询</a-button>
                  <a-button @click="channel.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:sms:add'" type="primary" @click="openChannelCreate">
              <template #icon><PlusOutlined /></template>新增渠道
            </a-button>
          </div>
          <a-table
            :columns="channelColumns"
            :data-source="channel.list.value"
            :loading="channel.loading.value"
            :pagination="channel.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1100 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'provider_code'">
                <a-tag color="blue">{{ PROVIDER_TEXT[record.provider_code] ?? record.provider_code }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button v-perm="'config:sms:edit'" type="link" size="small" @click="openChannelEdit(record)">编辑</a-button>
                  <a-tooltip title="联调阶段开放(模块08)">
                    <a-button type="link" size="small" disabled>发送测试</a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="record.status === 1 ? '确认停用该渠道?' : '确认启用该渠道?'"
                    @confirm="toggleChannel(record)"
                  >
                    <a-button v-perm="'config:sms:edit'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? '停用' : '启用' }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm title="确认删除该渠道?渠道下存在模板时需先删除模板" @confirm="removeChannel(record)">
                    <a-button v-perm="'config:sms:delete'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 模板 ========== -->
        <a-tab-pane key="template" tab="短信模板">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item label="所属渠道">
                <a-select
                  v-model:value="template.query.channelId"
                  allow-clear
                  placeholder="全部"
                  style="width: 170px"
                  :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
                />
              </a-form-item>
              <a-form-item label="类型">
                <a-select v-model:value="template.query.templateType" allow-clear placeholder="全部" style="width: 110px">
                  <a-select-option :value="1">验证码</a-select-option>
                  <a-select-option :value="2">通知</a-select-option>
                  <a-select-option :value="3">营销</a-select-option>
                  <a-select-option :value="4">其他</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="template.search"><template #icon><SearchOutlined /></template>查询</a-button>
                  <a-button @click="template.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:sms:template'" type="primary" @click="openTplCreate">
              <template #icon><PlusOutlined /></template>新增模板
            </a-button>
          </div>
          <a-table
            :columns="templateColumns"
            :data-source="template.list.value"
            :loading="template.loading.value"
            :pagination="template.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1100 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'template_type'">
                <a-tag>{{ TPL_TYPE[record.template_type] ?? record.template_type }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button v-perm="'config:sms:template'" type="link" size="small" @click="openTplEdit(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该模板?" @confirm="removeTpl(record)">
                    <a-button v-perm="'config:sms:template'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 发送日志 ========== -->
        <a-tab-pane key="log" tab="发送日志">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item label="渠道">
                <a-select
                  v-model:value="log.query.channelId"
                  allow-clear
                  placeholder="全部"
                  style="width: 170px"
                  :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
                />
              </a-form-item>
              <a-form-item label="状态">
                <a-select v-model:value="log.query.status" allow-clear placeholder="全部" style="width: 110px">
                  <a-select-option :value="1">成功</a-select-option>
                  <a-select-option :value="2">失败</a-select-option>
                  <a-select-option :value="3">发送中</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="log.search"><template #icon><SearchOutlined /></template>查询</a-button>
                  <a-button @click="log.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
          </div>
          <a-table
            :columns="logColumns"
            :data-source="log.list.value"
            :loading="log.loading.value"
            :pagination="log.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1200 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="LOG_STATUS" />
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 新增/编辑渠道 -->
    <a-modal
      v-model:open="chModalOpen"
      :title="chEditingId ? '编辑短信渠道' : '新增短信渠道'"
      width="600px"
      :confirm-loading="chSaving"
      @ok="saveChannel"
    >
      <a-form :label-col="{ style: { width: '130px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="服务商" required>
              <a-select v-model:value="chForm.providerCode" :disabled="!!chEditingId">
                <a-select-option value="twilio">Twilio</a-select-option>
                <a-select-option value="messagebird">MessageBird</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="渠道名称" required>
              <a-input v-model:value="chForm.providerName" placeholder="如:Twilio-欧洲" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API 密钥">
              <a-input-password
                v-model:value="chForm.apiKey"
                :placeholder="chEditingId ? '留空保留原值' : ''"
                autocomplete="new-password"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="AccountSid">
              <a-input v-model:value="chForm.accountSid" placeholder="Twilio 必填" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="短信签名">
              <a-input v-model:value="chForm.signName" placeholder="如 Mtrip" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="验证码有效期(秒)">
              <a-input-number v-model:value="chForm.codeExpireSec" :min="60" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="区域白名单">
              <a-select
                v-model:value="chForm.regionWhitelist"
                mode="tags"
                placeholder="国家码,如 FR、DE;留空不限制"
                :token-separators="[',']"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-input v-model:value="chForm.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 新增/编辑模板 -->
    <a-modal
      v-model:open="tplModalOpen"
      :title="tplEditingId ? '编辑短信模板' : '新增短信模板'"
      width="560px"
      :confirm-loading="tplSaving"
      @ok="saveTpl"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item label="所属渠道" required>
          <a-select
            v-model:value="tplForm.channelId"
            :disabled="!!tplEditingId"
            placeholder="选择渠道(创建后不可修改)"
            :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
          />
        </a-form-item>
        <a-form-item label="模板名称" required>
          <a-input v-model:value="tplForm.templateName" placeholder="如:登录验证码" />
        </a-form-item>
        <a-form-item label="模板类型">
          <a-select v-model:value="tplForm.templateType">
            <a-select-option :value="1">验证码</a-select-option>
            <a-select-option :value="2">通知</a-select-option>
            <a-select-option :value="3">营销</a-select-option>
            <a-select-option :value="4">其他</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模板内容" required>
          <a-textarea
            v-model:value="tplForm.content"
            :rows="4"
            placeholder="使用 ${var} 作为变量占位符,如:您的验证码是 ${code},${expire} 分钟内有效"
          />
          <div class="tpl-tip">变量以 <code v-pre>${var}</code> 格式书写,保存时系统自动提取</div>
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="tplForm.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="2">停用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.tpl-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mtrip-text-aux);

  code {
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--mtrip-bg-page);
  }
}
</style>
