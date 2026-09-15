/**
 * 关怀模式酒店结果卡(Figma `Hotel Search Lite` / Search Results `2312:6745` 的 Card 2/5/6/7)
 *
 * 与完整模式的 `components/hotel/HotelResultCard` 是**两份**而不是一份带开关的:
 * 关怀版把每个元素都放大了一档(星 12→24、心 20→32、酒店名 16→24、价格 16→20),
 * 去掉了地址行与右下角徽章,并且多了一枚 Choose 按钮 —— 与首页 / 我的精选那两对 Lite/完整
 * 页面同一处理方式(见 HANDOFF「关怀模式落地三屏」:版式差得远就不塞进同一个组件)。
 *
 * 设计稿实测:
 *   卡片   白底,1px --secondary 描边,圆角 24,投影 0/1 blur2 黑 5%;内边距 1(描边内的一圈)
 *   封面   高 176,上下各压一条渐变(自 `--primary` 50% 透明到全透)
 *   上条   p12:左侧星级(24 一枚,gap4)+ 右侧收藏(黑 25% 圆底 p4,图标 32)
 *   下条   p12:左下角评价档药丸(主色底,px12 py4,Inter 700/16 白色大写)
 *   正文   p16 gap4:酒店名 Outfit Medium 24/20 #061C34;
 *          价格行 = 左(可选删除线原价 + 促销标签 12)+ 主价 Inter 600/20/24 主色 + "/ night" 16/15 --text-2,
 *          右 Choose 按钮(主色,圆角 16,px16 py8,Inter 500/20 白色)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsItem } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 设计稿封面高;评分达到这个分数才挂 EXCELLENT(与完整模式同一口径) */
const COVER_HEIGHT = 176;
const EXCELLENT_FROM = 4.5;

interface Props {
  goods: GoodsItem;
  /** `goods.cover_image` 为空时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  favorite?: boolean;
  /** 勾了 Myanmar Citizen:有公民价时按公民价展示,并把原价划掉 */
  citizen?: boolean;
  onPress: (goods: GoodsItem) => void;
  onToggleFavorite: (goods: GoodsItem) => void;
}

export default function LiteHotelCard({
  goods,
  coverSource,
  favorite = false,
  citizen = false,
  onPress,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  const currency = useSiteStore((s) => s.currency);

  /* 封面按像素宽给 CoverImage:整宽 − 页面左右内边距 − 1px 描边 ×2 − 1px 内边距 ×2 */
  const coverWidth = winW - PAGE_PADDING * 2 - 4;

  const citizenPrice = goods.minPriceCitizen ?? 0;
  const hasCitizenPrice = citizen && citizenPrice > 0 && citizenPrice < goods.minPrice;
  const price = hasCitizenPrice ? citizenPrice : goods.minPrice;
  const tier = goods.rating && goods.rating >= EXCELLENT_FROM ? t('hotels.results.excellent') : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(goods)}
    >
      <View style={styles.cover}>
        <CoverImage
          uri={goods.cover_image}
          fallback={coverSource}
          width={coverWidth}
          height={COVER_HEIGHT}
          label={goods.goods_name}
        />

        {/* 上渐变条:星级 + 收藏 */}
        <View style={styles.topBar} pointerEvents="box-none">
          <EdgeGradient id="liteCardTop" reverse />
          <View style={styles.stars}>
            {Array.from({ length: goods.star_level }).map((_, i) => (
              <HomeIcon key={i} name="star" size={24} color="#FFFFFF" />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
            onPress={() => onToggleFavorite(goods)}
            hitSlop={8}
          >
            <HomeIcon name={favorite ? 'heartFilled' : 'heart'} size={32} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* 下渐变条:评价档药丸(没有评分就整条不画,免得留一条空渐变) */}
        {tier ? (
          <View style={styles.bottomBar} pointerEvents="none">
            <EdgeGradient id="liteCardBottom" />
            <View style={styles.tier}>
              <Text style={styles.tierText}>{tier}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {goods.goods_name}
        </Text>

        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            {hasCitizenPrice ? (
              <View style={styles.strikeRow}>
                <Text style={styles.strike}>{formatMoney(goods.minPrice, currency)}</Text>
                <Text style={styles.promo}>
                  {t('hotels.results.citizenOff', {
                    percent: Math.round(((goods.minPrice - citizenPrice) / goods.minPrice) * 100),
                  })}
                </Text>
              </View>
            ) : null}
            <View style={styles.priceLine}>
              <Text style={styles.price}>{formatMoney(price, currency)}</Text>
              <Text style={styles.perNight}>{t('hotels.lite.perNight')}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.choose, pressed && styles.pressed]}
            onPress={() => onPress(goods)}
          >
            <Text style={styles.chooseText}>{t('hotels.lite.choose')}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** 封面上下那两条渐变(主色 50% → 透明);`reverse` = 自上而下由深到浅 */
function EdgeGradient({ id, reverse = false }: { id: string; reverse?: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={reverse ? 0.5 : 0} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={reverse ? 0 : 0.5} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...shadows.subtle,
  },
  pressed: { opacity: 0.85 },

  cover: { width: '100%', height: COVER_HEIGHT, borderRadius: 22, overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heart: {
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  tier: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  tierText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 18,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  body: { padding: 16, gap: 4 },
  name: {
    paddingVertical: 4,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0.14,
    color: colors.cardTitle,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  priceCol: { flex: 1, minWidth: 0 },
  strikeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  strike: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
    textDecorationLine: 'line-through',
  },
  promo: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.hot },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingVertical: 4 },
  price: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
  perNight: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 20, color: colors.textSoft },

  choose: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  chooseText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
});
