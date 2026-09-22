/**
 * 向导吸底操作栏,两种布局(设计稿 1675:6274 与 1675:7611)
 *
 *   'buttons'(默认) 左 Back 描边按钮 + 右主按钮,各占一半、gap 20、px24
 *   'price'          左「TOTAL ESTIMATED PRICE + 金额」+ 右主按钮(设计稿 Step 1 加购已选态)
 *
 * 设计稿实测(step4 footer `718:3358`):栏底 `--tab`、py16;两枚按钮**等宽等高 167x52**、
 * 圆角 12、gap 20、容器 px24;Back 是 1px 主色描边 + 主色 Inter 500/14 tracking .14,
 * 主按钮是主色底白字 + `shadows.raised`(稿面 `718:3365` 可见,Back 的 `718:3361` 是 hidden),
 * 主按钮文字右侧带一枚 20 的右箭头(只有 Check Out 没有)。
 *
 * ⚠️ **横向内边距不照搬稿面的 40**:稿面按钮 167 宽、内容(Pay Now 60 + gap 8 + 箭头 20)88,
 * 40×2 + 88 = 168 > 167 —— 在 402 的稿面上就已经是零余量,到 390/360 的真机上必然把文字挤到
 * 第二行,右按钮就比左边高一截(用户 2026-09-22 报的「左右大小不一致」)。
 * 这里两按钮布局下走 `stretch`(flex:1 均分 + px 收到 16)+ `height: 52` 锁死高度 +
 * 文案 `numberOfLines={1}`:两枚恒等宽等高,内容居中,稿面宽度下与稿面一致,窄屏只是内边距变小。
 * price 变体(Step 1)是内容宽按钮,仍用稿面的 px40,不受影响。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius, shadows } from '@/config/theme';
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
        /* 两按钮布局才拉伸并收内边距;price 变体是内容宽,px40 正是它的宽度来源 */
        variant === 'buttons' && styles.stretch,
        pressed && bookingShared.pressed,
      ]}
      onPress={onPrimary}
    >
      <Text style={styles.primaryText} numberOfLines={1}>
        {primaryLabel}
      </Text>
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
            style={({ pressed }) => [styles.backBtn, styles.stretch, pressed && bookingShared.pressed]}
            onPress={onBack}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            <Text style={styles.backText} numberOfLines={1}>
              {t('hotels.booking.back')}
            </Text>
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
  /**
   * 两枚按钮等分整宽:`flex:1` 让宽度只由容器决定(各 167@402),
   * 同时把内边距从稿面的 40 收到 16 —— 拉伸态下内边距不影响外框宽度,只决定文字的可用空间,
   * 40 会在 390/360 上把文字挤到第二行,右按钮就比左边高一截。
   */
  stretch: { flex: 1, minWidth: 0, paddingHorizontal: 16 },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    /* 稿面 py16 + 行高 20 = 52;写成定高,免得任一侧换行把两边撑得不一样 */
    height: 52,
    paddingHorizontal: 40,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backText: {
    flexShrink: 1,
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
    /* 与 Back 同一口径:定高 52;两按钮布局下宽度交给 flex:1 均分(内边距由 stretch 收窄) */
    height: 52,
    paddingHorizontal: 40,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
    /* 稿面 718:3365(Back 的 718:3361 是 hidden,所以只有主按钮有投影) */
    ...shadows.raised,
  },
  primaryText: {
    flexShrink: 1,
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
