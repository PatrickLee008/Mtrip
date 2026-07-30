<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端商品管理:数据范围强制 MerchantContext 商户集合
 * 集团→本集团绑定商户全部商品;商户/门店→本商户商品
 * 状态机沿用平台口径:0草稿 →1待审核 →3已上架/2驳回;3⇄4上下架;5软删
 */
class GoodsController extends AbstractAdminController
{
    /** 商品列表:筛选 名称/类型/分类/状态,附带分类名 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('goods_info')->whereNull('deleted_at')->where('status', '<>', 5);
        $this->applyMerchantScope($query);
        if (($name = $this->strInput('goodsName')) !== '') {
            $query->where('goods_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('goodsType')) > 0) {
            $query->where('goods_type', $type);
        }
        if (($categoryId = $this->intInput('categoryId')) > 0) {
            $query->where('category_id', $categoryId);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('sort_weight')->orderByDesc('id')
            ->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'merchant_id', 'supplier_id', 'goods_type', 'category_id',
                'goods_name', 'cover_image', 'address', 'star_level', 'status', 'audit_remark',
                'sort_weight', 'is_recommend', 'is_hot', 'sales_count', 'created_at', 'updated_at'])
            ->map(static fn ($row) => (array) $row)->all();
        $categoryNames = $this->pluckNames('goods_category', array_column($rows, 'category_id'), 'category_name');
        $merchantNames = $this->pluckNames('merchant_info', array_column($rows, 'merchant_id'), 'merchant_name');
        $list = array_map(static function (array $row) use ($categoryNames, $merchantNames) {
            $row['category_name'] = (string) ($categoryNames[$row['category_id']] ?? '');
            $row['merchant_name'] = (string) ($merchantNames[$row['merchant_id']] ?? '');
            return $row;
        }, $rows);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 商品详情:含房型/票种子表与退改规则 */
    public function detail(): array
    {
        $goods = $this->findScoped($this->requireId());
        $goods['images'] = $this->jsonDecode($goods['images']);
        $goods['facilities'] = $this->jsonDecode($goods['facilities']);
        unset($goods['deleted_at']);

        $skuTable = (int) $goods['goods_type'] === 1 ? 'hotel_room_type' : 'ticket_type';
        $skus = Db::table($skuTable)
            ->where('goods_id', $goods['id'])->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                foreach (['images', 'facilities', 'time_slots'] as $col) {
                    if (array_key_exists($col, $row)) {
                        $row[$col] = $this->jsonDecode($row[$col]);
                    }
                }
                unset($row['deleted_at']);
                return $row;
            })->all();
        $rules = Db::table('goods_refund_rule')
            ->where('goods_id', $goods['id'])->whereNull('deleted_at')
            ->orderBy('sku_type')->orderBy('sku_id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['rules'] = $this->jsonDecode($row['rules']);
                unset($row['deleted_at']);
                return $row;
            })->all();

        return Result::success([
            'goods' => $goods,
            'skus' => $skus,
            'refundRules' => $rules,
        ]);
    }

    /** 新增商品(草稿):merchant_id 强制取当前主体范围 */
    #[Permission('mch:goods:add')]
    public function create(): array
    {
        $goodsType = $this->intInput('goodsType', 1);
        if (! in_array($goodsType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 goodsType 不正确');
        }
        $merchantId = $this->resolveMerchantId();
        $siteId = (int) (Db::table('merchant_info')->where('id', $merchantId)->value('site_id') ?? 0);
        $data = $this->collectFields();
        $data['site_id'] = $siteId;
        $data['merchant_id'] = $merchantId;
        $data['goods_type'] = $goodsType;
        $data['goods_name'] = $this->requireStr('goodsName');
        $data['supplier_id'] = $this->intInput('supplierId');
        $data['category_id'] = $this->intInput('categoryId');
        $data['status'] = 0;
        $id = (int) Db::table('goods_info')->insertGetId($data);
        return Result::success(['id' => $id], '商品已保存为草稿');
    }

    /** 编辑商品:待审核/已上架/已删除不可编辑,须先下架或撤回 */
    #[Permission('mch:goods:edit')]
    public function update(): array
    {
        $goods = $this->findScoped($this->requireId());
        if (in_array((int) $goods['status'], [1, 3, 5], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '待审核/已上架/已删除商品不可编辑,请先下架或撤回');
        }
        $data = $this->collectFields();
        if (($name = $this->strInput('goodsName')) !== '') {
            $data['goods_name'] = $name;
        }
        if (($categoryId = $this->intInput('categoryId')) > 0) {
            $data['category_id'] = $categoryId;
        }
        if ($data === []) {
            return Result::success(null, '无可更新内容');
        }
        Db::table('goods_info')->where('id', $goods['id'])->update($data);
        return Result::success(null, '商品更新成功');
    }

    /** 提交审核:0草稿/2驳回 → 1待审核;须至少一个在售 SKU */
    #[Permission('mch:goods:edit')]
    public function submit(): array
    {
        $goods = $this->findScoped($this->requireId());
        if (! in_array((int) $goods['status'], [0, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅草稿/驳回商品可提交审核');
        }
        $skuTable = (int) $goods['goods_type'] === 1 ? 'hotel_room_type' : 'ticket_type';
        $skuCount = Db::table($skuTable)
            ->where('goods_id', $goods['id'])->where('status', 1)
            ->whereNull('deleted_at')->count();
        if ($skuCount === 0) {
            $skuLabel = (int) $goods['goods_type'] === 1 ? '房型' : '票种';
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "请先添加至少一个在售{$skuLabel}");
        }
        Db::table('goods_info')->where('id', $goods['id'])->update(['status' => 1, 'audit_remark' => '']);
        return Result::success(null, '已提交审核');
    }

    /** 上下架:3已上架 ⇄ 4已下架 */
    #[Permission('mch:goods:status')]
    public function toggleStatus(): array
    {
        $goods = $this->findScoped($this->requireId());
        $status = (int) $goods['status'];
        if (! in_array($status, [3, 4], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已上架/已下架商品可切换状态');
        }
        $next = $status === 3 ? 4 : 3;
        Db::table('goods_info')->where('id', $goods['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 3 ? '商品已上架' : '商品已下架');
    }

    /** 商户数据范围:按可见商户集合过滤 */
    private function applyMerchantScope($query): void
    {
        $merchantIds = MerchantContext::scopeMerchantIds();
        $query->whereIn('merchant_id', $merchantIds === [] ? [0] : $merchantIds);
    }

    /** 新增时确定归属商户:集团须显式指定并落在范围内;商户/门店取自身商户 */
    private function resolveMerchantId(): int
    {
        $scope = MerchantContext::scopeMerchantIds();
        if ($scope === []) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        if (MerchantContext::accountType() === 1) {
            $merchantId = $this->requireId('merchantId');
            if (! in_array($merchantId, $scope, true)) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '所选商户不在可管理范围内');
            }
            return $merchantId;
        }
        return $scope[0];
    }

    /** 取商品并校验商户数据权限 */
    private function findScoped(int $id): array
    {
        $goods = Db::table('goods_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在');
        }
        $goods = (array) $goods;
        if (! in_array((int) $goods['merchant_id'], MerchantContext::scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $goods;
    }

    /** 批量取 id=>name 映射 */
    private function pluckNames(string $table, array $ids, string $nameColumn): array
    {
        $ids = array_values(array_filter(array_unique($ids)));
        if ($ids === []) {
            return [];
        }
        return Db::table($table)->whereIn('id', $ids)->pluck($nameColumn, 'id')->all();
    }

    /** 收集可选编辑字段(snake_case 列 ← 驼峰入参) */
    private function collectFields(): array
    {
        $data = [];
        $map = [
            'goods_brief' => 'goodsBrief',
            'goods_detail' => 'goodsDetail',
            'cover_image' => 'coverImage',
            'address' => 'address',
            'open_time' => 'openTime',
            'close_time' => 'closeTime',
        ];
        foreach ($map as $column => $param) {
            $value = $this->input($param);
            if ($value !== null) {
                $data[$column] = trim((string) $value);
            }
        }
        foreach (['images' => 'images', 'facilities' => 'facilities'] as $column => $param) {
            $value = $this->input($param);
            if (is_array($value)) {
                $data[$column] = json_encode($value, JSON_UNESCAPED_UNICODE);
            }
        }
        if ($this->input('starLevel') !== null) {
            $data['star_level'] = $this->intInput('starLevel');
        }
        if ($this->input('sortWeight') !== null) {
            $data['sort_weight'] = $this->intInput('sortWeight');
        }
        if ($this->input('isRecommend') !== null) {
            $data['is_recommend'] = $this->intInput('isRecommend') === 1 ? 1 : 0;
        }
        if ($this->input('isHot') !== null) {
            $data['is_hot'] = $this->intInput('isHot') === 1 ? 1 : 0;
        }
        if ($this->input('longitude') !== null) {
            $data['longitude'] = $this->floatInput('longitude');
        }
        if ($this->input('latitude') !== null) {
            $data['latitude'] = $this->floatInput('latitude');
        }
        return $data;
    }
}
