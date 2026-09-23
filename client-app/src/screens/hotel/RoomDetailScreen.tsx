/**
 * 正常模式房型详情页(Figma M-Trip / Rooms Details `281:1041`)
 *
 * 酒店详情 Rooms 页签里真实房型卡的「See Details」落到这里(演示房型没有详情数据,仍是 comingSoon)。
 * 关怀模式另有一张 `RoomDetailLiteScreen`(稿 2352:6030,大字号、走 Lite 订房向导),两页不共用。
 *
 * 自上而下:大图(底部压 圆点 / 360° / 全景 / 张数)→ 房型信息卡 → Room Amenities 两列网格 →
 * Breakfast Highlight → Price Summary;顶栏(返回 / 通知 / 分享)悬浮在图上,底部吸底价格栏。
 *
 * **订房入口走购物车**:价格卡的「Book This Room」与底栏「Reserve now」都先把本房型放进
 * `roomCartStore`(已在车里就不动间数),再进 4 步订房向导 —— 与酒店详情 Rooms 页签的 Continue 同一入口。
 * 向导只要车里有东西就进 trip 模式、按整车下单,所以车里若已有别的房型会一并结算(这正是购物车语义)。
 * 加购参数与房型卡 Choose 共用 `realRoomCartEntry`,两个入口加进车的名称/封面/属性一致。
 *
 * 设计稿实测:
 *   信息卡 --tab 底,1px --secondary,圆角 24,padding 24,gap 16,阴影 Effect/DS:
 *          房型名 Inter 600/20/40 #0B1C30;「STARTS AT」Inter 600/12 大写 tracking .6 #434655
 *          + 价 Inter 700/16/24 主色;分隔线;参数行 Inter 500/14/20 --text-2(图标同房型卡)
 *   设施卡 同壳,gap 24:标题 Inter 600/24/32;两列网格 gap 24,条目 = 40 高 #E5EEFF 圆角 8 图标底
 *          + Inter 400/16/24 --text
 *   早餐卡 rgba(65,105,237,.05) 底,1px --secondary,圆角 24,padding 25,gap 16:
 *          64 圆底 rgba(32,77,218,.1) + 18.75x25 刀叉;标题 Inter 400/16 #204DDA;正文 Inter 400/16/24 #434655
 *   价格卡 同壳,padding 25,阴影 0/10 blur15 -3 + 0/4 blur6 -4(= shadows.raised):标题 Inter 600/24/32;
 *          明细行 左 Inter 400/16 --text-2 / 右 Inter 600/16 --text;合计行上边框、pt13,两侧 24/32;
 *          CTA 主色圆角 12 py16 Inter 400/16 白;脚注 Inter 600/12 tracking .6 --text-2
 *   底栏   与酒店详情页底栏同规格(Total Price / 金额 / -15% TODAY + Reserve now)
 *
 * **与稿面的偏差(无数据,不编造)**
 *   - 设施网格:`hotel_room_type.facilities` 是自由文本数组,接口给了就按关键词配图标平铺;
 *     没给才回落到设计稿那六项。稿面图标底宽度 27~40 不等(是稿面按字形收缩的),统一为 40 见方。
 *   - 税费行:同关怀模式页,后端实付里没有税费,值取占位 `TAX_AMOUNT = 0`(稿面自身的数也对不上)。
 *   - 早餐卡只在房型确实含早时出现;有入离日期时价格卡多一行晚数,合计 = 单价 × 晚数(与购物车同口径)。
 *   - 圆点按实际图片数渲染,只有一张时不画;backdrop-blur RN 无原生支持,只保留底色。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { realRoomCartEntry, realRoomCover } from '@/components/hotel/HotelRoomsTab';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_DEMO } from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';
import { nightsBetween, useRoomCartStore } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail } from '@/types/models';
import { formatMoney } from '@/utils/format';
import { resolveMediaUri } from '@/utils/media';

/** 设计稿顶部大图高度 */
const HERO_HEIGHT = 300;
/** 底部价格栏:pt17 + 内容 55(12/16 + 16/24 + 10/15)+ pb16,与酒店详情页同值 */
const BOTTOM_BAR_HEIGHT = 88;
/** 税费占位:后端无税费字段,见文件头 */
const TAX_AMOUNT = 0;

interface Amenity {
  key: string;
  icon: HomeIconName;
  width: number;
  height: number;
  label: string;
}

/** 设计稿那六项(接口没给设施时回落),图标尺寸取稿面原值 */
const DEMO_AMENITIES = [
  { key: 'highSpeedWifi', icon: 'wifiFilled', width: 24, height: 17 },
  { key: 'climateControl', icon: 'airConditioning', width: 20, height: 20 },
  { key: 'miniBar', icon: 'miniBar', width: 19, height: 20 },
  { key: 'smartTv', icon: 'smartTv', width: 20, height: 16 },
  { key: 'ensuiteBathroom', icon: 'bathroom', width: 20, height: 20 },
  { key: 'coffeeMachine', icon: 'coffeeMachine', width: 16, height: 20 },
] as const;

/** 真实设施是自由文本,按关键词配图标(配不上用对勾),尺寸同上 */
function amenityIcon(label: string): Pick<Amenity, 'icon' | 'width' | 'height'> {
  const key = label.toLowerCase();
  if (key.includes('wifi') || key.includes('网')) return { icon: 'wifiFilled', width: 24, height: 17 };
  if (key.includes('air') || key.includes('climate') || key.includes('空调'))
    return { icon: 'airConditioning', width: 20, height: 20 };
  if (key.includes('bar') || key.includes('酒')) return { icon: 'miniBar', width: 19, height: 20 };
  if (key.includes('tv') || key.includes('电视')) return { icon: 'smartTv', width: 20, height: 16 };
  if (key.includes('bath') || key.includes('浴') || key.includes('卫'))
    return { icon: 'bathroom', width: 20, height: 20 };
  if (key.includes('coffee') || key.includes('咖啡')) return { icon: 'coffeeMachine', width: 16, height: 20 };
  if (key.includes('breakfast') || key.includes('早')) return { icon: 'breakfast', width: 15, height: 20 };
  if (key.includes('pool') || key.includes('泳')) return { icon: 'outdoorPool', width: 20, height: 18 };
  if (key.includes('parking') || key.includes('停')) return { icon: 'parking', width: 20, height: 20 };
  return { icon: 'checkmarkCircle', width: 20, height: 20 };
}

export default function RoomDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'RoomDetail'>>().params;
  const insets = useSafeAreaInsets();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const cartPropertyId = useRoomCartStore((s) => s.propertyId);
  const cartToggle = useRoomCartStore((s) => s.toggle);
  const setCartContext = useRoomCartStore((s) => s.setContext);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchHotelDetail(params.goodsId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.goodsId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  const skuIndex = detail ? detail.skus.findIndex((s) => s.id === params.skuId) : -1;
  const sku = detail && skuIndex >= 0 ? detail.skus[skuIndex] : undefined;
  if (error || !detail || !sku) return <ErrorView message={error} onRetry={() => void load()} />;

  const price = Number(sku.base_price);
  /** 与购物车/详情页底栏同口径:缺日期按 1 晚 */
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const hasDates = Boolean(params.checkIn && params.checkOut);
  const total = price * nights + TAX_AMOUNT;

  /* 过滤脏值(后台实测填过 '111'),圆点与张数按实际可用图片数渲染 */
  const images = (sku.images ?? [])
    .map((uri) => resolveMediaUri(uri))
    .filter((uri): uri is string => uri !== null);

  const amenities: Amenity[] = sku.facilities?.length
    ? sku.facilities.map((label) => ({ key: label, label, ...amenityIcon(label) }))
    : DEMO_AMENITIES.map((item) => ({
        ...item,
        label: t(`hotels.detail.roomDetail.amenityList.${item.key}`),
      }));

  /**
   * Book This Room / Reserve now:本房型放进车(已在车里就不动间数)后进订房向导。
   * 车若属于别家酒店(理论上不会,本页只从详情页进来)先切上下文 —— `setContext` 换酒店会清车。
   */
  const book = () => {
    if (cartPropertyId !== detail.id) {
      setCartContext({
        propertyId: detail.id,
        hotelName: detail.goods_name,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      });
    }
    const entry = realRoomCartEntry(sku, skuIndex, t);
    const inCart = useRoomCartStore.getState().items.some((item) => item.roomKey === entry.roomKey);
    if (!inCart) cartToggle({ roomKey: entry.roomKey, price: entry.price, sku: entry.sku, ...entry.extra });
    navigation.navigate('HotelBooking', {
      roomKey: entry.roomKey,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      propertyId: detail.id,
      roomTypeId: sku.id,
    });
  };

  return (
    <View style={styles.root}>
      {/* 状态栏黑条(设计稿导航条),不随内容滚动 */}
      <View style={[styles.statusBar, { height: insets.top }]} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={realRoomCover(sku, skuIndex)} style={styles.heroImage} resizeMode="cover" />

          <View style={styles.heroOverlay} pointerEvents="box-none">
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : styles.dotIdle]} />
                ))}
              </View>
            ) : (
              <View />
            )}

            {/* 360° / 全景没有素材与接口,同房型卡走 comingSoon */}
            <View style={styles.pillRow}>
              <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={comingSoon}>
                <HomeIcon name="view360" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={comingSoon}>
                <HomeIcon name="panorama" width={20} height={16} color="#FFFFFF" />
              </Pressable>
              <View style={[styles.pill, styles.counter]}>
                <HomeIcon name="imageCopy" size={20} color="#FFFFFF" />
                <Text style={styles.counterText}>
                  {t('hotels.detail.photoCount', { index: 1, total: Math.max(1, images.length) })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.main}>
          {/* 房型信息 */}
          <View style={styles.card}>
            <Text style={styles.roomName} numberOfLines={2}>
              {sku.room_name ?? `#${sku.id}`}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.startsAt}>{t('hotels.detail.roomDetail.startsAt')}</Text>
              <Text style={styles.startsAtPrice}>{formatMoney(price, currency)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              <View style={styles.spec}>
                <HomeIcon name="guests" size={9.333} color={colors.body} />
                <Text style={styles.specText}>
                  {t('hotels.detail.rooms.guests', { guests: sku.max_guests ?? 2 })}
                </Text>
              </View>
              <View style={styles.spec}>
                <HomeIcon name="bedSize" width={11.667} height={8.167} color={colors.body} />
                <Text style={styles.specText}>{sku.bed_type || t('hotels.detail.rooms.beds.king')}</Text>
              </View>
              {sku.area ? (
                <View style={styles.spec}>
                  <HomeIcon name="roomArea" size={12.763} color={colors.body} />
                  <Text style={styles.specText}>{sku.area}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 房内设施(两列网格) */}
          <View style={[styles.card, styles.amenitiesCard]}>
            <Text style={styles.sectionTitle}>{t('hotels.detail.roomDetail.amenities')}</Text>
            <View style={styles.amenityGrid}>
              {amenities.map((item) => (
                <View key={item.key} style={styles.amenityItem}>
                  <View style={styles.amenityIcon}>
                    <HomeIcon name={item.icon} width={item.width} height={item.height} color={colors.primary} />
                  </View>
                  <Text style={styles.amenityText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 含早提示:只有房型确实含早才画 */}
          {sku.breakfast === 1 ? (
            <View style={styles.breakfast}>
              <View style={styles.breakfastIcon}>
                <HomeIcon name="breakfast" width={18.75} height={25} color={BREAKFAST_BLUE} />
              </View>
              <View style={styles.flexCol}>
                <Text style={styles.breakfastTitle}>{t('hotels.detail.roomDetail.breakfastTitle')}</Text>
                <Text style={styles.breakfastDesc}>{t('hotels.detail.roomDetail.breakfastDesc')}</Text>
              </View>
            </View>
          ) : null}

          {/* 价格汇总 */}
          <View style={[styles.card, styles.priceCard]}>
            <Text style={styles.sectionTitle}>{t('hotels.detail.roomDetail.priceSummary')}</Text>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('hotels.detail.roomDetail.pricePerNight')}</Text>
                <Text style={styles.summaryValue}>{formatMoney(price, currency)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('hotels.detail.roomDetail.taxAndFees')}</Text>
                <Text style={styles.summaryValue}>{formatMoney(TAX_AMOUNT, currency)}</Text>
              </View>
              {hasDates ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('hotels.detail.roomDetail.nights')}</Text>
                  <Text style={styles.summaryValue}>{nights}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('hotels.detail.totalPrice')}</Text>
                <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
              </View>
            </View>

            <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={book}>
              <Text style={styles.ctaText}>{t('hotels.detail.roomDetail.bookThisRoom')}</Text>
            </Pressable>

            <Text style={styles.footnote}>{t('hotels.detail.roomDetail.freeCancelNote')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* 顶部栏悬浮在大图上,不随内容滚动(同酒店详情页) */}
      <View style={[styles.topBar, { top: insets.top }]} pointerEvents="box-none">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="roomDetailTopBar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#roomDetailTopBar)" />
        </Svg>

        <Pressable
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.topBarRight}>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={comingSoon}
            hitSlop={8}
          >
            <HomeIcon name="bellOutline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={comingSoon}
            hitSlop={8}
          >
            <HomeIcon name="share" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* 底部价格栏(Mobile Bottom Bar 281:1184) */}
      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <View>
          <Text style={styles.barLabel}>{t('hotels.detail.totalPrice')}</Text>
          <Text style={styles.barPrice}>{formatMoney(total, currency)}</Text>
          <Text style={styles.barDiscount}>
            {t('hotels.detail.discountToday', { percent: DETAIL_DEMO.discountPercent })}
          </Text>
        </View>
        <Pressable style={({ pressed }) => [styles.reserveBtn, pressed && styles.pressed]} onPress={book}>
          <Text style={styles.reserveText}>{t('hotels.detail.roomDetail.reserveNow')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 早餐卡的蓝(稿面 #204DDA,不是 primary #4169ED) */
const BREAKFAST_BLUE = '#204DDA';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  statusBar: { backgroundColor: '#000000' },

  /* ---- 大图 ---- */
  hero: { width: '100%', height: HERO_HEIGHT, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotActive: { backgroundColor: '#FFFFFF' },
  dotIdle: { backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  pillRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  counter: { flexDirection: 'row', gap: 10 },
  counterText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },

  /* ---- 顶部栏 ---- */
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roundBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur,只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  /* ---- 内容区 ---- */
  main: { paddingTop: 16, paddingHorizontal: PAGE_PADDING, paddingBottom: 20, gap: 24 },
  card: {
    width: '100%',
    padding: 24,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  roomName: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 40,
    letterSpacing: -0.32,
    color: '#0B1C30',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  startsAt: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  startsAtPrice: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.softBlue },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  sectionTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  amenitiesCard: { gap: 24 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 24, columnGap: 24 },
  /* 两列:basis 40% + grow 撑满,每格 = (容器宽 − 列间距 24) / 2 */
  amenityItem: {
    flexGrow: 1,
    flexBasis: '40%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amenityIcon: {
    width: 40,
    height: 40,
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

  breakfast: {
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
  breakfastTitle: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: BREAKFAST_BLUE },
  breakfastDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  priceCard: { padding: 25, ...shadows.raised },
  summary: { gap: 12, paddingBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.softBlue,
  },
  totalLabel: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 32, color: colors.heading },
  totalValue: {
    flexShrink: 1,
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'right',
    color: colors.primary,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
    ...shadows.media,
  },
  ctaText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  footnote: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.textSoft,
  },

  /* ---- 底部价格栏(同酒店详情页) ---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: colors.card,
  },
  barLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.heading },
  barPrice: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
  barDiscount: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15, color: colors.emergencyFg },
  reserveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  reserveText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
