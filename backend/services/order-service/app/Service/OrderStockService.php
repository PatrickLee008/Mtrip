<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 订单库存服务:价格日历锁定/扣减/释放(goods_daily_stock,行锁+流水)
 * 变动类型:1下单锁定 2支付扣减 3取消释放 4退款回补
 */
class OrderStockService
{
    /**
     * 订单占用的库存日期:酒店=入住到离店前一晚,门票=单日
     */
    public function datesOf(int $orderType, string $useDate, ?string $endDate): array
    {
        if ($orderType !== 1) {
            return [$useDate];
        }
        $start = strtotime($useDate);
        $end = $endDate ? strtotime($endDate) : false;
        if ($start === false || $end === false || $end <= $start) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '入住/离店日期不正确');
        }
        if (($end - $start) / 86400 > 30) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '连住最多30晚');
        }
        $dates = [];
        for ($t = $start; $t < $end; $t += 86400) {
            $dates[] = date('Y-m-d', $t);
        }
        return $dates;
    }

    /**
     * 锁定库存并计算总价(须在事务内调用)
     * 无日历记录的日期先按 SKU 基础价/基础库存补建
     * @return array{0: float, 1: array} [总价, 变动明细(供 logChanges)]
     */
    public function lock(int $siteId, int $goodsId, int $skuType, int $skuId, array $sku, array $dates, int $qty): array
    {
        $total = 0.0;
        $changes = [];
        foreach ($dates as $date) {
            $row = $this->lockRow($skuType, $skuId, $date);
            if (! $row) {
                Db::table('goods_daily_stock')->insertOrIgnore([
                    'site_id' => $siteId,
                    'goods_id' => $goodsId,
                    'sku_type' => $skuType,
                    'sku_id' => $skuId,
                    'stock_date' => $date,
                    'price' => $sku['base_price'],
                    'stock_total' => $sku['base_stock'],
                ]);
                $row = $this->lockRow($skuType, $skuId, $date);
            }
            if (! $row || (int) $row['is_closed'] === 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "{$date} 已停售");
            }
            $available = (int) $row['stock_total'] - (int) $row['stock_sold'] - (int) $row['stock_locked'];
            if ($available < $qty) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "{$date} 库存不足");
            }
            Db::table('goods_daily_stock')->where('id', $row['id'])
                ->increment('stock_locked', $qty);
            $total += (float) $row['price'] * $qty;
            $changes[] = [
                'site_id' => $siteId,
                'goods_id' => $goodsId,
                'sku_type' => $skuType,
                'sku_id' => $skuId,
                'stock_date' => $date,
                'change_type' => 1,
                'change_qty' => -$qty,
            ];
        }
        return [$total, $changes];
    }

    /** 补写库存流水(下单锁定后回填订单ID) */
    public function logChanges(int $orderId, array $changes): void
    {
        foreach ($changes as &$change) {
            $change['order_id'] = $orderId;
        }
        unset($change);
        Db::table('goods_stock_log')->insert($changes);
    }

    /** 支付扣减:锁定转已售(须在事务内调用) */
    public function deduct(array $order): void
    {
        $this->move($order, 2, static function (int $id, int $qty) {
            Db::table('goods_daily_stock')->where('id', $id)->update([
                'stock_locked' => Db::raw("GREATEST(stock_locked - {$qty}, 0)"),
                'stock_sold' => Db::raw("stock_sold + {$qty}"),
            ]);
        });
    }

    /** 取消释放:归还锁定(须在事务内调用) */
    public function release(array $order): void
    {
        $this->move($order, 3, static function (int $id, int $qty) {
            Db::table('goods_daily_stock')->where('id', $id)->update([
                'stock_locked' => Db::raw("GREATEST(stock_locked - {$qty}, 0)"),
            ]);
        });
    }

    /** 退款回补:已售扣回(须在事务内调用) */
    public function refundRestore(array $order): void
    {
        $this->move($order, 4, static function (int $id, int $qty) {
            Db::table('goods_daily_stock')->where('id', $id)->update([
                'stock_sold' => Db::raw("GREATEST(stock_sold - {$qty}, 0)"),
            ]);
        });
    }

    /** 按订单遍历库存日,应用变更并写流水 */
    private function move(array $order, int $changeType, callable $apply): void
    {
        $skuType = (int) $order['order_type'];
        $qty = (int) $order['quantity'];
        $dates = $this->datesOf($skuType, (string) $order['use_date'], $order['end_date'] ? (string) $order['end_date'] : null);
        $logs = [];
        foreach ($dates as $date) {
            $row = $this->lockRow($skuType, (int) $order['sku_id'], $date);
            if ($row) {
                $apply((int) $row['id'], $qty);
            }
            $logs[] = [
                'site_id' => (int) $order['site_id'],
                'goods_id' => (int) $order['goods_id'],
                'sku_type' => $skuType,
                'sku_id' => (int) $order['sku_id'],
                'stock_date' => $date,
                'change_type' => $changeType,
                'change_qty' => in_array($changeType, [3, 4], true) ? $qty : -$qty,
                'order_id' => (int) $order['id'],
            ];
        }
        Db::table('goods_stock_log')->insert($logs);
    }

    private function lockRow(int $skuType, int $skuId, string $date): ?array
    {
        $row = Db::table('goods_daily_stock')
            ->where('sku_type', $skuType)
            ->where('sku_id', $skuId)
            ->where('stock_date', $date)
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();
        return $row ? (array) $row : null;
    }
}
