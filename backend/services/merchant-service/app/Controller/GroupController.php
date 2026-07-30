<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\GroupService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 集团管理(计划 11-集团与门店模块)
 * 集团=管理/授权实体(参考美团品牌总部):不签约不结算,商户经 merchant_info.group_id 排他授权绑定
 * 状态:1启用 ⇄ 2禁用;删除为软删且要求已无绑定商户
 */
class GroupController extends AbstractController
{
    #[Inject]
    protected GroupService $service;

    /** 集团列表:筛选 集团名称/状态,含绑定商户数,联系电话脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_group')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($name = $this->strInput('groupName')) !== '') {
            $query->where('group_name', 'like', "%{$name}%");
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        // 绑定商户数(仅统计未删除商户)
        $ids = array_column($list, 'id');
        $counts = $ids === [] ? [] : Db::table('merchant_info')
            ->whereIn('group_id', $ids)->whereNull('deleted_at')
            ->selectRaw('group_id, COUNT(*) AS cnt')->groupBy('group_id')
            ->pluck('cnt', 'group_id')->all();
        foreach ($list as &$row) {
            $row['merchant_count'] = (int) ($counts[$row['id']] ?? 0);
        }
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 集团详情:含绑定商户列表与集团账号(超管可见明文手机号) */
    public function detail(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $phone = $this->decryptField((string) $group['contact_phone']);
        $group['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        unset($group['deleted_at']);

        $merchants = Db::table('merchant_info')
            ->where('group_id', $group['id'])->whereNull('deleted_at')
            ->orderByDesc('id')
            ->get(['id', 'merchant_name', 'merchant_type', 'status', 'commission_rate', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        $accounts = Db::table('merchant_admin')
            ->where('group_id', $group['id'])->where('merchant_id', 0)->whereNull('deleted_at')
            ->get(['id', 'username', 'real_name', 'is_owner', 'status', 'last_login_at', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'group' => $group,
            'merchants' => $merchants,
            'accounts' => $accounts,
        ]);
    }

    /** 新增集团(直接启用,无审核流) */
    #[Permission('merchant:group:add')]
    public function create(): array
    {
        $siteId = AdminContext::isSuper() ? $this->requireId('siteId') : AdminContext::siteId();
        $data = $this->collectFields();
        $data['site_id'] = $siteId;
        $data['group_name'] = $this->requireStr('groupName');
        $data['contact_name'] = $this->requireStr('contactName');
        $data['contact_phone'] = $this->encryptField($this->requireStr('contactPhone'));
        $data['status'] = 1;
        $id = (int) Db::table('merchant_group')->insertGetId($data);
        return Result::success(['id' => $id], '集团创建成功');
    }

    /** 编辑集团 */
    #[Permission('merchant:group:edit')]
    public function update(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $data = $this->collectFields();
        if (($name = $this->strInput('groupName')) !== '') {
            $data['group_name'] = $name;
        }
        if (($contact = $this->strInput('contactName')) !== '') {
            $data['contact_name'] = $contact;
        }
        if (($phone = $this->strInput('contactPhone')) !== '') {
            $data['contact_phone'] = $this->encryptField($phone);
        }
        Db::table('merchant_group')->where('id', $group['id'])->update($data);
        return Result::success(null, '集团更新成功');
    }

    /** 启停:1启用 ⇄ 2禁用(禁用后集团账号登录由商户端登录侧校验集团状态) */
    #[Permission('merchant:group:status')]
    public function toggleStatus(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $next = (int) $group['status'] === 1 ? 2 : 1;
        Db::table('merchant_group')->where('id', $group['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '集团已启用' : '集团已禁用');
    }

    /** 绑定商户(批量):仅同站点、非注销、未绑定其他集团的商户可绑 */
    #[Permission('merchant:group:bind')]
    public function bind(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $merchantIds = array_values(array_unique(array_map('intval', (array) $this->input('merchantIds', []))));
        $merchantIds = array_filter($merchantIds, static fn (int $id) => $id > 0);
        if ($merchantIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 merchantIds 不能为空');
        }
        $merchants = Db::table('merchant_info')
            ->whereIn('id', $merchantIds)->whereNull('deleted_at')
            ->get(['id', 'site_id', 'group_id', 'status', 'merchant_name'])
            ->map(static fn ($row) => (array) $row)->all();
        if (count($merchants) !== count($merchantIds)) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '存在无效商户');
        }
        foreach ($merchants as $merchant) {
            if ((int) $group['site_id'] > 0 && (int) $merchant['site_id'] !== (int) $group['site_id']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "商户 {$merchant['merchant_name']} 与集团不属于同一站点");
            }
            if ((int) $merchant['status'] === 5) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "商户 {$merchant['merchant_name']} 已注销,不可绑定");
            }
            if ((int) $merchant['group_id'] > 0 && (int) $merchant['group_id'] !== (int) $group['id']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "商户 {$merchant['merchant_name']} 已绑定其他集团");
            }
        }
        $bound = Db::table('merchant_info')
            ->whereIn('id', $merchantIds)->where('group_id', 0)
            ->update(['group_id' => (int) $group['id']]);
        return Result::success(['bound' => $bound], "已绑定 {$bound} 个商户");
    }

    /** 解绑商户:group_id 置 0,商户回归独立 */
    #[Permission('merchant:group:bind')]
    public function unbind(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $merchantId = $this->requireId('merchantId');
        $updated = Db::table('merchant_info')
            ->where('id', $merchantId)->where('group_id', $group['id'])
            ->whereNull('deleted_at')
            ->update(['group_id' => 0]);
        if ($updated === 0) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '该商户未绑定至此集团');
        }
        return Result::success(null, '已解绑');
    }

    /** 生成/重置集团主账号(初始密码明文仅返回一次) */
    #[Permission('merchant:group:account')]
    public function accountReset(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        if ((int) $group['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '集团已禁用,不可生成账号');
        }
        $account = $this->service->resetAccount($group);
        $message = $account['created'] ? '集团账号已生成' : '集团账号密码已重置';
        return Result::success($account, $message);
    }

    /** 删除集团(软删):要求已无绑定商户,联动软删集团账号 */
    #[Permission('merchant:group:delete')]
    public function remove(): array
    {
        $group = $this->findScopedGroup($this->requireId());
        $boundCount = Db::table('merchant_info')
            ->where('group_id', $group['id'])->whereNull('deleted_at')->count();
        if ($boundCount > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "集团下仍有 {$boundCount} 个绑定商户,请先解绑");
        }
        $now = date('Y-m-d H:i:s');
        Db::transaction(static function () use ($group, $now) {
            Db::table('merchant_group')->where('id', $group['id'])->update(['deleted_at' => $now]);
            Db::table('merchant_admin')->where('group_id', $group['id'])->where('merchant_id', 0)
                ->whereNull('deleted_at')->update(['deleted_at' => $now]);
        });
        return Result::success(null, '集团已删除');
    }

    /** 取集团并校验站点数据权限 */
    private function findScopedGroup(int $id): array
    {
        $group = Db::table('merchant_group')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $group) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '集团不存在');
        }
        $group = (array) $group;
        $this->assertSiteScope((int) $group['site_id']);
        return $group;
    }

    /** 收集可选编辑字段(snake_case 列 ← 驼峰入参) */
    private function collectFields(): array
    {
        $data = [];
        $map = [
            'group_short_name' => 'groupShortName',
            'logo' => 'logo',
            'contact_email' => 'contactEmail',
            'remark' => 'remark',
        ];
        foreach ($map as $column => $param) {
            $value = $this->input($param);
            if ($value !== null) {
                $data[$column] = trim((string) $value);
            }
        }
        return $data;
    }
}
