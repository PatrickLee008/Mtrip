/**
 * 短信验证码页(按 Figma Onboarding / Signup node `566:3741` 空态 + `566:3902` 填充态重做)
 *
 * 结构:公共外壳 `components/user/AuthShell`(主色底 + 插画 + 顶部栏 + logo/标语)
 * → 白卡:标题 → 「已发送到 +95 9***56」说明 → 6 位分格输入 → 倒计时 + 重发 → Continue → 更换手机号。
 *
 * 设计稿实测:
 *   卡片     `--tab` 圆角 32,padding 24,gap 24,1px `--secondary` 描边,投影 DS_AG
 *   标题     Inter SemiBold 24/32 `--text`;说明 Inter Regular 16/24 #747686(第二句加粗)
 *   分格框   高 56,圆角 12,白底 1px #C4C5D7 描边,六格等分 gap 8;数字 Inter Medium 20 主色居中
 *   表单     三段(分格 / 倒计时 / CTA)gap 32;倒计时 Inter Bold 16/24 #204DDA,重发按钮 pt8 且 50% 透明
 *   CTA      主色 py16 圆角 12,Outfit 400 16/28;未填满 6 位时整体 50% 透明(设计稿即禁用态)
 *
 * ⚠ **短信通道还没接**:后端没有发码/验码接口,所以本页是「走过场」——
 * 进页面就把演示码 `123456` 填好,Continue 只校验「填满 6 位」,填什么都通过,重发只是把倒计时归零。
 * 接入真实短信后,改动集中在三处:进页面不再预填、`resend` 调发码接口、`submit` 先调验码接口。
 *
 * 注册接口是**一次性收单**(手机号 + 密码 + 推荐码),而设计稿把推荐码排在本页之后,
 * 因此这里**不落库**,只把 `draft` 透传给推荐码页,由那一页统一提交(见 `ReferralCodeScreen`)。
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputKeyPressEventData,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import AuthShell from '@/components/user/AuthShell';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';

/** 设计稿固定展示 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
const CODE_LENGTH = 6;
/** 短信未接通期间的演示验证码(进页面即预填) */
const MOCK_CODE = '123456';
/** 设计稿倒计时从 02:00 起跳(截图上是走了 1 秒的 01:59) */
const RESEND_SECONDS = 120;

/** 手机号打码:留首位与末两位,中间填星,与设计稿 `9*******56` 一致 */
function maskMobile(mobile: string): string {
  const digits = mobile.trim();
  if (digits.length <= 3) return `${COUNTRY_CODE} ${digits}`;
  const stars = '*'.repeat(digits.length - 3);
  return `${COUNTRY_CODE} ${digits.slice(0, 1)}${stars}${digits.slice(-2)}`;
}

function formatCountdown(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft } = useRoute<RouteProp<RootStackParamList, 'VerifyOtp'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [digits, setDigits] = useState<string[]>(() => MOCK_CODE.split('').slice(0, CODE_LENGTH));
  const [left, setLeft] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<TextInput | null>>([]);

  /* 倒计时:每秒减 1,到 0 停住并放开重发。依赖只取「是否还在走」,避免每秒重建定时器 */
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const code = digits.join('');
  const canSubmit = code.length === CODE_LENGTH;

  /** 单格输入:只收数字;粘贴整串时按位铺开并把焦点移到最后一格 */
  const onChangeDigit = (index: number, text: string) => {
    let nums = text.replace(/\D/g, '');
    /**
     * 格子里已有数字时再敲一位,RN 给的 text 是「旧值 + 新字符」(共 2 位),
     * 这里把旧值剥掉,行为回到「覆写当前格再前进」。
     * 只在长度恰好为 2 时剥,免得把粘贴进来的整串首位当成旧值误删。
     */
    if (digits[index] !== '' && nums.length === 2 && nums.startsWith(digits[index])) {
      nums = nums.slice(1);
    }
    if (nums === '') {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < nums.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = nums[i];
      }
      return next;
    });
    const nextIndex = Math.min(index + nums.length, CODE_LENGTH - 1);
    inputs.current[nextIndex]?.focus();
  };

  /** 空格上按退格:回到上一格并清掉它(RN 不会自动跨格删) */
  const onKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace' || digits[index] !== '' || index === 0) return;
    setDigits((prev) => prev.map((d, i) => (i === index - 1 ? '' : d)));
    inputs.current[index - 1]?.focus();
  };

  const resend = () => {
    if (left > 0) return;
    // 短信未接通:只把倒计时归零重来,并把演示码填回去
    setDigits(MOCK_CODE.split('').slice(0, CODE_LENGTH));
    setLeft(RESEND_SECONDS);
    showToast(t('user.otp.resent'));
  };

  const submit = () => {
    if (!canSubmit) {
      showToast(t('user.otp.invalid'));
      return;
    }
    // 没有验码接口,填满即放行;推荐码页才真正提交注册
    navigation.navigate('ReferralCode', { draft });
  };

  return (
    <AuthShell
      actionLabel={t('user.loginTitle')}
      onAction={() => navigation.navigate('Login')}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('user.otp.title')}</Text>
          <Text style={styles.desc}>
            {t('user.otp.sentTo')}
            <Text style={styles.descStrong}>{maskMobile(draft.mobile)}</Text>
            {'. '}
            <Text style={styles.descStrong}>{t('user.otp.enterBelow')}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.boxes}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                style={styles.box}
                value={digit}
                onChangeText={(text) => onChangeDigit(index, text)}
                onKeyPress={(e) => onKeyPress(index, e)}
                keyboardType="number-pad"
                /* 粘贴 6 位整串时 maxLength=1 会被截断,故留出整串长度由 onChangeDigit 自己铺开 */
                maxLength={CODE_LENGTH}
                selectTextOnFocus
                textAlign="center"
                accessibilityLabel={`${t('user.otp.title')} ${index + 1}`}
              />
            ))}
          </View>

          <View style={styles.timerBox}>
            <Text style={styles.timer}>{formatCountdown(left)}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.resendBtn,
                left > 0 && styles.resendDisabled,
                pressed && left === 0 && styles.pressed,
              ]}
              disabled={left > 0}
              onPress={resend}
              hitSlop={8}
            >
              <Text style={styles.resendText}>{t('user.otp.resend')}</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
            disabled={!canSubmit}
            onPress={submit}
          >
            <Text style={styles.ctaText}>{t('user.otp.continue')}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>{t('user.otp.changePhone')}</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    padding: 24,
    gap: 24,
    ...shadows.card,
  },

  header: { width: '100%', alignItems: 'center' },
  title: {
    marginBottom: 8,
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
    textAlign: 'center',
  },
  /* 设计稿左右各留 27.81 的内边距,让说明文案折成两行 */
  desc: {
    paddingHorizontal: 27.81,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.label,
    textAlign: 'center',
  },
  descStrong: { fontFamily: fonts.interBold },

  form: { width: '100%', gap: 32 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    flex: 1,
    /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会把六格撑破 */
    minWidth: 0,
    height: 56,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
    fontFamily: fonts.interMedium,
    fontSize: 20,
    letterSpacing: 0.14,
    color: colors.primary,
    textAlign: 'center',
  },

  timerBox: { alignItems: 'center' },
  timer: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#204DDA' },
  resendBtn: { paddingTop: 8 },
  resendDisabled: { opacity: 0.5 },
  resendText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.label,
    textAlign: 'center',
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  footerLink: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#204DDA' },
  pressed: { opacity: 0.85 },
});
