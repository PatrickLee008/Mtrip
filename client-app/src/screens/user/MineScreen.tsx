/**
 * 我的:用户资料/余额积分/语言切换/GDPR/退出登录
 */

import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import PriceText from '@/components/business/PriceText';
import CustomButton from '@/components/common/CustomButton';
import PageLayout from '@/components/layout/PageLayout';
import { SUPPORTED_LANGS, type Lang } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import { changeLanguage } from '@/i18n';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';

const LANG_LABELS: Record<Lang, string> = { 'zh-CN': '中文', 'en-US': 'English' };

export default function MineScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const logout = useUserStore((s) => s.logout);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const lang = useCommonStore((s) => s.lang);
  const setLang = useCommonStore((s) => s.setLang);
  const gdprAccepted = useCommonStore((s) => s.gdprAccepted);
  const siteName = useSiteStore((s) => s.siteName);

  // 获焦刷新资料(余额/积分变动)
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  const toggleLang = async (next: Lang) => {
    if (next === lang) return;
    await setLang(next);
    changeLanguage(next);
  };

  return (
    <PageLayout scrollable padded>
      {isLogin && profile ? (
        <View style={styles.profileCard}>
          <Image
            source={profile.avatar ? { uri: profile.avatar } : undefined}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.nickname}>{profile.nickname || profile.mobile}</Text>
            <Text style={styles.mobile}>{profile.mobile}</Text>
            {profile.memberLevelName ? (
              <Text style={styles.level}>
                {t('user.memberLevel')}: {profile.memberLevelName}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable style={styles.profileCard} onPress={() => navigation.navigate('Login')}>
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text style={styles.notLogin}>{t('user.notLogin')}</Text>
        </Pressable>
      )}

      {isLogin && profile ? (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <PriceText amount={profile.balance} size="sm" />
            <Text style={styles.statLabel}>{t('user.balance')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.points}</Text>
            <Text style={styles.statLabel}>{t('user.points')}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.entryCard}>
        <Pressable style={styles.entryRow} onPress={() => navigation.navigate('OrderList')}>
          <Text style={styles.settingLabel}>{t('order.listTitle')}</Text>
          <Text style={styles.entryArrow}>›</Text>
        </Pressable>
        {/* 站点切换:设计稿顶部栏没有这一项,多站点是设计稿未覆盖的需求,统一收到「我的」 */}
        <Pressable
          style={[styles.entryRow, styles.entryRowTop]}
          onPress={() => navigation.navigate('SiteSelect')}
        >
          <Text style={styles.settingLabel}>{t('site.title')}</Text>
          <View style={styles.entryValueWrap}>
            {siteName ? <Text style={styles.settingValue}>{siteName}</Text> : null}
            <Text style={styles.entryArrow}>›</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('user.language')}</Text>
          <View style={styles.langGroup}>
            {SUPPORTED_LANGS.map((l) => (
              <Pressable
                key={l}
                style={[styles.langBtn, lang === l && styles.langActive]}
                onPress={() => void toggleLang(l)}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {LANG_LABELS[l]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('user.gdpr')}</Text>
          <Text style={styles.settingValue}>
            {gdprAccepted ? t('user.gdprAccepted') : t('user.gdprNotAccepted')}
          </Text>
        </View>
      </View>

      {isLogin ? (
        <View style={styles.logoutWrap}>
          <CustomButton title={t('user.logout')} type="default" onPress={() => void logout()} />
        </View>
      ) : null}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.background },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarIcon: { fontSize: 26 },
  profileInfo: { flex: 1, marginLeft: spacing.lg },
  nickname: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  mobile: { marginTop: spacing.xs, fontSize: fontSize.xs, color: colors.textSecondary },
  level: { marginTop: spacing.xs, fontSize: fontSize.xs, color: colors.primary },
  notLogin: { marginLeft: spacing.lg, fontSize: fontSize.md, color: colors.textSecondary },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  statValue: { fontSize: fontSize.price, fontWeight: '700', color: colors.text },
  statLabel: { marginTop: spacing.xs, fontSize: fontSize.xs, color: colors.textSecondary },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  /* 同一张卡里的第二行起加分隔线 */
  entryRowTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryValueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  entryArrow: { fontSize: fontSize.lg, color: colors.textSecondary },
  settingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingLabel: { fontSize: fontSize.md, color: colors.text },
  settingValue: { fontSize: fontSize.sm, color: colors.textSecondary },
  langGroup: { flexDirection: 'row' },
  langBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.sm,
  },
  langActive: { borderColor: colors.primary, backgroundColor: '#f0f6ff' },
  langText: { fontSize: fontSize.sm, color: colors.textSecondary },
  langTextActive: { color: colors.primary, fontWeight: '600' },
  logoutWrap: { marginTop: spacing.md },
});
