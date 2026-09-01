/**
 * 登录页(按 Figma M-Trip / Login 505:1293 重做)
 *
 * 结构:主色底 + 插画铺底 → 顶部栏(返回 / Sign Up)→ logo + 标语 → 白色表单卡。
 * 表单卡内:手机号(+95 区号)→ 密码(眼睛切换)→ 记住我 → 登录 → 分隔线 → 三方登录。
 *
 * 设计稿实测:
 *   插画     绝对定位,w150.41% h46.55% left-18.49% top16.66%(设计稿的图片填充裁切)
 *   Main     flex-1 两端对齐,pt68(让开顶部栏)pb20 px16
 *   表单卡   --tab #FEFEFE,圆角 32,padding 24,gap 8
 *   输入框   #EFF4FF,高 52,圆角 12,padding 16,行内 gap 12;两框之间 gap 16
 *   登录按钮 主色,py16,圆角 12,文字 Outfit 400/16;未填完时整体 50% 透明(设计稿即禁用态)
 *   三方按钮 高 48,圆角 12,px31,1px --secondary 描边
 *
 * 「记住我」= **记住手机号**(不含密码):进页面回填上次保存的号码并默认勾上,
 * 登录成功时按当前勾选状态写入 / 清除 `STORAGE_KEYS.REMEMBER_MOBILE`。
 * 它管的不是免登录 —— token 本来就无条件持久化(见 `store/userStore.ts` 的 applyAuth / hydrate)。
 *
 * 未实现的能力(设计稿有、后端没有),一律走 comingSoon:
 *   区号选择(固定 +95)、三方登录
 */

import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import SocialIcon, { type SocialProvider } from '@/components/user/SocialIcon';
import { STORAGE_KEYS } from '@/config/global';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { storage } from '@/utils/storage';
import { isMobile, isPassword } from '@/utils/validate';

const ILLUSTRATION = require('../../../assets/images/login/illustration.png');
const LOGO = require('../../../assets/images/login/logo-badge.png');

/** 设计稿固定展示 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
/** 顶部栏高度 = py16*2 + 返回按钮 36,与设计稿 Main 的 pt68 对齐 */
const TOP_BAR_HEIGHT = 68;
const SOCIALS: SocialProvider[] = ['google', 'facebook', 'apple'];

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const login = useUserStore((s) => s.login);
  const showToast = useCommonStore((s) => s.showToast);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* 进页面回填上次「记住我」保存的手机号,并把勾选框恢复成勾上 */
  useEffect(() => {
    let alive = true;
    void storage.getString(STORAGE_KEYS.REMEMBER_MOBILE).then((saved) => {
      if (!alive || !saved) return;
      setMobile(saved);
      setRemember(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* 设计稿的登录按钮是 50% 透明的禁用态,对应两栏未填完 */
  const canSubmit = mobile.trim().length > 0 && password.length > 0 && !submitting;

  const comingSoon = () => showToast(t('home.comingSoon'));

  const submit = async () => {
    if (!isMobile(mobile)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    if (!isPassword(password)) {
      showToast(t('user.invalidPassword'));
      return;
    }
    setSubmitting(true);
    try {
      await login(mobile.trim(), password);
      /* 只在登录成功后按当前勾选状态落盘,单纯勾/取消勾不改本地值 */
      if (remember) {
        await storage.setString(STORAGE_KEYS.REMEMBER_MOBILE, mobile.trim());
      } else {
        await storage.remove(STORAGE_KEYS.REMEMBER_MOBILE);
      }
      showToast(t('common.success'));
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/**
       * 插画铺底:设计稿是整屏图片填充后裁切,这里按同样的比例绝对定位。
       * **必须外面套一层 overflow:'hidden' 的裁切层** —— 图宽是屏宽的 150.41%、左边还退了 18.49%,
       * 右侧会超出屏幕约 32%,不裁的话整页可以横向拖动(同开屏页波浪的 `styles.waves` 做法)。
       */}
      <View style={styles.illustrationClip} pointerEvents="none">
        <Image source={ILLUSTRATION} style={styles.illustration} resizeMode="cover" />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* 顶部栏:自上而下由主色 50% 渐隐到透明 */}
        <View style={styles.topBar}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="topBarGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#topBarGrad)" />
          </Svg>

          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => navigation.navigate('Register')}
            hitSlop={8}
          >
            <Text style={styles.signUp}>{t('user.registerTitle')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Image source={LOGO} style={styles.logo} resizeMode="cover" />
            </View>
            <Text style={styles.tagline}>{t('user.tagline')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fields}>
              {/* 手机号:区号固定 +95,竖线右侧为号码输入 */}
              <View style={styles.field}>
                <HomeIcon name="phone" size={20} color={colors.primary} />
                <Pressable
                  style={({ pressed }) => [styles.codeBtn, pressed && styles.pressed]}
                  onPress={comingSoon}
                  hitSlop={6}
                >
                  <Text style={styles.codeText}>{COUNTRY_CODE}</Text>
                  <HomeIcon name="chevronDown" size={12} color="#204DDA" />
                </Pressable>
                <View style={styles.vDivider} />
                <TextInput
                  style={styles.input}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder={t('user.mobilePlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  keyboardType="phone-pad"
                  maxLength={20}
                  autoCapitalize="none"
                />
              </View>

              {/* 密码:右侧眼睛切换明文 */}
              <View style={styles.field}>
                <HomeIcon name="lock" size={20} color={colors.primary} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('user.passwordPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  secureTextEntry={secure}
                  maxLength={32}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setSecure((v) => !v)} hitSlop={10}>
                  <HomeIcon name="eyeOff" size={16} color={colors.body} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}
              onPress={() => setRemember((v) => !v)}
              hitSlop={6}
            >
              {/* 选中态换成实心方块的 checkboxIndeterminate,与酒店页 Myanmar Citizen 一致 */}
              <HomeIcon
                name={remember ? 'checkboxIndeterminate' : 'checkbox'}
                size={20}
                color={remember ? colors.primary : colors.softBlue}
              />
              <Text style={styles.rememberText}>{t('user.rememberMe')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                !canSubmit && styles.loginBtnDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              disabled={!canSubmit}
              onPress={() => void submit()}
            >
              <Text style={styles.loginText}>{t('user.login')}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.hLine} />
              <Text style={styles.dividerText}>{t('user.orLoginWith')}</Text>
              <View style={styles.hLine} />
            </View>

            <View style={styles.socials}>
              {SOCIALS.map((p) => (
                <Pressable
                  key={p}
                  style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
                  onPress={comingSoon}
                >
                  <SocialIcon provider={p} />
                </Pressable>
              ))}
            </View>

            {/* 设计稿没有这段,但登录页需要保留隐私告知,放在卡片末尾弱化处理 */}
            <Text style={styles.gdprTip}>{t('user.gdprTip')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1 },
  flex: { flex: 1 },
  /* 插画裁切层:铺满整屏并把超出的部分剪掉(见上面 JSX 的说明) */
  illustrationClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  /* 设计稿:w150.41% h46.55%,left-18.49% top16.66% */
  illustration: {
    position: 'absolute',
    width: '150.41%',
    height: '46.55%',
    left: '-18.49%',
    top: '16.66%',
  },

  topBar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur(未引入 expo-blur),这里只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    opacity: 0.8,
  },
  signUp: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },

  main: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 20,
    gap: 24,
  },
  header: { alignItems: 'center' },
  /* 设计稿 logo 框 100x74,内部图片放大后裁切 */
  logoBox: { width: 100, height: 74, overflow: 'hidden' },
  logo: { position: 'absolute', width: 180.6, height: 181.63, left: -40.3, top: -53.82 },
  tagline: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    gap: 8,
  },
  fields: { gap: 16 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  /* 设计稿区号与号码之间的竖线:1x20,#191A25 50% */
  vDivider: { width: 1, height: 20, backgroundColor: colors.textSoft },
  /* minWidth 0 同酒店页搜索框:web 端 <input> 的 min-width:auto 会撑破字段,把右侧眼睛图标挤出去 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  loginBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  hLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: {
    paddingHorizontal: 8,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },

  socials: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  /**
   * 设计稿是 px31 的固定宽(20 的图标 → 82 宽),三枚 + 两道 16 间距 = 278。
   * 卡片可用宽 = 屏宽 - 32(页边距)- 48(卡片内边距),屏宽小于约 358 时会被挤破,
   * 故改成等分 + 上限 82:402 宽下与设计稿一致,窄屏自动收窄。
   */
  socialBtn: {
    flex: 1,
    minWidth: 0,
    maxWidth: 82,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },

  gdprTip: {
    marginTop: 8,
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textSoft,
  },
  pressed: { opacity: 0.85 },
});
