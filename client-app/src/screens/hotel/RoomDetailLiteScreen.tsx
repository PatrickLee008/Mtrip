/**
 * 关怀模式房型详情页(Figma `Hotel Details Lite` / Rooms Details `2352:6030`)
 *
 * 详情页房卡的「See Room」落到这里。自上而下:大图(顶部压主色渐变遮罩,底部压 圆点 / 张数 /
 * See 3D View / See 360 View)→ 房型信息卡 → Room Amenities → Breakfast Highlight → Price Summary。
 * **没有吸底栏** —— 稿里 `2352:6164 Mobile Bottom Bar` 是 `hidden="true"`,
 * CTA 由价格卡内的「Book This Room」承担。
 *
 * ⚠️ **大图连同覆盖控件都在滚动流里,不是绝对定位的浮层**。
 * 更早一版把大图垫在 ScrollView 底下、覆盖控件浮在最上层,结果滚动时
 * 「See 3D / 360 View」不跟着图走、一直悬在内容上方 —— 用户指出后改成了现在这样:
 * 大图是滚动区的第一个子元素,覆盖控件(含顶部遮罩)绝对定位在**大图内部**,一起滚、也点得到。
 * 只有返回键仍绝对定位压在图上(稿里 `2352:9557` 就是这么画的,标题与右侧按钮都 hidden)。
 *
 * 2026-09-18 **第三次逐节点复核**,按稿面改掉 11 处(稿面值 ← 旧值):
 *   ① 顶栏渐变遮罩 `2352:9557` 补齐(主色 50% → 透明,带高 80;此前完全没有)
 *   ② 返回胶囊底 `rgba(0,0,0,.25)`(旧 .4)   ③ 返回箭头 32(旧 20)
 *   ④ 大图 ↔ 内容 gap 10(旧:无)            ⑤ 覆盖层首行 alignItems flex-end(旧 center)
 *   ⑥ 设施卡 gap 24(旧:与信息卡共用 16 —— 本文件头早写着 24,是实现漏了)
 *   ⑦ 分组小标行高 16(旧 20)                ⑧ 属性行图标宽 20(旧 16)
 *   ⑨ 早餐卡 padding 24(旧 25)              ⑩ 价格卡 padding 24(旧 25)、合计行 paddingTop 12(旧 13)
 *   ⑪ 价格卡阴影 = `shadows.raised`(稿面 0/4 blur6 -4 + 0/10 blur15 -3;旧误用 subtle)、
 *      CTA 阴影 = `shadows.media`(稿面 0/2 blur4 -2 + 0/4 blur6 -1;旧没有)
 *
 * 设计稿实测:
 *   页面   底色 --background;内容区 padding 16,块间距 24
 *   信息卡 --tab 底,1px --secondary,圆角 32,padding 24,gap16:
 *          房型名 Inter 600/24/40 #0B1C30;「PRICE PER NIGHT」(Inter 600/12 大写 tracking .6 --text-2)
 *          + 价 Inter 700/20/24 主色;1px 分隔线;三项属性 Inter 500/16/20 --text-2(图标宽 20)
 *   设施卡 同壳(圆角 32 padding 24 **gap 24**):标题 Inter 600/24/32;
 *          分组小标 Inter 700/16/**16** 大写 tracking 1.2 主色;条目 gap20、文字 Inter 400/20/24 #0B1C30
 *   早餐卡 底 rgba(65,105,237,0.05),1px --secondary,圆角 32,**padding 24**,gap16:
 *          64 圆底(rgba(32,77,218,.1))+ 图标;标题 Inter 400/20 #204DDA;正文 Inter 400/16/24
 *   价格卡 --tab 底,1px --secondary,圆角 20,**padding 24**,gap16:标题 Inter 600/24/32;
 *          明细行 左 Inter 400/16 --text-2 / 右 Inter 600/20;合计行上边框 --secondary、padding 12 0 0,
 *          左 Inter 700/24/32、右 Inter 600/24/32 主色;CTA 主色圆角 12 py16 Inter 400/20 白(带 media 阴影);
 *          脚注 Inter 600/16 居中 --text-2
 *
 * **税费展示位**:稿面 `2352:6131` 有「Tax & Service Fees (15%)」行。本轮**画出展示位**,值取占位常量
 * `TAX_AMOUNT = 0` —— 后端 `PricingService` 算的实付里没有这笔税费,而且**稿面自己的数也对不上**
 * (212,750 + 27,75,Total 仍是 212,750),照抄会让本页 Total 与结账页实收不一致。
 * **后端出税费字段后,把 `TAX_AMOUNT` 换成接口值即可**(只改这一处)。
 *
 * **另两处偏差(后端没有对应数据,不编造)**
 *   1. 设施卡设计稿分了 ESSENTIALS / RECREATION / DINING 三组,`hotel_room_type.facilities`
 *      是一维字符串数组、没有分类字段 —— 接口给了就按真实值平铺一组(组标题「Room Amenities」),
 *      没给才回落到设计稿那三组(`DETAIL_AMENITY_GROUPS`,与 `HotelInfoLiteScreen` 同一份)。
 *   2. 「Loyalty Status Module」(会员积分模块)没做:App 侧没有会员权益接口,且稿里是 `hidden`。
 *
 * **未照抄的两处稿面细节(有意为之)**
 *   - 覆盖层两行在稿里写死宽 370(而可用宽 = 402 − 2×12 = 378,左右并不等距),判为稿面手工尺寸,按容器撑满。
 *   - 圆点数量不照稿的固定 3 枚(稿面 3 枚与旁边胶囊的 "2/12" 自相矛盾),按**实际图片数**渲染,
 *     只有一张时不画。
 *   - 三处 `backdrop-filter`(顶栏胶囊 blur4、大图胶囊 blur6、圆点条 blur6)RN 无原生支持,只保留底色。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { TEMP_HOTEL_COVERS } from '@/assets/tempImages';
import EdgeGradient from '@/components/common/EdgeGradient';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import { nightsBetween } from '@/components/hotel/booking/bookingFormat';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_AMENITY_GROUPS } from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';
import { resolveMediaUri } from '@/utils/media';

/** 设计稿顶部大图高度 */
const HERO_HEIGHT = 300;
/** 设计稿顶栏遮罩带高(稿里顶栏自身高 = 16 上下内边距 + 48 胶囊) */
const SCRIM_HEIGHT = 80;
/**
 * 税费占位:**后端无税费字段**(见文件头「税费展示位」),故这里置 0、**待后端**出字段后替换。
 * 后端 `PricingService` 算的实付里没有这笔税费,稿面自身的数也对不上(212,750 + 27,75,Total 仍 212,750)。
 */
const TAX_AMOUNT = 0;

export default function RoomDetailLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'RoomDetailLite'>>().params;
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

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
  /* 过滤脏值(后台实测填过 '111'),圆点与张数按实际可用图片数渲染 */
  const images = (sku.images ?? [])
    .map((uri) => resolveMediaUri(uri))
    .filter((uri): uri is string => uri !== null);
  const cover = images[0] ? { uri: images[0] } : TEMP_HOTEL_COVERS[0];

  const reserve = () =>
    navigation.navigate('HotelBookingLite', {
      propertyId: detail.id,
      roomTypeId: sku.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* 稿面 `2352:6031`:大图与内容块之间 gap 10(内容区自己另有 paddingTop 16) */}
          <View style={styles.heroBlock}>
            {/* 大图连同覆盖控件都在滚动流里,一起滚、也点得到(见文件头) */}
            <View style={styles.heroWrap}>
              <Image source={cover} style={styles.hero} resizeMode="cover" />

              {/* 稿面 `2352:9557` 的填充是主色渐变遮罩(Text Bg top):0deg 由透明到 rgba(65,105,237,.5)。
                  压在图上、位于覆盖控件之下,所以放最前面。 */}
              <View style={styles.heroScrim} pointerEvents="none">
                <EdgeGradient id="roomTopScrim" reverse />
              </View>

              {/* 覆盖控件绝对定位在**大图内部**:跟着图一起滚,也点得到。
                  圆点与张数按**实际图片数**渲染,只有一张就不画 */}
              <View style={styles.heroOverlay} pointerEvents="box-none">
                {/* 稿面 `2352:9540`:首行 align-items flex-end */}
                <View style={styles.heroRowTop}>
                  {images.length > 1 ? (
                    <View style={styles.dots}>
                      {images.map((_, i) => (
                        <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : styles.dotIdle]} />
                      ))}
                    </View>
                  ) : (
                    <View />
                  )}
                  {images.length > 1 ? (
                    <View style={styles.heroPill}>
                      <HomeIcon name="imageCopy" size={20} color="#FFFFFF" />
                      <Text style={styles.heroPillText}>
                        {t('hotels.detail.photoCount', { index: 1, total: images.length })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 3D / 360 都没有素材与接口,与实景预览页同一处理:走 comingSoon */}
                <View style={styles.heroRow}>
                  <Pressable
                    style={({ pressed }) => [styles.heroPill, pressed && styles.pressed]}
                    onPress={comingSoon}
                  >
                    <HomeIcon name="view360" size={20} color="#FFFFFF" />
                    <Text style={styles.heroPillText}>{t('hotels.lite.room.see3d')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.heroPill, pressed && styles.pressed]}
                    onPress={comingSoon}
                  >
                    <Text style={styles.heroPillText}>{t('hotels.lite.room.see360')}</Text>
                    <HomeIcon name="panorama" width={20} height={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.main}>
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

              {/**
               * 房内设施。设计稿分 ESSENTIALS / RECREATION / DINING 三组,但
               * `hotel_room_type.facilities` 是**一维自由文本数组、没有分类字段** ——
               * 所以:接口给了就按真实值平铺一组(不猜分类),没给才回落到设计稿那三组
               * (`DETAIL_AMENITY_GROUPS`,与 `HotelInfoLiteScreen` 同一份,两页不会给出不同的设施)。
               * 稿面这张卡的 gap 是 24(信息卡是 16),故本页单独覆盖。
               */}
              <View style={[styles.card, styles.amenitiesCard]}>
                <Text style={styles.sectionTitle}>{t('hotels.lite.room.amenities')}</Text>
                {sku.facilities?.length ? (
                  <View style={styles.amenityList}>
                    {sku.facilities.map((item) => (
                      <View key={item} style={styles.amenityItem}>
                        <HomeIcon name="checkmarkCircle" size={20} color={colors.primary} />
                        <Text style={styles.amenityText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  DETAIL_AMENITY_GROUPS.map((group) => (
                    <View key={group.key} style={styles.amenityGroup}>
                      <Text style={styles.groupTitle}>
                        {t(`hotels.detail.amenityGroups.${group.key}`)}
                      </Text>
                      <View style={styles.amenityList}>
                        {group.items.map((item) => (
                          <View key={item.key} style={styles.amenityItem}>
                            <HomeIcon name={item.icon} size={20} color={colors.primary} />
                            <Text style={styles.amenityText}>
                              {t(`hotels.detail.amenityList.${item.key}`)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </View>

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
                {/* 稿面 `2352:6131` 的税费行:值取占位常量,见文件头「税费展示位」 */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('hotels.lite.room.taxAndFees')}</Text>
                  <Text style={styles.summaryValue}>{formatMoney(TAX_AMOUNT, currency)}</Text>
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
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 返回键压在图上(稿里 `2352:9557` 只有这一枚,标题与右侧按钮都是 hidden) */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={32} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Meta({ icon, text }: { icon: 'people' | 'bedSize' | 'roomArea'; text: string }) {
  return (
    <View style={styles.meta}>
      <HomeIcon name={icon} size={20} color={colors.textSoft} />
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
  scroll: { paddingBottom: 32 },
  /* 稿面 `2352:6031`:大图与内容块 gap 10 */
  heroBlock: { gap: 10 },
  heroWrap: { width: '100%', height: HERO_HEIGHT },
  hero: { width: '100%', height: '100%' },
  /* 稿面 `2352:9557` 的渐变填充,带高 80 */
  heroScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: SCRIM_HEIGHT },

  topBar: { position: 'absolute', left: 20, top: 16 },
  /* 稿面 `2352:9558`:底 rgba(0,0,0,.25) + blur(4) + opacity .8;blur 与整体透明度 RN 不还原,只留底色 */
  backPill: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
    paddingTop: 16,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 32,
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
  /* 稿面 `2352:6071`:设施卡的 gap 是 24(信息卡 16,不动共用样式) */
  amenitiesCard: { gap: 24 },
  roomName: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 40,
    letterSpacing: -0.32,
    color: '#0B1C30',
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
  amenityGroup: { gap: 12 },
  /* 稿面 `style_db23f563`:Inter 700/16,行高 16 */
  groupTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
  },
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
    padding: 24,
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

  /* 稿面 `2352:6121`:padding 24,圆角 20;阴影 `2352:6122` = 0/4 blur6 -4 + 0/10 blur15 -3,
     与 theme 的 `shadows.raised` 规格逐字一致(覆盖共用 card 的 subtle) */
  priceCard: { borderRadius: 20, padding: 24, ...shadows.raised },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.heading },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.softBlue,
  },
  totalLabel: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 32, color: colors.heading },
  totalValue: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.primary },

  /* CTA 阴影 = 稿面 `2352:6142`(0/2 blur4 -2 + 0/4 blur6 -1),与 theme 的 `shadows.media` 同规格 */
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
    ...shadows.media,
  },
  ctaText: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
  footnote: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.textSoft,
  },

  /* ---- 大图底部覆盖层(设计稿 `2352:6033`) ---- */
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 4,
    padding: 12,
  },
  /* 稿面 `2352:9540`:首行 align-items flex-end(圆点条与张数胶囊底对齐) */
  heroRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  /* 设计稿还叠了 6px 背景模糊,RN 无原生 backdrop-blur,只保留底色(同图库) */
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
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  heroPillText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
});
