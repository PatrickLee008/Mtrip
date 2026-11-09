<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 钱包流水展示字段(App 钱包页与管理端钱包流水共用,改一处两处生效)
 *
 * 给 user_balance_log 行补:booking_no(预订号)/ property_name(物业名)/ txn_no(展示用交易编号 WAL-Ymd-%06d)。
 */
class WalletLogPresenter
{
    /**
     * 流水关联的预订:order_id 有两种口径 —— 整单 Trip 钱包支付记的是 order_trip.id(备注含 trip_no),
     * 其余(单订单支付、退款、推荐返利)记的是 order_main.id。按「备注里出现的单号」判定是哪一种,避免 id 撞号串单。
     *
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    public static function withBookingInfo(array $rows): array
    {
        $ids = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) $r['order_id'], $rows))));
        $trips = $orders = $tripHotel = [];
        if ($ids !== []) {
            $trips = Db::table('order_trip')->whereIn('id', $ids)->pluck('trip_no', 'id')->all();
            $orders = Db::table('order_main as o')
                ->leftJoin('merchant_store as s', 's.id', '=', 'o.property_id')
                ->whereIn('o.id', $ids)
                ->get(['o.id', 'o.order_no', 'o.goods_name', 's.store_name'])
                ->keyBy('id')->all();
            if ($trips !== []) {
                foreach (Db::table('order_main as o')
                    ->leftJoin('merchant_store as s', 's.id', '=', 'o.property_id')
                    ->whereIn('o.trip_id', array_keys($trips))
                    ->orderBy('o.id')
                    ->get(['o.trip_id', 'o.goods_name', 's.store_name']) as $o) {
                    $tripHotel[(int) $o->trip_id] ??= (string) ($o->store_name ?: $o->goods_name);
                }
            }
        }
        foreach ($rows as &$row) {
            $orderId = (int) $row['order_id'];
            $remark = (string) $row['remark'];
            $row['booking_no'] = '';
            $row['property_name'] = '';
            if (isset($trips[$orderId]) && str_contains($remark, (string) $trips[$orderId])) {
                $row['booking_no'] = (string) $trips[$orderId];
                $row['property_name'] = $tripHotel[$orderId] ?? '';
            } elseif (isset($orders[$orderId])) {
                $o = $orders[$orderId];
                $row['booking_no'] = (string) $o->order_no;
                $row['property_name'] = (string) ($o->store_name ?: $o->goods_name);
            }
            $row['txn_no'] = self::txnNo($row);
        }
        unset($row);
        return $rows;
    }

    /** 展示用交易编号:WAL-创建日期-流水 id 补零 6 位 */
    public static function txnNo(array $row): string
    {
        return sprintf('WAL-%s-%06d', date('Ymd', strtotime((string) $row['created_at'])), (int) $row['id']);
    }

    /**
     * 按预订号反查流水的 order_id 口径(与 withBookingInfo 对称):单订单号 → order_main.id,行程号 → order_trip.id。
     *
     * @return list<int>
     */
    public static function orderIdsByBookingNo(string $bookingNo): array
    {
        $ids = Db::table('order_main')->where('order_no', $bookingNo)->pluck('id')->all();
        $ids = array_merge($ids, Db::table('order_trip')->where('trip_no', $bookingNo)->pluck('id')->all());
        return array_values(array_unique(array_map('intval', $ids)));
    }
}
