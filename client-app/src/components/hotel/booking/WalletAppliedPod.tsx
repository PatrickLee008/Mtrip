/**
 * 「mTrip Wallet Applied」抵扣小卡(Figma `3465:9396`,Booking Flow 759:9777;钱包部分抵扣 PRD 模块 25)
 *
 * 钱包开关开着且确实抵扣了金额时,放在钱包卡下方(完整模式第 2 步核对页 / 支付页)说明这次钱包怎么用:
 *   头行     28 圆 #6CF8BB + 勾 /「mTrip Wallet Applied」700 14/20 #111C2D / 右「Applied」胶囊(rgba(0,108,73,.15) 底 #006C49 字)
 *   可用余额  400 13/18 #434654 ── 500 15/22 #111C2D
 *   本次抵扣  「Wallet Credit Used」500 15/22 #B80035 ── 「- MMK 80,000」700 14/20 #B80035
 *   分隔线    1px #DEE8FF(上下各 4)
 *   抵扣后余额 钱包小图标 +「Balance Remaining After Stay」400 13/18 #434654 ── 700 12/16 #006C49
 * 外壳 #F0F3FF 圆角 16 padding 16 gap 10。稿面字体是 Plus Jakarta Sans,本工程只打包了 Inter / Outfit,按同字重换 Inter。
 *
 * **稿面之外补了一行「还需另付」**(`due > 0` 才显示):钱包付不清全额(余额或单笔限额不够)时,
 * 剩余部分要用其他渠道付,不写出来的话用户只看到抵扣额,不知道还要付多少。
 * 受单笔限额约束(`capped`)时这一行下面再给一句限额说明。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/* 稿面专用色(主题里没有同值令牌) */
const POD_BG = '#F0F3FF';
const POD_TITLE = '#111C2D';
const POD_MUTED = '#434654';
const POD_CHECK_BG = '#6CF8BB';
const POD_GREEN = '#006C49';
const POD_GREEN_TINT = 'rgba(0, 108, 73, 0.15)';
const POD_DEBIT = '#B80035';
const POD_DIVIDER = '#DEE8FF';

interface Props {
  /** 钱包当前可用余额(抵扣前) */
  balance: number;
  /** 本次抵扣额 */
  applied: number;
  /** 抵扣后还要用其他渠道付的金额;0 不显示该行 */
  due?: number;
  /** 抵扣额被单笔限额截住(余额本来够更多);给一句限额说明 */
  cap?: number;
}

export default function WalletAppliedPod({ balance, applied, due = 0, cap = 0 }: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const capped = cap > 0 && applied >= cap - 0.005 && balance > cap;

  return (
    <View style={styles.pod}>
      <View style={styles.row}>
        <View style={styles.headLeft}>
          <View style={styles.checkDot}>
            <HomeIcon name="checkSmall" width={12.225} height={9.019} color={POD_GREEN} />
          </View>
          <Text style={styles.title}>{t('hotels.booking.wallet.appliedTitle')}</Text>
        </View>
        <View style={styles.appliedPill}>
          <Text style={styles.appliedText}>{t('hotels.booking.wallet.appliedBadge')}</Text>
        </View>
      </View>

      <View style={[styles.row, styles.firstLine]}>
        <Text style={styles.label}>{t('hotels.booking.wallet.availableBalance')}</Text>
        <Text style={styles.value}>{formatMoney(balance, currency)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.debitLabel}>{t('hotels.booking.review.walletCredit')}</Text>
        <Text style={styles.debitValue}>- {formatMoney(applied, currency)}</Text>
      </View>

      {due > 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('hotels.booking.wallet.remainingDue')}</Text>
          <Text style={styles.value}>{formatMoney(due, currency)}</Text>
        </View>
      ) : null}
      {due > 0 && capped ? (
        <Text style={styles.capNote}>
          {t('hotels.booking.wallet.capNote', { amount: formatMoney(cap, currency) })}
        </Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.remainLeft}>
          <HomeIcon name="wallet" width={12.667} height={12} color={POD_MUTED} />
          <Text style={styles.label}>{t('hotels.booking.wallet.balanceAfter')}</Text>
        </View>
        <Text style={styles.remainValue}>{formatMoney(Math.max(0, balance - applied), currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pod: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: POD_BG, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  firstLine: { paddingTop: 4 },
  headLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkDot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: POD_CHECK_BG,
  },
  title: { flexShrink: 1, fontFamily: fonts.interBold, fontSize: 14, lineHeight: 20, color: POD_TITLE },
  appliedPill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: POD_GREEN_TINT },
  appliedText: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: POD_GREEN,
  },
  label: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 13, lineHeight: 18, color: POD_MUTED },
  value: { fontFamily: fonts.interMedium, fontSize: 15, lineHeight: 22, color: POD_TITLE },
  debitLabel: { flexShrink: 1, fontFamily: fonts.interMedium, fontSize: 15, lineHeight: 22, color: POD_DEBIT },
  debitValue: { fontFamily: fonts.interBold, fontSize: 14, lineHeight: 20, color: POD_DEBIT },
  capNote: { marginTop: -6, fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  divider: { height: 1, marginVertical: 4, backgroundColor: POD_DIVIDER },
  remainLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  remainValue: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: POD_GREEN,
  },
});
