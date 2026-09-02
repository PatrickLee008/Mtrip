/**
 * 复核相关的公共卡片(设计稿 Step 3 `1675:6404` / Stay 明细 `1675:9677` / Trip `1675:9406`)
 *
 * 这几张卡在三个屏里逐像素相同,收敛到一个文件:
 *   RoomSummaryCard   房型卡:封面 192 + 右上「Preferred」+ 名称 Outfit 600/16 + 三格参数
 *   StayDetailsGrid   入离 / 人数两行,圆角 20 的卡,行左是 40 圆的深主色 10% 图标底
 *   AddOnServiceCard  「Add On Service」+ 已选加购胶囊
 *   PriceBreakdownCard 明细表(1px `--secondary` 圆角 12 的表框)+ TOTAL AMOUNT + 大号总价
 *   CancellationCard  左侧 4px 主色竖条的取消政策
 *   TermsCheckbox     条款勾选(两段链接文案)
 *   AddMoreStayCard   `--secondary` 底 + 主色描边的「Add More Stay」,右上角一枚 95 的楼宇水印
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import {
  BORDER_SOFT,
  TINT_CHIP,
  TINT_DEEP,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/* ------------------------------------------------------------------ 房型卡 */

interface RoomCardProps {
  cover: ImageSourcePropType;
  badge: string;
  name: string;
  guestsLabel: string;
  bedLabel: string;
  areaLabel: string;
}

export function RoomSummaryCard({
  cover,
  badge,
  name,
  guestsLabel,
  bedLabel,
  areaLabel,
}: RoomCardProps) {
  return (
    <View style={styles.roomCard}>
      <View style={styles.roomCover}>
        <Image source={cover} style={styles.roomImage} resizeMode="cover" />
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeText}>{badge}</Text>
        </View>
      </View>
      <View style={styles.roomBody}>
        <Text style={styles.roomName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.roomSpecs}>
          <View style={styles.roomSpec}>
            <HomeIcon name="guests" size={9.333} color={colors.textSoft} />
            <Text style={styles.roomSpecText}>{guestsLabel}</Text>
          </View>
          <View style={styles.roomSpec}>
            <HomeIcon name="bedSize" width={11.667} height={8.167} color={colors.textSoft} />
            <Text style={styles.roomSpecText}>{bedLabel}</Text>
          </View>
          <View style={styles.roomSpec}>
            <HomeIcon name="roomArea" size={12.763} color={colors.textSoft} />
            <Text style={styles.roomSpecText}>{areaLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- 入离 / 人数 */

interface StayRow {
  key: string;
  icon: HomeIconName;
  iconWidth: number;
  iconHeight: number;
  label: string;
  value: string;
}

export function StayDetailsGrid({ rows }: { rows: StayRow[] }) {
  return (
    <View style={styles.gridCard}>
      {rows.map((row) => (
        <View key={row.key} style={styles.gridRow}>
          <View style={styles.gridIcon}>
            <HomeIcon
              name={row.icon}
              width={row.iconWidth}
              height={row.iconHeight}
              color={colors.primary}
            />
          </View>
          <View style={styles.flex}>
            <Text style={styles.gridLabel}>{row.label}</Text>
            <Text style={styles.gridValue}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------- 已选增值服务 */

export function AddOnServiceCard({ title, chips }: { title: string; chips: string[] }) {
  return (
    <View style={styles.addOnCard}>
      <Text style={styles.addOnTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {chips.map((chip) => (
          <View key={chip} style={styles.chip}>
            <HomeIcon name="checkmarkCircle" size={11.667} color={colors.primary} />
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 价格明细 */

export interface PriceRow {
  key: string;
  label: string;
  value: string;
  /** 划线原价 */
  strike?: boolean;
}

interface PriceProps {
  title: string;
  rows: PriceRow[];
  totalLabel: string;
  pointsLabel: string;
  total: string;
  /** 设计稿 Step 3 / Trip 是 40/60 的大号,支付页汇总卡是 32/40 */
  compact?: boolean;
}

export function PriceBreakdownCard({
  title,
  rows,
  totalLabel,
  pointsLabel,
  total,
  compact = false,
}: PriceProps) {
  return (
    <View style={[bookingShared.panelWhite, styles.priceCard]}>
      <Text style={styles.priceTitle}>{title}</Text>
      <View style={styles.priceTable}>
        {rows.map((row) => (
          <View key={row.key} style={styles.priceRow}>
            <Text style={styles.priceLabel}>{row.label}</Text>
            <Text style={[styles.priceValue, row.strike && styles.priceStrike]}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.priceTotal}>
          <View style={styles.priceTotalHead}>
            <Text style={bookingShared.overline}>{totalLabel}</Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>{pointsLabel}</Text>
            </View>
          </View>
          <Text style={[styles.priceGrand, compact && styles.priceGrandCompact]}>{total}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 取消政策 */

export function CancellationCard({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={styles.cancelCard}>
      <HomeIcon name="infoCircle" size={20} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.cancelTitle}>{title}</Text>
        <Text style={styles.cancelDesc}>{desc}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 条款勾选 */

interface TermsProps {
  checked: boolean;
  prefix: string;
  terms: string;
  separator: string;
  privacy: string;
  suffix: string;
  onToggle: () => void;
  onOpenTerms: () => void;
}

export function TermsCheckbox({
  checked,
  prefix,
  terms,
  separator,
  privacy,
  suffix,
  onToggle,
  onOpenTerms,
}: TermsProps) {
  return (
    <View style={styles.termsRow}>
      <Pressable style={styles.termsBox} onPress={onToggle} hitSlop={8}>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <HomeIcon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
      <Text style={styles.termsText}>
        {prefix}
        <Text style={styles.termsLink} onPress={onOpenTerms}>
          {terms}
        </Text>
        {separator}
        <Text style={styles.termsLink} onPress={onOpenTerms}>
          {privacy}
        </Text>
        {suffix}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------- 继续添加住宿 */

interface AddMoreProps {
  title: string;
  desc: string;
  action: string;
  onPress: () => void;
}

export function AddMoreStayCard({ title, desc, action, onPress }: AddMoreProps) {
  return (
    <View style={styles.addMoreCard}>
      {/* 右上角 95 的楼宇水印,被卡片圆角裁掉(设计稿 2302:8994) */}
      <View style={styles.addMoreWatermark} pointerEvents="none">
        <HomeIcon name="building" size={95} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <View style={styles.addMoreTitleBox}>
          <Text style={styles.addMoreTitle}>{title}</Text>
        </View>
        <Text style={styles.addMoreDesc}>{desc}</Text>
        <Pressable
          style={({ pressed }) => [
            bookingShared.primaryBtn,
            styles.addMoreBtn,
            pressed && bookingShared.pressed,
          ]}
          onPress={onPress}
        >
          <HomeIcon name="plus" size={10.5} color="#FFFFFF" />
          <Text style={bookingShared.primaryBtnText}>{action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  /* ---- 房型卡 ---- */
  roomCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  roomCover: { height: 192, width: '100%', overflow: 'hidden' },
  roomImage: { width: '100%', height: '100%' },
  roomBadge: {
    position: 'absolute',
    right: 16,
    top: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(65, 105, 237, 0.4)',
  },
  roomBadgeText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  roomBody: { padding: 20, gap: 12, backgroundColor: colors.card },
  roomName: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.heading },
  roomSpecs: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  roomSpec: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomSpecText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 入离 / 人数 ---- */
  gridCard: {
    gap: 16,
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: colors.surface,
  },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gridIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: TINT_DEEP,
  },
  gridLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.textSoft,
  },
  gridValue: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },

  /* ---- 增值服务 ---- */
  addOnCard: {
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: colors.surface,
  },
  addOnTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.heading,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  chipText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.primary,
  },

  /* ---- 价格明细 ---- */
  priceCard: { gap: 16 },
  priceTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 28, color: colors.heading },
  priceTable: {
    gap: 12,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  priceLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  priceValue: {
    width: 100,
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    color: colors.heading,
  },
  priceStrike: { textDecorationLine: 'line-through' },
  priceTotal: { paddingHorizontal: 16, paddingVertical: 8 },
  priceTotalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: TINT_CHIP,
  },
  pointsText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'right',
    color: colors.heading,
  },
  priceGrand: {
    fontFamily: fonts.interBold,
    fontSize: 40,
    lineHeight: 60,
    letterSpacing: -0.96,
    textAlign: 'right',
    color: colors.primary,
  },
  priceGrandCompact: { fontSize: 32, lineHeight: 40 },

  /* ---- 取消政策 ---- */
  cancelCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingLeft: 28,
    paddingRight: 24,
    paddingVertical: 24,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  cancelTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  cancelDesc: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 条款 ---- */
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  termsBox: { paddingTop: 4 },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textSoft,
    backgroundColor: colors.card,
  },
  checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  termsText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 22.75,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  termsLink: {
    fontFamily: fonts.interBold,
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  /* ---- 继续添加住宿 ---- */
  addMoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.softBlue,
    overflow: 'hidden',
    ...shadows.card,
  },
  addMoreWatermark: { position: 'absolute', right: -12, top: -1, opacity: 0.35 },
  addMoreTitleBox: { paddingVertical: 12, opacity: 0.9 },
  addMoreTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 24, color: colors.heading },
  addMoreDesc: {
    marginTop: 8,
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },
  addMoreBtn: { marginTop: 8, width: '100%' },
});
