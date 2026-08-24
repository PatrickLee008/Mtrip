/**
 * 酒店搜索结果卡(Figma M-Trip / Long Stay Search Results 1695:6325 的 Card 7/2/6/5)
 *
 * 结构:封面(176 高,上下各压一条主色渐变条)+ 正文(名称 / 地址 / 价格与徽章)。
 *   渐变条上:左上角星级(star_level 颗 12px 星)、右上角收藏心;
 *             左下角评分与评价数、右下角评价档徽章(EXCELLENT)。
 *
 * 设计稿实测:
 *   卡片   白底,1px --secondary 描边,圆角 20,padding 1,投影 shadows.subtle
 *   渐变   上条 rgba(65,105,237,0.5) → 透明;下条透明 → rgba(65,105,237,0.5);两条都 padding 12
 *   心     rgba(0,0,0,0.25) 底、padding 4、圆角 40,内 16px 心
 *   评分行 「Rating: 9.3 」白 Inter 600/12 +「(1,230 Review)」--secondary Inter 400/12
 *   徽章   px12/py4 圆角 999,Inter 700/10:EXCELLENT 主色底白字、PREFERRED #EFF4FF 底主色字、
 *          HIGH DEMAND --tertiary 底白字、BEST SELLER 主色 10% 底主色字
 *   正文   padding 16 gap 4;名称 Outfit 600/16 #061C34 字距 0.14;
 *          地址 16px 图标 + Inter 400/12 行高 24;
 *          价格 Inter 600/16 主色 +「/ night」Inter 400/10 --text-2;
 *          促销小行 10px 两列:左列划线原价(可多条,--text-2)、右列说明标签(可多条)
 *
 * 数据来源分两路:
 *   - 真实数据(`/api/v1/app/goods/list`):评分接口暂不下发 → `goods.rating` 为空时评分行不渲染;
 *     徽章按 is_recommend → PREFERRED、is_hot → HIGH DEMAND 推导;
 *     促销小行由**公民价**推导(勾了 Myanmar Citizen 且公民起价更低时,划掉原价并显示省了多少)。
 *   - 演示数据(`screens/hotel/demoResults.ts`):`ratingTier` / `promo` / `badge` 三个可选属性
 *     直接照搬设计稿的文案与数值(SUMMER PROMO、Long Stay Not Supported、BEST SELLER 等)。
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts, text } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsItem } from '@/types/models';
import { formatMoney } from '@/utils/format';

const COVER_HEIGHT = 176;
/** 卡片圆角(设计稿 20,比首页卡的 32 小) */
const CARD_RADIUS = 20;
/** 评分达到该分数显示 EXCELLENT(真实数据走后端 5 分制) */
const EXCELLENT_FROM = 4.5;

/** 徽章/标签配色(键名对应设计稿的色彩变量) */
export type Tone = 'primary' | 'tint' | 'hot' | 'soft' | 'orange';

export interface CardBadge {
  text: string;
  tone: Tone;
}

export interface CardPromo {
  /** 划线原价(设计稿第二张卡有两条) */
  strike?: number[];
  /** 说明标签(如 SUMMER PROMO / 5% off for 7Nights / Long Stay Not Supported) */
  tags?: CardBadge[];
}

interface Props {
  goods: GoodsItem;
  /** goods.cover_image 为空时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  /** 是否已收藏(页面统一维护,未登录时恒 false) */
  favorite?: boolean;
  /** 勾了 Myanmar Citizen:有公民价时按公民价展示 */
  citizen?: boolean;
  /** 封面右下角的评价档徽章文案;不传时按 rating ≥ 4.5 显示 EXCELLENT */
  ratingTier?: string | null;
  /** 价格上方的促销小行;不传时按公民价推导 */
  promo?: CardPromo;
  /** 右下角徽章;不传时按 is_recommend / is_hot 推导 */
  badge?: CardBadge | null;
  onPress: (goods: GoodsItem) => void;
  onToggleFavorite: (goods: GoodsItem) => void;
}

export default function HotelResultCard({
  goods,
  coverSource,
  favorite = false,
  citizen = false,
  ratingTier,
  promo,
  badge,
  onPress,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  const currency = useSiteStore((s) => s.currency);

  /* 封面要按像素宽给 CoverImage:卡片是「整宽 - 页面左右内边距 - 1px 描边 - 1px 内边距」 */
  const coverWidth = winW - PAGE_PADDING * 2 - 2 - 2;

  const citizenPrice = goods.minPriceCitizen ?? 0;
  const hasCitizenPrice = citizen && citizenPrice > 0 && citizenPrice < goods.minPrice;
  const price = hasCitizenPrice ? citizenPrice : goods.minPrice;

  /* 促销小行:调用方没给就按公民价推导 */
  const shownPromo: CardPromo | undefined =
    promo ??
    (hasCitizenPrice
      ? {
          strike: [goods.minPrice],
          tags: [
            {
              text: t('hotels.results.citizenOff', {
                percent: Math.round(((goods.minPrice - citizenPrice) / goods.minPrice) * 100),
              }),
              tone: 'primary',
            },
          ],
        }
      : undefined);

  /* 评价档徽章:调用方没给就按评分推导 */
  const shownTier =
    ratingTier === undefined
      ? goods.rating && goods.rating >= EXCELLENT_FROM
        ? t('hotels.results.excellent')
        : null
      : ratingTier;

  /* 右下角徽章:调用方没给就按推荐/热门推导 */
  const shownBadge: CardBadge | null =
    badge === undefined
      ? goods.is_recommend === 1
        ? { text: t('home.stays.preferred'), tone: 'tint' }
        : goods.is_hot === 1
          ? { text: t('hotels.results.highDemand'), tone: 'hot' }
          : null
      : badge;

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
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="hotelCardTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelCardTop)" />
          </Svg>

          <View style={styles.stars}>
            {Array.from({ length: goods.star_level }).map((_, i) => (
              <HomeIcon key={i} name="star" size={12} color="#FFFFFF" />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
            onPress={() => onToggleFavorite(goods)}
            hitSlop={8}
          >
            <HomeIcon name={favorite ? 'heartFilled' : 'heart'} size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* 下渐变条:评分 + 评价档徽章(没有评分时整条不渲染) */}
        {goods.rating ? (
          <View style={styles.bottomBar} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="hotelCardBottom" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0.5} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelCardBottom)" />
            </Svg>

            <Text style={styles.ratingLine} numberOfLines={1}>
              <Text style={styles.ratingScore}>
                {t('hotels.results.rating', { score: goods.rating.toFixed(1) })}{' '}
              </Text>
              {goods.reviewCount ? (
                <Text style={styles.ratingCount}>
                  {t('hotels.results.reviews', {
                    reviews: goods.reviewCount.toLocaleString('en-US'),
                  })}
                </Text>
              ) : null}
            </Text>
            {shownTier ? <Badge badge={{ text: shownTier, tone: 'primary' }} /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[text.cardTitle, styles.title]} numberOfLines={1}>
            {goods.goods_name}
          </Text>
        </View>

        {goods.address ? (
          <View style={styles.addressRow}>
            <HomeIcon name="location" size={16} color={colors.textSoft} />
            <Text style={styles.address} numberOfLines={1}>
              {goods.address}
            </Text>
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <View>
            {shownPromo ? (
              /* 设计稿是两列:左列划线原价、右列说明标签,各自可堆多行 */
              <View style={styles.promoRow}>
                {shownPromo.strike?.length ? (
                  <View style={styles.promoCol}>
                    {shownPromo.strike.map((amount) => (
                      <Text key={amount} style={styles.promoStrike}>
                        {formatMoney(amount, currency)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {shownPromo.tags?.length ? (
                  <View style={styles.promoCol}>
                    {shownPromo.tags.map((tag) => (
                      <Text key={tag.text} style={[styles.promoTag, TONE_TEXT[tag.tone]]}>
                        {tag.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.priceLine}>
              <Text style={styles.price}>{formatMoney(price, currency)}</Text>
              <Text style={styles.perNight}>{t('home.stays.perNight')}</Text>
            </View>
          </View>

          {shownBadge ? <Badge badge={shownBadge} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Badge({ badge }: { badge: CardBadge }) {
  return (
    <View style={[styles.badge, TONE_BG[badge.tone]]}>
      <Text style={[styles.badgeText, TONE_TEXT[badge.tone]]}>{badge.text}</Text>
    </View>
  );
}

/** 徽章底色(soft = 设计稿 BEST SELLER 的主色 10%) */
const TONE_BG = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  tint: { backgroundColor: colors.tintBg },
  hot: { backgroundColor: colors.hot },
  soft: { backgroundColor: 'rgba(65, 105, 237, 0.1)' },
  orange: { backgroundColor: 'transparent' },
});

/** 前景色:主色底与红底上是白字,其余是自身色 */
const TONE_TEXT = StyleSheet.create({
  primary: { color: '#FFFFFF' },
  tint: { color: colors.primary },
  hot: { color: '#FFFFFF' },
  soft: { color: colors.primary },
  orange: { color: colors.orange },
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 1,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...shadows.subtle,
  },
  pressed: { opacity: 0.9 },

  cover: {
    height: COVER_HEIGHT,
    overflow: 'hidden',
    borderTopLeftRadius: CARD_RADIUS - 1,
    borderTopRightRadius: CARD_RADIUS - 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heart: {
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  ratingLine: { flexShrink: 1 },
  ratingScore: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  ratingCount: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.softBlue,
  },

  body: { padding: 16, gap: 4 },
  titleRow: { paddingVertical: 4 },
  title: { letterSpacing: 0.14 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: {
    flex: 1,
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  promoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  promoCol: { gap: 4 },
  promoStrike: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    color: colors.textSoft,
    textDecorationLine: 'line-through',
  },
  promoTag: { fontFamily: fonts.interSemi, fontSize: 10 },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
  perNight: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSoft,
  },

  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15 },
});
