/**
 * 推荐明细(按 Figma M-Trip / More `1690:5296` Referral Status 实现)
 *
 * 自上而下:推荐统计卡(与 Refer & Earn 同一枚)→ Pending / Rewarded 两段页签 → 被推荐人卡片。
 *
 * 卡片(设计稿 1690:5474):48 主色圆(姓名首字母白字 Inter 700/16)+ 姓名 + 状态胶囊
 * (`--orange` 底、px12 py4、Inter 600/12 tracking 0.55)+ 说明 Inter 400/14 `--text-2`;
 * 下方一条 `--secondary` 底、圆角 24、py12 的五格进度:已完成打勾、当前节点 info、未到的是空心圆,
 * 相邻两格之间有一条 32 宽的连接线。
 *
 * 数据走 user-service `/app/user/referral/invitees`,按页签传 `status`(0待达成 / 1已发放);
 * 进度条与说明文案由 `reward_status` 推导(口径见 `useReferralData.ts` 头部)。
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { REFERRAL_STATUS } from '@/api/user';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import ReferralStatsCard from '@/components/more/ReferralStatsCard';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { REFERRAL_PROGRESS } from '@/screens/more/moreDemo';
import {
  refereeDescKey,
  refereeDoneUntil,
  useReferralInvitees,
  useReferralSummary,
} from '@/screens/more/useReferralData';

type StatusTab = 'pending' | 'rewarded';
const TABS: StatusTab[] = ['pending', 'rewarded'];
const TAB_STATUS: Record<StatusTab, number> = {
  pending: REFERRAL_STATUS.PENDING,
  rewarded: REFERRAL_STATUS.REWARDED,
};

export default function ReferralStatusScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<StatusTab>('pending');
  const { summary } = useReferralSummary();
  const { list } = useReferralInvitees(TAB_STATUS[tab]);

  return (
    <MorePageLayout title={t('more.referral.status.title')}>
      <View style={styles.stack}>
        <ReferralStatsCard summary={summary} />

        <SegmentedTabs
          tabs={TABS}
          value={tab}
          onChange={setTab}
          label={(item) => t(`more.referral.status.tabs.${item}`)}
        />

        {list.length === 0 ? (
          <Text style={styles.empty}>{t('more.referral.status.empty')}</Text>
        ) : (
          list.map((referee) => (
            <View key={referee.id} style={[moreShared.panel, styles.card]}>
              <View style={styles.head}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{referee.nickname.slice(0, 1)}</Text>
                </View>
                <View style={styles.headText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {referee.nickname}
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>
                        {t(`more.referral.status.tabs.${tab}`)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>
                    {t(`more.referral.status.desc.${refereeDescKey(referee.reward_status)}`)}
                  </Text>
                </View>
              </View>

              <View style={styles.progress}>
                {REFERRAL_PROGRESS.map((step, index) => {
                  const doneUntil = refereeDoneUntil(referee.reward_status);
                  const done = index < doneUntil;
                  const current = index === doneUntil;
                  return (
                    <View key={step} style={styles.progressCell}>
                      {/* 连接线画在格子左侧,首格不画 */}
                      {index > 0 ? <View style={styles.progressLine} /> : null}
                      {done ? (
                        <HomeIcon name="checkmarkCircle" size={20} color={colors.primary} />
                      ) : current ? (
                        <HomeIcon name="info" size={20} color={colors.orange} />
                      ) : (
                        <View style={styles.progressDot} />
                      )}
                      <Text style={styles.progressLabel}>
                        {t(`more.referral.status.progress.${step}`)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },

  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  avatarText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  headText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.round,
    backgroundColor: colors.orange,
  },
  statusText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16.5,
    letterSpacing: 0.55,
    color: '#FFFFFF',
  },
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },

  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.softBlue,
  },
  progressCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4 },
  /* 设计稿 Line 13:连接相邻两个节点,压在图标垂直中线上 */
  progressLine: {
    position: 'absolute',
    top: 9,
    left: '-50%',
    width: '100%',
    height: 1,
    backgroundColor: colors.divider,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  progressLabel: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  empty: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: 24,
  },
});
