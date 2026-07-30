<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 商户端门店管理:数据范围由 MerchantContext 裁剪
 * 集团→本集团绑定商户全部门店;商户→本商户门店;门店→仅本门店
 */
class StoreController extends AbstractController
{
    /** 门店列表 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_store')
            ->leftJoin('merchant_info', 'merchant_info.id', '=', 'merchant_store.merchant_id')
            ->whereNull('merchant_store.deleted_at')
            ->select('merchant_store.*', 'merchant_info.merchant_name');
        $this->applyStoreScope($query);
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

    /** 门店详情 */
    public function detail(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $store['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $store['contact_phone']));
        $store['images'] = $this->jsonDecode($store['images']);
        $store['merchant_name'] = (string) (Db::table('merchant_info')
            ->where('id', $store['merchant_id'])->value('merchant_name') ?? '');
        unset($store['deleted_at']);
        return Result::success($store);
    }

    /** 新增门店(集团/商户可用;首个门店自动设为主门店) */
    #[Permission('mch:store:add')]
    public function create(): array
    {
        $merchantId = $this->requireId('merchantId');
        $this->assertMerchantInScope($merchantId);
        $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        if ((int) $merchant->status === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销商户不可新增门店');
        }
        $data = $this->collectFields();
        $data['site_id'] = (int) $merchant->site_id;
        $data['merchant_id'] = $merchantId;
        $data['store_name'] = $this->requireStr('storeName');
        $hasStore = Db::table('merchant_store')->where('merchant_id', $merchantId)->whereNull('deleted_at')->exists();
        $data['is_main'] = $hasStore ? 0 : 1;
        $data['status'] = 1;
        $id = (int) Db::table('merchant_store')->insertGetId($data);
        return Result::success(['id' => $id, 'isMain' => $data['is_main']], '门店创建成功');
    }

    /** 编辑门店 */
    #[Permission('mch:store:edit')]
    public function update(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $data = $this->collectFields();
        if (($name = $this->strInput('storeName')) !== '') {
            $data['store_name'] = $name;
        }
        if ($data !== []) {
            Db::table('merchant_store')->where('id', $store['id'])->update($data);
        }
        return Result::success(null, '门店更新成功');
    }

    /** 设为主门店(同商户互斥) */
    #[Permission('mch:store:set-main')]
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
    #[Permission('mch:store:status')]
    public function toggleStatus(): array
    {
        $store = $this->findScopedStore($this->requireId());
        $next = (int) $store['status'] === 1 ? 2 : 1;
        Db::table('merchant_store')->where('id', $store['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '门店已营业' : '门店已停业');
    }

    /** 门店数据范围:门店账号仅本门店;集团/商户按可见商户集合 */
    private function applyStoreScope($query): void
    {
        if (MerchantContext::accountType() === 3) {
            $query->where('merchant_store.id', MerchantContext::storeId());
            return;
        }
        $merchantIds = MerchantContext::scopeMerchantIds();
        $query->whereIn('merchant_store.merchant_id', $merchantIds === [] ? [0] : $merchantIds);
    }

    private function assertMerchantInScope(int $merchantId): void
    {
        if (! in_array($merchantId, MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }

    private function findScopedStore(int $id): array
    {
        $store = Db::table('merchant_store')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $store) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '门店不存在');
        }
        $store = (array) $store;
        if (MerchantContext::accountType() === 3) {
            if ((int) $store['id'] !== MerchantContext::storeId()) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            }
        } else {
            $this->assertMerchantInScope((int) $store['merchant_id']);
        }
        return $store;
    }

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
