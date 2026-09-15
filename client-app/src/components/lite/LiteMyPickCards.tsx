/**
 * 关怀模式「我的精选」的四件展示件(Figma Lite My Pick `2540:21121`)
 *
 * 刻意**不做成完整模式那几个组件的 lite 分支** —— 两版的差别不只是字号:
 * 预订卡去掉了地址行与地图按钮、收藏酒店卡去掉了星级/地址/起价、收藏餐厅卡去掉了
 * 评分/距离/时长/配送费。加开关进去会让原组件变成一堆条件分支,原页面也跟着担风险。
 * 封面仍复用 CoverImage(远程图 → 本地兜底 → 渐变占位 三级降级),不重复实现。
 *
 * 设计稿实测:
 *   页签   外壳 --tab 底 p4 圆角 24;三段等分,py12,选中主色底圆角 24,
 *          文字 Inter 500/20 行高 20 字距 0.14(选中白 / 未选中 --text-2)
 *   预订卡 --tab 底 1px --secondary 圆角 24 DS_AG 投影;封面高 176,
 *          状态胶囊右上 16/16 绿底 px12 py4 圆角全,check 12 + Inter 400/14 字距 0.55
 *          正文 p16 gap12:名 Outfit 500/24、房型 Inter 500/16 主色、1px 分隔、
 *          两行信息(图标 32 + 标签 Inter 400/12 大写 --text-2 + 值 Inter 700/16)、
 *          整宽主色按钮 py12 圆角 12 文字 Inter 500/20
 *   酒店卡 宽 300,封面 176,心形右上 12/12 黑 25% 底 p4 圆角 40 内含 32 图标,
 *          正文 px24 py16,名 Outfit 600/24 行高 32 #061C34
 *   餐厅卡 宽 322,封面 128,心形右上 16/16 内含 16 图标,左下角标签行,
 *          正文 p20,名 Outfit 600/24 行高 32 --text
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿卡宽 */
export const LITE_HOTEL_CARD_WIDTH = 300;
export const LITE_RESTAURANT_CARD_WIDTH = 322;

/* ----------------------------------------------------------------- 页签 */

interface TabsProps {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}

export function LiteTabs({ items, value, onChange }: TabsProps) {
  return (
    <View style={styles.tabs}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- 预订卡 */

interface BookingProps {
  /** 卡片宽度(页面内容宽度) */
  width: number;
  title: string;
  coverUri?: string | null;
  coverSource?: ImageSourcePropType;
  skuName?: string;
  statusLabel: string;
  statusColor?: string;
  datesLabel: string;
  dates: string;
  travelersLabel: string;
  travelers: string;
  detailLabel: string;
  onPressDetail: () => void;
}

export function LiteBookingCard({
  width,
  title,
  coverUri,
  coverSource,
  skuName,
  statusLabel,
  statusColor = colors.statusPaid,
  datesLabel,
  dates,
  travelersLabel,
  travelers,
  detailLabel,
  onPressDetail,
}: BookingProps) {
  return (
    <View style={[styles.bookingCard, { width }]}>
      <View style={styles.bookingCover}>
        <CoverImage uri={coverUri} fallback={coverSource} width={width - 2} height={176} label={title} />
        <View style={[styles.status, { backgroundColor: statusColor }]}>
          <HomeIcon name="checkmarkCircle" size={12} color="#FFFFFF" />
          <Text style={styles.statusText}>{statusLabel.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.bookingBody}>
        <View style={styles.bookingHead}>
          <Text style={styles.bookingTitle} numberOfLines={2}>
            {title}
          </Text>
          {skuName ? (
            <Text style={styles.bookingSku} numberOfLines={1}>
              {skuName}
            </Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View>
          <LiteMetaRow icon="calendar2" label={datesLabel} value={dates} />
          <LiteMetaRow icon="people" label={travelersLabel} value={travelers} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={onPressDetail}
        >
          <Text style={styles.ctaText} numberOfLines={1}>
            {detailLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LiteMetaRow({
  icon,
  label,
  value,
}: {
  icon: 'calendar2' | 'people';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <HomeIcon name={icon} size={32} color={colors.primary} />
      <View style={styles.metaText}>
        <Text style={styles.metaLabel} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/* --------------------------------------------------------- 收藏酒店卡 */

interface SavedHotelProps {
  name: string;
  coverUri?: string | null;
  coverSource?: ImageSourcePropType;
  /** 实心=已收藏且可点取消;空心=示例卡,不可点 */
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
}

export function LiteSavedHotelCard({
  name,
  coverUri,
  coverSource,
  favorite,
  onToggleFavorite,
  onPress,
}: SavedHotelProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.savedCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View>
        <CoverImage
          uri={coverUri}
          fallback={coverSource}
          width={LITE_HOTEL_CARD_WIDTH - 2}
          height={176}
          label={name}
        />
        <Pressable
          style={styles.heartBadge}
          disabled={!onToggleFavorite}
          accessibilityRole="button"
          onPress={onToggleFavorite}
        >
          <HomeIcon name={favorite ? 'heartFilled' : 'heart'} size={32} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.savedBody}>
        <Text style={styles.savedName} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------- 收藏餐厅卡 */

interface SavedRestaurantProps {
  name: string;
  coverSource?: ImageSourcePropType;
  /** 「Premium choice」一类的主色实心标签 */
  premiumLabel?: string;
  /** 「15% Off」一类的描边标签 */
  discountLabel?: string;
  onToggleFavorite?: () => void;
  onPress?: () => void;
}

export function LiteSavedRestaurantCard({
  name,
  coverSource,
  premiumLabel,
  discountLabel,
  onToggleFavorite,
  onPress,
}: SavedRestaurantProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.restaurantCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View>
        <CoverImage
          uri={null}
          fallback={coverSource}
          width={LITE_RESTAURANT_CARD_WIDTH - 2}
          height={128}
          label={name}
        />
        <Pressable
          style={styles.heartBadgeSmall}
          accessibilityRole="button"
          onPress={onToggleFavorite}
        >
          <HomeIcon name="heartFilled" size={16} color="#FFFFFF" />
        </Pressable>

        <View style={styles.tagRow}>
          {premiumLabel ? (
            <View style={styles.tagSolid}>
              <Text style={styles.tagSolidText} numberOfLines={1}>
                {premiumLabel}
              </Text>
            </View>
          ) : null}
          {discountLabel ? (
            <View style={styles.tagOutline}>
              <Text style={styles.tagOutlineText} numberOfLines={1}>
                {discountLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.restaurantBody}>
        <Text style={styles.savedName} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------- styles */

/** 三张卡共用的壳:--tab 底 + 1px --secondary + 圆角 24 + DS_AG 投影 */
const cardShell = {
  borderRadius: 24,
  borderWidth: 1,
  borderColor: colors.softBlue,
  backgroundColor: colors.surface,
  overflow: 'hidden' as const,
  shadowColor: '#0F294D',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.textSoft,
  },
  tabTextActive: { color: '#FFFFFF' },

  bookingCard: cardShell,
  bookingCover: { height: 176 },
  status: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    /* 设计稿 Overlay+Shadow:0/4 blur6 spread-1 黑 10% */
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusText: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 16.5,
    letterSpacing: 0.55,
    color: '#FFFFFF',
  },
  bookingBody: { padding: 16, gap: 12 },
  bookingHead: { gap: 8 },
  bookingTitle: { fontFamily: fonts.outfit, fontSize: 24, lineHeight: 28, color: colors.heading },
  bookingSku: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  divider: { height: 1, backgroundColor: colors.divider },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 55 },
  metaText: { flex: 1, minWidth: 0 },
  metaLabel: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 15,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  metaValue: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  savedCard: { ...cardShell, width: LITE_HOTEL_CARD_WIDTH },
  savedBody: { paddingHorizontal: 24, paddingVertical: 16 },
  /* 设计稿酒店卡名用 #061C34,与 --text 不是同一个值 */
  savedName: { fontFamily: fonts.outfitSemi, fontSize: 24, lineHeight: 32, color: colors.cardTitle },
  heartBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  restaurantCard: { ...cardShell, width: LITE_RESTAURANT_CARD_WIDTH },
  restaurantBody: { padding: 20 },
  heartBadgeSmall: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  tagRow: { position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', gap: 8 },
  tagSolid: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  tagSolidText: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  tagOutline: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  tagOutlineText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },

  pressed: { opacity: 0.9 },
});
