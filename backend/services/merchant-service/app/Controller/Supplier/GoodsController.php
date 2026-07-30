<?php

declare(strict_types=1);

namespace App\Controller\Supplier;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\SupplierContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 供应商端供货商品自助维护:仅限本供应商(supplier_id)的 supplier_goods 记录
 * 状态:1供货中 ⇄ 2已停供;软删。
 */
class GoodsController extends AbstractController
{
    /** 供货商品列表:筛选 名称/类型/状态 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('supplier_goods')
            ->where('supplier_id', SupplierContext::supplierId())->whereNull('deleted_at');
        if (($name = $this->strInput('goodsName')) !== '') {
            $query->where('goods_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('goodsType')) > 0) {
            $query->where('goods_type', $type);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 供货商品详情 */
    public function detail(): array
    {
        return Result::success(['goods' => $this->findScoped($this->requireId())]);
    }

    /** 新增供货商品 */
    #[Permission('sup:goods:add')]
    public function create(): array
    {
        $goodsType = $this->intInput('goodsType', 1);
        if (! in_array($goodsType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 goodsType 不正确');
        }
        [$supplyPrice, $retailPrice] = $this->validatePrices();
        $id = (int) Db::table('supplier_goods')->insertGetId([
            'site_id' => SupplierContext::siteId(),
            'supplier_id' => SupplierContext::supplierId(),
            'goods_id' => $this->intInput('goodsId'),
            'goods_name' => $this->requireStr('goodsName'),
            'goods_type' => $goodsType,
            'supply_price' => $supplyPrice,
            'retail_price' => $retailPrice,
            'sync_type' => $this->validSyncType(),
            'status' => 1,
            'remark' => mb_substr($this->strInput('remark'), 0, 255),
        ]);
        return Result::success(['id' => $id], '供货商品已添加');
    }

    /** 编辑供货商品:名称/价格/同步方式/关联平台商品 */
    #[Permission('sup:goods:edit')]
    public function update(): array
    {
        $row = $this->findScoped($this->requireId());
        $data = [];
        if (($name = $this->strInput('goodsName')) !== '') {
            $data['goods_name'] = $name;
        }
        if ($this->input('supplyPrice') !== null || $this->input('retailPrice') !== null) {
            [$data['supply_price'], $data['retail_price']] = $this->validatePrices(
                $this->floatInput('supplyPrice', (float) $row['supply_price']),
                $this->floatInput('retailPrice', (float) $row['retail_price'])
            );
        }
        if ($this->input('syncType') !== null) {
            $data['sync_type'] = $this->validSyncType();
        }
        if (($type = $this->intInput('goodsType')) > 0 && in_array($type, [1, 2], true)) {
            $data['goods_type'] = $type;
        }
        if ($this->input('goodsId') !== null) {
            $data['goods_id'] = $this->intInput('goodsId');
        }
        if ($this->input('remark') !== null) {
            $data['remark'] = mb_substr($this->strInput('remark'), 0, 255);
        }
        if ($data === []) {
            return Result::success(null, '无可更新内容');
        }
        Db::table('supplier_goods')->where('id', $row['id'])->update($data);
        return Result::success(null, '供货商品已更新');
    }

    /** 停供/恢复供货(1供货中 ⇄ 2已停供) */
    #[Permission('sup:goods:status')]
    public function toggleStatus(): array
    {
        $row = $this->findScoped($this->requireId());
        $next = (int) $row['status'] === 1 ? 2 : 1;
        Db::table('supplier_goods')->where('id', $row['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '已恢复供货' : '已停供');
    }

    /** 删除供货商品(软删) */
    #[Permission('sup:goods:delete')]
    public function remove(): array
    {
        $row = $this->findScoped($this->requireId());
        Db::table('supplier_goods')->where('id', $row['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '供货商品已删除');
    }

    /** 取本供应商供货商品 */
    private function findScoped(int $id): array
    {
        $row = Db::table('supplier_goods')->where('id', $id)
            ->where('supplier_id', SupplierContext::supplierId())
            ->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '供货商品不存在或无权操作');
        }
        return (array) $row;
    }

    /** 校验供货价/零售价:非负且底价不高于零售价 */
    private function validatePrices(?float $supply = null, ?float $retail = null): array
    {
        $supply ??= $this->floatInput('supplyPrice', -1);
        $retail ??= $this->floatInput('retailPrice', -1);
        if ($supply < 0 || $retail < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '供货价/零售价不能为负');
        }
        if ($retail > 0 && $supply > $retail) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '供货底价不能高于建议零售价');
        }
        return [round($supply, 2), round($retail, 2)];
    }

    /** 校验库存同步方式:1API实时 2手动导入 3定时同步 */
    private function validSyncType(): int
    {
        $syncType = $this->intInput('syncType', 2);
        if (! in_array($syncType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 syncType 不正确');
        }
        return $syncType;
    }
}
