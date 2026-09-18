/**
 * 关怀模式订房 Step 2 · Price Breakdown(Figma `2540:19621`)
 *
 * 新稿把旧的复核步(价格明细 + 券)与支付步(渠道)合成这一屏:
 * 价格明细卡 → Coupons 票券卡 → Choose Payment Method → See Other Payment 折叠条。
 *
 * 设计稿实测:
 *   明细卡   `2540:19624` 白底 1px rgba(196,197,215,.3) 圆角 24 padding 25
 *            内层 1px --secondary 圆角 12 gap12;每行下边框 1px --secondary、px8、单元格 p8
 *            左标 Inter 400 16/24 --text,右值 Inter 500 16/24 定宽 100(首行划线)
 *            合计块 px16 py8:TOTAL AMOUNT Inter 600 12/16 大写 tracking .6 --text-2
 *            + Earn N Points 药丸(rgba(65,105,237,.1) 圆角 8 px8 py4)
 *            + 大金额 Inter 700 **40/60** 主色 tracking -0.96,右对齐
 *   券卡     `2540:19657`(组件 `440:1309` Variant2)高 82 圆角 20 px24 py12 gap22 主色底
 *            —— 与完整版支付页那张券卡**同一规格**,样式照抄 `BookingStepPayment.styles.coupon`
 *   渠道卡   `2540:19665` --tab 底 1px --secondary 圆角 24 padding 25:
 *            40 图标底(#E5EEFF 圆角 8)+ 名称 Inter 700 20/24 + 副标 Inter 400 16/24 --text-2
 *            + 右侧 24 勾选框
 *   折叠条   `2540:19694` --secondary 底 1px 主色 圆角 24 px24 py8,Inter 700 20/24
 *
 * **主位那张卡放的是 mTrip 钱包余额,不是稿子上的 MMQR Pay**(用户确认):
 * 后端只有钱包余额是真渠道(`payOrder` 的 `payMethod=3`),照稿把 MMQR 摆主位的话
 * 默认那张卡根本付不了款。MMQR / KBZPay / Wave Pay / 酒店前台等按现有口径收进
 * 「See Other Payment」,展开后一律置灰 + Coming soon。
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_PAY_ICONS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { nightsBetween, nightsLowerLabel } from '@/components/hotel/booking/bookingFormat';
import { CARD_HEADING, PAY_TILE_BG, TINT_CHIP } from '@/components/hotel/booking/bookingShared';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  PAYMENT_POPULAR,
  type BookingStay,
  type PaymentMethodKey,
} from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

/** 「See Other Payment」展开后列出的渠道:除钱包外的全部,一律置灰 */
const OTHER_METHODS = [...PAYMENT_POPULAR, 'hotel'] as const;

interface CouponState {
  applied: { receiveId: number; name: string; discount: number } | null;
  hasUsable: boolean;
  loading: boolean;
  onOpen: () => void;
}

interface Props {
  stay: BookingStay;
  /** 已扣券后的实付金额 */
  total: number;
  method: PaymentMethodKey | null;
  balance: number;
  insufficient: boolean;
  coupon?: CouponState;
  onSelect: (key: PaymentMethodKey) => void;
  onComingSoon: () => void;
}

export default function LiteStepPay({
  stay,
  total,
  method,
  balance,
  insufficient,
  coupon,
  onSelect,
  onComingSoon,
}: Props) {
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const [otherOpen, setOtherOpen] = useState(false);

  const nightsText = nightsLowerLabel(t, nightsBetween(stay.checkIn, stay.checkOut));

  type PriceRow = { key: string; label: string; value: string; strike?: boolean };

  /**
   * 真实商品只有房费一行:后端 `create` 的价钱来自锁库存的日历价,没有税费与原价概念,
   * 也不发积分(见 `useBookingWizard` 的说明)。演示数据才铺满设计稿那三行。
   */
  const rows: PriceRow[] = stay.demo
    ? [
        {
          key: 'original',
          label: t('hotels.booking.review.originalPrice', { nights: nightsText }),
          value: formatAmount(stay.originalPrice, currency),
          strike: true,
        },
        {
          key: 'room',
          label: t('hotels.booking.review.roomPrice', { nights: nightsText }),
          value: formatAmount(stay.roomPrice, currency),
        },
        {
          key: 'taxes',
          label: t('hotels.booking.review.taxes', { percent: stay.taxPercent }),
          value: formatAmount(stay.taxes, currency),
        },
      ]
    : [
        {
          key: 'room',
          label: t('hotels.booking.review.roomPrice', { nights: nightsText }),
          value: formatAmount(stay.roomPrice, currency),
        },
      ];

  /* 券的抵扣额一律来自服务端试算,前端不自己算 */
  if (coupon?.applied) {
    rows.push({
      key: 'coupon',
      label: coupon.applied.name,
      value: `- ${formatAmount(coupon.applied.discount, currency)}`,
    });
  }

  return (
    <View style={styles.root}>
      {/* ------------------------------------------------------------ 价格明细 */}
      <View style={liteBooking.cardWhite}>
        <View style={styles.table}>
          {/* 明细行之间**不留间距**(各自靠下边框分隔);gap12 是行组与合计块之间的 */}
          <View>
            {rows.map((row) => (
              <View key={row.key} style={styles.tableRow}>
                <View style={styles.cellLeft}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                </View>
                <View style={styles.cellRight}>
                  <Text style={[styles.rowValue, row.strike && styles.strike]}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.totalBlock}>
            <View style={liteBooking.rowBetween}>
              <Text style={liteBooking.overline}>{t('hotels.booking.review.totalAmount')}</Text>
              {stay.points > 0 ? (
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsText}>
                    {t('hotels.booking.review.earnPoints', {
                      points: stay.points.toLocaleString(i18n.language),
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(total, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* -------------------------------------------------------------- 优惠券 */}
      {coupon ? (
        <Pressable
          style={({ pressed }) => [styles.coupon, pressed && liteBooking.pressed]}
          onPress={coupon.onOpen}
        >
          <View style={styles.couponLeft}>
            <View style={styles.couponTile}>
              <HomeIcon name="ticketDiagonal" size={20} color={colors.primary} />
            </View>
            <View style={liteBooking.flexCol}>
              <Text style={styles.couponTitle} numberOfLines={1}>
                {coupon.applied
                  ? coupon.applied.name
                  : t('hotels.booking.payment.couponsTitle')}
              </Text>
              <Text style={styles.couponDesc} numberOfLines={1}>
                {coupon.loading
                  ? t('common.loading')
                  : coupon.applied
                    ? `- ${formatAmount(coupon.applied.discount, currency)}`
                    : coupon.hasUsable
                      ? t('hotels.booking.coupon.select')
                      : t('hotels.booking.coupon.none')}
              </Text>
            </View>
          </View>
          {coupon.applied ? (
            <Text style={styles.couponApplied}>{t('hotels.booking.lite.applied')}</Text>
          ) : (
            <HomeIcon name="chevronDown" width={12} height={7.4} color="#FFFFFF" />
          )}
        </Pressable>
      ) : null}

      {/* -------------------------------------------------------------- 支付渠道 */}
      <View style={styles.methods}>
        <Text style={styles.methodsTitle}>{t('hotels.booking.lite.choosePayment')}</Text>

        {/* 主位:钱包余额(唯一真渠道) */}
        <Pressable
          style={({ pressed }) => [styles.methodCard, pressed && liteBooking.pressed]}
          onPress={() => onSelect('wallet')}
        >
          <View style={styles.methodLeft}>
            <View style={styles.methodTile}>
              <Image source={TEMP_PAY_ICONS.wallet} style={styles.methodIcon} resizeMode="contain" />
            </View>
            <View style={liteBooking.flexCol}>
              <Text style={liteBooking.itemTitle}>
                {t('hotels.booking.payment.methods.wallet.title')}
              </Text>
              <Text style={[styles.methodDesc, insufficient && styles.methodDescWarn]}>
                {insufficient
                  ? t('hotels.booking.payment.insufficient')
                  : t('hotels.booking.payment.methods.wallet.desc', {
                      amount: formatMoney(balance, currency),
                    })}
              </Text>
            </View>
          </View>
          <HomeIcon
            name={method === 'wallet' ? 'checkboxIndeterminate' : 'checkbox'}
            size={24}
            color={method === 'wallet' ? colors.primary : colors.softBlue}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [liteBooking.foldBar, pressed && liteBooking.pressed]}
          onPress={() => setOtherOpen((v) => !v)}
        >
          <Text style={styles.methodsTitle}>{t('hotels.booking.lite.seeOtherPayment')}</Text>
          {/* HomeIcon 不吃 style,展开态用一层 View 来翻转箭头 */}
          <View style={otherOpen ? styles.flip : undefined}>
            <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.primary} />
          </View>
        </Pressable>

        {/* 其余渠道后端都没接,展开后一律置灰 + Coming soon(与完整模式同一口径) */}
        {otherOpen
          ? OTHER_METHODS.map((key) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.methodCard,
                  styles.methodDisabled,
                  pressed && liteBooking.pressed,
                ]}
                onPress={onComingSoon}
              >
                <View style={styles.methodLeft}>
                  <View style={styles.methodTile}>
                    <Image
                      source={TEMP_PAY_ICONS[key]}
                      style={styles.methodIcon}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={liteBooking.flexCol}>
                    <Text style={liteBooking.itemTitle}>
                      {t(`hotels.booking.payment.methods.${key}.title`)}
                    </Text>
                    <Text style={styles.methodDesc}>
                      {t(`hotels.booking.payment.methods.${key}.desc`)}
                    </Text>
                  </View>
                </View>
                <HomeIcon name="checkbox" size={24} color={colors.softBlue} />
              </Pressable>
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },

  /* ---- 价格明细表 ---- */
  table: {
    width: '100%',
    gap: 12,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  cellLeft: { flex: 1, minWidth: 0, padding: 8 },
  cellRight: { width: 100, alignItems: 'flex-end', padding: 8 },
  rowLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  rowValue: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 24, color: colors.heading },
  strike: { textDecorationLine: 'line-through' },

  totalBlock: { paddingHorizontal: 16, paddingVertical: 8 },
  pointsPill: {
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
    color: colors.heading,
  },
  totalValue: {
    fontFamily: fonts.interBold,
    fontSize: 40,
    lineHeight: 60,
    letterSpacing: -0.96,
    textAlign: 'right',
    color: colors.primary,
  },

  /* ---- 券卡(与完整版支付页同一规格) ---- */
  coupon: {
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
  couponLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  couponTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: PAY_TILE_BG,
  },
  couponTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  couponDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.softBlue },
  couponApplied: {
    width: 45,
    textAlign: 'center',
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    color: '#FFFFFF',
  },

  /* ---- 支付渠道 ---- */
  methods: { gap: 12 },
  methodsTitle: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: CARD_HEADING },
  methodCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  methodDisabled: { opacity: 0.6 },
  methodLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  methodTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: PAY_TILE_BG,
    overflow: 'hidden',
  },
  methodIcon: { width: 24, height: 24 },
  methodDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  methodDescWarn: { color: colors.hot },

  flip: { transform: [{ rotate: '180deg' }] },
});
