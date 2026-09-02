/**
 * 注册页(按 Figma M-Trip / Signup 505:1498 重做)
 *
 * 与登录页 505:1293 同一套版式:主色底 + 插画铺底 → 顶部栏(返回 / Sign In)→ logo + 标语
 * → 白色表单卡。卡内自上而下:手机号(+95 区号)→ 邮箱 → 密码 → 确认密码
 * → 条款勾选 → 注册按钮 → 分隔线 → 三方登录。尺寸取值与登录页一致,见 LoginScreen 顶部注释。
 *
 * 与设计稿的两处有意偏差:
 *   1. CTA 文案设计稿写的是「Login」(注册页上显然是笔误),这里用 user.register「Sign up」
 *   2. 设计稿没有昵称栏,故删掉原昵称输入;后端 nickname 为空时会自动取「User+手机后四位」
 *
 * 未实现的能力(设计稿有、后端没有),一律走 comingSoon:
 *   区号选择(固定 +95)、三方登录、条款/隐私政策详情页
 *
 * 邮箱:设计稿有此栏且 user_info.email 列也在,但 user-service 的注册接口暂未接收该入参
 * (见 api/user.ts 的注释),故这里按「选填 + 填了才校验」处理,值照常上送。
 */

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import SocialIcon, { type SocialProvider } from '@/components/user/SocialIcon';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { setGdprConsent } from '@/utils/gdpr';
import { isEmail, isMobile, isPassword } from '@/utils/validate';

const ILLUSTRATION = require('../../../assets/images/login/illustration.png');
const LOGO = require('../../../assets/images/login/logo-badge.png');

/** 设计稿固定展示 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
/** 顶部栏高度 = py16*2 + 返回按钮 36,与设计稿 Main 的 pt68 对齐 */
const TOP_BAR_HEIGHT = 68;
const SOCIALS: SocialProvider[] = ['google', 'facebook', 'apple'];

export default function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const register = useUserStore((s) => s.register);
  const showToast = useCommonStore((s) => s.showToast);
  const setGdprAccepted = useCommonStore((s) => s.setGdprAccepted);

  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [securePwd, setSecurePwd] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* 设计稿的 CTA 是 50% 透明的禁用态,对应必填项没填完或未勾选条款 */
  const canSubmit =
    mobile.trim().length > 0 &&
    password.length > 0 &&
    confirm.length > 0 &&
    agreed &&
    !submitting;

  const comingSoon = () => showToast(t('home.comingSoon'));

  const submit = async () => {
    if (!isMobile(mobile)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    if (email.trim() !== '' && !isEmail(email)) {
      showToast(t('user.invalidEmail'));
      return;
    }
    if (!isPassword(password)) {
      showToast(t('user.invalidPassword'));
      return;
    }
    if (password !== confirm) {
      showToast(t('user.passwordMismatch'));
      return;
    }
    if (!agreed) {
      showToast(t('user.agreeRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await register(mobile.trim(), password, { email: email.trim() || undefined });
      // 勾选条款即视为同意隐私政策(GDPR 授权落地)
      await setGdprConsent(true);
      setGdprAccepted(true);
      showToast(t('common.success'));
      // 注册来自 Login 页跳转,成功后回到栈底(MainTabs)
      navigation.popToTop();
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

          {/* 设计稿右上角是回登录页;注册页由登录页 push 而来,退栈即回登录 */}
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <Text style={styles.signIn}>{t('user.loginTitle')}</Text>
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

              <View style={styles.field}>
                <HomeIcon name="mail" size={20} color={colors.primary} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('user.emailPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  keyboardType="email-address"
                  maxLength={100}
                  autoCapitalize="none"
                  autoCorrect={false}
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
                  secureTextEntry={securePwd}
                  maxLength={32}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setSecurePwd((v) => !v)} hitSlop={10}>
                  <HomeIcon name="eyeOff" size={16} color={colors.body} />
                </Pressable>
              </View>

              <View style={styles.field}>
                <HomeIcon name="lock" size={20} color={colors.primary} />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder={t('user.confirmPasswordPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  secureTextEntry={secureConfirm}
                  maxLength={32}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setSecureConfirm((v) => !v)} hitSlop={10}>
                  <HomeIcon name="eyeOff" size={16} color={colors.body} />
                </Pressable>
              </View>
            </View>

            {/* 条款勾选:整行可点切换,条款/隐私政策两个词单独可点 */}
            <View style={styles.agreeRow}>
              <Pressable onPress={() => setAgreed((v) => !v)} hitSlop={6}>
                {/* 选中态换成实心方块的 checkboxIndeterminate,与登录页记住我一致 */}
                <HomeIcon
                  name={agreed ? 'checkboxIndeterminate' : 'checkbox'}
                  size={20}
                  color={agreed ? colors.primary : colors.softBlue}
                />
              </Pressable>
              <Text style={styles.agreeText}>
                <Text onPress={() => setAgreed((v) => !v)}>{t('user.agreePrefix')}</Text>
                <Text style={styles.agreeLink} onPress={comingSoon}>
                  {t('user.terms')}
                </Text>
                <Text onPress={() => setAgreed((v) => !v)}>{t('user.agreeAnd')}</Text>
                <Text style={styles.agreeLink} onPress={comingSoon}>
                  {t('user.privacyPolicy')}
                </Text>
                {/* 缅甸语的「同意」要放句尾,中英文这个键是空串 */}
                <Text onPress={() => setAgreed((v) => !v)}>{t('user.agreeSuffix')}</Text>
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                !canSubmit && styles.submitBtnDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              disabled={!canSubmit}
              onPress={() => void submit()}
            >
              <Text style={styles.submitText}>{t('user.register')}</Text>
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
  signIn: {
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
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会撑破字段,把右侧眼睛图标挤出去 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /* 设计稿 Inter Medium 12/17.5,正文 #575E72、链接 #204DDA */
  agreeText: {
    flex: 1,
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 17.5,
    letterSpacing: 0.14,
    color: '#575E72',
  },
  agreeLink: { color: '#204DDA' },

  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: {
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

  pressed: { opacity: 0.85 },
});
