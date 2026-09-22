/**
 * 多酒店行程详情(Figma `2142:4389` Multihotel Booking Edit booking)
 *
 * 一个 Trip 下的**多段住宿**各占一张卡,按入住日先后排成时间轴:
 *   序号圆(40,主色底 + 4px `--secondary` 描边)+「Stay n」→ 左侧竖线 → 住宿卡。
 * 每张卡就是「我的预订」那张卡的 `stay` 变体(同组件,不同壳)—— 稿面除了卡壳与封面位置,
 * PAID 胶囊 / 酒店名·地址·房型 / DATES·TRAVELERS 两格 / 按钮行 / Booking ID 行全都一样。
 *
 * **定位是只读的行程详情**(与用户 2026-09-22 确认):稿子文件名叫「Edit booking」,
 * 但后端没有任何改期/改信息接口,所以这里不做编辑,只做「看整个行程 + 进单段详情」。
 * 单段的「View Details」进 `BookingDetail`(那一页才展开房型/设施/联系物业/取消入口)。
 *
 * 取数:`order/trip/detail`(后端已按 `use_date` 排序,正好是 PRD 的 Trip Timeline)
 *      + 对每个**不同物业**各拉一次 `hotels/detail` 补地址与封面(订单快照里没有地址)。
 *      物业数 = 段数 ≤ 10,且同物业只拉一次。
 *
 * 设计稿实测:
 *   页面   `--background` 底;Main px16 py80(顶部给悬浮顶栏留位),段间 gap24
 *   段头   40 圆:主色底 + 4px `--secondary` 描边 + Effect/DS;序号白字 20/28;
 *          右「Stay n」Inter 600/16 主色;gap10
 *   竖线   段头下方左侧缩进 18、与卡 gap20 的一条 2px `--secondary` 竖线
 *   住宿卡 `--tab` 底 1px `--secondary` **圆角 32** p25 gap16 投影 Effect/DS;
 *          封面内嵌 176 高圆角 20;右上 PAID 胶囊;底部 View Details + 44 方地图按钮;
 *          最后一行是「Booking ID: 」+ 复制
 *
 * ⚠️ 稿面序号字是 Plus Jakarta Bold,本项目没装该字族(只加载 Outfit + Inter),用 Inter 700 顶替。
 * ⚠️ 地图按钮 comingSoon(没有地图 SDK,与订单详情页同一处理)。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { fetchTripDetail, type TripBookingRow } from '@/api/trip';
import { tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import BookingCard from '@/components/mypick/BookingCard';
import { ORDER_STATUS_I18N } from '@/config/global';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { orderStatusColor } from '@/screens/mypick/useMyPickData';
import { useCommonStore } from '@/store/commonStore';
import { formatDate } from '@/utils/format';

export default function TripDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const { tripId } = route.params;
  const [stays, setStays] = useState<TripBookingRow[]>([]);
  /** 物业地址:订单快照里没有,按 property_id 各拉一次商品详情补上(同物业只拉一次) */
  const [addresses, setAddresses] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contentWidth, setContentWidth] = useState(width - PAGE_PADDING * 2);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trip = await fetchTripDetail(tripId);
      const rows = trip.bookings ?? [];
      setStays(rows);
      setError('');
      /* 地址补齐:失败不影响主内容(卡片的地址行不传就不渲染) */
      const ids = [...new Set(rows.map((r) => r.property_id).filter((id) => id > 0))];
      const details = await Promise.all(
        ids.map((id) => fetchHotelDetail(id).then((d) => [id, d.address] as const).catch(() => null)),
      );
      setAddresses(Object.fromEntries(details.filter((d): d is readonly [number, string] => d !== null)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.main,
          { paddingTop: insets.top + 80, paddingBottom: 32 + insets.bottom },
        ]}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width - PAGE_PADDING * 2)}
        showsVerticalScrollIndicator={false}
      >
        {stays.map((row, i) => (
          <View key={row.id} style={styles.stayGroup}>
            {/* 段头 2291:5401 */}
            <View style={styles.stayHead}>
              <View style={styles.stayBadge}>
                <Text style={styles.stayBadgeText}>{i + 1}</Text>
              </View>
              <Text style={styles.stayTitle}>
                {t('order.tripDetail.stay', { index: i + 1 })}
              </Text>
            </View>

            {/* 竖线 + 卡 2291:5406 */}
            <View style={styles.stayBody}>
              <View style={styles.stayLine} />
              <BookingCard
                variant="stay"
                width={contentWidth - 38}
                title={row.goods_name}
                coverUri={row.goods_image}
                coverSource={tempCoverFor(i)}
                address={addresses[row.property_id]}
                skuName={row.sku_name}
                bookingNo={row.order_no}
                statusLabel={t(ORDER_STATUS_I18N[row.order_status] ?? 'common.empty')}
                statusColor={orderStatusColor(row.order_status)}
                dates={
                  row.use_date
                    ? `${formatDate(row.use_date)}${row.end_date ? ` - ${formatDate(row.end_date)}` : ''}`
                    : '-'
                }
                travelers={t('myPick.booking.roomsValue', { rooms: row.quantity })}
                travelersLabel={t('myPick.booking.rooms')}
                /* 单段详情才展开房型/设施/取消入口 */
                onPressDetail={() => navigation.navigate('BookingDetail', { orderId: row.id })}
                onPressMap={comingSoon}
              />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 悬浮顶栏 2142:4558(声明在滚动容器之后,否则列表会盖住它) */}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  main: { paddingHorizontal: PAGE_PADDING, gap: 24 },
  pressed: { opacity: 0.85 },

  /* ---- 段头与时间轴 ---- */
  stayGroup: { gap: 4 },
  stayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stayBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.softBlue,
    backgroundColor: colors.primary,
    ...shadows.subtle,
  },
  /* 稿面是 Plus Jakarta Bold 20/28,本项目没装该字族 → Inter 700 顶替 */
  stayBadgeText: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 28, color: '#FFFFFF' },
  stayTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 16, color: colors.primary },
  stayBody: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingLeft: 18 },
  stayLine: { width: 2, alignSelf: 'stretch', backgroundColor: colors.softBlue },

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
});
