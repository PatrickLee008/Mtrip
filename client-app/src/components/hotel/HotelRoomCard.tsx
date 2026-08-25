/**
 * 房型卡(Figma M-Trip / Hotel Details Rooms 222:1598「Room Card 1」)
 *
 * 设计稿实测:
 *   卡壳   `--tab` 底 / 1px `--secondary` 描边 / 圆角 32 / 投影 Effect/DS
 *   封面   370x192,上压主色渐变条(p20,自上而下主色 50%→透明):左 Bestseller 胶囊、右收藏心
 *          下压一行(p12):左圆点条、右 360°/全景/张数三枚胶囊(第三张卡设计稿只留张数一枚)
 *   正文   padding 16 / gap 12
 *     标题行  Outfit 600/16 + 余量胶囊(#D9E1FB 底、Inter 600/14 `--text-2`)+ 右「See Details」Outfit 500/12 主色
 *     参数行  三格两端对齐:人数 / 床型 / 面积,图标 + Inter 500/12 `--text-2`
 *     设施行  上下各一条分隔线,中间等分若干格:图标 + Inter 400/10 `--text-2` 居中
 *     价格行  左划线原价 + 促销小字(Inter 600/10)、主价 Inter 600/16 主色 +「/ night」
 *            右 Select 按钮(主色底 / 圆角 16 / px16 py8 / Inter 500/14 白)
 *
 * 设计稿的 backdrop-blur 在 RN 无原生等价,只保留半透明底色(同图库)。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface RoomFacility {
  key: string;
  icon: HomeIconName;
  /** 设计稿里这些字形原生尺寸不一(wifi 那枚是 16,其余是 20) */
  size: number;
  label: string;
}

interface Props {
  /**
   * 渐变 id 的种子,取房型 key 这类**稳定且是 ASCII 的**值。
   * 不能拿房型名去派生 —— 中文名经 `\W` 过滤后会变成空串,同屏三张卡撞成同一个 id。
   */
  gradientKey: string;
  cover: ImageSourcePropType;
  /** 封面右下角张数胶囊文案(设计稿写死 2/12) */
  photoCount: string;
  name: string;
  /** 「4 Left」这类余量角标,不传就不渲染 */
  leftLabel?: string | null;
  seeDetailsLabel: string;
  /** 参数行三格:人数 / 床型 / 面积 */
  guestsLabel: string;
  bedLabel: string;
  /** 设计稿 Family Suite 画了两个床图标 */
  bedCount: number;
  areaLabel: string;
  facilities: RoomFacility[];
  /** 划线原价(已格式化),不传就不渲染 */
  strike?: string | null;
  /** 促销小字,不传就不渲染 */
  promo?: string | null;
  price: string;
  perNightLabel?: string | null;
  selectLabel: string;
  bestsellerLabel?: string | null;
  favorite: boolean;
  /** 封面右下角是否带 360°/全景两枚按钮(设计稿只有前两张卡有) */
  viewer?: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onSelect: () => void;
  /** 360°/全景按钮点击(设计稿对应 VR View / 3d View 两张二级页,未实现) */
  onOpenViewer?: () => void;
}

export default function HotelRoomCard({
  gradientKey,
  cover,
  photoCount,
  name,
  leftLabel,
  seeDetailsLabel,
  guestsLabel,
  bedLabel,
  bedCount,
  areaLabel,
  facilities,
  strike,
  promo,
  price,
  perNightLabel,
  selectLabel,
  bestsellerLabel,
  favorite,
  viewer = false,
  onPress,
  onToggleFavorite,
  onSelect,
  onOpenViewer,
}: Props) {
  /** 渐变 id 要跟着卡片走,同屏三张卡共用一个 id 在 web 上会互相顶掉 */
  const gradientId = `roomCardTop-${gradientKey}`;

  return (
    <View style={styles.card}>
      {/**
       * 封面是**定高 + 自剪裁**的一段:图片走正常流(不再用 absoluteFill),
       * 角标/胶囊两条才是绝对定位。这样图片与顶部渐变都被关在这 192 里,
       * 不会漏到下面正文那段去(正文另有不透明底色兜底)。
       */}
      <View style={styles.cover}>
        <Image source={cover} style={styles.coverImage} resizeMode="cover" />

        {/* 顶部渐变条 + Bestseller / 收藏心 */}
        <View style={styles.coverTop}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>

          {bestsellerLabel ? (
            <View style={styles.bestseller}>
              <Text style={styles.bestsellerText}>{bestsellerLabel}</Text>
            </View>
          ) : (
            <View />
          )}

          <Pressable
            style={({ pressed }) => [styles.heartBtn, pressed && styles.pressed]}
            onPress={onToggleFavorite}
            hitSlop={8}
          >
            {/* 设计稿两态都是白色实/空心(fluent:heart-12-filled / -regular),不是红色 */}
            <HomeIcon name={favorite ? 'heartFilled' : 'heart'} size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* 底部:左圆点条,右 360°/全景/张数三枚胶囊(设计稿第三张卡只有张数一枚) */}
        <View style={styles.coverBottom}>
          <View style={styles.dots} pointerEvents="none">
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : styles.dotIdle]} />
            ))}
          </View>

          <View style={styles.pillRow}>
            {viewer ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                  onPress={onOpenViewer}
                  hitSlop={6}
                >
                  <HomeIcon name="view360" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                  onPress={onOpenViewer}
                  hitSlop={6}
                >
                  <HomeIcon name="panorama" width={20} height={16} color="#FFFFFF" />
                </Pressable>
              </>
            ) : null}

            <View style={[styles.pill, styles.counter]}>
              <HomeIcon name="imageCopy" size={20} color="#FFFFFF" />
              <Text style={styles.counterText}>{photoCount}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* 标题行 */}
        <View style={styles.row}>
          <View style={styles.titleGroup}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {leftLabel ? (
              <View style={styles.leftBadge}>
                <Text style={styles.leftBadgeText}>{leftLabel}</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={onPress} hitSlop={8}>
            {({ pressed }) => (
              <Text style={[styles.seeDetails, pressed && styles.pressed]}>{seeDetailsLabel}</Text>
            )}
          </Pressable>
        </View>

        {/* 参数行(与设施行的图标设计稿是实色 #191A25,比同排文字深,不跟文字共用 --text-2) */}
        <View style={styles.row}>
          <View style={styles.spec}>
            <HomeIcon name="guests" size={9.333} color={colors.body} />
            <Text style={styles.specText}>{guestsLabel}</Text>
          </View>
          <View style={styles.spec}>
            {Array.from({ length: bedCount }, (_, i) => (
              <HomeIcon key={i} name="bedSize" width={11.667} height={8.167} color={colors.body} />
            ))}
            <Text style={styles.specText}>{bedLabel}</Text>
          </View>
          <View style={styles.spec}>
            <HomeIcon name="roomArea" size={12.763} color={colors.body} />
            <Text style={styles.specText}>{areaLabel}</Text>
          </View>
        </View>

        {/* 设施行(上下各一条分隔线) */}
        <View style={styles.facilityBlock}>
          <View style={styles.divider} />
          <View style={styles.facilityRow}>
            {facilities.map((f) => (
              <View key={f.key} style={styles.facility}>
                <HomeIcon name={f.icon} size={f.size} color={colors.body} />
                <Text style={styles.facilityText}>{f.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.divider} />
        </View>

        {/* 价格行 */}
        <View style={styles.row}>
          <View>
            {strike || promo ? (
              <View style={styles.promoRow}>
                {strike ? <Text style={styles.strike}>{strike}</Text> : null}
                {promo ? <Text style={styles.promo}>{promo}</Text> : null}
              </View>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              {perNightLabel ? <Text style={styles.perNight}>{perNightLabel}</Text> : null}
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.selectBtn, pressed && styles.pressed]}
            onPress={onSelect}
          >
            <Text style={styles.selectText}>{selectLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.subtle,
  },

  /* 定高 + overflow hidden:图片与顶部渐变都关在这一段里,漏不到正文 */
  cover: { height: 192, width: '100%', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  bestseller: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  bestsellerText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
  },
  heartBtn: {
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  coverBottom: {
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

  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  /* 张数胶囊比另两枚多一个图标与文字的间距 */
  counter: { gap: 10 },
  counterText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },

  /**
   * 正文自带不透明底色(设计稿卡片底 `--tab`),不靠卡片那层透出来 ——
   * 否则封面一旦有东西漏出来,底部的划线价/「/ night」这种浅色字直接压在图上就看不清了。
   */
  body: { padding: 16, gap: 12, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  name: {
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    flexShrink: 1,
  },
  leftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.card,
    backgroundColor: colors.softBlue,
  },
  leftBadgeText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    color: colors.textSoft,
  },
  seeDetails: {
    fontFamily: fonts.outfit,
    fontSize: 12,
    color: colors.primary,
  },

  spec: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  facilityBlock: { gap: 8 },
  /* 设施行上下两条线取导出资产 Line 3 的实际描边 #D9E1FB(= --secondary),不是通用的浅灰分隔线 */
  divider: { height: 1, backgroundColor: colors.softBlue },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  facility: { flex: 1, alignItems: 'center' },
  facilityText: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSoft,
    textAlign: 'center',
  },

  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strike: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    color: colors.textSoft,
    textDecorationLine: 'line-through',
  },
  promo: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    color: colors.primary,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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

  selectBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  selectText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
