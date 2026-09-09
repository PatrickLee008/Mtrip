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
 *   CTA      主色 py16 圆角 12,Outfit 400 16/28;未填满时整体 50% 透明(设计稿即禁用态)
 *
 * **短信通道走 SMSPoh Verify API V3**(后端 `/app/auth/sms/{send,verify}`)。
 * 三个场景共用本页,由路由参数 `scene` 区分:
 *   register → 验证通过后带 `verifyToken` 去推荐码页,由那一页统一提交注册
 *   login    → 验证通过即免密登录(`userStore.loginBySms`)
 *   reset    → 验证通过后去重置密码页
 *
 * **本页不负责首次发码** —— 进来之前上一屏(注册页 / 忘记密码页 / 登录页的验证码入口)
 * 已经发过一条,这里挂载时再发一次就会连发两条、白烧一条短信,也会把重发冷却直接触发。
 * 所以倒计时按上一屏返回的 `resendAfter` 起跳,只有点「Resend OTP」才真的再发。
 *
 * 对设计稿的两处偏离(设计稿只画了注册场景的静态页):
 *   1. 格子数量改为按后端下发的 `pinLength` 渲染(后台可配 4~8,默认 6 与设计稿一致)——
 *      写死 6 格而后台配了 4 位的话,用户永远填不满、Continue 永远点不亮。
 *   2. 「更换手机号」在 login/reset 场景同样是返回上一屏,文案未按场景改写(设计稿没有对应稿)。
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

import { ApiError } from '@/api/request';
import { API_CODE } from '@/api/types';
import { apiSmsSend, apiSmsVerify } from '@/api/user';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

/** 设计稿固定展示 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
/** 设计稿是 6 格;后台可配 4~8,实际以发码接口返回的 pinLength 为准 */
const DEFAULT_CODE_LENGTH = 6;
/** 后端 SmsVerifyService 的重发冷却也是 60 秒,两边保持一致 */
const DEFAULT_RESEND_SECONDS = 60;

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
  const params = useRoute<RouteProp<RootStackParamList, 'VerifyOtp'>>().params;
  const { scene, mobile, draft, maskedMobile } = params;
  const showToast = useCommonStore((s) => s.showToast);
  const loginBySms = useUserStore((s) => s.loginBySms);

  const [codeLength, setCodeLength] = useState(params.pinLength ?? DEFAULT_CODE_LENGTH);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: params.pinLength ?? DEFAULT_CODE_LENGTH }, () => ''),
  );
  const [left, setLeft] = useState(params.resendAfter ?? DEFAULT_RESEND_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);

  /* 倒计时:每秒减 1,到 0 停住并放开重发。依赖只取「是否还在走」,避免每秒重建定时器 */
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const code = digits.join('');
  const canSubmit = code.length === codeLength && !submitting;

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
      for (let i = 0; i < nums.length && index + i < codeLength; i += 1) {
        next[index + i] = nums[i];
      }
      return next;
    });
    const nextIndex = Math.min(index + nums.length, codeLength - 1);
    inputs.current[nextIndex]?.focus();
  };

  /** 空格上按退格:回到上一格并清掉它(RN 不会自动跨格删) */
  const onKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace' || digits[index] !== '' || index === 0) return;
    setDigits((prev) => prev.map((d, i) => (i === index - 1 ? '' : d)));
    inputs.current[index - 1]?.focus();
  };

  const resend = async () => {
    if (left > 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await apiSmsSend({ mobile, scene });
      // 后端可能改过配置,重发时按最新的位数重置格子
      setCodeLength(result.pinLength);
      setDigits(Array.from({ length: result.pinLength }, () => ''));
      setLeft(result.resendAfter);
      inputs.current[0]?.focus();
      showToast(t('user.otp.resent'));
    } catch (e) {
      // 限流(42911)时后端已给出具体文案,request 层已 Toast,这里不再重复弹
      if (!(e instanceof ApiError)) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** 验证通过后按场景分流 */
  const dispatchByScene = async (verifyToken: string) => {
    if (scene === 'register') {
      if (!draft) {
        // 正常流程不会发生(注册场景一定带 draft),兜底回注册表单重来
        showToast(t('user.otp.invalid'));
        navigation.navigate('Register');
        return;
      }
      navigation.navigate('ReferralCode', { draft, verifyToken });
      return;
    }
    if (scene === 'login') {
      await loginBySms(mobile, verifyToken);
      showToast(t('common.success'));
      // 验证码登录由登录页 push 而来,完成后回到栈底
      navigation.popToTop();
      return;
    }
    navigation.navigate('ResetPassword', { mobile, verifyToken });
  };

  const submit = async () => {
    if (code.length !== codeLength) {
      showToast(t('user.otp.invalid'));
      return;
    }
    setSubmitting(true);
    try {
      const { verifyToken } = await apiSmsVerify({ mobile, scene, code });
      await dispatchByScene(verifyToken);
    } catch (e) {
      // 码错/码过期都清空重填;request 层已按后端文案 Toast 过
      if (e instanceof ApiError && (e.code === API_CODE.SMS_CODE_INVALID || e.code === API_CODE.SMS_CODE_EXPIRED)) {
        setDigits(Array.from({ length: codeLength }, () => ''));
        inputs.current[0]?.focus();
      } else if (!(e instanceof ApiError)) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setSubmitting(false);
    }
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
            <Text style={styles.descStrong}>{maskedMobile ?? maskMobile(mobile)}</Text>
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
                /* 粘贴整串时 maxLength=1 会被截断,故留出整串长度由 onChangeDigit 自己铺开 */
                maxLength={codeLength}
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
                (left > 0 || submitting) && styles.resendDisabled,
                pressed && left === 0 && styles.pressed,
              ]}
              disabled={left > 0 || submitting}
              onPress={() => void resend()}
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
            onPress={() => void submit()}
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
