/**
 * mTrip 钱包卡(多房间新稿 3465:9556 / 3465:9596;单房型支付页同一张卡,只是底部是「可用余额」文字)。
 *
 * 设计稿是 149.5° 的 #204DDA → #4169ED 渐变,RN 无原生线性渐变,用 svg 画。
 * 传 `toggle` 时底部换成「Use wallet」开关(开 = 用钱包支付)。
 * 返回卡片 + 余额不足红字两个兄弟节点,红字用负 margin 贴近卡片,间距由父容器的 gap(24)决定。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { DEEP_PRIMARY, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

interface Props {
  /** 钱包可用余额 */
  balance: number;
  /** 余额不足以支付本单:卡片下方给一行红字 */
  insufficient?: boolean;
  /** 右上角 i */
  onInfo: () => void;
  /** 「Use wallet」开关;不传则底部显示「可用余额」 */
  toggle?: { on: boolean; onChange: (on: boolean) => void };
}

export default function WalletCard({ balance, insufficient = false, onInfo, toggle }: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  return (
    <>
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
          {toggle ? (
            <Pressable
              style={({ pressed }) => [styles.toggleRow, pressed && bookingShared.pressed]}
              onPress={() => toggle.onChange(!toggle.on)}
              hitSlop={6}
              accessibilityRole="switch"
              accessibilityState={{ checked: toggle.on }}
            >
              {/* 稿面开关:54×28 白底胶囊 + 24 主色圆点;开 = 圆点在右,关 = 圆点在左并褪成浅蓝 */}
              <View style={styles.toggleTrack}>
                <View style={[styles.toggleKnob, toggle.on ? styles.toggleKnobOn : styles.toggleKnobOff]} />
              </View>
              <Text style={styles.toggleText}>{t('hotels.booking.payment.useWallet')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.walletHint}>{t('hotels.booking.payment.availableBalance')}</Text>
          )}
        </View>
        <Pressable style={styles.walletInfo} onPress={onInfo} hitSlop={8}>
          <HomeIcon name="infoCircle" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {insufficient ? (
        <Text style={styles.insufficient}>{t('hotels.booking.payment.insufficient')}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  toggleTrack: { width: 54, height: 28, borderRadius: 24, backgroundColor: colors.surface },
  toggleKnob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 24 },
  toggleKnobOff: { left: 3, backgroundColor: colors.softBlue },
  toggleKnobOn: { right: 3, backgroundColor: colors.primary },
  toggleText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  insufficient: {
    marginTop: -12,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.danger,
  },
});
