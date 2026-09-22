/**
 * Step 4 · 支付(设计稿 1675:6537;多住宿态 1675:9158 —— 同一组件,只是没有进度条、汇总卡多一行眉头)
 *
 * 结构:汇总卡 → mTrip 钱包渐变卡 → Popular Payment Method ×3 → Other Payment Methods
 *      (钱包 / 到店 / 可展开的卡组织 / 可展开的手机银行)→ COUPONS 卡 → 返现横幅 →
 *      Payment Summary 折叠卡 → Secure Payment Guarantee → 三枚合规标。
 *
 * **本期只有 mTrip 钱包余额是真渠道**:余额那行可单选并真扣款,其余渠道(MMQR / KBZPay /
 * Wave Pay / 到店付 / 银行卡 / 手机银行)统一置灰挂 Coming soon 角标,点按只弹提示不选中。
 * 优惠券、Payment Summary 展开、新增卡片、Pay by other/Share 同样走 comingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import {
  TEMP_CARD_BRANDS,
  TEMP_PAY_ICONS,
  TEMP_PAY_MOBILE_BANKING,
  TEMP_PAY_MOBILE_BANKING_LOGO,
} from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import PaymentMethodRow from '@/components/hotel/booking/PaymentMethodRow';
import {
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  PAY_TILE_BG,
  TINT_CHIP,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  BOOKING_DEMO,
  CARD_BRANDS,
  MOBILE_BANKING_BRANDS,
  PAYMENT_OTHER,
  PAYMENT_POPULAR,
  SAVED_CARDS,
  TRUST_BADGES,
  type PaymentMethodKey,
} from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

/**
 * 结账优惠券(C-M6)。不传 = COUPONS 卡维持占位(点了只弹 Coming soon)——
 * 关怀模式 / 演示模式 / 未登录走这条路,行为与从前一致。
 */
export interface PaymentCouponState {
  /** 已应用的券;null = 当前没用券 */
  applied: { receiveId: number; name: string; discount: number } | null;
  /** 本单是否有可用券(决定卡片副标题是「选一张」还是「暂无可用」) */
  hasUsable: boolean;
  loading: boolean;
  /** 打开选券弹窗 */
  onOpen: () => void;
}

interface Props {
  /** 汇总卡由页面渲染后作为 children 传进来(单住宿 / 多住宿两种眉头) */
  summary: React.ReactNode;
  method: PaymentMethodKey | null;
  expanded: 'card' | 'mobileBanking' | null;
  /** 钱包可用余额:真实模式取 `/app/user/me`,演示模式回落设计稿数值 */
  balance: number;
  /** 余额不足以支付本单(由页面用实付金额比出来),在钱包卡下方给一行红字提示 */
  insufficient?: boolean;
  onSelect: (key: PaymentMethodKey) => void;
  onToggleExpand: (key: 'card' | 'mobileBanking') => void;
  onComingSoon: () => void;
  coupon?: PaymentCouponState;
}

export default function BookingStepPayment({
  summary,
  method,
  expanded,
  balance,
  insufficient = false,
  onSelect,
  onToggleExpand,
  onComingSoon,
  coupon,
}: Props) {
  const { t } = useTranslation();
  /**
   * 未开放渠道默认折叠(用户 2026-09-22 定的)。本期只有 mTrip 钱包能真扣款,
   * 其余六个渠道全是 Coming soon —— 摊开来占一屏多,还容易让人以为能选。
   * 纯展示态,不用提到页面上去。
   */
  const [moreOpen, setMoreOpen] = React.useState(false);
  const currency = useSiteStore((s) => s.currency);
  const comingSoonBadge = t('home.comingSoon');

  const brands = CARD_BRANDS.map((brand) => ({
    key: brand.key,
    source: TEMP_CARD_BRANDS[brand.key],
    width: brand.width,
  }));
  const bankBrands = MOBILE_BANKING_BRANDS.map((key) => ({
    key,
    source: TEMP_PAY_ICONS[key],
    width: 24,
  }));

  /* 券卡三态:加载中 / 已用券(显示券名)/ 有可用券(选一张)/ 没有可用券(不可点) */
  const couponDisabled = coupon ? !coupon.applied && !coupon.hasUsable && !coupon.loading : false;
  const couponDesc = (() => {
    if (!coupon) return t('hotels.booking.payment.couponsDesc');
    if (coupon.applied) return coupon.applied.name;
    if (coupon.loading) return t('common.loading');
    return coupon.hasUsable
      ? t('hotels.booking.payment.couponsDesc')
      : t('hotels.booking.coupon.none');
  })();

  return (
    <View style={styles.root}>
      {summary}

      {/* mTrip 钱包卡:设计稿是 149.5° 的 #204DDA → #4169ED 渐变,RN 无原生线性渐变,用 svg 画 */}
      <View style={styles.wallet}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="bookingWallet" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={DEEP_PRIMARY} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bookingWallet)" />
        </Svg>

        <View style={styles.walletBody}>
          <View style={styles.walletHead}>
            <HomeIcon name="wallet" width={15.833} height={15} color="#FFFFFF" />
            <Text style={styles.walletTitle}>{t('hotels.booking.payment.wallet')}</Text>
          </View>
          <View style={styles.walletAmountRow}>
            <Text style={styles.walletCurrency}>{currency}</Text>
            <Text style={styles.walletAmount}>{formatAmount(balance, currency)}</Text>
          </View>
          <Text style={styles.walletHint}>{t('hotels.booking.payment.availableBalance')}</Text>
        </View>
        <Pressable style={styles.walletInfo} onPress={onComingSoon} hitSlop={8}>
          <HomeIcon name="infoCircle" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {insufficient ? (
        <Text style={styles.insufficient}>{t('hotels.booking.payment.insufficient')}</Text>
      ) : null}

      <View style={styles.group}>
        {/**
         * 稿面(284:1145)是「Popular ×3 → Other ×4」全部摊开,这里**有意偏离**:
         * 能真扣款的只有 mTrip 钱包,所以钱包常驻在上,其余六个未开放渠道收进下面那个折叠区。
         * 折叠区展开后的内容与顺序仍按稿面(Popular ×3 → 到店付 → 银行卡 → 手机银行)。
         */}
        <Text style={styles.groupTitle}>{t('hotels.booking.payment.other')}</Text>
        <PaymentMethodRow
          icon={TEMP_PAY_ICONS.wallet}
          deepTile
          title={t('hotels.booking.payment.methods.wallet.title')}
          desc={t('hotels.booking.payment.methods.wallet.desc', {
            amount: formatMoney(balance, currency),
          })}
          checked={method === 'wallet'}
          onPress={() => onSelect('wallet')}
        />

        {/* 未开放渠道的折叠头:点一下展开/收起,不参与选中 */}
        <Pressable
          style={({ pressed }) => [styles.moreHead, pressed && bookingShared.pressed]}
          onPress={() => setMoreOpen((prev) => !prev)}
        >
          <View style={styles.moreHeadText}>
            <Text style={styles.moreTitle}>{t('hotels.booking.payment.moreMethods')}</Text>
            <Text style={styles.moreDesc}>{t('hotels.booking.payment.moreMethodsDesc')}</Text>
          </View>
          <View style={moreOpen ? styles.chevronUp : undefined}>
            <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.textSoft} />
          </View>
        </Pressable>

        {moreOpen ? (
          <>
            <Text style={styles.groupTitle}>{t('hotels.booking.payment.popular')}</Text>
            {PAYMENT_POPULAR.map((key) => (
              <PaymentMethodRow
                key={key}
                icon={TEMP_PAY_ICONS[key]}
                iconInset={key === 'mmqr'}
                title={t(`hotels.booking.payment.methods.${key}.title`)}
                desc={t(`hotels.booking.payment.methods.${key}.desc`)}
                disabled
                badge={comingSoonBadge}
                onPress={onComingSoon}
              />
            ))}

            {PAYMENT_OTHER.filter((key) => key !== 'wallet').map((key) => (
              <PaymentMethodRow
                key={key}
                icon={TEMP_PAY_ICONS[key]}
                title={t('hotels.booking.payment.methods.hotel.title')}
                desc={t('hotels.booking.payment.methods.hotel.desc')}
                disabled
                badge={comingSoonBadge}
                onPress={onComingSoon}
              />
            ))}

            <PaymentMethodRow
              icon={TEMP_PAY_ICONS.card}
              title={t('hotels.booking.payment.methods.card.title')}
              brands={brands}
              expandable
              expanded={expanded === 'card'}
              disabled
              badge={comingSoonBadge}
              onPress={() => onToggleExpand('card')}
            >
              {SAVED_CARDS.map((card) => (
                <Pressable
                  key={card.key}
                  style={({ pressed }) => [styles.savedCard, styles.disabled, pressed && bookingShared.pressed]}
                  onPress={onComingSoon}
                >
                  <View style={styles.savedLeft}>
                    <View style={styles.savedTile}>
                      <HomeIcon name="wallet" width={15.833} height={15} color={DEEP_PRIMARY} />
                    </View>
                    <View>
                      <Text style={styles.savedTitle}>
                        {t('hotels.booking.payment.savedCard', { last4: card.last4 })}
                      </Text>
                      <Text style={styles.savedDesc}>
                        {t('hotels.booking.payment.cardExpires', { date: card.expires })}
                      </Text>
                    </View>
                  </View>
                  <HomeIcon name="checkbox" size={24} color={colors.softBlue} />
                </Pressable>
              ))}
              <Pressable
                style={({ pressed }) => [styles.addCard, pressed && bookingShared.pressed]}
                onPress={onComingSoon}
              >
                <Text style={styles.savedDesc}>{t('hotels.booking.payment.addCard')}</Text>
                <Text style={styles.savedDesc}>+</Text>
              </Pressable>
            </PaymentMethodRow>

            <PaymentMethodRow
              icon={TEMP_PAY_MOBILE_BANKING}
              iconOverlay={TEMP_PAY_MOBILE_BANKING_LOGO}
              title={t('hotels.booking.payment.methods.mobileBanking.title')}
              brands={bankBrands}
              expandable
              expanded={expanded === 'mobileBanking'}
              disabled
              badge={comingSoonBadge}
              onPress={() => onToggleExpand('mobileBanking')}
            >
              <Pressable
                style={({ pressed }) => [styles.addCard, styles.disabled, pressed && bookingShared.pressed]}
                onPress={onComingSoon}
              >
                <Text style={styles.savedDesc}>
                  {t('hotels.booking.payment.methods.mobileBanking.title')}
                </Text>
                <HomeIcon name="checkbox" size={24} color={colors.softBlue} />
              </Pressable>
            </PaymentMethodRow>
          </>
        ) : null}

        {/**
         * COUPONS 卡(516:2381):券从第 3 步挪到这里(用户 2026-09-22 定的)——
         * 选券会改实付金额,放在钱包余额旁边才看得出「够不够付」。
         * 副标题三态:已用券显示券名 / 有可用券显示「选一张」/ 没有可用券显示「暂无」且整卡不可点。
         * 不传 `coupon` 时维持原来的占位行为(演示 / 关怀 / 未登录)。
         */}
        <Text style={bookingShared.overline}>{t('hotels.booking.payment.couponsLabel')}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.coupon,
            couponDisabled && styles.couponIdle,
            pressed && !couponDisabled && bookingShared.pressed,
          ]}
          onPress={couponDisabled ? undefined : (coupon?.onOpen ?? onComingSoon)}
          disabled={couponDisabled}
        >
          <View style={styles.savedLeft}>
            <View style={styles.couponTile}>
              <HomeIcon name="ticketDiagonal20" size={20} color={DEEP_PRIMARY} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.couponTitle}>{t('hotels.booking.payment.couponsTitle')}</Text>
              <Text style={styles.couponDesc} numberOfLines={1}>
                {couponDesc}
              </Text>
            </View>
          </View>
          {coupon?.applied ? (
            <Text style={styles.couponSaved}>
              {`- ${formatAmount(coupon.applied.discount, currency)}`}
            </Text>
          ) : (
            <HomeIcon name="chevronDown" width={12} height={7.4} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      <View style={styles.cashback}>
        <View style={styles.savedLeft}>
          <View style={styles.cashbackIcon}>
            <HomeIcon name="megaphone" width={21.55} height={20.5} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cashbackTitle}>
              {t('hotels.booking.payment.cashbackTitle', { percent: BOOKING_DEMO.cashbackPercent })}
            </Text>
            <Text style={styles.cashbackDesc}>
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
        style={({ pressed }) => [bookingShared.panel, styles.summaryRow, pressed && bookingShared.pressed]}
        onPress={onComingSoon}
      >
        <Text style={styles.summaryTitle}>{t('hotels.booking.payment.paymentSummary')}</Text>
        <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.primary} />
      </Pressable>

      <View style={styles.secure}>
        <HomeIcon name="shieldSimple" width={16} height={20} color={colors.statusPaid} />
        <View style={styles.flex}>
          <Text style={styles.secureTitle}>{t('hotels.booking.payment.secureTitle')}</Text>
          <Text style={styles.secureDesc}>{t('hotels.booking.payment.secureDesc')}</Text>
        </View>
      </View>

      <View style={styles.badges}>
        {TRUST_BADGES.map((badge) => (
          <View key={badge.key} style={styles.badge}>
            <HomeIcon
              name={badge.icon}
              width={badge.width}
              height={badge.height}
              color={CARD_HEADING}
            />
            <Text style={styles.badgeText}>{t(`hotels.booking.payment.badges.${badge.key}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  flex: { flex: 1, minWidth: 0 },
  /** 未开通渠道展开后的内容,与 PaymentMethodRow 的置灰口径一致 */
  disabled: { opacity: 0.45 },
  insufficient: {
    marginTop: -12,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
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
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8,
    opacity: 0.9,
    color: '#FFFFFF',
  },
  walletAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walletCurrency: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 28,
    opacity: 0.8,
    color: '#FFFFFF',
  },
  walletAmount: { fontFamily: fonts.interBold, fontSize: 28, lineHeight: 28, color: '#FFFFFF' },
  walletHint: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    opacity: 0.75,
    color: '#FFFFFF',
  },
  walletInfo: { alignSelf: 'flex-start' },

  /* ---- 支付方式 ---- */
  group: { gap: 12 },
  groupTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: CARD_HEADING },

  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  savedLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  savedTile: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: PAY_TILE_BG,
  },
  savedTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  savedDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },

  /* ---- 优惠券 ---- */
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
  /* 已抵扣额:与券名同卡,右侧白色加粗 */
  couponSaved: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  /* 没有可用券:整卡压暗且不可点 */
  couponIdle: { opacity: 0.55 },

  /* ---- 未开放渠道的折叠头 ---- */
  moreHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 17,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  moreHeadText: { gap: 2 },
  moreTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: CARD_HEADING },
  moreDesc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  chevronUp: { transform: [{ rotate: '180deg' }] },

  /* ---- 返现 ---- */
  cashback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(65, 105, 237, 0.3)',
    backgroundColor: TINT_CHIP,
  },
  cashbackIcon: {
    width: 36.86,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  cashbackTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.primary },
  cashbackDesc: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.textSoft,
  },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: CARD_HEADING },

  /* ---- 安全提示 ---- */
  secure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: '#DCE9FF',
  },
  secureTitle: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: CARD_HEADING,
  },
  secureDesc: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: FORM_TEXT,
  },

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
  badgeText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: CARD_HEADING,
  },
});
