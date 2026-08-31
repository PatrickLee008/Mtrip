/**
 * 推荐规则说明(按 Figma M-Trip / More `1690:5735` How Referral Work 实现)
 *
 * 一张卡里五个步骤:48 主色圆(序号白字 Inter 700/16)+ 标题 Inter 600/16 + 说明 Inter 400/14 `--text-2`;
 * 卡下面是一块主色 10% 底、圆角 12、padding 16 的「Reward Rules」提示,内含五条圆点列表。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { REFERRAL_RULES, REFERRAL_STEPS } from '@/screens/more/moreDemo';

export default function HowReferralWorksScreen() {
  const { t } = useTranslation();

  return (
    <MorePageLayout title={t('more.referral.how.title')}>
      <View style={[moreShared.panel, styles.card]}>
        {REFERRAL_STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{index + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{t(`more.referral.how.steps.${step}.title`)}</Text>
              <Text style={styles.stepDesc}>{t(`more.referral.how.steps.${step}.desc`)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>{t('more.referral.how.rulesTitle')}</Text>
        <View style={styles.rulesList}>
          {REFERRAL_RULES.map((rule) => (
            <View key={rule} style={styles.ruleItem}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>{t(`more.referral.how.rules.${rule}`)}</Text>
            </View>
          ))}
        </View>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 24 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  badge: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  stepText: { flex: 1, minWidth: 0 },
  stepTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },
  stepDesc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },

  /* 设计稿 1690:5940:主色 10% 底 */
  rules: {
    gap: 4,
    padding: 16,
    borderRadius: radius.btn,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  rulesTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  rulesList: { gap: 4 },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleDot: {
    width: 6,
    height: 6,
    marginTop: 9,
    borderRadius: 3,
    backgroundColor: colors.textSoft,
  },
  ruleText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },
});
