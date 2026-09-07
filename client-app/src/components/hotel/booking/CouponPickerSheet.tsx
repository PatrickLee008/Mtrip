/**
 * 结账选券浮层(订房 Step 3 `228:5118` 的价格明细里点券行打开)
 *
 * 设计稿这张 Step 3 只画到「价格明细」为止,**没有画选券弹层**,所以这里不是照抄某个节点,
 * 而是沿用本流程既有的浮层做法:交互与 `SelectSheet` 完全一致(RN Modal + Animated,
 * 关闭动画放完才卸载,黑 25% 遮罩),行内样式沿用 `bookingShared` 的卡壳与描边口径,
 * 券的文案(优惠值 / 门槛 / 有效期 / 不可用原因)复用优惠中心的 `couponFormat` ——
 * 同一张券在优惠中心和结账页必须是同一套说法。
 *
 * 列表里每张券的 `discount` 是**服务端按本单算出来的实际抵扣额**(`/coupon/match-list`),
 * 不是前端估的;不可用的券照样列出来并给出原因,而不是直接藏掉 —— 用户要知道为什么不能选。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { BORDER_SOFT_STRONG, TINT_CHIP, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  discountTitle,
  expiryText,
  reasonText,
  thresholdText,
} from '@/screens/promotions/couponFormat';
import type { CouponView } from '@/types/models';
import { formatAmount } from '@/utils/format';

interface Props {
  visible: boolean;
  /** 全部未使用券(可用的已由后端排在前面) */
  coupons: CouponView[];
  /** 当前选中的领券记录 id;0 = 不使用优惠券 */
  selectedId: number;
  /** 后端算出的最优券 id;为 0 表示本单没有可用券 */
  bestId: number;
  currency: string;
  loading: boolean;
  onClose: () => void;
  /** 选中某张券(0 = 不使用) */
  onSelect: (receiveId: number) => void;
}

export default function CouponPickerSheet({
  visible,
  coupons,
  selectedId,
  bestId,
  currency,
  loading,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const pick = (receiveId: number) => {
    onSelect(receiveId);
    onClose();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{t('hotels.booking.coupon.pickTitle')}</Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && bookingShared.pressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('common.cancel')}
            >
              <HomeIcon name="close" size={16} color={colors.textSoft} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} bounces={false}>
            {loading ? (
              <Text style={styles.empty}>{t('common.loading')}</Text>
            ) : coupons.length === 0 ? (
              <Text style={styles.empty}>{t('hotels.booking.coupon.none')}</Text>
            ) : (
              coupons.map((coupon) => {
                const disabled = coupon.unusableReason !== null;
                const active = coupon.receive_id === selectedId;
                return (
                  <Pressable
                    key={coupon.receive_id}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      disabled && styles.rowDisabled,
                      pressed && !disabled && bookingShared.pressed,
                    ]}
                    disabled={disabled}
                    onPress={() => pick(coupon.receive_id)}
                  >
                    <View style={styles.rowMain}>
                      <View style={styles.rowTitleLine}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {coupon.coupon_name}
                        </Text>
                        {coupon.receive_id === bestId ? (
                          <View style={styles.bestBadge}>
                            <Text style={styles.bestBadgeText}>
                              {t('hotels.booking.coupon.best')}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {discountTitle(coupon, t, currency)} · {thresholdText(coupon, t, currency)}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {disabled
                          ? reasonText(coupon.unusableReason, t)
                          : expiryText(coupon, t)}
                      </Text>
                    </View>

                    <View style={styles.rowRight}>
                      {/* 不可用的券不展示抵扣额 —— 它对本单是 0,写出来只会误导 */}
                      {disabled ? null : (
                        <Text style={styles.rowSave}>
                          {t('hotels.booking.coupon.save', {
                            amount: formatAmount(coupon.discount ?? 0, currency),
                          })}
                        </Text>
                      )}
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active ? <HomeIcon name="check" size={10} color="#FFFFFF" /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* 不使用优惠券:与「恢复最优券」一起放在底部,是设计稿之外、但换券必须有的退路 */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.footerBtn, pressed && bookingShared.pressed]}
              onPress={() => pick(0)}
            >
              <Text style={[styles.footerText, selectedId === 0 && styles.footerTextActive]}>
                {t('hotels.booking.coupon.noCoupon')}
              </Text>
            </Pressable>
            {bestId > 0 && selectedId !== bestId ? (
              <Pressable
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.footerBtnPrimary,
                  pressed && bookingShared.pressed,
                ]}
                onPress={() => pick(bestId)}
              >
                <Text style={[styles.footerText, styles.footerTextPrimary]}>
                  {t('hotels.booking.coupon.useBest')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%',
    maxWidth: 370,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT_STRONG,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  closeBtn: { padding: 4 },

  list: { maxHeight: 360 },
  empty: {
    paddingVertical: 32,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSoft,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT_STRONG,
  },
  rowActive: { backgroundColor: TINT_CHIP },
  rowDisabled: { opacity: 0.45 },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: {
    flexShrink: 1,
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.heading,
  },
  bestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  bestBadgeText: { fontFamily: fonts.interSemi, fontSize: 10, lineHeight: 14, color: '#FFFFFF' },
  rowMeta: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.label },
  rowSub: { fontFamily: fonts.inter, fontSize: 11, lineHeight: 16, color: colors.textSoft },

  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowSave: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  radio: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footerBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  footerBtnPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  footerText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.label,
  },
  footerTextActive: { color: colors.primary },
  footerTextPrimary: { color: '#FFFFFF' },
});
