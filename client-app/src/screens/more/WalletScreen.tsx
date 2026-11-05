/**
 * mTrip 钱包(Figma section `mTrip Wallet` 3452:8469:History 3452:9373 / Refunds 3606:11554 /
 * Spend 3606:11734 / Expired 3606:11941 / no history 3452:8646 / How it work overlay 3452:9744)
 *
 * 自上而下:余额卡(主色斜向渐变 + 右侧 40% 钱包插画)→ 四页签(All / Refunds / Spend / Expired)→
 * 「Transaction History」+ 月份筛选胶囊 → 流水卡列表(View details 进交易详情)。
 * 顶栏右侧「?」打开「How mTrip wallet work」说明弹窗(QA MTW_TC_001)。
 *
 * 设计稿实测:
 *   余额卡  padding 24 圆角 24;「Available Balance」Inter 600/16 白 75%;币种 Inter 500/16 白 80% + 金额 Inter 700/28;
 *           说明 Inter 400/10 白 75%
 *   页签    白底 p8 圆角 32;选中主色底圆角 16 白字,未选 --text-2;Inter 500/14
 *   标题行  Outfit 600/20;月份胶囊 --secondary 底 px8 py4 圆角 24,日历 20 + Outfit 600/16 主色 + 下拉
 *   流水卡  白底 1px --secondary 圆角 24 p20 gap12;类型 20 图标 + Inter 600/16;View details Inter 700/12 主色;
 *           金额 Inter 700/16(入账绿 / 出账红 / 过期灰);时间 Inter 600/10 --text-2;
 *           底部浅蓝条(主色 10% 圆角 8 px12 py4):物业名 + 预订号(主色),Inter 400/14
 *
 * 月份筛选默认「全部月份」:设计稿胶囊写的是具体月份,但默认只看当月会让 QA 看不到历史流水,
 * 选了月份后胶囊显示该月。Expired 页签:钱包余额目前没有过期机制,后端预留 change_type 6,列表恒空。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { fetchBalanceLogs, type BalanceLog, type BalanceLogType } from '@/api/user';
import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import SelectSheet from '@/components/hotel/booking/SelectSheet';
import MorePageLayout from '@/components/more/MorePageLayout';
import { DEEP_PRIMARY, moreShared } from '@/components/more/moreShared';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  WALLET_KIND_ICON,
  recentMonths,
  walletAmountColor,
  walletKind,
  walletListTime,
  walletSign,
} from '@/screens/more/walletFormat';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import { formatAmount } from '@/utils/format';

const CARD_ART = require('../../../assets/images/wallet/card-bg.png');
const TABS: BalanceLogType[] = ['all', 'refund', 'spend', 'expired'];
const PAGE_SIZE = 20;
/** 月份筛选「全部」的哨兵键 */
const ALL_MONTHS = 'all';

export default function WalletScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currency = useSiteStore((s) => s.currency);
  const profile = useUserStore((s) => s.profile);
  const refreshProfile = useUserStore((s) => s.refreshProfile);

  const [tab, setTab] = useState<BalanceLogType>('all');
  const [month, setMonth] = useState(ALL_MONTHS);
  const [monthOpen, setMonthOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [list, setList] = useState<BalanceLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** 切页签 / 月份时丢弃旧请求的返回 */
  const generation = useRef(0);

  const months = useMemo(() => recentMonths(i18n.language), [i18n.language]);
  const monthOptions = useMemo(
    () => [{ key: ALL_MONTHS, label: t('more.wallet.allMonths') }, ...months],
    [months, t],
  );
  const monthLabel = monthOptions.find((m) => m.key === month)?.label ?? t('more.wallet.allMonths');

  const load = useCallback(
    async (nextPage: number) => {
      const g = ++generation.current;
      setLoading(true);
      setFailed(false);
      try {
        const data = await fetchBalanceLogs({
          page: nextPage,
          pageSize: PAGE_SIZE,
          type: tab,
          month: month === ALL_MONTHS ? undefined : month,
        });
        if (g !== generation.current) return;
        setList((prev) => (nextPage === 1 ? data.list : [...prev, ...data.list]));
        setTotal(data.total);
        setPage(nextPage);
      } catch {
        if (g === generation.current) setFailed(true);
      } finally {
        if (g === generation.current) setLoading(false);
      }
    },
    [tab, month],
  );

  useEffect(() => {
    setList([]);
    void load(1);
  }, [load]);

  // 余额以服务端为准:从订房 / 退款回来时刷新一次
  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  return (
    <MorePageLayout
      title={t('more.wallet.title')}
      headerRight={
        <Pressable
          style={({ pressed }) => pressed && moreShared.pressed}
          onPress={() => setGuideOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('more.wallet.guide.title')}
        >
          <HomeIcon name="questionCircle" size={24} color={colors.primary} />
        </Pressable>
      }
    >
      {/* 余额卡 */}
      <View style={styles.balanceCard}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="walletPageGrad" x1="0" y1="0" x2="0.72" y2="1">
              <Stop offset="0" stopColor={DEEP_PRIMARY} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#walletPageGrad)" />
        </Svg>
        <Image source={CARD_ART} style={styles.cardArt} resizeMode="contain" />
        <View style={styles.balanceBody}>
          <View style={styles.balanceTitleRow}>
            <HomeIcon name="wallet" width={15.833} height={15} color="#FFFFFF" />
            <Text style={styles.balanceTitle}>{t('more.wallet.balanceLabel')}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currency}</Text>
            <Text style={styles.amountValue}>{formatAmount(profile?.balance ?? 0, currency)}</Text>
          </View>
          <Text style={styles.balanceHint}>{t('more.wallet.balanceHint')}</Text>
        </View>
      </View>

      <View style={styles.historyGroup}>
        {/* 四页签 */}
        <View style={styles.tabs}>
          {TABS.map((key) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {t(`more.wallet.tabs.${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.historyHead}>
          <Text style={styles.historyTitle}>{t('more.wallet.history')}</Text>
          <Pressable
            style={({ pressed }) => [styles.monthChip, pressed && moreShared.pressed]}
            onPress={() => setMonthOpen(true)}
          >
            <HomeIcon name="calendar2" size={20} color={colors.primary} />
            <Text style={styles.monthText}>{monthLabel}</Text>
            <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.primary} />
          </Pressable>
        </View>

        {list.map((log) => (
          <TxnCard
            key={log.id}
            log={log}
            currency={currency}
            lang={i18n.language}
            onDetail={() => navigation.navigate('WalletTxnDetail', { log })}
          />
        ))}

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {!loading && failed ? (
          <Pressable onPress={() => void load(page)}>
            <Text style={styles.empty}>{t('more.wallet.loadFailed')}</Text>
          </Pressable>
        ) : null}
        {!loading && !failed && list.length === 0 ? (
          <View style={styles.emptyBox}>
            <HomeIcon name="wallet20" size={32} color={colors.textSoft} />
            <Text style={styles.empty}>{t('more.wallet.empty')}</Text>
          </View>
        ) : null}
        {!loading && list.length < total ? (
          <Pressable onPress={() => void load(page + 1)}>
            <Text style={styles.more}>{t('more.wallet.loadMore')}</Text>
          </Pressable>
        ) : null}
      </View>

      <SelectSheet
        visible={monthOpen}
        title={t('more.wallet.selectMonth')}
        options={monthOptions}
        value={month}
        onClose={() => setMonthOpen(false)}
        onSelect={(key) => {
          setMonth(key);
          setMonthOpen(false);
        }}
      />
      <WalletGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </MorePageLayout>
  );
}

/** 一条流水卡;过期流水没有关联预订,不出 View details 与底部浅蓝条 */
function TxnCard({
  log,
  currency,
  lang,
  onDetail,
}: {
  log: BalanceLog;
  currency: string;
  lang: string;
  onDetail: () => void;
}) {
  const { t } = useTranslation();
  const kind = walletKind(log);
  const color = walletAmountColor(log);
  const amount = Math.abs(Number(log.amount));
  return (
    <View style={styles.txnCard}>
      <View style={styles.txnTop}>
        <View style={styles.txnHead}>
          <View style={styles.txnTitleRow}>
            <HomeIcon name={WALLET_KIND_ICON[kind]} size={20} color={colors.primary} />
            <Text style={styles.txnTitle}>{t(`more.wallet.kinds.${kind}`)}</Text>
          </View>
          {kind !== 'expired' ? (
            <Pressable onPress={onDetail} hitSlop={8}>
              <Text style={styles.viewDetails}>{t('more.wallet.viewDetails')}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.txnAmountRow}>
          <Text style={[styles.txnAmount, { color }]}>
            {`${walletSign(log)} ${currency} ${formatAmount(amount, currency)}`}
          </Text>
          <Text style={styles.txnTime}>{walletListTime(log, lang)}</Text>
        </View>
      </View>
      {log.booking_no ? (
        <View style={styles.txnBooking}>
          <Text style={styles.txnProperty} numberOfLines={1}>
            {log.property_name}
          </Text>
          <Text style={styles.txnBookingNo} numberOfLines={1}>
            {`#${log.booking_no}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** 「How mTrip wallet work」说明弹窗(3452:9744):三条说明 + 底部浅蓝提示 */
const GUIDE_ITEMS: { key: 'refund' | 'use' | 'noTopUp'; icon: HomeIconName }[] = [
  { key: 'refund', icon: 'arrowSyncCircle' },
  { key: 'use', icon: 'ticket16' },
  { key: 'noTopUp', icon: 'shield20' },
];

function WalletGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* 卡片本身吞掉点击,只有点遮罩才关 */}
        <Pressable style={styles.guideCard} onPress={() => undefined}>
          <View style={styles.guideHead}>
            <Text style={styles.guideTitle}>{t('more.wallet.guide.title')}</Text>
            <Pressable style={styles.guideClose} onPress={onClose} hitSlop={10} accessibilityLabel={t('more.wallet.close')}>
              <HomeIcon name="close" size={12} color={colors.textSoft} />
            </Pressable>
          </View>
          <View style={styles.guideList}>
            {GUIDE_ITEMS.map((item) => (
              <View key={item.key} style={styles.guideItem}>
                <View style={styles.guideIcon}>
                  <HomeIcon name={item.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.guideItemTitle}>{t(`more.wallet.guide.${item.key}.title`)}</Text>
                  <Text style={styles.guideItemDesc}>{t(`more.wallet.guide.${item.key}.desc`)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.guideNote}>
              <Text style={styles.guideNoteText}>{t('more.wallet.guide.note')}</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  balanceCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    ...shadows.card,
  },
  /* 设计稿插画:卡片右侧,宽 ~44%、40% 透明度,超出部分被圆角裁掉 */
  cardArt: {
    position: 'absolute',
    right: -24,
    top: 12,
    width: '44%',
    height: '120%',
    opacity: 0.4,
  },
  balanceBody: { gap: 8 },
  balanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.75 },
  balanceTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountCurrency: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 28, color: 'rgba(255,255,255,0.8)' },
  amountValue: { fontFamily: fonts.interBold, fontSize: 28, lineHeight: 28, color: '#FFFFFF' },
  balanceHint: {
    maxWidth: 220,
    opacity: 0.75,
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },

  historyGroup: { gap: 16 },
  tabs: { flexDirection: 'row', padding: 8, borderRadius: 32, backgroundColor: colors.surface },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 16 },
  tabActive: { backgroundColor: colors.primary, ...shadows.subtle },
  tabText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.14, color: '#8B8C91' },
  tabTextActive: { color: '#FFFFFF' },

  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  historyTitle: { fontFamily: fonts.outfitSemi, fontSize: 20, lineHeight: 24, color: colors.heading },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24,
    backgroundColor: colors.softBlue,
  },
  monthText: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  txnCard: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  txnTop: { gap: 4 },
  txnHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  txnTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  txnTitle: { flex: 1, fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: colors.heading },
  viewDetails: { fontFamily: fonts.interBold, fontSize: 12, lineHeight: 20, color: colors.primary },
  txnAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  txnAmount: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 26 },
  txnTime: { fontFamily: fonts.interSemi, fontSize: 10, lineHeight: 20, color: '#8B8C91' },
  txnBooking: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(65,105,237,0.1)',
  },
  txnProperty: { flex: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.heading },
  txnBookingNo: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.primary, textAlign: 'right' },

  loading: { paddingVertical: 24 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  empty: { textAlign: 'center', fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: '#8B8C91' },
  more: { textAlign: 'center', paddingVertical: 12, fontFamily: fonts.interSemi, fontSize: 14, color: colors.primary },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  guideCard: {
    width: '100%',
    maxWidth: 370,
    padding: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  guideHead: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  guideTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 20, letterSpacing: 0.14, color: colors.heading },
  guideClose: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  guideList: { gap: 16, padding: 24 },
  guideItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guideIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.softBlue,
  },
  guideItemTitle: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 24, color: colors.heading },
  guideItemDesc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: '#8B8C91' },
  guideNote: { padding: 12, borderRadius: 24, backgroundColor: 'rgba(65,105,237,0.1)' },
  guideNoteText: { textAlign: 'center', fontFamily: fonts.inter, fontSize: 11, lineHeight: 21, color: colors.primary },
});
