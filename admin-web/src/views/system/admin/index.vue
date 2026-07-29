<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiAdminAdd,
  apiAdminDelete,
  apiAdminDetail,
  apiAdminList,
  apiAdminLoginLogs,
  apiAdminResetPassword,
  apiAdminToggleStatus,
  apiAdminUpdate,
  apiRoleAll,
} from '@/api/system';

/** 管理员管理:列表筛选 / 新增编辑(角色绑定) / 重置密码 / 启停 / 删除 / 登录记录 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiAdminList, {
  username: '',
  realName: '',
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '登录账号', dataIndex: 'username', width: 130 },
  { title: '姓名', dataIndex: 'realName', width: 110 },
  { title: '站点', dataIndex: 'siteId', width: 90 },
  { title: '手机号', dataIndex: 'mobile', width: 130 },
  { title: '邮箱', dataIndex: 'email', width: 170, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '最近登录', dataIndex: 'lastLoginAt', width: 160 },
  { title: '操作', key: 'action', width: 300, fixed: 'right' as const },
];

// ---------- 新增/编辑弹窗 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const roleOptions = ref<TableRow[]>([]);
const form = reactive({
  username: '',
  password: '',
  realName: '',
  mobile: '',
  email: '',
  siteId: 0,
  roleIds: [] as number[],
  remark: '',
});

async function openCreate(): Promise<void> {
  editingId.value = 0;
  Object.assign(form, { username: '', password: '', realName: '', mobile: '', email: '', siteId: 0, roleIds: [], remark: '' });
  modalOpen.value = true;
}

async function openEdit(row: TableRow): Promise<void> {
  editingId.value = row.id;
  const detail = await apiAdminDetail(row.id);
  Object.assign(form, {
    username: detail.username,
    password: '',
    realName: detail.realName,
    mobile: detail.mobile,
    email: detail.email,
    siteId: detail.siteId,
    roleIds: detail.roleIds ?? [],
    remark: detail.remark,
  });
  modalOpen.value = true;
}

async function saveAdmin(): Promise<void> {
  if (!form.username.trim()) {
    message.warning('请输入登录账号');
    return;
  }
  if (editingId.value === 0 && !form.password) {
    message.warning('请输入初始密码');
    return;
  }
  modalSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      realName: form.realName,
      mobile: form.mobile,
      email: form.email,
      siteId: form.siteId,
      roleIds: form.roleIds,
      remark: form.remark,
    };
    if (editingId.value === 0) {
      await apiAdminAdd({ ...payload, password: form.password });
    } else {
      await apiAdminUpdate({ ...payload, id: editingId.value });
    }
    message.success(editingId.value === 0 ? '管理员创建成功' : '管理员更新成功');
    modalOpen.value = false;
    void load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 重置密码 ----------
const pwdOpen = ref(false);
const pwdSaving = ref(false);
const pwdTarget = ref<TableRow | null>(null);
const pwdValue = ref('');

function openResetPwd(row: TableRow): void {
  pwdTarget.value = row;
  pwdValue.value = '';
  pwdOpen.value = true;
}

async function doResetPwd(): Promise<void> {
  if (pwdValue.value.length < 8) {
    message.warning('密码至少 8 位,须含大小写字母和数字');
    return;
  }
  pwdSaving.value = true;
  try {
    await apiAdminResetPassword(pwdTarget.value!.id, pwdValue.value);
    message.success('密码重置成功');
    pwdOpen.value = false;
  } finally {
    pwdSaving.value = false;
  }
}

// ---------- 启停 / 删除 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  await apiAdminToggleStatus(row.id);
  message.success(row.status === 1 ? '已禁用' : '已启用');
  void load();
}

async function removeAdmin(row: TableRow): Promise<void> {
  await apiAdminDelete(row.id);
  message.success('管理员已删除');
  void load();
}

// ---------- 登录记录抽屉 ----------
const logOpen = ref(false);
const logLoading = ref(false);
const logList = ref<TableRow[]>([]);
const logTarget = ref<TableRow | null>(null);
const logColumns = [
  { title: '时间', dataIndex: 'created_at', width: 160 },
  { title: 'IP', dataIndex: 'login_ip', width: 130 },
  { title: '设备/浏览器', dataIndex: 'user_agent', ellipsis: true },
  { title: '结果', dataIndex: 'status', width: 90 },
];

async function openLoginLogs(row: TableRow): Promise<void> {
  logTarget.value = row;
  logOpen.value = true;
  logLoading.value = true;
  try {
    const data = await apiAdminLoginLogs({ adminId: row.id, page: 1, pageSize: 50 });
    logList.value = data.list;
  } finally {
    logLoading.value = false;
  }
}

onMounted(() => {
  void load();
  void apiRoleAll().then((rows) => {
    roleOptions.value = rows;
  });
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="登录账号">
          <a-input v-model:value="query.username" placeholder="模糊搜索" allow-clear style="width: 160px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="姓名">
          <a-input v-model:value="query.realName" placeholder="模糊搜索" allow-clear style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 180px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 110px">
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>
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
      <template #title>管理员列表</template>
      <template #extra>
        <a-button v-perm="'sys:admin:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增管理员
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'username'">
            {{ record.username }}
            <a-tag v-if="record.isSuper" color="gold">超管</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'siteId'">
            <a-tag v-if="record.siteId === 0" color="blue">全平台</a-tag>
            <span v-else>{{ record.siteId }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button v-perm="'sys:admin:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-perm="'sys:admin:reset-pwd'" type="link" size="small" @click="openResetPwd(record)">重置密码</a-button>
              <a-popconfirm
                v-if="!record.isSuper"
                :title="record.status === 1 ? '确认禁用该账号?' : '确认启用该账号?'"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'sys:admin:status'" type="link" size="small">
                  {{ record.status === 1 ? '禁用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-button type="link" size="small" @click="openLoginLogs(record)">登录记录</a-button>
              <a-popconfirm v-if="!record.isSuper" title="删除后账号不可登录,确认删除?" @confirm="removeAdmin(record)">
                <a-button v-perm="'sys:admin:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId === 0 ? '新增管理员' : '编辑管理员'"
      :confirm-loading="modalSaving"
      width="560px"
      @ok="saveAdmin"
    >
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item label="登录账号" required>
          <a-input v-model:value="form.username" :disabled="editingId !== 0" placeholder="登录账号,创建后不可修改" />
        </a-form-item>
        <a-form-item v-if="editingId === 0" label="初始密码" required>
          <a-input-password v-model:value="form.password" placeholder="至少8位,含大小写字母和数字" />
        </a-form-item>
        <a-form-item label="姓名">
          <a-input v-model:value="form.realName" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="所属站点">
          <SiteTreeSelect v-model:value="form.siteId" allow-all />
        </a-form-item>
        <a-form-item label="角色">
          <a-select v-model:value="form.roleIds" mode="multiple" placeholder="选择角色" option-filter-prop="label">
            <a-select-option v-for="role in roleOptions" :key="role.id" :value="role.id" :label="role.role_name">
              {{ role.role_name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="手机号">
          <a-input v-model:value="form.mobile" placeholder="加密存储,列表脱敏显示" />
        </a-form-item>
        <a-form-item label="邮箱">
          <a-input v-model:value="form.email" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" title="重置密码" :confirm-loading="pwdSaving" width="420px" @ok="doResetPwd">
      <a-alert type="warning" show-icon message="高危操作:重置后原密码立即失效" style="margin-bottom: 16px" />
      <a-form layout="vertical">
        <a-form-item :label="`为「${pwdTarget?.username}」设置新密码`" required>
          <a-input-password v-model:value="pwdValue" placeholder="至少8位,含大小写字母和数字" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 登录记录 -->
    <a-drawer v-model:open="logOpen" :title="`登录记录 - ${logTarget?.username ?? ''}`" width="640">
      <a-table
        :columns="logColumns"
        :data-source="logList"
        :loading="logLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="{ 1: { text: '成功', color: 'success' }, 2: { text: '失败', color: 'error' } }" />
          </template>
        </template>
      </a-table>
    </a-drawer>
  </PageContainer>
</template>
