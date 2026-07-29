<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商品 SKU 管理:酒店房型 / 门票票种 CRUD + 退改规则
 * 保存均为 upsert 风格:带 id 编辑,不带 id 新增;删除为软删(校验进行中订单)
 */
class AdminSkuController extends AbstractAdminController
{
    // ---------- 酒店房型 ----------

    /** 房型列表(按商品) */
    public function roomList(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 1);
        $list = Db::table('hotel_room_type')
            ->where('goods_id', $goods['id'])->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['images'] = $this->jsonDecode($row['images']);
                $row['facilities'] = $this->jsonDecode($row['facilities']);
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    /** 保存房型:床型/面积/人数/早餐/门市价/每日库存 */
    #[Permission('goods:hotel:room')]
    public function roomSave(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 1);
        $data = [
            'bed_type' => $this->strInput('bedType'),
            'area' => $this->strInput('area'),
            'max_guests' => max(1, $this->intInput('maxGuests', 2)),
            'breakfast' => in_array($this->intInput('breakfast'), [0, 1, 2], true) ? $this->intInput('breakfast') : 0,
            'base_price' => $this->validPrice('basePrice'),
            'base_stock' => max(0, $this->intInput('baseStock')),
            'sort' => $this->intInput('sort'),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
        ];
        foreach (['images', 'facilities'] as $col) {
            $value = $this->input($col);
            if (is_array($value)) {
                $data[$col] = json_encode($value, JSON_UNESCAPED_UNICODE);
            }
        }

        $id = $this->intInput('id');
        if ($id > 0) {
            $row = $this->findSku('hotel_room_type', $id, (int) $goods['id']);
            if (($name = $this->strInput('roomName')) !== '') {
                $data['room_name'] = $name;
            }
            Db::table('hotel_room_type')->where('id', $row['id'])->update($data);
            return Result::success(['id' => (int) $row['id']], '房型已更新');
        }
        $data['site_id'] = (int) $goods['site_id'];
        $data['goods_id'] = (int) $goods['id'];
        $data['room_name'] = $this->requireStr('roomName');
        $newId = (int) Db::table('hotel_room_type')->insertGetId($data);
        return Result::success(['id' => $newId], '房型已创建');
    }

    /** 删除房型(软删):存在进行中订单禁止 */
    #[Permission('goods:hotel:room')]
    public function roomDelete(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 1);
        $row = $this->findSku('hotel_room_type', $this->requireId(), (int) $goods['id']);
        $this->assertSkuNoPendingOrder(1, (int) $row['id']);
        Db::table('hotel_room_type')->where('id', $row['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '房型已删除');
    }

    // ---------- 门票票种 ----------

    /** 票种列表(按商品) */
    public function ticketList(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 2);
        $list = Db::table('ticket_type')
            ->where('goods_id', $goods['id'])->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['time_slots'] = $this->jsonDecode($row['time_slots']);
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    /** 保存票种:类型/门市价/每日库存/分时时段/预约核销规则 */
    #[Permission('goods:ticket:type')]
    public function ticketSave(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 2);
        $ticketKind = $this->intInput('ticketKind', 1);
        if (! in_array($ticketKind, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 ticketKind 不正确');
        }
        $data = [
            'ticket_kind' => $ticketKind,
            'base_price' => $this->validPrice('basePrice'),
            'base_stock' => max(0, $this->intInput('baseStock')),
            'valid_days' => max(1, $this->intInput('validDays', 1)),
            'book_limit' => max(0, $this->intInput('bookLimit')),
            'advance_hours' => max(0, $this->intInput('advanceHours')),
            'verify_times' => max(1, $this->intInput('verifyTimes', 1)),
            'sort' => $this->intInput('sort'),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
        ];
        $timeSlots = $this->input('timeSlots');
        if (is_array($timeSlots)) {
            $data['time_slots'] = json_encode($timeSlots, JSON_UNESCAPED_UNICODE);
        }
        if ($ticketKind === 2 && ! is_array($timeSlots)) {
            $exists = $this->intInput('id') > 0
                && (string) Db::table('ticket_type')->where('id', $this->intInput('id'))->value('time_slots') !== '';
            if (! $exists) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '分时票必须配置 timeSlots 时段');
            }
        }

        $id = $this->intInput('id');
        if ($id > 0) {
            $row = $this->findSku('ticket_type', $id, (int) $goods['id']);
            if (($name = $this->strInput('ticketName')) !== '') {
                $data['ticket_name'] = $name;
            }
            Db::table('ticket_type')->where('id', $row['id'])->update($data);
            return Result::success(['id' => (int) $row['id']], '票种已更新');
        }
        $data['site_id'] = (int) $goods['site_id'];
        $data['goods_id'] = (int) $goods['id'];
        $data['ticket_name'] = $this->requireStr('ticketName');
        $newId = (int) Db::table('ticket_type')->insertGetId($data);
        return Result::success(['id' => $newId], '票种已创建');
    }

    /** 删除票种(软删):存在进行中订单禁止 */
    #[Permission('goods:ticket:type')]
    public function ticketDelete(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'), 2);
        $row = $this->findSku('ticket_type', $this->requireId(), (int) $goods['id']);
        $this->assertSkuNoPendingOrder(2, (int) $row['id']);
        Db::table('ticket_type')->where('id', $row['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '票种已删除');
    }

    // ---------- 退改规则 ----------

    /** 退改规则列表(按商品,含商品级与 SKU 级) */
    public function ruleList(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'));
        $list = Db::table('goods_refund_rule')
            ->where('goods_id', $goods['id'])->whereNull('deleted_at')
            ->orderBy('sku_type')->orderBy('sku_id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['rules'] = $this->jsonDecode($row['rules']);
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    /** 保存退改规则:同 goods+sku 维度唯一(存在则覆盖);阶梯退款须配 rules */
    #[Permission(['goods:hotel:edit', 'goods:ticket:edit'])]
    public function ruleSave(): array
    {
        $goods = $this->findGoods($this->requireId('goodsId'));
        $ruleType = $this->intInput('ruleType', 1);
        if (! in_array($ruleType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 ruleType 不正确');
        }
        $skuType = $this->intInput('skuType');
        if (! in_array($skuType, [0, 1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 skuType 不正确');
        }
        $skuId = $skuType === 0 ? 0 : $this->requireId('skuId');
        if ($skuType > 0) {
            $this->findSku($skuType === 1 ? 'hotel_room_type' : 'ticket_type', $skuId, (int) $goods['id']);
        }

        $rules = $this->input('rules');
        if ($ruleType === 2) {
            if (! is_array($rules) || $rules === []) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '阶梯退款必须配置 rules 阶梯');
            }
            foreach ($rules as $step) {
                $hours = (int) ($step['hoursBefore'] ?? $step['hours_before'] ?? -1);
                $rate = (float) ($step['refundRate'] ?? $step['refund_rate'] ?? -1);
                if ($hours < 0 || $rate < 0 || $rate > 100) {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '阶梯规则须含 hoursBefore≥0 与 refundRate 0-100');
                }
            }
        }
        $data = [
            'rule_type' => $ruleType,
            'rules' => $ruleType === 2
                ? json_encode(array_map(static fn ($step) => [
                    'hours_before' => (int) ($step['hoursBefore'] ?? $step['hours_before']),
                    'refund_rate' => (float) ($step['refundRate'] ?? $step['refund_rate']),
                ], $rules), JSON_UNESCAPED_UNICODE)
                : null,
            'remark' => mb_substr($this->strInput('remark'), 0, 500),
        ];

        $exist = Db::table('goods_refund_rule')
            ->where('goods_id', $goods['id'])->where('sku_type', $skuType)->where('sku_id', $skuId)
            ->whereNull('deleted_at')->first();
        if ($exist) {
            Db::table('goods_refund_rule')->where('id', $exist->id)->update($data);
            return Result::success(['id' => (int) $exist->id], '退改规则已更新');
        }
        $data['site_id'] = (int) $goods['site_id'];
        $data['goods_id'] = (int) $goods['id'];
        $data['sku_type'] = $skuType;
        $data['sku_id'] = $skuId;
        $newId = (int) Db::table('goods_refund_rule')->insertGetId($data);
        return Result::success(['id' => $newId], '退改规则已创建');
    }

    // ---------- 私有 ----------

    /** 取商品并校验站点权限与商品类型(0=不限类型) */
    private function findGoods(int $goodsId, int $goodsType = 0): array
    {
        $goods = Db::table('goods_info')->where('id', $goodsId)->whereNull('deleted_at')->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在');
        }
        $goods = (array) $goods;
        $this->assertSiteScope((int) $goods['site_id']);
        if ($goodsType > 0 && (int) $goods['goods_type'] !== $goodsType) {
            $label = $goodsType === 1 ? '酒店' : '门票';
            throw new BusinessException(ErrorCode::PARAM_ERROR, "该商品不是{$label}类型");
        }
        return $goods;
    }

    /** 取 SKU 行并校验归属商品 */
    private function findSku(string $table, int $id, int $goodsId): array
    {
        $row = Db::table($table)
            ->where('id', $id)->where('goods_id', $goodsId)
            ->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'SKU 不存在或不属于该商品');
        }
        return (array) $row;
    }

    /** SKU 存在进行中订单(待支付/已支付/退款中)禁止删除 */
    private function assertSkuNoPendingOrder(int $skuType, int $skuId): void
    {
        // order_main.order_type:1酒店 2门票,与 skuType 同义
        $pending = Db::table('order_main')
            ->where('order_type', $skuType)->where('sku_id', $skuId)
            ->whereIn('order_status', [0, 1, 5])
            ->whereNull('deleted_at')->count();
        if ($pending > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$pending} 笔进行中订单,禁止删除");
        }
    }

    /** 校验非负价格入参 */
    private function validPrice(string $key): float
    {
        $price = $this->floatInput($key, -1);
        if ($price < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为负");
        }
        return round($price, 2);
    }
}
