/**
 * 「更多」页(按 Figma M-Trip / More `1690:4642` 重做,原为一张自制的设置页)
 *
 * 设计稿自上而下:mTrip 字标顶部栏 → 资料卡(头像 + 姓名/邮箱 + 编辑按钮 + 会员胶囊行)
 * → 钱包卡(渐变底,余额 + Top Up)→ 菜单卡一(Account / Referral / Accessibility Mode)
 * → 菜单卡二(Guide / About / Terms and Conditions / FAQ / Rate this app)→ 版本号。
 *
 * 设计稿实测:
 *   Main   px16 pb20,块间距 24
 *   资料卡 与其余同壳(`--tab` / 1px `--secondary` / 圆角 32 / padding 24),gap 16
 *   头像   `--secondary` 底、padding 4、正圆,内含 44 的 person 图标
 *   会员行 `--secondary` 底、圆角 32、px4;左侧 `#204DDA` 胶囊(星章 + 等级名),右侧提示 10px
 *   钱包卡 149.52° `#204DDA`→`#4169ED` 渐变,圆角 32,padding 24;
 *          币种 Inter 500/16 80% + 金额 Inter 700/28;Top Up 白色胶囊 px24 py4
 *   菜单项 见 components/more/MenuLink.tsx
 *
 * 设计稿没有、但项目必须保留的功能,统一收进第三张「设置」卡(订单 / 站点 / 语言 / GDPR)
 * 与其下的退出按钮 —— 这些是设计稿未覆盖的既有需求,不能因为改版丢掉。
 *
 * 未实现的能力(设计稿有、后端没有),一律走 comingSoon:
 *   钱包与 Top Up、会员权益数、编辑资料、无障碍模式(仅本地勾选态)、About、FAQ、Rate this app。
 */

import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import LanguageDialog from '@/components/more/LanguageDialog';
import MenuLink from '@/components/more/MenuLink';
import { DEEP_PRIMARY, moreShared } from '@/components/more/moreShared';
import { APP_VERSION, type Lang } from '@/config/global';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { changeLanguage } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import { formatAmount } from '@/utils/format';

const LOGO = require('../../../assets/images/logo.png');

/** 设计稿写死的会员权益数,后端暂无权益接口 */
const DEMO_REWARD_COUNT = 5;

export default function MineScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const logout = useUserStore((s) => s.logout);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const lang = useCommonStore((s) => s.lang);
  const setLang = useCommonStore((s) => s.setLang);
  const gdprAccepted = useCommonStore((s) => s.gdprAccepted);
  const showToast = useCommonStore((s) => s.showToast);
  const siteName = useSiteStore((s) => s.siteName);
  const currency = useSiteStore((s) => s.currency);

  const [langOpen, setLangOpen] = useState(false);
  /** 无障碍模式后端没有开关,仅本地勾选态 */
  const [liteMode, setLiteMode] = useState(false);

  // 获焦刷新资料(余额/积分变动)
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  const comingSoon = () => showToast(t('home.comingSoon'));

  const pickLang = (next: Lang) => {
    setLangOpen(false);
    if (next === lang) return;
    void (async () => {
      await setLang(next);
      changeLanguage(next);
    })();
  };

  const requireLogin = () => navigation.navigate('Login');

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          {/* 资料卡 */}
          <View style={[moreShared.panel, styles.profilePanel]}>
            <View style={styles.profileRow}>
              <View style={styles.avatarRing}>
                {profile?.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                ) : (
                  <HomeIcon name="person" size={44} color={colors.primary} />
                )}
              </View>

              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>
                  {isLogin && profile
                    ? profile.nickname || profile.mobile
                    : t('user.notLogin')}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {isLogin && profile ? profile.email || profile.mobile : ''}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.editBtn, pressed && moreShared.pressed]}
                onPress={isLogin ? comingSoon : requireLogin}
              >
                <HomeIcon name="personEdit" size={20} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.memberRow}>
              <View style={styles.memberPillOuter}>
                <View style={styles.memberPill}>
                  <HomeIcon name="medalStar" size={8.333} color="#FFD700" />
                  <Text style={styles.memberText}>
                    {(isLogin && profile?.memberLevelName) || t('user.memberLevel')}
                  </Text>
                </View>
              </View>
              <Text style={styles.rewardText}>
                {t('more.rewards', { count: isLogin ? DEMO_REWARD_COUNT : 0 })}
              </Text>
            </View>
          </View>

          {/* 钱包卡 */}
          <Pressable
            style={({ pressed }) => [styles.walletCard, pressed && moreShared.pressed]}
            onPress={comingSoon}
          >
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                {/* 设计稿 149.52°:换算成从左上到右下的对角线渐变 */}
                <LinearGradient id="walletGrad" x1="0" y1="0" x2="0.72" y2="1">
                  <Stop offset="0" stopColor={DEEP_PRIMARY} />
                  <Stop offset="1" stopColor={colors.primary} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#walletGrad)" />
            </Svg>

            <View style={styles.walletTitleRow}>
              <View style={styles.walletTitleLeft}>
                <HomeIcon name="wallet" width={15.833} height={15} color="#FFFFFF" />
                <Text style={styles.walletTitle}>{t('more.wallet.title')}</Text>
              </View>
              <HomeIcon name="info" size={20} color="#FFFFFF" />
            </View>

            <View style={styles.walletBody}>
              <View style={styles.walletAmountBox}>
                <View style={styles.walletAmountRow}>
                  <Text style={styles.walletCurrency}>{currency}</Text>
                  <Text style={styles.walletAmount}>
                    {formatAmount(isLogin && profile ? profile.balance : 0, currency)}
                  </Text>
                </View>
                <Text style={styles.walletLabel}>{t('more.wallet.balanceLabel')}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.topUpBtn, pressed && moreShared.pressed]}
                onPress={comingSoon}
              >
                <HomeIcon name="plus" size={10.5} color={DEEP_PRIMARY} />
                <Text style={styles.topUpText}>{t('more.wallet.topUp')}</Text>
              </Pressable>
            </View>
          </Pressable>

          {/* 菜单卡一 */}
          <View style={[moreShared.panel, styles.menuPanel]}>
            <MenuLink
              icon="personEdit"
              title={t('more.menu.account.title')}
              desc={t('more.menu.account.desc')}
              divider
              onPress={() => (isLogin ? navigation.navigate('Account') : requireLogin())}
            />
            <MenuLink
              icon="people"
              title={t('more.menu.referral.title')}
              desc={t('more.menu.referral.desc')}
              divider
              onPress={() => (isLogin ? navigation.navigate('Referral') : requireLogin())}
            />
            <MenuLink
              icon="accessibility"
              title={t('more.menu.accessibility.title')}
              desc={t('more.menu.accessibility.desc')}
              right={
                <Pressable
                  style={[styles.toggle, liteMode && styles.toggleOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: liteMode }}
                  onPress={() => {
                    setLiteMode((v) => !v);
                    comingSoon();
                  }}
                >
                  <View style={[styles.knob, liteMode && styles.knobOn]} />
                </Pressable>
              }
            />
          </View>

          {/* 菜单卡二 */}
          <View style={[moreShared.panel, styles.menuPanel]}>
            <MenuLink
              icon="questionCircle"
              title={t('more.menu.guide.title')}
              desc={t('more.menu.guide.desc')}
              divider
              onPress={() => navigation.navigate('Guides')}
            />
            <MenuLink
              icon="bookInfo"
              title={t('more.menu.about.title')}
              desc={t('more.menu.about.desc')}
              divider
              onPress={comingSoon}
            />
            <MenuLink
              icon="shieldTask"
              title={t('more.menu.terms.title')}
              desc={t('more.menu.terms.desc')}
              divider
              onPress={() => navigation.navigate('LegalTerms')}
            />
            <MenuLink
              icon="bookQuestion"
              title={t('more.menu.faq.title')}
              desc={t('more.menu.faq.desc')}
              divider
              onPress={comingSoon}
            />
            <MenuLink
              icon="star"
              title={t('more.menu.rate.title')}
              desc={t('more.menu.rate.desc')}
              onPress={comingSoon}
            />
          </View>

          {/* 设计稿没有这张卡:多站点 / 多语言 / GDPR / 订单是项目既有需求,改版后收在这里 */}
          <View style={[moreShared.panel, styles.menuPanel]}>
            <MenuLink
              icon="document"
              title={t('order.listTitle')}
              desc={t('more.menu.orders.desc')}
              divider
              onPress={() => (isLogin ? navigation.navigate('OrderList') : requireLogin())}
            />
            <MenuLink
              icon="locationFilled"
              title={t('site.title')}
              desc={siteName || t('more.menu.site.desc')}
              divider
              onPress={() => navigation.navigate('SiteSelect')}
            />
            <MenuLink
              icon="chat"
              title={t('user.language')}
              desc={t('more.menu.language.desc')}
              divider
              onPress={() => setLangOpen(true)}
            />
            <MenuLink
              icon="shieldTask"
              title={t('user.gdpr')}
              desc={gdprAccepted ? t('user.gdprAccepted') : t('user.gdprNotAccepted')}
              right={<View />}
            />
          </View>

          {isLogin ? (
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && moreShared.pressed]}
              onPress={() => void logout()}
            >
              <Text style={styles.logoutText}>{t('user.logout')}</Text>
            </Pressable>
          ) : null}

          <Text style={styles.version}>{t('more.version', { version: APP_VERSION })}</Text>
        </ScrollView>
      </SafeAreaView>

      <LanguageDialog
        visible={langOpen}
        value={lang}
        onSelect={pickLang}
        onClose={() => setLangOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  /* 设计稿顶部栏 402x47:左侧 mTrip 字标(与首页同一枚),右侧元素在这张稿里是隐藏的 */
  header: { paddingHorizontal: 16, paddingVertical: 4 },
  logo: { width: 48, height: 39 },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 24,
  },

  profilePanel: { gap: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarRing: {
    padding: 4,
    borderRadius: 99,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  profileText: { flex: 1, minWidth: 0 },
  /* 设计稿姓名色 #141D23,比 --text 略深,只在这里出现 */
  name: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },
  email: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.textSoft },
  editBtn: {
    padding: 13,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
    borderRadius: radius.card,
    backgroundColor: colors.softBlue,
  },
  /* 设计稿在胶囊外面还套了一层 #F6FAFF 底,用来把胶囊从 --secondary 上托起来 */
  memberPillOuter: { borderRadius: radius.round, backgroundColor: '#F6FAFF' },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.round,
    backgroundColor: DEEP_PRIMARY,
  },
  memberText: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  rewardText: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 24,
    color: colors.heading,
  },

  walletCard: {
    padding: 24,
    gap: 8,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  walletTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletTitle: {
    opacity: 0.9,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  walletBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  walletAmountBox: { flex: 1, minWidth: 0, gap: 8 },
  walletAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walletCurrency: {
    opacity: 0.8,
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  walletAmount: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 28,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  walletLabel: {
    opacity: 0.75,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderRadius: radius.round,
    backgroundColor: '#FFFFFF',
  },
  topUpText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: DEEP_PRIMARY,
  },

  menuPanel: { gap: 16 },

  /* 设计稿开关 40x20:底 --background,滑块 20 圆、--text-2(关);开态用主色 */
  toggle: {
    width: 40,
    height: 20,
    borderRadius: 32,
    backgroundColor: colors.pageBg,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.softBlue },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textSoft },
  knobOn: { alignSelf: 'flex-end', backgroundColor: colors.primary },

  logoutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  logoutText: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 24, color: colors.danger },

  version: {
    opacity: 0.6,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
});
