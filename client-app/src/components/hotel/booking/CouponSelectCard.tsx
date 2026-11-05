/**
 * 结账 COUPONS 卡(516:2381):主色底整卡,左侧券图标 + 「Coupons」+ 副标题,右侧已抵扣额或下拉箭头。
 *
 * 第 3 步支付页与多房间第 2 步(钱包够付全款时这一步就是终点)共用 ——
 * 余额够付时也必须能选 / 换 / 取消券(QA P_TC_001,PRD 6.1「Users can modify or remove the coupon before payment」)。
 * 副标题三态:已用券显示券名 / 有可用券显示「选一张」/ 没有可用券显示「暂无」且整卡不可点。
 * 不传 `coupon` 时维持占位行为(演示 / 关怀 / 未登录):点了走 onComingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { DEEP_PRIMARY, PAY_TILE_BG, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

/**
 * 结账优惠券(C-M6)。不传 = COUPONS 卡维持占位(点了只弹 Coming soon)——
 * 关怀模式 / 演示模式 / 未登录走这条路,行为与从前一致。
 */
export interface PaymentCouponState {
  /** 已应用的券;null = 当前没用券 */
  applied: { name: string; discount: number } | null;
  /** 本单是否有可用券(决定卡片副标题是「选一张」还是「暂无可用」) */
  hasUsable: boolean;
  loading: boolean;
  /** 打开选券弹窗 */
  onOpen: () => void;
}

export default function CouponSelectCard({
  coupon,
  onComingSoon,
}: {
  coupon?: PaymentCouponState;
  onComingSoon: () => void;
}) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const disabled = coupon ? !coupon.applied && !coupon.hasUsable && !coupon.loading : false;
  const desc = (() => {
    if (!coupon) return t('hotels.booking.payment.couponsDesc');
    if (coupon.applied) return coupon.applied.name;
    if (coupon.loading) return t('common.loading');
    return coupon.hasUsable ? t('hotels.booking.payment.couponsDesc') : t('hotels.booking.coupon.none');
  })();

  return (
    <>
      <Text style={bookingShared.overline}>{t('hotels.booking.payment.couponsLabel')}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          disabled && styles.idle,
          pressed && !disabled && bookingShared.pressed,
        ]}
        onPress={disabled ? undefined : (coupon?.onOpen ?? onComingSoon)}
        disabled={disabled}
      >
        <View style={styles.left}>
          <View style={styles.tile}>
            <HomeIcon name="ticketDiagonal20" size={20} color={DEEP_PRIMARY} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>{t('hotels.booking.payment.couponsTitle')}</Text>
            <Text style={styles.desc} numberOfLines={1}>
              {desc}
            </Text>
          </View>
        </View>
        {coupon?.applied ? (
          <Text style={styles.saved}>{`- ${formatAmount(coupon.applied.discount, currency)}`}</Text>
        ) : (
          <HomeIcon name="chevronDown" width={12} height={7.4} color="#FFFFFF" />
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 22,
    minHeight: 82,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.primary,
  },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  tile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: PAY_TILE_BG,
  },
  title: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.softBlue },
  /* 已抵扣额:与券名同卡,右侧白色加粗 */
  saved: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  /* 没有可用券:整卡压暗且不可点 */
  idle: { opacity: 0.55 },
});
