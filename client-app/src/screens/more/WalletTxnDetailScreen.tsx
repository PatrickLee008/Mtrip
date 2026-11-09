/**
 * 钱包交易详情(Figma `mTrip Wallet - Transaction Detail (Refund)` 3452:8470 / `(Payment)` 3452:9053)
 *
 * 抬头卡:64 主色勾 + 类型名 + 大号金额(入账绿 / 出账红,后跟币种)+「Completed」胶囊,右上与左下各一团柔光;
 * 信息卡「TRANSACTION INFORMATION」:流水号(可复制)/ 时间 / 类型 / 预订号(主色,可复制)/ 物业 / 说明。
 * 流水行由列表页整条带过来(路由参数),不再二次请求;没有关联预订的流水不出预订号与物业两行。
 * 流水都是已落账的,状态恒为 Completed。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  WALLET_GREEN,
  WALLET_KIND_ICON,
  walletAmountColor,
  walletDetailTime,
  walletKind,
  walletSign,
} from '@/screens/more/walletFormat';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

export default function WalletTxnDetailScreen() {
  const { t, i18n } = useTranslation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'WalletTxnDetail'>>();
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);
  const log = params.log;
  const kind = walletKind(log);
  const amount = Math.abs(Number(log.amount));

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    showToast(t('more.wallet.detail.copied'));
  };

  return (
    <MorePageLayout title={t('more.wallet.detail.title')}>
      <View style={styles.hero}>
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />
        <HomeIcon name="checkCircle64" size={64} color={colors.primary} />
        <Text style={styles.heroType}>{t(`more.wallet.kinds.${kind}`)}</Text>
        <View style={styles.heroAmountRow}>
          <Text style={[styles.heroAmount, { color: walletAmountColor(log) }]}>
            {`${walletSign(log)}${formatAmount(amount, currency)}`}
          </Text>
          <Text style={styles.heroCurrency}>{currency}</Text>
        </View>
        <View style={styles.status}>
          <HomeIcon name="statusCheck" size={13.333} color={WALLET_GREEN} />
          <Text style={styles.statusText}>{t('more.wallet.detail.completed')}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>{t('more.wallet.detail.info')}</Text>
        <View style={styles.rows}>
          <Row label={t('more.wallet.detail.txnId')}>
            <Text style={styles.value}>{log.txn_no}</Text>
            <CopyButton label={t('more.wallet.detail.copy')} onPress={() => void copy(log.txn_no)} />
          </Row>
          <Row label={t('more.wallet.detail.time')}>
            <Text style={styles.value}>{walletDetailTime(log, i18n.language)}</Text>
          </Row>
          {/* 设计稿退款 / 支付两张详情的类型行都是业务品类「Hotel Stay」+ building(流水类型已在抬头卡);
              没关联预订的流水(调账、推荐返利等)没有品类,退回显示流水类型 */}
          <Row label={t('more.wallet.detail.type')}>
            <View style={styles.typeChip}>
              <HomeIcon name={log.booking_no ? 'building' : WALLET_KIND_ICON[kind]} size={20} color={colors.primary} />
              <Text style={styles.value}>
                {log.booking_no ? t('more.wallet.detail.hotelStay') : t(`more.wallet.kinds.${kind}`)}
              </Text>
            </View>
          </Row>
          {log.booking_no ? (
            <>
              <Row label={t('more.wallet.detail.bookingId')} shrinkLabel>
                {/* 预订号 20+ 位纯数字,不截断(用户要照着核对)也折不了行,让标签折成两行让位 */}
                <Text style={[styles.value, styles.link, styles.noShrink]}>
                  {log.booking_no}
                </Text>
                <CopyButton label={t('more.wallet.detail.copy')} onPress={() => void copy(log.booking_no)} />
              </Row>
              <Row label={t('more.wallet.detail.property')}>
                <Text style={[styles.value, styles.alignRight]} numberOfLines={2}>
                  {log.property_name || '-'}
                </Text>
              </Row>
            </>
          ) : null}
          <Row label={t('more.wallet.detail.description')} top>
            <Text style={styles.desc}>{t(`more.wallet.descriptions.${kind}`)}</Text>
          </Row>
        </View>
      </View>
    </MorePageLayout>
  );
}

function Row({
  label,
  top,
  shrinkLabel,
  children,
}: {
  label: string;
  top?: boolean;
  /** 值是长串不可折行内容时,让标签折行让位 */
  shrinkLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, top && styles.rowTop]}>
      <Text style={[styles.label, shrinkLabel && styles.labelShrink]}>{label}</Text>
      <View style={[styles.rowValue, shrinkLabel && styles.noShrink]}>{children}</View>
    </View>
  );
}

function CopyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.copy, pressed && moreShared.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <HomeIcon name="copyRegular" size={20} color={colors.primary} />
    </Pressable>
  );
}

const TEXT_DARK = '#111C2D';

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 234,
    padding: 24,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  /* 设计稿两团 186 圆形柔光(20px 模糊);RN 无 blur,用低透明度圆近似 */
  glow: { position: 'absolute', width: 186, height: 186, borderRadius: 93 },
  glowTop: { top: -94, right: -94, backgroundColor: 'rgba(108,248,187,0.18)' },
  glowBottom: { top: 140, left: -94, backgroundColor: 'rgba(222,232,255,0.5)' },
  heroType: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 22, color: colors.heading, textAlign: 'center' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroAmount: { fontFamily: fonts.interBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  heroCurrency: { fontFamily: fonts.interSemi, fontSize: 19, lineHeight: 26, letterSpacing: -0.8, color: '#8B8C91' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  statusText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.24, color: WALLET_GREEN },

  info: {
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  infoTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8B8C91',
  },
  rows: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTop: { alignItems: 'flex-start' },
  rowValue: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  label: { flexShrink: 0, fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: '#8B8C91' },
  labelShrink: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  value: { flexShrink: 1, fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: TEXT_DARK },
  alignRight: { textAlign: 'right' },
  link: { color: '#1F4ED3' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 8 },
  desc: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 15, lineHeight: 22, color: colors.heading, textAlign: 'right' },
  copy: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.softBlue,
  },
});
