<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiPayAccountAdd,
  apiPayAccountDelete,
  apiPayAccountList,
  apiPayAccountTest,
  apiPayAccountToggleStatus,
  apiPayAccountUpdate,
  type PayAccountTestResult,
} from '@/api/config';

/**
 * 收款账户(KBZPay MMQR):直连 / 服务商两种模式,站点支付渠道按 accountId 绑定。
 * 敏感字段(AppKey / 证书 / 私钥 / 私钥密码)只写不读:列表脱敏,编辑留空 = 不修改。
 * 证书可粘贴 PEM 或在浏览器本地读文件填入,不走上传接口。
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const MODE_TEXT = computed<Record<number, string>>(() => ({
  1: t('config.payAccount.modeDirect'),
  2: t('config.payAccount.modeIsv'),
}));
const ENV_TEXT = computed<Record<string, string>>(() => ({
  uat: t('config.payAccount.envUat'),
  prod: t('config.payAccount.envProd'),
}));

/** 筛选 siteId=0 表示不限站点(全平台),只在选中具体站点时下发,避免与「平台共享 site_id=0」混淆 */
function fetchAccounts(params: Record<string, unknown>) {
  const { siteId, ...rest } = params;
  return apiPayAccountList(Number(siteId) > 0 ? params : rest);
}

const { loading, list, query, load, search, reset, pagination } = useTable(fetchAccounts, {
  siteId: 0,
  mode: undefined,
  env: undefined,
  status: undefined,
  keyword: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.payAccount.name'), dataIndex: 'account_name', width: 180, ellipsis: true },
  { title: t('config.payAccount.site'), dataIndex: 'site_id', width: 120 },
  { title: t('config.payAccount.mode'), dataIndex: 'mode', width: 110 },
  { title: t('config.payAccount.env'), dataIndex: 'env', width: 90 },
  { title: t('config.payAccount.appId'), dataIndex: 'app_id', width: 150, ellipsis: true },
  { title: t('config.payAccount.merchCode'), dataIndex: 'merch_code', width: 130, ellipsis: true },
  { title: t('config.payAccount.appKey'), dataIndex: 'app_key', width: 150, ellipsis: true },
  { title: t('config.payAccount.certStatus'), key: 'cert_col', width: 240 },
  { title: t('config.payAccount.bindCount'), dataIndex: 'bind_count', width: 80 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 220, fixed: 'right' as const },
]);

/** 证书状态标签(列表 + 编辑弹窗共用) */
const CERT_FLAGS = computed(() => [
  { key: 'has_cert', label: t('config.payAccount.certPem') },
  { key: 'has_key', label: t('config.payAccount.keyPem') },
  { key: 'has_key_pwd', label: t('config.payAccount.keyPwd') },
  { key: 'has_ca', label: t('config.payAccount.caPem') },
]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const emptyForm = () => ({
  siteId: 0,
  accountName: '',
  mode: 1,
  env: 'uat',
  appId: '',
  merchCode: '',
  appKey: '',
  certPem: '',
  keyPem: '',
  keyPwd: '',
  caPem: '',
  notifyBaseUrl: '',
  remark: '',
});
const form = reactive(emptyForm());
/** 编辑时敏感字段的「已配置」状态(来自列表行,不回填脱敏值) */
const secretState = reactive({ appKey: false, certPem: false, keyPem: false, keyPwd: false, caPem: false });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, emptyForm());
  Object.assign(secretState, { appKey: false, certPem: false, keyPem: false, keyPwd: false, caPem: false });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    ...emptyForm(),
    siteId: Number(row.site_id ?? 0),
    accountName: row.account_name ?? '',
    mode: Number(row.mode ?? 1),
    env: row.env ?? 'uat',
    appId: row.app_id ?? '',
    merchCode: row.merch_code ?? '',
    notifyBaseUrl: row.notify_base_url ?? '',
    remark: row.remark ?? '',
  });
  Object.assign(secretState, {
    appKey: !!row.app_key,
    certPem: !!row.has_cert,
    keyPem: !!row.has_key,
    keyPwd: !!row.has_key_pwd,
    caPem: !!row.has_ca,
  });
  modalOpen.value = true;
}

/** 敏感字段 placeholder:编辑态提示留空不修改 */
function secretPlaceholder(base: string): string {
  return editingId.value ? t('config.payAccount.keepPlaceholder') : base;
}

const PEM_MAX_BYTES = 64 * 1024;

/** 证书文件在浏览器本地读成文本填入表单;返回 false 阻止 a-upload 发请求 */
function pemLoader(field: 'certPem' | 'keyPem' | 'caPem') {
  return (file: File): boolean => {
    if (file.size > PEM_MAX_BYTES) {
      message.warning(t('config.payAccount.fileTooLarge'));
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      form[field] = String(reader.result ?? '').trim();
    };
    reader.onerror = () => {
      message.error(t('config.payAccount.fileReadFailed'));
    };
    reader.readAsText(file);
    return false;
  };
}

async function saveAccount(): Promise<void> {
  if (!form.accountName.trim() || !form.appId.trim() || !form.merchCode.trim()) {
    message.warning(t('config.payAccount.required'));
    return;
  }
  if (!editingId.value && !form.appKey.trim()) {
    message.warning(t('config.payAccount.appKeyRequired'));
    return;
  }
  const notify = form.notifyBaseUrl.trim();
  if (notify && !/^https:\/\//i.test(notify)) {
    message.warning(t('config.payAccount.notifyHttps'));
    return;
  }
  modalSaving.value = true;
  try {
    const data = {
      ...form,
      accountName: form.accountName.trim(),
      appId: form.appId.trim(),
      merchCode: form.merchCode.trim(),
      appKey: form.appKey.trim(),
      notifyBaseUrl: notify,
    };
    if (editingId.value) {
      await apiPayAccountUpdate({ id: editingId.value, ...data });
    } else {
      await apiPayAccountAdd(data);
    }
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiPayAccountToggleStatus(row.id);
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await load();
}

async function removeAccount(row: TableRow): Promise<void> {
  // 后端校验:仍被站点渠道绑定的账户拒绝删除
  await apiPayAccountDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

// ---------- 连通性测试 ----------
const testingId = ref(0);

function testFailText(result: PayAccountTestResult): string {
  const params = { code: result.code || '-', message: result.message || '-' };
  switch (result.kind) {
    case 'network':
      return t('config.payAccount.testFail.network');
    case 'sign':
      return t('config.payAccount.testFail.sign');
    case 'business':
      return t('config.payAccount.testFail.business', params);
    case 'protocol':
      return t('config.payAccount.testFail.protocol', params);
    case 'config':
      return t('config.payAccount.testFail.config', params);
    default:
      return t('config.payAccount.testFail.unknown', params);
  }
}

async function testAccount(row: TableRow): Promise<void> {
  if (testingId.value) return;
  testingId.value = row.id;
  try {
    const result = await apiPayAccountTest(row.id);
    if (result.ok) {
      message.success(t('config.payAccount.testOk'));
    } else {
      message.error(testFailText(result), 6);
    }
  } finally {
    testingId.value = 0;
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
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item :label="t('config.payAccount.mode')">
          <a-select v-model:value="query.mode" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option :value="1">{{ t('config.payAccount.modeDirect') }}</a-select-option>
            <a-select-option :value="2">{{ t('config.payAccount.modeIsv') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.payAccount.env')">
          <a-select v-model:value="query.env" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option value="uat">{{ t('config.payAccount.envUat') }}</a-select-option>
            <a-select-option value="prod">{{ t('config.payAccount.envProd') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
            <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.payAccount.keyword')">
          <a-input
            v-model:value="query.keyword"
            allow-clear
            :placeholder="t('config.payAccount.keywordPlaceholder')"
            style="width: 200px"
            @press-enter="search"
          />
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
      <template #title>{{ t('config.payAccount.title') }}</template>
      <template #extra>
        <a-button v-perm="'config:payAccount:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('config.payAccount.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1600 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'account_name'">
            {{ record.account_name }}
            <a-tooltip v-if="record.readonly" :title="t('config.payAccount.readonlyTip')">
              <a-tag style="margin-left: 4px">{{ t('config.payAccount.readonly') }}</a-tag>
            </a-tooltip>
          </template>
          <template v-else-if="column.dataIndex === 'site_id'">
            <a-tag v-if="Number(record.site_id) === 0" color="gold">{{ t('config.payAccount.platformShared') }}</a-tag>
            <span v-else>{{ record.site_name ?? record.site_id }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'mode'">
            <a-tag :color="Number(record.mode) === 2 ? 'purple' : 'blue'">{{ MODE_TEXT[record.mode] ?? record.mode }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'env'">
            <a-tag :color="record.env === 'prod' ? 'red' : 'default'">{{ ENV_TEXT[record.env] ?? record.env }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'app_key'">
            <span class="masked">{{ record.app_key || t('config.payAccount.notConfigured') }}</span>
          </template>
          <template v-else-if="column.key === 'cert_col'">
            <a-space :size="4" wrap>
              <a-tag v-for="flag in CERT_FLAGS" :key="flag.key" :color="record[flag.key] ? 'success' : 'default'">
                {{ flag.label }}
              </a-tag>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'bind_count'">
            {{ record.bind_count ?? 0 }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button
                v-if="!record.readonly"
                v-perm="'config:payAccount:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >{{ t('common.edit') }}</a-button>
              <a-button
                v-if="!record.readonly"
                v-perm="'config:payAccount:test'"
                type="link"
                size="small"
                :loading="testingId === record.id"
                :disabled="testingId > 0 && testingId !== record.id"
                @click="testAccount(record)"
              >{{ t('config.payAccount.test') }}</a-button>
              <a-popconfirm
                v-if="!record.readonly"
                :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:payAccount:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm v-if="!record.readonly" :title="t('config.payAccount.confirmDelete')" @confirm="removeAccount(record)">
                <a-button v-perm="'config:payAccount:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('config.payAccount.edit') : t('config.payAccount.add')"
      width="720px"
      :confirm-loading="modalSaving"
      @ok="saveAccount"
    >
      <a-form :label-col="{ style: { width: '130px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.payAccount.name')" required>
              <a-input v-model:value="form.accountName" :placeholder="t('config.payAccount.namePlaceholder')" />
            </a-form-item>
          </a-col>
          <!-- 站点管理员不可选:后端强制落本站点 -->
          <a-col v-if="isSuper" :span="12">
            <a-form-item :label="t('config.payAccount.site')">
              <SiteTreeSelect v-model:value="form.siteId" allow-all />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.payAccount.mode')" required>
              <a-radio-group v-model:value="form.mode">
                <a-radio :value="1">{{ t('config.payAccount.modeDirect') }}</a-radio>
                <a-radio :value="2">{{ t('config.payAccount.modeIsv') }}</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.payAccount.env')" required>
              <a-radio-group v-model:value="form.env">
                <a-radio value="uat">{{ t('config.payAccount.envUat') }}</a-radio>
                <a-radio value="prod">{{ t('config.payAccount.envProd') }}</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col v-if="form.mode === 2" :span="24">
            <a-alert type="info" show-icon :message="t('config.payAccount.modeIsvTip')" style="margin-bottom: 16px" />
          </a-col>
        </a-row>

        <a-divider orientation="left" style="margin-top: 0">{{ t('config.payAccount.sectionCredential') }}</a-divider>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.payAccount.appId')" required>
              <a-input v-model:value="form.appId" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.payAccount.merchCode')" required>
              <a-input v-model:value="form.merchCode" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.payAccount.appKey')" :required="!editingId">
              <a-input-password
                v-model:value="form.appKey"
                :placeholder="secretPlaceholder('')"
                autocomplete="new-password"
              />
              <div v-if="editingId" class="secret-state">
                <a-tag :color="secretState.appKey ? 'success' : 'default'">
                  {{ secretState.appKey ? t('config.payAccount.configured') : t('config.payAccount.notConfigured') }}
                </a-tag>
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.payAccount.notifyBaseUrl')">
              <a-input v-model:value="form.notifyBaseUrl" :placeholder="t('config.payAccount.notifyBaseUrlPlaceholder')" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">{{ t('config.payAccount.sectionRefundCert') }}</a-divider>
        <a-form-item :label="t('config.payAccount.certPem')">
          <a-textarea
            v-model:value="form.certPem"
            :rows="3"
            :placeholder="secretPlaceholder(t('config.payAccount.pemPlaceholder'))"
            class="pem-input"
          />
          <div class="secret-state">
            <a-upload :show-upload-list="false" accept=".pem,.crt,.cer" :before-upload="pemLoader('certPem')">
              <a-button size="small"><UploadOutlined />{{ t('config.payAccount.pickFile') }}</a-button>
            </a-upload>
            <a-tag v-if="editingId" :color="secretState.certPem ? 'success' : 'default'">
              {{ secretState.certPem ? t('config.payAccount.configured') : t('config.payAccount.notConfigured') }}
            </a-tag>
          </div>
        </a-form-item>
        <a-form-item :label="t('config.payAccount.keyPem')">
          <a-textarea
            v-model:value="form.keyPem"
            :rows="3"
            :placeholder="secretPlaceholder(t('config.payAccount.pemPlaceholder'))"
            class="pem-input"
          />
          <div class="secret-state">
            <a-upload :show-upload-list="false" accept=".pem,.key" :before-upload="pemLoader('keyPem')">
              <a-button size="small"><UploadOutlined />{{ t('config.payAccount.pickFile') }}</a-button>
            </a-upload>
            <a-tag v-if="editingId" :color="secretState.keyPem ? 'success' : 'default'">
              {{ secretState.keyPem ? t('config.payAccount.configured') : t('config.payAccount.notConfigured') }}
            </a-tag>
          </div>
        </a-form-item>
        <a-form-item :label="t('config.payAccount.keyPwd')">
          <a-input-password
            v-model:value="form.keyPwd"
            :placeholder="secretPlaceholder('')"
            autocomplete="new-password"
          />
          <div v-if="editingId" class="secret-state">
            <a-tag :color="secretState.keyPwd ? 'success' : 'default'">
              {{ secretState.keyPwd ? t('config.payAccount.configured') : t('config.payAccount.notConfigured') }}
            </a-tag>
          </div>
        </a-form-item>
        <a-form-item :label="t('config.payAccount.caPem')">
          <a-textarea
            v-model:value="form.caPem"
            :rows="3"
            :placeholder="secretPlaceholder(t('config.payAccount.pemPlaceholder'))"
            class="pem-input"
          />
          <div class="secret-state">
            <a-upload :show-upload-list="false" accept=".pem,.crt,.cer" :before-upload="pemLoader('caPem')">
              <a-button size="small"><UploadOutlined />{{ t('config.payAccount.pickFile') }}</a-button>
            </a-upload>
            <a-tag v-if="editingId" :color="secretState.caPem ? 'success' : 'default'">
              {{ secretState.caPem ? t('config.payAccount.configured') : t('config.payAccount.notConfigured') }}
            </a-tag>
          </div>
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-input v-model:value="form.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.masked {
  color: var(--mtrip-text-aux);
  font-family: monospace;
}

.secret-state {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.pem-input {
  font-family: monospace;
  font-size: 12px;
}
</style>
