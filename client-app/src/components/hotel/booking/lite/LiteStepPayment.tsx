/**
 * 关怀模式 Step 4 · 支付(推导自 `Booking Flow` `759:9777` 的 Booking step 4 `276:876`)
 *
 * 结构与完整模式 `BookingStepPayment` 同:汇总卡 → mTrip 钱包渐变卡 →
 * Popular Payment Method ×3 → Other Payment Methods(钱包 / 到店 / 银行卡 / 手机银行)→
 * COUPONS 卡 → 返现横幅 → Payment Summary → Secure Payment Guarantee → 三枚合规标,
 * 字号按 `liteBookingShared` 放大一档。
 *
 * **本期只有 mTrip 钱包余额是真渠道**:余额那行可单选并真扣款,其余渠道统一置灰挂
 * Coming soon 角标,点按只弹提示不选中 —— 与完整模式同一口径。
 *
 * 关怀版的两处简化(都不是功能差异,是去掉纯装饰的嵌套):
 *   1. 银行卡 / 手机银行两行**不做展开**:完整版展开后是一张写死的「Visa **** 3456」示例卡,
 *      渠道本身都还没开通,关怀模式再套一层折叠只会让人以为能选。
 *   2. 汇总卡不放「View Details」:它跳的是完整模式版式的 `StayDetail`,字号会突然变小;
 *      复核步就在上一屏,要看明细往回走即可。
 */

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import {
  TEMP_CARD_BRANDS,
  TEMP_PAY_ICONS,
  TEMP_PAY_MOBILE_BANKING,
} from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import {
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  PAY_TILE_BG,
  TINT_CHIP,
} from '@/components/hotel/booking/bookingShared';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  BOOKING_DEMO,
  CARD_BRANDS,
  PAYMENT_POPULAR,
  TRUST_BADGES,
  type PaymentMethodKey,
} from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

interface Props {
  hotelName: string;
  dateLabel: string;
  roomLabel: string;
  pointsLabel: string;
  /** 已格式化的应付金额 */
  total: string;
  method: PaymentMethodKey | null;
  /** 钱包可用余额:真实模式取 `/app/user/me`,演示模式回落设计稿数值 */
  balance: number;
  /** 余额不足以支付本单(由页面用实付金额比出来),在钱包卡下方给一行红字提示 */
  insufficient?: boolean;
  onSelect: (key: PaymentMethodKey) => void;
  onComingSoon: () => void;
}

export default function LiteStepPayment({
  hotelName,
  dateLabel,
  roomLabel,
  pointsLabel,
  total,
  method,
  balance,
  insufficient = false,
  onSelect,
  onComingSoon,
}: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const comingSoonBadge = t('home.comingSoon');

  return (
    <View style={styles.root}>
      {/* 汇总卡 */}
      <View style={liteBooking.card}>
        <Text style={liteBooking.sectionTitle}>{hotelName}</Text>
        <Text style={liteBooking.body}>{dateLabel}</Text>
        <Text style={liteBooking.body}>{roomLabel}</Text>
        <View style={liteBooking.divider} />
        <View style={liteBooking.rowBetween}>
          <Text style={liteBooking.overline}>{t('hotels.booking.review.totalAmount')}</Text>
          <View style={styles.pointsChip}>
            <Text style={styles.pointsText}>{pointsLabel}</Text>
          </View>
        </View>
        <Text style={styles.total}>{total}</Text>
      </View>

      {/* mTrip 钱包卡:设计稿是 149.5° 的 #204DDA → #4169ED 渐变,RN 无原生线性渐变,用 svg 画 */}
      <View style={styles.wallet}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="liteBookingWallet" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={DEEP_PRIMARY} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#liteBookingWallet)" />
        </Svg>

        <View style={styles.walletBody}>
          <View style={styles.walletHead}>
            <HomeIcon name="wallet" width={21} height={20} color="#FFFFFF" />
            <Text style={styles.walletTitle}>{t('hotels.booking.payment.wallet')}</Text>
          </View>
          <View style={styles.walletAmountRow}>
            <Text style={styles.walletCurrency}>{currency}</Text>
            <Text style={styles.walletAmount}>{formatAmount(balance, currency)}</Text>
          </View>
          <Text style={styles.walletHint}>{t('hotels.booking.payment.availableBalance')}</Text>
        </View>
        <Pressable style={styles.walletInfo} onPress={onComingSoon} hitSlop={8}>
          <HomeIcon name="infoCircle" size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      {insufficient ? (
        <Text style={styles.insufficient}>{t('hotels.booking.payment.insufficient')}</Text>
      ) : null}

      <View style={styles.group}>
        <Text style={liteBooking.cardTitle}>{t('hotels.booking.payment.popular')}</Text>
        {PAYMENT_POPULAR.map((key) => (
          <MethodRow
            key={key}
            icon={TEMP_PAY_ICONS[key]}
            title={t(`hotels.booking.payment.methods.${key}.title`)}
            desc={t(`hotels.booking.payment.methods.${key}.desc`)}
            badge={comingSoonBadge}
            onPress={onComingSoon}
          />
        ))}

        <Text style={liteBooking.cardTitle}>{t('hotels.booking.payment.other')}</Text>
        <MethodRow
          icon={TEMP_PAY_ICONS.wallet}
          title={t('hotels.booking.payment.methods.wallet.title')}
          desc={t('hotels.booking.payment.methods.wallet.desc', {
            amount: formatMoney(balance, currency),
          })}
          checked={method === 'wallet'}
          onPress={() => onSelect('wallet')}
        />
        <MethodRow
          icon={TEMP_PAY_ICONS.hotel}
          title={t('hotels.booking.payment.methods.hotel.title')}
          desc={t('hotels.booking.payment.methods.hotel.desc')}
          badge={comingSoonBadge}
          onPress={onComingSoon}
        />
        <MethodRow
          icon={TEMP_PAY_ICONS.card}
          title={t('hotels.booking.payment.methods.card.title')}
          brands={CARD_BRANDS.map((brand) => ({
            key: brand.key,
            source: TEMP_CARD_BRANDS[brand.key],
            width: brand.width,
          }))}
          badge={comingSoonBadge}
          onPress={onComingSoon}
        />
        <MethodRow
          icon={TEMP_PAY_MOBILE_BANKING}
          title={t('hotels.booking.payment.methods.mobileBanking.title')}
          badge={comingSoonBadge}
          onPress={onComingSoon}
        />

        <Text style={liteBooking.overline}>{t('hotels.booking.payment.couponsLabel')}</Text>
        <Pressable
          style={({ pressed }) => [styles.coupon, pressed && liteBooking.pressed]}
          onPress={onComingSoon}
        >
          <View style={styles.rowLeft}>
            <View style={styles.couponTile}>
              <HomeIcon name="ticketDiagonal20" size={26} color={DEEP_PRIMARY} />
            </View>
            <View style={liteBooking.flexCol}>
              <Text style={styles.couponTitle}>{t('hotels.booking.payment.couponsTitle')}</Text>
              <Text style={styles.couponDesc}>{t('hotels.booking.payment.couponsDesc')}</Text>
            </View>
          </View>
          <HomeIcon name="chevronDown" width={16} height={10} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.cashback}>
        <View style={styles.rowLeft}>
          <View style={styles.cashbackIcon}>
            <HomeIcon name="megaphone" width={26} height={25} color={colors.primary} />
          </View>
          <View style={liteBooking.flexCol}>
            <Text style={styles.cashbackTitle}>
              {t('hotels.booking.payment.cashbackTitle', { percent: BOOKING_DEMO.cashbackPercent })}
            </Text>
            <Text style={liteBooking.note}>
              {t('hotels.booking.payment.cashbackDesc', {
                amount: formatMoney(BOOKING_DEMO.cashbackAmount, currency),
              })}
            </Text>
          </View>
        </View>
        <Text style={styles.cashbackTitle}>
          +{formatAmount(BOOKING_DEMO.cashbackAmount, currency)}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          liteBooking.card,
          liteBooking.rowBetween,
          pressed && liteBooking.pressed,
        ]}
        onPress={onComingSoon}
      >
        <Text style={[liteBooking.cardTitle, liteBooking.flexCol]}>
          {t('hotels.booking.payment.paymentSummary')}
        </Text>
        <HomeIcon name="chevronDown" width={16} height={10} color={colors.primary} />
      </Pressable>

      <View style={styles.secure}>
        <HomeIcon name="shieldSimple" width={20} height={25} color={colors.statusPaid} />
        <View style={liteBooking.flexCol}>
          <Text style={styles.secureTitle}>{t('hotels.booking.payment.secureTitle')}</Text>
          <Text style={liteBooking.note}>{t('hotels.booking.payment.secureDesc')}</Text>
        </View>
      </View>

      <View style={styles.badges}>
        {TRUST_BADGES.map((badge) => (
          <View key={badge.key} style={styles.badge}>
            <HomeIcon
              name={badge.icon}
              width={badge.width * 1.5}
              height={badge.height * 1.5}
              color={CARD_HEADING}
            />
            <Text style={styles.badgeText}>{t(`hotels.booking.payment.badges.${badge.key}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 一行支付方式。给了 `badge`(Coming soon)即视为未开通:整行置灰、右侧不画勾选框,
 * 点按由调用方弹提示;`checked` 只对已开通的渠道有意义。
 */
function MethodRow({
  icon,
  title,
  desc,
  brands,
  badge,
  checked = false,
  onPress,
}: {
  icon: ImageSourcePropType;
  title: string;
  desc?: string;
  brands?: { key: string; source: ImageSourcePropType; width: number }[];
  badge?: string;
  checked?: boolean;
  onPress: () => void;
}) {
  const disabled = Boolean(badge);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.method,
        disabled && styles.methodDisabled,
        checked && styles.methodChecked,
        pressed && liteBooking.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.methodTile}>
          <Image source={icon} style={styles.methodIcon} resizeMode="contain" />
        </View>
        <View style={liteBooking.flexCol}>
          <Text style={styles.methodTitle}>{title}</Text>
          {desc ? <Text style={liteBooking.note}>{desc}</Text> : null}
          {brands ? (
            <View style={styles.brands}>
              {brands.map((brand) => (
                <Image
                  key={brand.key}
                  source={brand.source}
                  style={{ width: brand.width * 1.3, height: 22 }}
                  resizeMode="contain"
                />
              ))}
            </View>
          ) : null}
          {badge ? <Text style={styles.methodBadge}>{badge}</Text> : null}
        </View>
      </View>
      {disabled ? null : (
        <HomeIcon
          name={checked ? 'checkboxIndeterminate' : 'checkbox'}
          size={28}
          color={checked ? colors.primary : colors.softBlue}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  rowLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },

  pointsChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  pointsText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: colors.primary },
  total: { fontFamily: fonts.interBold, fontSize: 36, lineHeight: 44, color: colors.primary },

  insufficient: {
    marginTop: -12,
    fontFamily: fonts.interSemi,
    fontSize: 18,
    lineHeight: 24,
    color: colors.danger,
  },

  /* ---- 钱包卡 ---- */
  wallet: {
    flexDirection: 'row',
    padding: 24,
    borderRadius: radius.card,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  walletBody: { flex: 1, minWidth: 0, gap: 8 },
  walletHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletTitle: {
    fontFamily: fonts.inter,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.8,
    opacity: 0.9,
    color: '#FFFFFF',
  },
  walletAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletCurrency: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 32,
    opacity: 0.8,
    color: '#FFFFFF',
  },
  walletAmount: { fontFamily: fonts.interBold, fontSize: 36, lineHeight: 40, color: '#FFFFFF' },
  walletHint: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.6,
    opacity: 0.75,
    color: '#FFFFFF',
  },
  walletInfo: { alignSelf: 'flex-start' },

  /* ---- 支付方式 ---- */
  group: { gap: 16 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  methodDisabled: { opacity: 0.45 },
  methodChecked: { borderColor: colors.primary },
  methodTile: {
    width: 64,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: PAY_TILE_BG,
    overflow: 'hidden',
  },
  methodIcon: { width: '100%', height: '100%' },
  methodTitle: { fontFamily: fonts.interBold, fontSize: 22, lineHeight: 30, color: colors.heading },
  methodBadge: {
    paddingTop: 4,
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    color: colors.orange,
  },
  brands: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },

  /* ---- 优惠券 ---- */
  coupon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  couponTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: PAY_TILE_BG,
  },
  couponTitle: { fontFamily: fonts.interBold, fontSize: 22, lineHeight: 30, color: '#FFFFFF' },
  couponDesc: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 26, color: colors.softBlue },

  /* ---- 返现 ---- */
  cashback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(65, 105, 237, 0.3)',
    backgroundColor: TINT_CHIP,
  },
  cashbackIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  cashbackTitle: { fontFamily: fonts.interBold, fontSize: 22, lineHeight: 30, color: colors.primary },

  /* ---- 安全提示 ---- */
  secure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: '#DCE9FF',
  },
  secureTitle: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 28, color: CARD_HEADING },

  /* ---- 合规标(设计稿整块 60% 不透明度) ---- */
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    opacity: 0.6,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: FORM_TEXT },
});
