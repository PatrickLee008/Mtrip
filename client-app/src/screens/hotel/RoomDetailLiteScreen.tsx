/**
 * 关怀模式房型详情页(Figma `Hotel Details Lite` / Rooms Details `2352:6030`)
 *
 * 详情页房卡的「See Room」落到这里。自上而下:大图 → 顶栏 → 房型信息卡 → Room Amenities
 * → Breakfast Highlight → Price Summary → 吸底栏(单价 + Reserve now)。
 *
 * 设计稿实测:
 *   页面   底色 --background;内容区 padding 16,块间距 24
 *   信息卡 --tab 底,1px --secondary,圆角 32,padding 24,gap16:
 *          房型名 Inter 600/24/40 #0B1C30;「PRICE PER NIGHT」(Inter 600/12 大写 tracking .6 --text-2)
 *          + 价 Inter 700/20/24 主色;1px 分隔线;三项属性 Inter 500/16/20 --text-2
 *   设施卡 同壳(圆角 32 padding 24 gap24):标题 Inter 600/24/32;
 *          分组小标 Inter 700/16 大写 tracking 1.2 主色;条目 gap12、文字 Inter 400/20/24 #0B1C30
 *   早餐卡 底 rgba(65,105,237,0.05),1px --secondary,圆角 32,padding 25,gap16:
 *          64 圆底(rgba(32,77,218,.1))+ 图标;标题 Inter 400/20 #204DDA;正文 Inter 400/16/24
 *   价格卡 --tab 底,1px --secondary,圆角 20,padding 25,gap16:标题 Inter 600/24/32;
 *          明细行 左 Inter 400/16 --text-2 / 右 Inter 600/20;合计行上边框 --secondary,
 *          左 Inter 700/24/32、右 Inter 600/24/32 主色;CTA 主色圆角 12 py16 Inter 400/20 白;
 *          脚注 Inter 600/16 居中 --text-2
 *
 * **与设计稿的三处偏差(都是后端没有对应数据,不编造)**
 *   1. 设施卡设计稿分了 ESSENTIALS / RECREATION / DINING 三组,`hotel_room_type.facilities`
 *      是一维字符串数组,没有分类字段 —— 这里平铺一组,组标题用「Room Amenities」。
 *   2. 价格卡的「Tax & Service Fees (15%)」**没做**:下单接口算的实付里没有这笔税费
 *      (见 order-service PricingService),画上去会与结账页对不上。
 *      有入离日期时改成「单价 × 晚数」,没有日期就只显示单价。
 *   3. 「Loyalty Status Module」(会员积分模块)没做:App 侧没有会员权益接口。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { TEMP_HOTEL_COVERS } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import { nightsBetween } from '@/components/hotel/booking/bookingFormat';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 设计稿顶部大图高度 */
const HERO_HEIGHT = 260;

export default function RoomDetailLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'RoomDetailLite'>>().params;
  const currency = useSiteStore((s) => s.currency);

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

  const sku: GoodsSku | undefined = detail?.skus.find((s) => s.id === params.skuId);

  /** 有入离日期就按晚数算合计,没有就只显示单价(不编税费,见文件头说明) */
  const nights = useMemo(
    () =>
      params.checkIn && params.checkOut ? Math.max(1, nightsBetween(params.checkIn, params.checkOut)) : 0,
    [params.checkIn, params.checkOut],
  );

  if (loading) return <LoadingView />;
  if (error || !detail || !sku) return <ErrorView message={error} onRetry={() => void load()} />;

  const price = Number(sku.base_price);
  const total = nights > 0 ? price * nights : price;
  const cover = sku.images?.[0] ? { uri: sku.images[0] } : TEMP_HOTEL_COVERS[0];

  const reserve = () =>
    navigation.navigate('HotelBookingLite', {
      propertyId: detail.id,
      roomTypeId: sku.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    });

  return (
    <View style={styles.root}>
      <Image source={cover} style={styles.hero} resizeMode="cover" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {t('hotels.lite.room.title')}
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          {/* 房型信息 */}
          <View style={styles.card}>
            <Text style={styles.roomName}>{sku.room_name ?? `#${sku.id}`}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('hotels.lite.room.pricePerNight')}</Text>
              <Text style={styles.priceValue}>{formatMoney(price, currency)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              {sku.max_guests ? (
                <Meta icon="people" text={t('hotels.lite.guestsCount', { count: sku.max_guests })} />
              ) : null}
              {sku.bed_type ? <Meta icon="bedSize" text={sku.bed_type} /> : null}
              {sku.area ? <Meta icon="roomArea" text={sku.area} /> : null}
            </View>
          </View>

          {/* 房内设施 */}
          {sku.facilities?.length ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('hotels.lite.room.amenities')}</Text>
              <View style={styles.amenityList}>
                {sku.facilities.map((item) => (
                  <View key={item} style={styles.amenityItem}>
                    <HomeIcon name="checkmarkCircle" size={20} color={colors.primary} />
                    <Text style={styles.amenityText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 含早提示:只有房型确实含早才画 */}
          {sku.breakfast === 1 ? (
            <View style={styles.breakfast}>
              <View style={styles.breakfastIcon}>
                <HomeIcon name="breakfast" size={28} color="#204DDA" />
              </View>
              <View style={styles.flexCol}>
                <Text style={styles.breakfastTitle}>{t('hotels.lite.room.breakfastTitle')}</Text>
                <Text style={styles.breakfastDesc}>{t('hotels.lite.room.breakfastDesc')}</Text>
              </View>
            </View>
          ) : null}

          {/* 价格汇总 */}
          <View style={[styles.card, styles.priceCard]}>
            <Text style={styles.sectionTitle}>{t('hotels.lite.room.priceSummary')}</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('hotels.lite.room.pricePerNightPlain')}</Text>
              <Text style={styles.summaryValue}>{formatMoney(price, currency)}</Text>
            </View>
            {nights > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('hotels.lite.room.nights')}</Text>
                <Text style={styles.summaryValue}>{nights}</Text>
              </View>
            ) : null}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('hotels.lite.totalPrice')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={reserve}
            >
              <Text style={styles.ctaText}>{t('hotels.lite.room.bookThisRoom')}</Text>
            </Pressable>

            <Text style={styles.footnote}>{t('hotels.lite.room.freeCancelNote')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 吸底栏 */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.bottomInner}>
          <View>
            <Text style={styles.bottomLabel}>{t('hotels.lite.room.startAt')}</Text>
            <Text style={styles.bottomPrice}>{formatMoney(price, currency)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.reserveBtn, pressed && styles.pressed]}
            onPress={reserve}
          >
            <Text style={styles.reserveText}>{t('hotels.lite.room.reserveNow')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Meta({ icon, text }: { icon: 'people' | 'bedSize' | 'roomArea'; text: string }) {
  return (
    <View style={styles.meta}>
      <HomeIcon name={icon} size={16} color={colors.textSoft} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },

  /** 同 `HotelsLiteScreen`:H5 端必须显式 `width:'100%'`,否则 RNW 会用图片固有宽度撑爆页面 */
  hero: { position: 'absolute', left: 0, top: 0, width: '100%', height: HERO_HEIGHT },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backPill: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  main: {
    paddingTop: HERO_HEIGHT - 120,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 120,
    gap: 24,
  },

  card: {
    width: '100%',
    padding: 24,
    gap: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  roomName: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.32,
    color: colors.cardTitle,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  priceValue: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.softBlue },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  sectionTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  amenityList: { gap: 20 },
  amenityItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amenityText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 20,
    lineHeight: 24,
    color: colors.cardTitle,
  },

  breakfast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 25,
    borderRadius: 32,
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
  breakfastTitle: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 24, color: '#204DDA' },
  breakfastDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  priceCard: { borderRadius: 20, padding: 25 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.heading },
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
  totalValue: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.primary },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
  footnote: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.6,
    color: colors.textSoft,
    textAlign: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
  },
  bottomLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  bottomPrice: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
  reserveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  reserveText: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
});
