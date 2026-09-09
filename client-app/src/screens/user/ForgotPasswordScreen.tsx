/**
 * 忘记密码 · 第一步:输入手机号发验证码
 *
 * ⚠ **设计稿没有这一页**(Onboarding section 752:9380 只画了登录 / 注册 / 验证码 / 推荐码四张)。
 * 版式因此复用同一套外壳与卡片取值:`AuthShell` + 验证码/推荐码页那张带描边的白卡
 * (`--tab` 圆角 32,padding 24,gap 24,1px `--secondary` 描边,投影 DS_AG),
 * 手机号字段逐字沿用登录页的写法(`#EFF4FF` 高 52 圆角 12,+95 区号 + 竖线 + 输入框)。
 * 等设计稿补齐后按稿调整即可,不要在这里另起一套视觉。
 *
 * 链路:本页发码(scene=reset)→ `VerifyOtp` 填码 → `ResetPassword` 设新密码 → 回登录页。
 * 发码放在本页是为了让「该手机号尚未注册」在还能改号码的这一屏就报出来。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { apiSmsSend } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { isMobile } from '@/utils/validate';

/** 与登录/注册页一致:固定 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const [mobile, setMobile] = useState('');
  const [sending, setSending] = useState(false);

  const canSubmit = mobile.trim().length > 0 && !sending;

  const submit = async () => {
    if (!isMobile(mobile)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    const target = mobile.trim();
    setSending(true);
    try {
      const sent = await apiSmsSend({ mobile: target, scene: 'reset' });
      navigation.navigate('VerifyOtp', {
        scene: 'reset',
        mobile: target,
        resendAfter: sent.resendAfter,
        pinLength: sent.pinLength,
        maskedMobile: sent.mobile,
      });
    } catch (e) {
      // 号码未注册 / 限流 / 未配渠道,request 层已按后端文案 Toast;
      // 这里没有可降级的路径(没短信就重置不了密码),只能停在本页
      if (!(e instanceof ApiError)) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setSending(false);
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
          <Text style={styles.title}>{t('user.forgot.title')}</Text>
          <Text style={styles.desc}>{t('user.forgot.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <HomeIcon name="phone" size={20} color={colors.primary} />
            <Pressable
              style={({ pressed }) => [styles.codeBtn, pressed && styles.pressed]}
              onPress={() => showToast(t('home.comingSoon'))}
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

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
            disabled={!canSubmit}
            onPress={() => void submit()}
          >
            <Text style={styles.ctaText}>{t('user.forgot.continue')}</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 8,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.label,
    textAlign: 'center',
  },

  form: { width: '100%', gap: 32 },
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
  vDivider: { width: 1, height: 20, backgroundColor: colors.textSoft },
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会撑破字段 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

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
  pressed: { opacity: 0.85 },
});
