/**
 * 忘记密码 · 第二步:凭 verifyToken 设置新密码
 *
 * ⚠ **设计稿没有这一页**(同 `ForgotPasswordScreen` 的说明),版式复用 AuthShell +
 * 验证码/推荐码页那张带描边的白卡,密码字段逐字沿用登录页的写法(含右侧眼睛切换)。
 *
 * `verifyToken` 由验证码页透传,是 scene=reset 的一次性票据(后端 10 分钟有效):
 * 提交成功即被后端作废,所以本页失败后可以原地改密码重试,但**不能返回上一页再提交一次**。
 * 后端重置后**不自动登录**,这里提交成功直接回登录页,让用户用新密码走一次正常登录。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { apiResetPassword } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { isPassword } from '@/utils/validate';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mobile, verifyToken } = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [securePwd, setSecurePwd] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = password.length > 0 && confirm.length > 0 && !submitting;

  const submit = async () => {
    if (!isPassword(password)) {
      showToast(t('user.invalidPassword'));
      return;
    }
    if (password !== confirm) {
      showToast(t('user.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await apiResetPassword({ mobile, password, verifyToken });
      showToast(t('user.reset.success'));
      // 栈里已有登录页(本流程由它 push 而来),navigate 会退回到它而不是再压一层
      navigation.navigate('Login');
    } catch (e) {
      if (!(e instanceof ApiError)) {
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
          <Text style={styles.title}>{t('user.reset.title')}</Text>
          <Text style={styles.desc}>{t('user.reset.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fields}>
            <View style={styles.field}>
              <HomeIcon name="lock" size={20} color={colors.primary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('user.reset.newPasswordPlaceholder')}
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

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
            disabled={!canSubmit}
            onPress={() => void submit()}
          >
            <Text style={styles.ctaText}>{t('user.reset.submit')}</Text>
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
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会把右侧眼睛图标挤出去 */
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
