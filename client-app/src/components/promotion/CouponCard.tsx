/**
 * 优惠券卡(设计稿 1401:3657 等,三段券列表反复用同一张卡)
 *
 * 设计稿实测:
 *   外框     圆角 24,overflow hidden(两侧缺口靠它裁成半圆)
 *   左色块   宽 100,主色底,右侧 1px 白色虚线;图标 20 + 品类文案 Inter 400/10 大写 tracking 1
 *   右内容   `--tab` 底,px20 py12,三行:券码行 / 标题+副标题 / 有效期+按钮
 *   角标     `--background` 底胶囊,px8 py2,Inter 700/10;颜色随类型走(见 BADGE_COLORS)
 *   缺口     31 圆,left 85、上 -16 / 下 -15,填充 `#EBF0FF`(= 页面底色)
 *   按钮     圆角胶囊 px20 py6,Inter 400/13;已过期态无底色、文字走 `--text-2`
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  CATEGORY_ICONS,
  type CouponBadge,
  type DemoCoupon,
} from '@/screens/promotions/promoSections';

/** 角标配色(设计稿:新用户走主色、新用户专享/热门走 `--tertiary`、限量走 `--orange`) */
const BADGE_COLORS: Record<CouponBadge, string> = {
  newUser: colors.primary,
  newUserExclusive: colors.hot,
  limited: colors.orange,
  popular: colors.hot,
};

interface Props {
  coupon: DemoCoupon;
  /** 点整张卡(进券详情) */
  onPress?: () => void;
  /** 点右下角按钮(领取 / 去使用);已过期态不可点 */
  onAction?: () => void;
}

export default function CouponCard({ coupon, onPress, onAction }: Props) {
  const { t } = useTranslation();
  const expired = coupon.state === 'expired';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* 左侧品类色块 */}
      <View style={styles.left}>
        <HomeIcon name={CATEGORY_ICONS[coupon.category]} size={20} color="#FFFFFF" />
        <Text style={styles.category}>{t(`promotions.coupon.categories.${coupon.category}`)}</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.codeRow}>
          <View style={styles.codeLeft}>
            <HomeIcon name="ticketDiagonal" size={18} color={colors.primary} />
            <Text style={styles.code}>{coupon.code}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: BADGE_COLORS[coupon.badge] }]}>
              {t(`promotions.coupon.badges.${coupon.badge}`)}
            </Text>
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>{t(`promotions.items.${coupon.item}.title`)}</Text>
          <Text style={styles.desc}>{t(`promotions.items.${coupon.item}.desc`)}</Text>
        </View>

        <View style={styles.footRow}>
          <View style={styles.expiryRow}>
            <HomeIcon name="clock" size={11.2} color={colors.textSoft} />
            <Text style={styles.expiry}>
              {t('promotions.coupon.expiry', { date: coupon.expiry })}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              expired && styles.actionBtnExpired,
              pressed && !expired && styles.pressed,
            ]}
            disabled={expired}
            onPress={onAction}
          >
            <Text style={[styles.actionText, expired && styles.actionTextExpired]}>
              {t(`promotions.coupon.actions.${coupon.state}`)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 券票两侧的圆形缺口:填页面底色,被外框的 overflow hidden 裁成半圆 */}
      <View style={[styles.notch, styles.notchTop]} pointerEvents="none" />
      <View style={[styles.notch, styles.notchBottom]} pointerEvents="none" />
    </Pressable>
  );
}

const NOTCH_SIZE = 31;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    /* 设计稿卡高 128;内容比这矮时靠 minHeight 撑住,左侧色块随之等高 */
    minHeight: 128,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  left: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.primary,
    /* 设计稿是右侧 1px 白色虚线;RN 的 borderStyle 作用于整框,其余三边宽度为 0 故只显示右边 */
    borderStyle: 'dashed',
    borderColor: '#FFFFFF',
    borderRightWidth: 1,
  },
  category: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#FFFFFF',
  },

  right: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  codeRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  codeLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  code: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    color: colors.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.round,
    backgroundColor: colors.pageBg,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15 },

  textBlock: { paddingTop: 4 },
  title: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 25, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.heading },

  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  expiry: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16.5,
    color: colors.textSoft,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  actionBtnExpired: { backgroundColor: 'transparent' },
  actionText: {
    fontFamily: fonts.inter,
    fontSize: 13,
    lineHeight: 19.5,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  actionTextExpired: { color: colors.textSoft },

  notch: {
    position: 'absolute',
    left: 85,
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
    backgroundColor: colors.pageBg,
  },
  notchTop: { top: -16 },
  notchBottom: { bottom: -15 },

  pressed: { opacity: 0.85 },
});
