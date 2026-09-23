/**
 * 关怀模式「更多」页(按 Figma Lite More `2540:21478` 实现)
 *
 * 与完整模式 MineScreen 同一批数据、同一批落地页,区别只在排版与条目取舍:
 *   姓名 16→32、菜单标题 16→20 且**去掉每行下面那句灰色副标题**、卡片圆角 32→24、
 *   钱包卡去掉「Available Balance」那行、资料卡的会员行去掉权益计数改成一句 See Reward。
 *
 * 设计稿实测:
 *   Main   px16 pt16 pb20,块间距 24
 *   卡壳   --tab 底 / 1px --secondary / 圆角 24 / padding 24 / gap 16(圆角比完整模式小一档)
 *   头像   52 圆形 --secondary 底、padding4,内含 44 的 person 图标
 *   姓名   Inter 400/32(行高 32),#141D23;邮箱 Inter 400/16,--text-2
 *   会员行 --secondary 底圆角 32;胶囊 #F6FAFF 外托 + #204DDA 内胶囊 px12 py8
 *   钱包卡 144.84° #204DDA→#4169ED,圆角 24,padding 24;币种 Inter 500/20 80% + 金额 Inter 700/32
 *   菜单   见 components/more/MenuLink.tsx 的 lite 排版
 *   版本   Inter 400/16,--text-2,60% 透明,居中
 *
 * 设计稿之外补的一张卡(**用户明确要求保留**):语言 + 退出登录。
 * 设计稿把完整模式那张「订单 / 站点 / 语言 / GDPR」整张删了,但退出登录与切换语言是
 * 会把人卡死的两项 —— 关怀模式用户没法退出账号、没法改回看得懂的语言,就只能卸载重装。
 * 站点与 GDPR 按设计稿去掉(它们不至于让人无法继续使用)。
 *
 * 未实现的能力(与完整模式一致,一律 comingSoon):钱包与 Top Up、编辑资料、See Reward、
 * About、FAQ、Rate this app。
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

/** 本页卡片圆角(比完整模式的 radius.card=32 小一档) */
const PANEL_RADIUS = 24;

export default function MoreLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const logout = useUserStore((s) => s.logout);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const lang = useCommonStore((s) => s.lang);
  const setLang = useCommonStore((s) => s.setLang);
  const liteMode = useCommonStore((s) => s.liteMode);
  const setMode = useCommonStore((s) => s.setMode);
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);

  const [langOpen, setLangOpen] = useState(false);

  // 获焦刷新资料(余额/积分/会员等级变动),与完整模式 MineScreen 同一处理
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  const comingSoon = () => showToast(t('home.comingSoon'));
  const requireLogin = () => navigation.navigate('Login');

  const pickLang = (next: Lang) => {
    setLangOpen(false);
    if (next === lang) return;
    void (async () => {
      await setLang(next);
      changeLanguage(next);
    })();
  };

  return (
    <View style={styles.root}>
      {/* 原生导航头已关(见 navigation/index.tsx),状态栏高度由本页自己让开 */}
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
          <View style={styles.panel}>
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
                  {isLogin && profile ? profile.nickname || profile.mobile : t('user.notLogin')}
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
              <Text style={styles.rewardText} numberOfLines={1}>
                {t('more.lite.seeReward')}
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
                {/* 设计稿 144.84°:自左上到右下的对角线渐变 */}
                <LinearGradient id="liteWalletGrad" x1="0" y1="0" x2="0.8" y2="1">
                  <Stop offset="0" stopColor={DEEP_PRIMARY} />
                  <Stop offset="1" stopColor={colors.primary} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#liteWalletGrad)" />
            </Svg>

            <View style={styles.walletTitleRow}>
              <View style={styles.walletTitleLeft}>
                <HomeIcon name="wallet" width={15.833} height={15} color="#FFFFFF" />
                <Text style={styles.walletTitle}>{t('more.wallet.title')}</Text>
              </View>
              <HomeIcon name="info" size={32} color="#FFFFFF" />
            </View>

            <View style={styles.walletAmountRow}>
              <Text style={styles.walletCurrency}>{currency}</Text>
              <Text style={styles.walletAmount} numberOfLines={1}>
                {formatAmount(isLogin && profile ? profile.balance : 0, currency)}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.topUpBtn, pressed && moreShared.pressed]}
              onPress={comingSoon}
            >
              <HomeIcon name="plus" size={10.5} color={DEEP_PRIMARY} />
              <Text style={styles.topUpText}>{t('more.wallet.topUp')}</Text>
            </Pressable>
          </Pressable>

          {/* 菜单卡一 */}
          <View style={styles.panel}>
            <MenuLink
              lite
              icon="personEdit"
              title={t('more.menu.account.title')}
              divider
              onPress={() => (isLogin ? navigation.navigate('Account') : requireLogin())}
            />
            <MenuLink
              lite
              icon="people"
              title={t('more.menu.referral.title')}
              divider
              onPress={() => (isLogin ? navigation.navigate('Referral') : requireLogin())}
            />
            <MenuLink
              lite
              icon="accessibility"
              title={t('more.menu.accessibility.title')}
              right={
                <Pressable
                  style={[styles.toggle, liteMode && styles.toggleOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: liteMode }}
                  onPress={() => void setMode(liteMode ? 'full' : 'lite')}
                >
                  <View style={[styles.knob, liteMode && styles.knobOn]} />
                </Pressable>
              }
            />
          </View>

          {/* 菜单卡二 */}
          <View style={styles.panel}>
            <MenuLink
              lite
              icon="questionCircle"
              title={t('more.menu.guide.title')}
              divider
              onPress={() => navigation.navigate('Guides')}
            />
            <MenuLink lite icon="bookInfo" title={t('more.menu.about.title')} divider onPress={comingSoon} />
            <MenuLink
              lite
              icon="shieldTask"
              title={t('more.menu.terms.title')}
              divider
              onPress={() => navigation.navigate('LegalTerms')}
            />
            <MenuLink lite icon="bookQuestion" title={t('more.menu.faq.title')} divider onPress={comingSoon} />
            <MenuLink lite icon="star" title={t('more.menu.rate.title')} onPress={comingSoon} />
          </View>

          {/* 设计稿没有这张卡:语言与退出登录是「不保留就会把人卡死」的两项,见文件头 */}
          <View style={styles.panel}>
            <MenuLink
              lite
              icon="chat"
              title={t('user.language')}
              divider={isLogin}
              onPress={() => setLangOpen(true)}
            />
            {isLogin ? (
              <MenuLink
                lite
                icon="arrowRight"
                title={t('user.logout')}
                right={<View />}
                onPress={() => void logout()}
              />
            ) : null}
          </View>

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

  header: { paddingHorizontal: 16, paddingVertical: 4 },
  logo: { width: 48, height: 39 },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 24,
  },

  /* 与 moreShared.panel 同一套壳,只把圆角从 32 收到设计稿的 24 */
  panel: { ...moreShared.panel, borderRadius: PANEL_RADIUS, gap: 16 },

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
  /* 设计稿姓名色 #141D23,比 --text 略深 */
  name: { fontFamily: fonts.inter, fontSize: 32, lineHeight: 36, color: '#141D23' },
  email: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
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
  memberPillOuter: { borderRadius: radius.round, backgroundColor: '#F6FAFF' },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: DEEP_PRIMARY,
  },
  /* 设计稿写的是 20/15 —— 行高小于字号在 Android 上会把字切掉,这里抬到 24 */
  memberText: {
    fontFamily: fonts.inter,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  rewardText: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    color: colors.heading,
  },

  walletCard: {
    padding: 24,
    gap: 10,
    borderRadius: PANEL_RADIUS,
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
  walletAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walletCurrency: {
    opacity: 0.8,
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 32,
    color: '#FFFFFF',
  },
  walletAmount: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
  },
  topUpBtn: {
    alignSelf: 'flex-start',
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
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: DEEP_PRIMARY,
  },

  /* 设计稿开关 40x20(与完整模式同一枚) */
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

  version: {
    opacity: 0.6,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
});
