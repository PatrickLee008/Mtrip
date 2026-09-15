/**
 * 【临时页 · 接通真实 OTP 时整个文件删掉】固定验证码页
 *
 * 真实短信通道(SMSPoh)还没配渠道,注册流程里的验证码这一步先用这一页顶上:
 * **纯前端校验,只认 `FIXED_CODE`(123456),不发任何网络请求、也不签发/校验票据**。
 * 后端此时没有启用中的渠道,`AuthController::register` 不强制 `verifyToken`
 * (「渠道启用即强制」),所以过完这一页直接去推荐码页提交注册即可。
 *
 * 与真页 `VerifyOtpScreen` 的关系:**那一页原样留着、一行没改**,接通真实短信后
 * 把 `RegisterScreen` 的 `USE_FIXED_OTP` 去掉就自动切回去。本页刻意不复用它的组件 ——
 * 混在一起会让「哪段是临时的」变得难分辨,删除时容易误伤。
 *
 * 版式照搬 `VerifyOtpScreen`(AuthShell + 白卡 + 六格 + CTA),但去掉了倒计时与
 * 「Resend OTP」—— 本页根本没发过码,放一个重发按钮是假的。
 */

import React, { useRef, useState } from 'react';
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

/** 唯一能通过本页的码 */
const FIXED_CODE = '123456';
const CODE_LENGTH = FIXED_CODE.length;

export default function FixedOtpScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft } = useRoute<RouteProp<RootStackParamList, 'FixedOtp'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  const inputs = useRef<Array<TextInput | null>>([]);

  const code = digits.join('');
  const canSubmit = code.length === CODE_LENGTH;

  /** 单格输入:只收数字;粘贴整串时按位铺开并把焦点移到最后一格(同 VerifyOtpScreen) */
  const onChangeDigit = (index: number, text: string) => {
    let nums = text.replace(/\D/g, '');
    /* 格子里已有数字时再敲一位,RN 给的是「旧值 + 新字符」,剥掉旧值回到「覆写再前进」 */
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
    inputs.current[Math.min(index + nums.length, CODE_LENGTH - 1)]?.focus();
  };

  /** 空格上按退格:回到上一格并清掉它(RN 不会自动跨格删) */
  const onKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace' || digits[index] !== '' || index === 0) return;
    setDigits((prev) => prev.map((d, i) => (i === index - 1 ? '' : d)));
    inputs.current[index - 1]?.focus();
  };

  const submit = () => {
    if (code !== FIXED_CODE) {
      // 码不对就把提示语原样弹出来(它本身就写着该填什么),并清空重填
      showToast(t('user.otp.fixedHint', { code: FIXED_CODE }));
      setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
      inputs.current[0]?.focus();
      return;
    }
    /* 不带 verifyToken:后端没配渠道时 register 不强制票据 */
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
          <Text style={styles.desc}>{t('user.otp.enterBelow')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.boxesGroup}>
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
                  maxLength={CODE_LENGTH}
                  selectTextOnFocus
                  textAlign="center"
                  accessibilityLabel={`${t('user.otp.title')} ${index + 1}`}
                />
              ))}
            </View>

            {/* 底部浅色提示:告诉用户填 123456 */}
            <Text style={styles.hint}>{t('user.otp.fixedHint', { code: FIXED_CODE })}</Text>
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
  desc: {
    paddingHorizontal: 27.81,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.label,
    textAlign: 'center',
  },

  form: { width: '100%', gap: 32 },
  boxesGroup: { width: '100%', gap: 8 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    flex: 1,
    /* minWidth 0:web 端 <input> 的 min-width:auto 会把六格撑破 */
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
  /* 比说明文案更淡一档,不抢版面 */
  hint: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
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
