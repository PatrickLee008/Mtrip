<?php

declare(strict_types=1);

namespace App\Controller;

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
 * 状态:1营业 ⇄ 2停业;主门店不可删除(先转移);软删进回收站
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
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('merchant_store.status', (int) $status);
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

    /** 启停:1营业 ⇄ 2停业 */
    #[Permission('merchant:store:status')]
    public function toggleStatus(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $next = (int) $store['status'] === 1 ? 2 : 1;
        Db::table('merchant_store')->where('id', $store['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '门店已营业' : '门店已停业');
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
    private function findScopedStore(int $id): array
    {
        $store = Db::table('merchant_store')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $store) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '门店不存在');
        }
        $store = (array) $store;
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
