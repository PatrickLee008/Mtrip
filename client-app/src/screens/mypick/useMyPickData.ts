/**
 * 「我的精选」的数据层(完整模式 MyPickScreen 与关怀模式 MyPickLiteScreen 共用)
 *
 * 两个模式的版式完全不同,但**取数口径必须是同一份** —— 否则同一个账号在两种模式下
 * 看到的订单条数或收藏列表会对不上。抽在这里的只有取数与改数,不含任何排版。
 *
 * 关键约定沿用原页面(改动前写在 MyPickScreen 头部):
 *   - 本页是常驻 Tab,**必须用 useFocusEffect 而不是 useEffect** ——
 *     否则在酒店页收藏 / 下单后切回来还是旧数据(挂载不会重来)。
 *   - 登录后一律显示真实数据(可能为空);未登录时清空,由页面决定是否拿设计稿示例卡占位。
 *   - 收藏接口返回物业摘要、不含起价,补齐成 StayCard 需要的 GoodsItem 形状(minPrice=0)。
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchOrderList } from '@/api/order';
import { fetchFavoriteList, removeFavorite } from '@/api/user';
import { GOODS_TYPE, ORDER_STATUS } from '@/config/global';
import { colors } from '@/config/theme';
import { TAB_STATUS, type MyPickTab } from '@/screens/mypick/myPickSections';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsItem, OrderItemData } from '@/types/models';

/**
 * 状态胶囊底色:已支付/已核销/已完成走绿色,待支付走橙色,其余为中性灰。
 * 两种模式共用 —— 同一个订单在两处不该是两种颜色。
 */
export function orderStatusColor(status: number): string {
  if (status === ORDER_STATUS.PENDING) return colors.warning;
  if (status <= ORDER_STATUS.FINISHED) return colors.statusPaid;
  return colors.muted;
}

/**
 * 归并卡的状态优先级:**取最靠前的「待办态」**(用户 2026-09-22 定的口径)。
 *
 * 一个 Trip 下各预订是**各自独立**的生命周期(PRD 模块 1.1),状态天然可以不同,
 * 而设计稿(`289:1112`)每张卡只有一枚状态胶囊 —— 所以按「谁最需要用户处理」排序,
 * 取组内最靠前的那个:待支付(要付钱)> 退款中(在处理)> 已支付(待入住)> 已核销 >
 * 已完成 > 已退款 > 已取消 > 已过期。
 *
 * 页签过滤也按归并后的状态走(见 `tabBookings`),这样一个 Trip 只会出现在一个页签里。
 */
const STATUS_PRIORITY: number[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.REFUNDING,
  ORDER_STATUS.PAID,
  ORDER_STATUS.USED,
  ORDER_STATUS.FINISHED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.EXPIRED,
];

function statusRank(status: number): number {
  const i = STATUS_PRIORITY.indexOf(status);
  /* 没登记的状态排最后,不要让它抢走整组的显示状态 */
  return i === -1 ? STATUS_PRIORITY.length : i;
}

/**
 * 「我的预订」列表的一行 = 一个 Trip 或一个独立单(Figma `289:1112`)。
 *
 * 多房间与多酒店在列表里都**只占一张卡**,明细留到详情页 —— 所以这里把同 `trip_id`
 * 的预订折成一条,卡片需要的展示字段一次算好,两个模式的页面只管排版。
 */
export interface MyPickBooking {
  /** 列表 key:Trip 用 `trip-<id>`,独立单用 `order-<id>` */
  key: string;
  /** 点「View Details」进的那一单:取组内状态最靠前的(与卡上显示的状态一致) */
  orderId: number;
  /** 0 = 独立单 */
  tripId: number;
  /** 组内预订数(Trip 下有几个 Booking) */
  bookingCount: number;
  /** 组内总间数 Σquantity */
  roomCount: number;
  /** 涉及几家酒店(按 property_id 去重) */
  stayCount: number;
  /** 归并后的状态(见 STATUS_PRIORITY) */
  status: number;
  /** 首段的单号 / 酒店 / 封面 / 房型 */
  orderNo: string;
  hotelName: string;
  coverUri: string;
  skuName: string;
  /** 第二段的封面(仅多酒店卡用,叠在首图下面那条缩略图带里) */
  secondCoverUri: string;
  /** 组内最早入住 → 最晚离店(多酒店时是整个行程的跨度) */
  useDate: string | null;
  endDate: string | null;
  createdAt: string;
}

/** 把订单列表按 `trip_id` 折成列表行;独立单(trip_id=0)各自一行,顺序沿用接口的倒序 */
export function groupOrdersByTrip(orders: OrderItemData[]): MyPickBooking[] {
  const groups = new Map<string, OrderItemData[]>();
  for (const o of orders) {
    const key = o.trip_id > 0 ? `trip-${o.trip_id}` : `order-${o.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(o);
    else groups.set(key, [o]);
  }

  return [...groups.entries()].map(([key, rows]) => {
    /* 组内按「待办优先」排一次:第一条既是卡上的状态,也是点详情要进的那一单 */
    const byPriority = [...rows].sort((a, b) => statusRank(a.order_status) - statusRank(b.order_status));
    const lead = byPriority[0];
    /* 展示用的「首段」按 id 升序取,即下单时的第一项(Trip 建单顺序),不受状态排序影响 */
    const ordered = [...rows].sort((a, b) => a.id - b.id);
    const first = ordered[0];
    const properties = new Set(ordered.map((o) => o.property_id));
    const second = ordered.find((o) => o.property_id !== first.property_id);
    const dates = ordered.map((o) => o.use_date).filter((d): d is string => !!d);
    const ends = ordered.map((o) => o.end_date).filter((d): d is string => !!d);

    return {
      key,
      orderId: lead.id,
      tripId: first.trip_id,
      bookingCount: rows.length,
      roomCount: ordered.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0),
      stayCount: properties.size,
      status: lead.order_status,
      orderNo: first.order_no,
      hotelName: first.goods_name,
      coverUri: first.goods_image,
      skuName: first.sku_name,
      secondCoverUri: second?.goods_image ?? '',
      /* 日期跨度:最早入住 → 最晚离店(同一天多段也能正确显示成一段) */
      useDate: dates.length > 0 ? dates.sort()[0] : null,
      endDate: ends.length > 0 ? ends.sort()[ends.length - 1] : null,
      createdAt: first.created_at,
    };
  });
}

export interface MyPickData {
  isLogin: boolean;
  orders: OrderItemData[];
  favorites: GoodsItem[];
  /**
   * 当前页签下的**列表行**(同 Trip 已归并成一条,按归并后的状态过滤)。
   * 页面一律渲染这一份 —— 直接用 `orders` 会把一个多房间 Trip 拆成 N 张卡。
   */
  tabBookings: MyPickBooking[];
  tab: MyPickTab;
  setTab: (tab: MyPickTab) => void;
  refreshing: boolean;
  refresh: () => void;
  /** 取消收藏:先请求再就地移除(失败不动列表) */
  unfavorite: (propertyId: number) => Promise<void>;
}

export function useMyPickData(): MyPickData {
  const { t } = useTranslation();
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  const [tab, setTab] = useState<MyPickTab>('upcoming');
  const [orders, setOrders] = useState<OrderItemData[]>([]);
  const [favorites, setFavorites] = useState<GoodsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isLogin) {
        setOrders([]);
        setFavorites([]);
        return;
      }
      if (isRefresh) setRefreshing(true);
      try {
        const [orderPage, favoritePage] = await Promise.all([
          fetchOrderList({ page: 1, pageSize: 20 }),
          fetchFavoriteList({ page: 1, pageSize: 20 }),
        ]);
        setOrders(orderPage.list);
        setFavorites(
          favoritePage.list.map((f) => ({
            id: f.property_id,
            property_id: f.property_id,
            property_name: f.property_name,
            goods_type: GOODS_TYPE.HOTEL,
            category_id: 0,
            goods_name: f.property_name,
            goods_brief: '',
            cover_image: f.cover_image,
            address: f.address,
            longitude: null,
            latitude: null,
            star_level: f.star_level,
            is_recommend: 0,
            is_hot: 0,
            sales_count: 0,
            minPrice: 0,
          })),
        );
      } catch (e) {
        setOrders([]);
        setFavorites([]);
        if (isRefresh) showToast(e instanceof Error ? e.message : 'Error');
      } finally {
        setRefreshing(false);
      }
    },
    [isLogin, showToast],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unfavorite = useCallback(
    async (propertyId: number) => {
      try {
        await removeFavorite(propertyId);
        setFavorites((prev) => prev.filter((g) => g.id !== propertyId));
        showToast(t('myPick.savedHotels.removed'));
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    },
    [showToast, t],
  );

  /* 先归并再按页签过滤:过滤用的是**归并后的状态**,一个 Trip 只会出现在一个页签 */
  const tabBookings = useMemo(
    () => groupOrdersByTrip(orders).filter((b) => TAB_STATUS[tab].includes(b.status)),
    [orders, tab],
  );

  return {
    isLogin,
    orders,
    favorites,
    tabBookings,
    tab,
    setTab,
    refreshing,
    refresh: () => void load(true),
    unfavorite,
  };
}
