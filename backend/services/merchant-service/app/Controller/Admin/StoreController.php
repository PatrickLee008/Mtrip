<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Service\StoreService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 门店管理(计划 11-集团与门店模块)
 * 门店=履约/核销单元(参考美团POI):商户审核通过自动建主门店,结算主体仍在商户
 * 门店营业状态与平台暂停预订独立。主门店不可删除(先转移);软删进回收站
 */
class StoreController extends AbstractController
{
    #[Inject]
    protected StoreService $service;

    /** 门店列表:筛选 商户/门店名称/状态,联商户名称,联系电话脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_store')
            ->leftJoin('merchant_info', 'merchant_info.id', '=', 'merchant_store.merchant_id')
            ->whereNull('merchant_store.deleted_at')
            ->select('merchant_store.*', 'merchant_info.merchant_name');
        $this->applySiteScope($query, 'merchant_store.site_id');
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_store.merchant_id', $merchantId);
        }
        if (($name = $this->strInput('storeName')) !== '') {
            $query->where('merchant_store.store_name', 'like', "%{$name}%");
        }
        if (($businessType = $this->strInput('businessType')) !== '') {
            $query->where('merchant_store.business_type', $businessType);
        }
        $status = $this->input('status');
        if ((int) $status === StoreService::PLATFORM_SUSPENDED) {
            $query->where('merchant_store.operating_status', StoreService::PLATFORM_SUSPENDED);
        } elseif ($status !== null && $status !== '') {
            $query->where('merchant_store.status', (int) $status)
                ->where('merchant_store.operating_status', '<>', StoreService::PLATFORM_SUSPENDED);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('merchant_store.id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 门店详情(超管可见明文联系电话) */
    public function detail(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $phone = $this->decryptField((string) $store['contact_phone']);
        $store['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        $store['images'] = $this->jsonDecode($store['images']);
        $store['merchant_name'] = (string) (Db::table('merchant_info')
            ->where('id', $store['merchant_id'])->value('merchant_name') ?? '');
        $store['accounts'] = Db::table('merchant_admin')
            ->where('account_type', 3)->where('store_id', $store['id'])->whereNull('deleted_at')
            ->get(['id', 'username', 'real_name', 'is_owner', 'status', 'last_login_at', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();
        unset($store['deleted_at']);
        return Result::success($store);
    }

    /** 生成/重置门店账号(初始密码明文仅返回一次):数据范围=本门店履约 */
    #[Permission('merchant:store:account')]
    public function accountReset(): array
    {
        $store = $this->findScopedStore($this->requireId());
        if ((int) $store['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '门店已停业,不可生成账号');
        }
        // findScopedStore 返回的 contact_phone 为库中密文,直接写入 merchant_admin.mobile(与商户一致)
        $account = $this->service->resetAccount($store);
        return Result::success($account, $account['created'] ? '门店账号已生成' : '门店账号密码已重置');
    }

    /** 新增门店:商户首个门店自动设为主门店 */
    #[Permission('merchant:store:add')]
    public function create(): array
    {
        $merchant = $this->findMerchant($this->requireId('merchantId'));
        if ((int) $merchant['status'] === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销商户不可新增门店');
        }
        $data = $this->collectFields();
        $data['site_id'] = (int) $merchant['site_id'];
        $data['merchant_id'] = (int) $merchant['id'];
        $data['store_name'] = $this->requireStr('storeName');
        $hasStore = Db::table('merchant_store')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')->exists();
        $data['is_main'] = $hasStore ? 0 : 1;
        $data['status'] = 1;
        $id = (int) Db::table('merchant_store')->insertGetId($data);
        return Result::success(['id' => $id, 'isMain' => $data['is_main']], '门店创建成功');
    }

    /** 编辑门店 */
    #[Permission('merchant:store:edit')]
    public function update(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $data = $this->collectFields();
        if (($name = $this->strInput('storeName')) !== '') {
            $data['store_name'] = $name;
        }
        Db::table('merchant_store')->where('id', $store['id'])->update($data);
        return Result::success(null, '门店更新成功');
    }

    /** 设为主门店(同商户内互斥) */
    #[Permission('merchant:store:edit')]
    public function setMain(): array
    {
        $store = $this->findScopedStore($this->requireId());
        if ((int) $store['is_main'] === 1) {
            return Result::success(null, '该门店已是主门店');
        }
        Db::transaction(static function () use ($store) {
            Db::table('merchant_store')->where('merchant_id', $store['merchant_id'])
                ->whereNull('deleted_at')->update(['is_main' => 0]);
            Db::table('merchant_store')->where('id', $store['id'])->update(['is_main' => 1]);
        });
        return Result::success(null, '已设为主门店');
    }

    /** 平台立即暂停或恢复单个门店的新预订。 */
    #[Permission('merchant:store:status')]
    public function toggleStatus(): array
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        $id = $this->requireId();
        $action = $this->input('action');
        $reason = $this->input('reason');
        $rawVersion = $this->input('expectedVersion');
        $version = is_int($rawVersion) || is_string($rawVersion)
            ? filter_var($rawVersion, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) : false;
        if (! in_array($action, ['suspend', 'restore'], true) || $version === false
            || ! is_string($reason) || trim($reason) === '' || mb_strlen(trim($reason)) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请提供有效的操作、版本和500字以内的原因');
        }
        $result = Db::transaction(function () use ($id, $action, $version, $reason) {
            // 与下单门禁使用同一门店行锁，暂停生效前后只有一方可先提交。
            $store = $this->findScopedStore($id, true);
            if ((int) $store['booking_status_version'] !== $version) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '门店状态已更新，请刷新后重试');
            }
            $before = (int) $store['operating_status'];
            if (($action === 'suspend' && ! in_array($before, [1, 2], true))
                || ($action === 'restore' && $before !== StoreService::PLATFORM_SUSPENDED)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前门店状态不支持此操作');
            }
            // 旧数据若已有暂停状态且缺历史，按停业恢复，保留正常发布门禁。
            $next = $action === 'suspend' ? StoreService::PLATFORM_SUSPENDED
                : (int) ($this->statusHistoryQuery($store)->where('version', $version)->where('action', 'suspend')->value('from_status') ?? 2);
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_store_status_history')->insert([
                'site_id' => $store['site_id'], 'merchant_id' => $store['merchant_id'], 'store_id' => $id,
                'version' => $version + 1, 'action' => $action, 'from_status' => $before, 'to_status' => $next,
                'reason' => trim($reason), 'actor_id' => AdminContext::adminId(), 'actor_name' => AdminContext::adminName(),
                'effective_at' => $now,
            ]);
            Db::table('merchant_store')->where('id', $id)->update([
                'operating_status' => $next, 'booking_status_version' => $version + 1,
            ]);
            return ['operatingStatus' => $next, 'version' => $version + 1];
        });
        return Result::success($result);
    }

    #[Permission('merchant:store:list')]
    public function statusHistory(): array
    {
        $store = $this->findScopedStore($this->requireId());
        [$page, $size] = $this->pageParams();
        $query = $this->statusHistoryQuery($store);
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('version')->forPage($page, $size)->get()->map(static fn ($row) => (array) $row)->all();
        return Result::page($rows, $total, $page, $size);
    }

    private function statusHistoryQuery(array $store): \Hyperf\Database\Query\Builder
    {
        return Db::table('merchant_store_status_history')->where('site_id', $store['site_id'])
            ->where('merchant_id', $store['merchant_id'])->where('store_id', $store['id']);
    }

    /** 删除门店(软删):主门店不可删,请先转移主门店 */
    #[Permission('merchant:store:delete')]
    public function remove(): array
    {
        $store = $this->findScopedStore($this->requireId());
        if ((int) $store['is_main'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '主门店不可删除,请先将其他门店设为主门店');
        }
        Db::table('merchant_store')->where('id', $store['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '门店已删除');
    }

    /** 取门店并校验站点数据权限 */
    private function findScopedStore(int $id, bool $lock = false): array
    {
        $query = Db::table('merchant_store')->where('id', $id)->whereNull('deleted_at');
        if ($lock) $query->lockForUpdate();
        $store = $query->first();
        if (! $store) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '门店不存在');
        }
        $store = (array) $store;
        if (AdminContext::siteId() > 0 && (int) $store['site_id'] !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        $this->assertSiteScope((int) $store['site_id']);
        return $store;
    }

    /** 取商户并校验站点数据权限 */
    private function findMerchant(int $id): array
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        $merchant = (array) $merchant;
        $this->assertSiteScope((int) $merchant['site_id']);
        return $merchant;
    }

    /** 收集可选编辑字段(snake_case 列 ← 驼峰入参) */
    private function collectFields(): array
    {
        $data = [];
        $map = [
            'contact_name' => 'contactName',
            'address' => 'address',
            'business_license' => 'businessLicense',
            'business_hours' => 'businessHours',
            'remark' => 'remark',
        ];
        foreach ($map as $column => $param) {
            $value = $this->input($param);
            if ($value !== null) {
                $data[$column] = trim((string) $value);
            }
        }
        if (($phone = $this->strInput('contactPhone')) !== '') {
            $data['contact_phone'] = $this->encryptField($phone);
        }
        $images = $this->input('images');
        if (is_array($images)) {
            $data['images'] = json_encode($images, JSON_UNESCAPED_UNICODE);
        }
        if ($this->input('longitude') !== null) {
            $data['longitude'] = $this->floatInput('longitude');
        }
        if ($this->input('latitude') !== null) {
            $data['latitude'] = $this->floatInput('latitude');
        }
        return $data;
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }
}
