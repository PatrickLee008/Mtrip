/**
 * 推荐有奖(按 Figma M-Trip / More `1687:4120` Refer & Earn 实现)
 *
 * 自上而下:头图(与优惠页活动横幅同一张图,底部压主色渐变 + 标题/说明)→ 推荐统计卡
 * → 推荐码卡 → 推荐链接卡 → 两枚并排入口(How Referral Works / Referral Status)。
 *
 * 设计稿实测:
 *   头图     370×274,圆角 32;渐变与优惠页横幅同一套(主色 0→50%)
 *   码/链接卡 与其余同壳;标题 Inter 600/12 `--text-2` tracking 1.2;
 *            值框 `--secondary` 底、圆角 20、px16 py12,右侧 Copy(Inter 600/14 主色)+ 20 复制图标
 *   入口卡   1px `--secondary`、圆角 24、px12 py20,文字 Inter 600/12 tracking 1.2 居中
 *
 * 后端没有推荐接口,推荐码/链接/统计取 moreDemo.ts 的设计稿值;复制走 expo-clipboard(真复制)。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { TEMP_REFERRAL_BANNER } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import ReferralStatsCard from '@/components/more/ReferralStatsCard';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { REFERRAL_STATS } from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';

export default function ReferralScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const copy = (value: string) => {
    void (async () => {
      await Clipboard.setStringAsync(value);
      showToast(t('more.referral.copied'));
    })();
  };

  const renderCopyCard = (label: string, value: string, small?: boolean) => (
    <View style={[moreShared.panel, styles.copyPanel]}>
      <Text style={styles.copyLabel}>{label}</Text>
      <View style={styles.copyBox}>
        <Text style={[styles.copyValue, small && styles.copyValueSmall]} numberOfLines={1}>
          {value}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.copyBtn, pressed && moreShared.pressed]}
          onPress={() => copy(value)}
        >
          <Text style={styles.copyText}>{t('more.referral.copy')}</Text>
          <HomeIcon name="copy" width={14.167} height={16.667} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <MorePageLayout title={t('more.referral.title')}>
      <View style={styles.banner}>
        <Image source={TEMP_REFERRAL_BANNER} style={styles.bannerImage} resizeMode="cover" />
        <View style={styles.bannerOverlay}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="referralGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
                <Stop offset="0.505" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0.5} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#referralGrad)" />
          </Svg>
          <Text style={styles.bannerTitle}>{t('more.referral.bannerTitle')}</Text>
          <Text style={styles.bannerDesc}>{t('more.referral.bannerDesc')}</Text>
        </View>
      </View>

      <View style={styles.stack}>
        <ReferralStatsCard />
        {renderCopyCard(t('more.referral.codeLabel'), REFERRAL_STATS.code)}
        {renderCopyCard(t('more.referral.linkLabel'), REFERRAL_STATS.link, true)}

        <View style={styles.entryRow}>
          <Pressable
            style={({ pressed }) => [styles.entryCard, pressed && moreShared.pressed]}
            onPress={() => navigation.navigate('HowReferralWorks')}
          >
            <Text style={styles.entryText}>{t('more.referral.how.title')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.entryCard, pressed && moreShared.pressed]}
            onPress={() => navigation.navigate('ReferralStatus')}
          >
            <Text style={styles.entryText}>{t('more.referral.status.title')}</Text>
          </Pressable>
        </View>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    aspectRatio: 370 / 274,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    justifyContent: 'flex-end',
  },
  bannerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  bannerTitle: {
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.32,
    color: '#FFFFFF',
  },
  bannerDesc: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 30,
    letterSpacing: -0.32,
    color: '#FFFFFF',
  },

  stack: { gap: 16 },

  copyPanel: { gap: 8 },
  copyLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: colors.textSoft,
    opacity: 0.9,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.softBlue,
  },
  copyValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  copyValueSmall: { fontSize: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  entryRow: { flexDirection: 'row', gap: 8 },
  entryCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  entryText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textAlign: 'center',
    color: colors.heading,
  },
});
