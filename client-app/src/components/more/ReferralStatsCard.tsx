/**
 * 推荐奖励统计卡(设计稿 1687:4142,Refer & Earn 与 Referral Status 两页共用)
 *
 * 上半:20 钱包图标 + 「Total Rewards Earned」Outfit 600/12 `--text-2` + 金额 Inter 700/16 + 币种主色;
 * 下半:一条分隔线 + 三格数字(已邀请深色 / 待结算 `--orange` / 已奖励主色,标签 Inter 400/10)。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { REFERRAL_STATS } from '@/screens/more/moreDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

export default function ReferralStatsCard() {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const cells = [
    { key: 'invited', value: REFERRAL_STATS.invited, color: colors.heading },
    { key: 'pending', value: REFERRAL_STATS.pending, color: colors.orange },
    { key: 'rewarded', value: REFERRAL_STATS.rewarded, color: colors.primary },
  ] as const;

  return (
    <View style={[moreShared.panel, styles.card]}>
      <View style={styles.head}>
        <HomeIcon name="wallet20" size={20} color={colors.primary} />
        <View style={styles.headText}>
          <Text style={styles.headLabel}>{t('more.referral.totalRewards')}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>
              {formatAmount(REFERRAL_STATS.totalRewards, currency)}
            </Text>
            <Text style={styles.currency}>{currency}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsBlock}>
        <View style={styles.line} />
        <View style={styles.cells}>
          {cells.map((cell) => (
            <View key={cell.key} style={styles.cell}>
              <Text style={[styles.cellValue, { color: cell.color }]}>{cell.value}</Text>
              <Text style={styles.cellLabel}>{t(`more.referral.stats.${cell.key}`)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.9 },
  headText: { flex: 1, minWidth: 0 },
  headLabel: {
    fontFamily: fonts.outfitSemi,
    fontSize: 12,
    lineHeight: 20,
    color: colors.textSoft,
  },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  amount: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  currency: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  statsBlock: { gap: 8 },
  /* 设计稿 Line 3 的描边色(= --secondary) */
  line: { height: 1, backgroundColor: colors.softBlue },
  cells: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  cellValue: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24 },
  cellLabel: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.textSoft,
  },
});
