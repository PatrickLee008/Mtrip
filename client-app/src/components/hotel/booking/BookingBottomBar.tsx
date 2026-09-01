/**
 * 向导吸底操作栏,两种布局(设计稿 1675:6274 与 1675:7611)
 *
 *   'buttons'(默认) 左 Back 描边按钮 + 右主按钮,各占一半、gap 20、px24
 *   'price'          左「TOTAL ESTIMATED PRICE + 金额」+ 右主按钮(设计稿 Step 1 加购已选态)
 *
 * 设计稿实测:栏底 `--tab`、py16;按钮圆角 12、px40 py16;
 * Back 是 1px 主色描边 + 主色 Inter 500/14 tracking .14,主按钮是主色底白字,
 * 主按钮文字右侧带一枚 20 的右箭头(Continue 有,Add To Trip / Check Out 没有)。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  variant?: 'buttons' | 'price';
  /** 主按钮文案 */
  primaryLabel: string;
  /** 主按钮是否带右箭头(设计稿只有 Continue 带) */
  primaryArrow?: boolean;
  onPrimary: () => void;
  onBack: () => void;
  /** variant='price' 时左侧的金额(已格式化) */
  priceLabel?: string;
}

export default function BookingBottomBar({
  variant = 'buttons',
  primaryLabel,
  primaryArrow = true,
  onPrimary,
  onBack,
  priceLabel,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const primary = (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        variant === 'buttons' && styles.flex,
        pressed && bookingShared.pressed,
      ]}
      onPress={onPrimary}
    >
      <Text style={styles.primaryText}>{primaryLabel}</Text>
      {primaryArrow ? (
        /* 设计稿右箭头就是同一枚 arrow-left 旋转 180°,HomeIcon 不收 style,故外面套一层 */
        <View style={styles.flip}>
          <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
      <View style={[styles.inner, variant === 'price' && styles.innerPrice]}>
        {variant === 'price' ? (
          <View style={styles.priceGroup}>
            <Text style={styles.priceLabel}>{t('hotels.booking.totalEstimated')}</Text>
            <Text style={styles.priceValue}>{priceLabel}</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.backBtn, styles.flex, pressed && bookingShared.pressed]}
            onPress={onBack}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            <Text style={styles.backText}>{t('hotels.booking.back')}</Text>
          </Pressable>
        )}
        {primary}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  /* 价格变体左侧文案不定宽,两端对齐 */
  innerPrice: { justifyContent: 'space-between' },
  flex: { flex: 1, minWidth: 0 },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  flip: { transform: [{ rotate: '180deg' }] },

  priceGroup: { gap: 0 },
  priceLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.3,
    color: colors.label,
  },
  priceValue: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
});
