/**
 * 酒店订单详情(Figma `2659:16092` Rooms Details Multi Room / 单房间同页 `289:1670`)
 *
 * **一页两用**:多房间(一个 Trip 下多个预订)与单房间是同一套版式 ——
 * 差别只在「Booking Status」有几行、「Selected Rooms (n)」列几条,由数据决定,不是两个页面。
 * 入口是「我的预订」卡片的 View Details(卡已按 Trip 归并,点进来才展开明细)。
 *
 * 取数三条(都走现成接口):
 *   `order/detail`   代表单:联系人 / 核销码 / property_id / room_type_id / 金额
 *   `order/trip/detail`  带 `tripId` 时取同 Trip 下各预订(按入住日排序,后端已如此返回)
 *   `hotels/detail`  图库 / 地址 / 房型属性(人数·床型·含早)与设施 —— 订单快照里没有这些
 *
 * 设计稿实测:
 *   页面     `--background` 底;图库 300;Main pt16 px16 gap24 pb108
 *   顶栏     悬浮在 y=54:`--tab` 底 px20 py16 投影 Effect/DS;← 20 + 「Booking Details」Outfit 600/24 主色;
 *            右侧两枚 36 圆按钮(分享 / 提醒)
 *   标题卡   白底 1px `--secondary` 圆角 24 p21:酒店名 Inter 600/24;地址行 12x15 图标 + Inter 500/14 `--text-2`
 *   确认卡   `--tab` 底 1px 白 圆角 24 p25 投影 0 -4 20 `rgba(78,115,255,.08)`,内容 gap24:
 *            结果头(96x88 状态色 10% 圆底 + 40 图标 / 标题 Inter 700 24/32 -0.96 / 说明 16/24)
 *            → 酒店名 Inter 600/24 居中 → 状态行组(与预订结果页**共用** `BookingStatusRows`)
 *            → 「Booking ID: 」Inter 400/16 + 单号 600,右 20 复制图标
 *   住宿网格 `--tab` 底 1px `rgba(196,197,215,.2)` 圆角 24 p25 gap16:
 *            两行「40 圆 rgba(32,77,218,.1) + 20 图标 / 小标题 Inter 600/12 tracking .6 / 值 Inter 700/16」
 *            → 1px 线 → TOTAL AMOUNT(Inter 600/16 tracking .6 大写 #434655)+ 金额 Inter 700/20 主色
 *   已选房型 复用复核页那张 `SelectedRoomsCard`(**不传 onEdit**,订单已成立不能改房,稿面也没有该入口)
 *   房型设施 白底 1px `--secondary` 圆角 24 p24 gap24:标题 Inter 600/24 + 两列网格
 *            (每项 40 高 `#E5EEFF` 圆角 8 图标格 + Inter 400/16 文案)
 *   含早卡   `rgba(65,105,237,.05)` 底 1px `--secondary` 圆角 24 p25 gap16:64 圆底 + 标题 `#204DDA` + 说明 `#434655`
 *   联系物业 标题 24 → 整宽主色「Message Property」→ 地址卡(8 圆角 `--secondary` 图标格 + 地址 15/28 +
 *            Get Directions 链接 + 86 高地图块 + 「View on Map」主色胶囊)
 *   支持卡   标题 Support 24 + 右侧「Booking Reference」+ 单号;Help Center 行(1px 圆角 12 p17)+
 *            Live Support Chat(`#DBE2FA` 圆角 12)
 *   底部操作 两枚等宽描边按钮:Modify Booking(**稿面就是 opacity .5 禁用态**)/ Cancel Booking(`--tertiary` 红字)
 *
 * ⚠️ **Modify Booking 照稿禁用**,不是漏做:后端没有任何改期/改信息的接口(PRD 说确认后可改联系人/
 *   入住人/特殊要求,代码里没有),稿面也把它画成半透明。等后端出接口再解开。
 * 「Cancel Booking」进取消流程(`1205:2159` 退款摘要 → `1205:2480` 取消原因 → `1205:2679` 结果);
 *   按 PRD §1.1 取消粒度是**一个 booking**,同 Trip 下其余预订不受影响。
 * ⚠️ 地图缩略图稿面是静态地图图片,项目没有地图 SDK/静态图服务,这里用 `--secondary` 色块占位 +
 *   「View on Map」胶囊,点了 comingSoon;地址与「Get Directions」是真实数据/待接。
 * ⚠️ 稿面底部画了底部 Tab 栏(My Pick 高亮),但本页是 stack 页、不在 Tab 内,所以没有那一条。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

import { fetchHotelDetail } from '@/api/goods';
import { fetchOrderDetail } from '@/api/order';
import { fetchTripDetail, type TripBookingRow } from '@/api/trip';
import { TEMP_HOTEL_GALLERY, tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import HotelGallery from '@/components/hotel/HotelGallery';
import BookingStatusRows from '@/components/hotel/booking/BookingStatusRows';
import SelectedRoomsCard from '@/components/hotel/booking/SelectedRoomsCard';
import { formatDayMonth, nightsBetween, nightsLabel } from '@/components/hotel/booking/bookingFormat';
import { ORDER_STATUS, ORDER_STATUS_I18N } from '@/config/global';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { ROOM_FACILITY_ICONS } from '@/screens/hotel/detailDemo';
import { orderStatusColor } from '@/screens/mypick/useMyPickData';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { CartRoom } from '@/store/roomCartStore';
import type { GoodsDetail, GoodsSku, OrderDetail } from '@/types/models';
import { formatMoney } from '@/utils/format';
import { resolveMediaUri } from '@/utils/media';

/** 稿面地图缩略图高度 */
const MAP_HEIGHT = 86;

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const { orderId, tripId } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  /** 同 Trip 下的各预订(按入住日);单房型链路里只有代表单自己 */
  const [bookings, setBookings] = useState<TripBookingRow[]>([]);
  /** Trip 主单的实付(多房间要显示整单金额,不是代表单的) */
  const [tripPayAmount, setTripPayAmount] = useState<number | null>(null);
  const [hotel, setHotel] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await fetchOrderDetail(orderId);
      setOrder(detail);
      /* 多房间:整个 Trip 的预订都要列出来 */
      if (tripId && tripId > 0) {
        const trip = await fetchTripDetail(tripId);
        setBookings(trip.bookings ?? []);
        setTripPayAmount(Number(trip.pay_amount) || 0);
      } else {
        setBookings([]);
        setTripPayAmount(null);
      }
      /* 图库 / 地址 / 房型属性只有商品详情有,订单快照里没有 */
      if (detail.property_id > 0) {
        setHotel(await fetchHotelDetail(detail.property_id).catch(() => null));
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [orderId, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 列表里的「一条 = 一个预订」;单房型链路就把代表单包成一条 */
  const rows = useMemo<TripBookingRow[]>(() => {
    if (bookings.length > 0) return bookings;
    if (!order) return [];
    return [
      {
        id: order.id,
        order_no: order.order_no,
        property_id: order.property_id,
        room_type_id: order.room_type_id,
        goods_name: order.goods_name,
        goods_image: order.goods_image,
        sku_name: order.sku_name,
        quantity: order.quantity,
        pay_amount: order.pay_amount,
        order_status: order.order_status,
        refund_status: order.refund_status,
        use_date: order.use_date,
        end_date: order.end_date,
      },
    ];
  }, [bookings, order]);

  const skuOf = useCallback(
    (roomTypeId: number): GoodsSku | undefined =>
      (hotel?.skus ?? []).find((s) => s.id === roomTypeId),
    [hotel],
  );

  /**
   * 「Selected Rooms」用复核页那张卡,所以把预订行拼成它认的 `CartRoom` 形状。
   * 单价取房型的 `base_price`(稿面显示「/ night」),属性取商品详情的房型字段 ——
   * 订单快照里只有房型名与间数。
   */
  const rooms = useMemo<CartRoom[]>(
    () =>
      rows.map((row, i) => {
        const sku = skuOf(row.room_type_id);
        const cover = resolveMediaUri(Array.isArray(sku?.images) ? sku?.images[0] : undefined);
        const attrs: CartRoom['attrs'] = [
          {
            key: 'guests',
            icon: 'guests' as const,
            label: t('hotels.detail.rooms.guests', { guests: sku?.max_guests ?? 2 }),
          },
          {
            key: 'bed',
            icon: 'bedSize' as const,
            label: sku?.bed_type || t('hotels.detail.rooms.beds.king'),
          },
        ];
        if (sku?.breakfast) {
          attrs.push({
            key: 'breakfast',
            icon: 'breakfast' as const,
            label: t('hotels.detail.rooms.facilities.breakfast'),
          });
        }
        return {
          roomKey: `booking-${row.id}`,
          name: row.sku_name || sku?.room_name || `#${row.room_type_id}`,
          price: Number(sku?.base_price ?? 0),
          quantity: row.quantity,
          cover: (cover ? { uri: cover } : tempCoverFor(i)) as ImageSourcePropType,
          attrs,
        };
      }),
    [rows, skuOf, t],
  );

  if (loading) return <LoadingView />;
  if (error || !order) return <ErrorView message={error} onRetry={() => void load()} />;

  /* ---------------------------------------------------------------- 派生展示值 */
  const lead = rows[0];
  const hotelName = hotel?.goods_name ?? order.goods_name;
  const address = hotel?.address ?? '';
  /** 图库:商品详情的图能用几张用几张,一张都没有才回落设计稿临时图 */
  const gallery: ImageSourcePropType[] = (() => {
    const remote = hotel
      ? [hotel.cover_image, ...hotel.images]
          .map((uri) => resolveMediaUri(uri))
          .filter((uri): uri is string => uri !== null)
          .map((uri) => ({ uri }) as ImageSourcePropType)
      : [];
    return remote.length > 0 ? remote : TEMP_HOTEL_GALLERY;
  })();

  /** 整组的状态:全部同态就用它,不同态时按「我的预订」同一口径取最靠前的待办态 */
  const groupStatus = rows.reduce(
    (worst, row) => (orderStatusRank(row.order_status) < orderStatusRank(worst) ? row.order_status : worst),
    rows[0].order_status,
  );
  const confirmed = groupStatus !== ORDER_STATUS.PENDING;
  const tone = confirmed ? colors.statusPaid : colors.orange;

  const roomCount = rows.reduce((sum, row) => sum + row.quantity, 0);
  const nights = Math.max(1, nightsBetween(lead.use_date ?? '', lead.end_date ?? ''));
  const totalAmount =
    tripPayAmount ?? rows.reduce((sum, row) => sum + (Number(row.pay_amount) || 0), 0);
  /** 住客数:订单快照里没有,只能显示间数(稿面是「2 travelers, 2 rooms」两个字段) */
  const guestRoomLabel = t('order.bookingDetail.roomsValue', { rooms: roomCount });

  const facilities = ((skuOf(lead.room_type_id)?.facilities ?? []) as string[]).slice(0, 6);
  const breakfast = Boolean(skuOf(lead.room_type_id)?.breakfast);

  const copyId = () => {
    void Clipboard.setStringAsync(order.order_no);
    void showToast(t('hotels.booking.success.idCopied'));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <HotelGallery images={gallery} width={width} />

        <View style={styles.main}>
          {/* 标题卡 2659:16111 */}
          <View style={styles.titleCard}>
            <Text style={styles.hotelName}>{hotelName}</Text>
            {address ? (
              <View style={styles.addressRow}>
                <HomeIcon name="locationOutline" width={12} height={15} color={colors.textSoft} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {address}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 确认卡 2661:17072(与预订结果页同一个 Figma 组件,状态行组共用实现) */}
          <View style={styles.voucherCard}>
            <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
              <HomeIcon name={confirmed ? 'checkmarkCircle' : 'clock'} size={40} color={tone} />
            </View>
            <Text style={styles.resultTitle}>
              {t(
                confirmed
                  ? 'hotels.booking.success.confirmedTitle'
                  : 'hotels.booking.success.confirmingTitle',
              )}
            </Text>
            <Text style={styles.resultDesc}>
              {t(
                confirmed
                  ? 'hotels.booking.success.confirmedDesc'
                  : 'hotels.booking.success.confirmingDesc',
              )}
            </Text>
            <Text style={styles.voucherHotel}>{hotelName}</Text>

            <BookingStatusRows
              paymentLabel={t('hotels.booking.success.paymentStatus')}
              paymentBadge={t('hotels.booking.success.paid')}
              bookingLabel={t('hotels.booking.success.bookingStatus')}
              /* 一行一个预订:多房间标房号,单房间不标(与结果页同一口径) */
              rows={rows.map((row, i) => ({
                key: `status-${row.id}`,
                roomLabel: rows.length > 1 ? t('hotels.booking.success.statusRoom', { index: i + 1 }) : '',
                badge: t(ORDER_STATUS_I18N[row.order_status] ?? 'common.empty'),
                badgeIcon: row.order_status === ORDER_STATUS.PENDING ? 'clock' : 'checkmarkCircle',
                badgeColor: orderStatusColor(row.order_status),
              }))}
            />

            <View style={styles.idRow}>
              <Text style={styles.idLabel} numberOfLines={1}>
                {t('hotels.booking.success.bookingId')}
                <Text style={styles.idValue}>{order.order_no}</Text>
              </Text>
              <Pressable onPress={copyId} hitSlop={8}>
                <HomeIcon name="copy" width={17} height={20} color={colors.textSoft} />
              </Pressable>
            </View>
          </View>

          {/* 住宿网格 2659:16366 */}
          <View style={styles.grid}>
            <GridRow
              icon="calendar2"
              label={t('order.bookingDetail.checkInOut')}
              value={
                lead.use_date
                  ? t('order.bookingDetail.dateRange', {
                      checkIn: formatDayMonth(lead.use_date, i18n.language),
                      checkOut: formatDayMonth(lead.end_date ?? lead.use_date, i18n.language),
                      nights: nightsLabel(t, nights),
                    })
                  : '-'
              }
            />
            <GridRow
              icon="travelers"
              label={t('order.bookingDetail.guestsRooms')}
              value={guestRoomLabel}
            />
            <View style={styles.gridDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('order.bookingDetail.totalAmount')}</Text>
              <Text style={styles.totalValue}>{formatMoney(totalAmount, currency)}</Text>
            </View>
          </View>

          {/* 已选房型 2659:16386 —— 复用复核页那张卡,订单已成立故不给 Edit 入口 */}
          <SelectedRoomsCard rooms={rooms} />

          {/* 房型设施 2659:16168 */}
          {facilities.length > 0 ? (
            <View style={styles.amenitiesCard}>
              <Text style={styles.sectionTitle}>{t('order.bookingDetail.roomAmenities')}</Text>
              <View style={styles.amenityGrid}>
                {facilities.map((label) => {
                  const meta = facilityMeta(label);
                  return (
                    <View key={label} style={styles.amenityItem}>
                      <View style={styles.amenityIcon}>
                        <HomeIcon name={meta.icon} size={meta.size} color={colors.primary} />
                      </View>
                      <Text style={styles.amenityText} numberOfLines={2}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* 含早卡 2659:16208 —— 只有房型含早才出 */}
          {breakfast ? (
            <View style={styles.breakfastCard}>
              <View style={styles.breakfastIcon}>
                <HomeIcon name="breakfast" size={25} color={colors.primary} />
              </View>
              <View style={styles.flexCol}>
                <Text style={styles.breakfastTitle}>
                  {t('order.bookingDetail.breakfastTitle')}
                </Text>
                <Text style={styles.breakfastDesc}>{t('order.bookingDetail.breakfastDesc')}</Text>
              </View>
            </View>
          ) : null}

          {/* 联系物业 2659:16217 */}
          <View style={styles.contactGroup}>
            <Text style={styles.sectionTitle}>{t('order.bookingDetail.contactProperty')}</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={comingSoon}
            >
              <HomeIcon name="chatFilled" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{t('order.bookingDetail.messageProperty')}</Text>
            </Pressable>

            <View style={styles.addressCard}>
              <View style={styles.addressCardTop}>
                <View style={styles.addressIcon}>
                  <HomeIcon name="locationFilled" size={20} color={colors.primary} />
                </View>
                <View style={styles.flexCol}>
                  <Text style={styles.addressFull}>{address || t('common.empty')}</Text>
                  <Pressable onPress={comingSoon} hitSlop={6}>
                    <Text style={styles.linkText}>{t('order.bookingDetail.getDirections')}</Text>
                  </Pressable>
                </View>
              </View>
              {/* 稿面这里是静态地图图片,项目没有地图 SDK/静态图服务 → 色块占位 + 胶囊 */}
              <Pressable
                style={({ pressed }) => [styles.mapBox, pressed && styles.pressed]}
                onPress={comingSoon}
              >
                <View style={styles.mapPill}>
                  <HomeIcon name="map" size={16} color="#FFFFFF" />
                  <Text style={styles.mapPillText}>{t('order.bookingDetail.viewOnMap')}</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* 支持卡 2659:16243 */}
          <View style={styles.supportCard}>
            <View style={styles.supportHead}>
              <Text style={styles.sectionTitle}>{t('order.bookingDetail.support')}</Text>
              <View style={styles.supportRef}>
                <Text style={styles.supportRefLabel}>
                  {t('order.bookingDetail.bookingReference')}
                </Text>
                <Text style={styles.supportRefValue}>{order.order_no}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.helpRow, pressed && styles.pressed]}
              onPress={comingSoon}
            >
              <View style={styles.helpLeft}>
                <HomeIcon name="questionCircle" size={20} color={colors.primary} />
                <Text style={styles.helpText}>{t('order.bookingDetail.helpCenter')}</Text>
              </View>
              <HomeIcon name="chevronRight" size={12} color={colors.textSoft} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
              onPress={comingSoon}
            >
              <HomeIcon name="headset" size={20} color={colors.primary} />
              <Text style={styles.chatBtnText}>{t('order.bookingDetail.liveChat')}</Text>
            </Pressable>
          </View>

          {/* 底部操作 2659:16265 */}
          <View style={styles.actions}>
            {/* 稿面 opacity .5:后端没有改期/改信息接口,照稿禁用 */}
            <View style={[styles.ghostBtn, styles.disabled]}>
              <Text style={styles.ghostText}>{t('order.bookingDetail.modifyBooking')}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              /* 取消流程(Figma 1205:2159 → 1205:2480 → 1205:2679);按 PRD 只取消这一个 booking */
              onPress={() => navigation.navigate('CancelBooking', { orderId: order.id })}
            >
              <Text style={[styles.ghostText, styles.dangerText]}>
                {t('order.bookingDetail.cancelBooking')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* 悬浮顶栏 2659:16270(声明在滚动容器之后,否则列表会盖住它、返回键点不动) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.topBack, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          <Text style={styles.topTitle}>{t('order.bookingDetail.title')}</Text>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable style={styles.topIconBtn} onPress={comingSoon} hitSlop={6}>
            <HomeIcon name="share" width={18} height={20} color={colors.body} />
          </Pressable>
          <Pressable style={styles.topIconBtn} onPress={comingSoon} hitSlop={6}>
            <HomeIcon name="bellOutline" size={20} color={colors.body} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** 住宿网格的一行:40 圆底图标 + 小标题 + 值 */
function GridRow({
  icon,
  label,
  value,
}: {
  icon: 'calendar2' | 'travelers';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.gridRow}>
      <View style={styles.gridIcon}>
        <HomeIcon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.flexCol}>
        <Text style={styles.gridLabel}>{label}</Text>
        <Text style={styles.gridValue}>{value}</Text>
      </View>
    </View>
  );
}

/** 设施文案 → 图标(与酒店详情 Rooms 页签同一套映射) */
function facilityMeta(label: string) {
  const key = label.toLowerCase();
  if (key.includes('breakfast') || key.includes('餐')) return ROOM_FACILITY_ICONS.breakfast;
  if (key.includes('pool') || key.includes('泳')) return ROOM_FACILITY_ICONS.pool;
  if (key.includes('parking') || key.includes('停')) return ROOM_FACILITY_ICONS.parking;
  return ROOM_FACILITY_ICONS.wifi;
}

/** 组状态取「最靠前的待办态」,与「我的预订」归并卡同一优先级 */
function orderStatusRank(status: number): number {
  const priority: number[] = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.REFUNDING,
    ORDER_STATUS.PAID,
    ORDER_STATUS.USED,
    ORDER_STATUS.FINISHED,
    ORDER_STATUS.REFUNDED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.EXPIRED,
  ];
  const i = priority.indexOf(status);
  return i === -1 ? priority.length : i;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 16, gap: 24 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  /* ---- 悬浮顶栏 ---- */
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  topBack: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },

  /* ---- 标题卡 ---- */
  titleCard: {
    width: '100%',
    gap: 4,
    padding: 21,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },
  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 确认卡 ---- */
  voucherCard: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surface,
    shadowColor: '#4E73FF',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 3,
  },
  iconWrap: {
    width: 96,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  resultTitle: {
    width: '100%',
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.96,
    textAlign: 'center',
    color: colors.heading,
  },
  resultDesc: {
    width: '100%',
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
  voucherHotel: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.heading,
  },
  idRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  idLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 28,
    color: colors.textSoft,
  },
  idValue: { fontFamily: fonts.interSemi, color: colors.heading },

  /* ---- 住宿网格 ---- */
  grid: {
    width: '100%',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(196, 197, 215, 0.2)',
    backgroundColor: colors.surface,
  },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gridIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(32, 77, 218, 0.1)',
  },
  gridLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.textSoft,
  },
  gridValue: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  gridDivider: { height: 1, backgroundColor: colors.softBlue },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  totalValue: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: colors.primary },

  /* ---- 房型设施 ---- */
  sectionTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  amenitiesCard: {
    width: '100%',
    gap: 24,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 24, columnGap: 24 },
  amenityItem: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amenityIcon: {
    height: 40,
    minWidth: 32,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#E5EEFF',
  },
  amenityText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  /* ---- 含早卡 ---- */
  breakfastCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: 'rgba(65, 105, 237, 0.05)',
  },
  breakfastIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(32, 77, 218, 0.1)',
  },
  breakfastTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: '#204DDA' },
  breakfastDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  /* ---- 联系物业 ---- */
  contactGroup: { width: '100%', gap: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
  addressCard: {
    width: '100%',
    gap: 24,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    shadowColor: '#4E73FF',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addressCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  addressIcon: { padding: 12, borderRadius: 8, backgroundColor: colors.softBlue },
  addressFull: { fontFamily: fonts.inter, fontSize: 15, lineHeight: 28, color: colors.heading },
  linkText: {
    paddingTop: 8,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  mapBox: {
    height: MAP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  mapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  mapPillText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },

  /* ---- 支持卡 ---- */
  supportCard: {
    width: '100%',
    gap: 24,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  supportHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  supportRef: { alignItems: 'flex-end' },
  supportRefLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  supportRefValue: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#0B1C30',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: 'rgba(196, 197, 215, 0.2)',
  },
  helpLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#0B1C30' },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: '#DBE2FA',
  },
  chatBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  /* ---- 底部操作 ---- */
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  ghostBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.heading,
  },
  dangerText: { color: colors.hot },
});
