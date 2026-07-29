<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
const activeTab = ref('channel');

const PROVIDER_TEXT = computed<Record<string, string>>(() => ({
  twilio: t('config.sms.typeTwilio'),
  messagebird: t('config.sms.typeMessageBird'),
}));

const TPL_TYPE = computed<Record<number, string>>(() => ({
  1: t('config.sms.template.typeVerify'),
  2: t('config.sms.template.typeNotify'),
  3: t('config.sms.template.typeMarketing'),
  4: t('common.none'),
}));

// ---------- Tab1 渠道 ----------
const channel = useTable(apiSmsChannelList, { providerCode: undefined, status: undefined });

const channelColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.sms.channelType'), dataIndex: 'provider_code', width: 130 },
  { title: t('config.sms.channelName'), dataIndex: 'provider_name', width: 150 },
  { title: t('config.sms.template.sign'), dataIndex: 'sign_name', width: 120 },
  { title: t('config.sms.template.title'), dataIndex: 'region_whitelist', ellipsis: true },
  { title: t('config.sms.codeExpireSec'), dataIndex: 'code_expire_sec', width: 140 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 220, fixed: 'right' as const },
]);

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
    message.warning(t('common.pleaseInput'));
    return;
  }
  chSaving.value = true;
  try {
    if (chEditingId.value) {
      await apiSmsChannelUpdate({ id: chEditingId.value, ...chForm });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiSmsChannelAdd({ ...chForm });
      message.success(t('tip.saveSuccess'));
    }
    chModalOpen.value = false;
    await channel.load();
  } finally {
    chSaving.value = false;
  }
}

async function toggleChannel(row: TableRow): Promise<void> {
  const result = await apiSmsChannelToggleStatus(row.id);
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await channel.load();
}

async function removeChannel(row: TableRow): Promise<void> {
  // 后端校验:渠道下存在模板时拒绝删除
  await apiSmsChannelDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await channel.load();
}

// ---------- Tab2 模板 ----------
const template = useTable(apiSmsTemplateList, { channelId: undefined, templateType: undefined, status: undefined });

const templateColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.sms.template.templateName'), dataIndex: 'template_name', width: 160 },
  { title: t('config.sms.template.type'), dataIndex: 'template_type', width: 90 },
  { title: t('config.sms.template.title'), dataIndex: 'provider_name', width: 140 },
  { title: t('config.sms.template.content'), dataIndex: 'content', ellipsis: true },
  { title: t('config.sms.template.templateCode'), dataIndex: 'variables', width: 160, ellipsis: true },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 140, fixed: 'right' as const },
]);

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
    message.warning(t('common.pleaseInput'));
    return;
  }
  if (!tplEditingId.value && !tplForm.channelId) {
    message.warning(t('common.pleaseSelect'));
    return;
  }
  tplSaving.value = true;
  try {
    if (tplEditingId.value) {
      // channelId 仅创建时可指定
      const { channelId: _skip, ...rest } = tplForm;
      await apiSmsTemplateUpdate({ id: tplEditingId.value, ...rest });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiSmsTemplateAdd({ ...tplForm });
      message.success(t('tip.saveSuccess'));
    }
    tplModalOpen.value = false;
    await template.load();
  } finally {
    tplSaving.value = false;
  }
}

async function removeTpl(row: TableRow): Promise<void> {
  await apiSmsTemplateDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await template.load();
}

// ---------- Tab3 发送日志(只读) ----------
const log = useTable(apiSmsLogList, { channelId: undefined, status: undefined });

const logColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('config.sms.log.mobile'), dataIndex: 'mobile', width: 140 },
  { title: t('config.sms.log.channel'), dataIndex: 'provider_name', width: 140 },
  { title: t('config.sms.log.template'), dataIndex: 'template_name', width: 160 },
  { title: t('config.sms.log.content'), dataIndex: 'content', ellipsis: true },
  { title: t('common.status'), dataIndex: 'status', width: 90 },
  { title: t('config.sms.log.errorCode'), dataIndex: 'fail_reason', width: 180, ellipsis: true },
  { title: t('config.sms.log.time'), dataIndex: 'created_at', width: 160 },
]);

const LOG_STATUS = computed<Record<number, { text: string; color: 'success' | 'error' | 'processing' }>>(() => ({
  1: { text: t('status.success'), color: 'success' },
  2: { text: t('status.failed'), color: 'error' },
  3: { text: t('status.processing'), color: 'processing' },
}));

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
        <a-tab-pane key="channel" :tab="t('config.sms.title')">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item :label="t('config.sms.channelType')">
                <a-select v-model:value="channel.query.providerCode" allow-clear :placeholder="t('common.all')" style="width: 150px">
                  <a-select-option value="twilio">Twilio</a-select-option>
                  <a-select-option value="messagebird">MessageBird</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item :label="t('common.status')">
                <a-select v-model:value="channel.query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
                  <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
                  <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="channel.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                  <a-button @click="channel.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:sms:add'" type="primary" @click="openChannelCreate">
              <template #icon><PlusOutlined /></template>{{ t('config.sms.actions.add') }}
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
                  <a-button v-perm="'config:sms:edit'" type="link" size="small" @click="openChannelEdit(record)">{{ t('common.edit') }}</a-button>
                  <a-tooltip :title="t('tip.comingSoon')">
                    <a-button type="link" size="small" disabled>{{ t('config.sms.actions.test') }}</a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                    @confirm="toggleChannel(record)"
                  >
                    <a-button v-perm="'config:sms:edit'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm :title="t('tip.confirmDelete')" @confirm="removeChannel(record)">
                    <a-button v-perm="'config:sms:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 模板 ========== -->
        <a-tab-pane key="template" :tab="t('config.sms.template.title')">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item :label="t('config.sms.template.title')">
                <a-select
                  v-model:value="template.query.channelId"
                  allow-clear
                  :placeholder="t('common.all')"
                  style="width: 170px"
                  :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
                />
              </a-form-item>
              <a-form-item :label="t('config.sms.template.type')">
                <a-select v-model:value="template.query.templateType" allow-clear :placeholder="t('common.all')" style="width: 110px">
                  <a-select-option :value="1">{{ t('config.sms.template.typeVerify') }}</a-select-option>
                  <a-select-option :value="2">{{ t('config.sms.template.typeNotify') }}</a-select-option>
                  <a-select-option :value="3">{{ t('config.sms.template.typeMarketing') }}</a-select-option>
                  <a-select-option :value="4">{{ t('common.none') }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="template.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                  <a-button @click="template.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:sms:template'" type="primary" @click="openTplCreate">
              <template #icon><PlusOutlined /></template>{{ t('config.sms.template.actions.add') }}
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
                  <a-button v-perm="'config:sms:template'" type="link" size="small" @click="openTplEdit(record)">{{ t('common.edit') }}</a-button>
                  <a-popconfirm :title="t('tip.confirmDelete')" @confirm="removeTpl(record)">
                    <a-button v-perm="'config:sms:template'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 发送日志 ========== -->
        <a-tab-pane key="log" :tab="t('config.sms.log.title')">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item :label="t('config.sms.log.channel')">
                <a-select
                  v-model:value="log.query.channelId"
                  allow-clear
                  :placeholder="t('common.all')"
                  style="width: 170px"
                  :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
                />
              </a-form-item>
              <a-form-item :label="t('common.status')">
                <a-select v-model:value="log.query.status" allow-clear :placeholder="t('common.all')" style="width: 110px">
                  <a-select-option :value="1">{{ t('status.success') }}</a-select-option>
                  <a-select-option :value="2">{{ t('status.failed') }}</a-select-option>
                  <a-select-option :value="3">{{ t('status.processing') }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="log.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                  <a-button @click="log.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
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
      :title="chEditingId ? t('common.edit') + ' ' + t('config.sms.title') : t('config.sms.actions.add')"
      width="600px"
      :confirm-loading="chSaving"
      @ok="saveChannel"
    >
      <a-form :label-col="{ style: { width: '130px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.sms.channelType')" required>
              <a-select v-model:value="chForm.providerCode" :disabled="!!chEditingId">
                <a-select-option value="twilio">Twilio</a-select-option>
                <a-select-option value="messagebird">MessageBird</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.sms.channelName')" required>
              <a-input v-model:value="chForm.providerName" :placeholder="t('common.pleaseInput')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.sms.authToken')">
              <a-input-password
                v-model:value="chForm.apiKey"
                :placeholder="chEditingId ? t('common.optional') : ''"
                autocomplete="new-password"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.sms.accountSid')">
              <a-input v-model:value="chForm.accountSid" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.sms.template.sign')">
              <a-input v-model:value="chForm.signName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.sms.codeExpireSec')">
              <a-input-number v-model:value="chForm.codeExpireSec" :min="60" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.sms.regionWhitelist')">
              <a-select
                v-model:value="chForm.regionWhitelist"
                mode="tags"
                :placeholder="t('config.sms.regionWhitelistTip')"
                :token-separators="[',']"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.remark')">
              <a-input v-model:value="chForm.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 新增/编辑模板 -->
    <a-modal
      v-model:open="tplModalOpen"
      :title="tplEditingId ? t('common.edit') + ' ' + t('config.sms.template.title') : t('config.sms.template.actions.add')"
      width="560px"
      :confirm-loading="tplSaving"
      @ok="saveTpl"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item :label="t('config.sms.template.title')" required>
          <a-select
            v-model:value="tplForm.channelId"
            :disabled="!!tplEditingId"
            :placeholder="t('common.pleaseSelect')"
            :options="channel.list.value.map((row) => ({ value: row.id, label: row.provider_name }))"
          />
        </a-form-item>
        <a-form-item :label="t('config.sms.template.templateName')" required>
          <a-input v-model:value="tplForm.templateName" :placeholder="t('common.pleaseInput')" />
        </a-form-item>
        <a-form-item :label="t('config.sms.template.type')">
          <a-select v-model:value="tplForm.templateType">
            <a-select-option :value="1">{{ t('config.sms.template.typeVerify') }}</a-select-option>
            <a-select-option :value="2">{{ t('config.sms.template.typeNotify') }}</a-select-option>
            <a-select-option :value="3">{{ t('config.sms.template.typeMarketing') }}</a-select-option>
            <a-select-option :value="4">{{ t('common.none') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.sms.template.content')" required>
          <a-textarea
            v-model:value="tplForm.content"
            :rows="4"
            :placeholder="t('config.sms.template.contentPlaceholder')"
          />
          <div class="tpl-tip">{{ t('config.sms.template.contentPlaceholder') }}</div>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="tplForm.status">
            <a-radio :value="1">{{ t('status.enabled') }}</a-radio>
            <a-radio :value="2">{{ t('status.disabled') }}</a-radio>
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
