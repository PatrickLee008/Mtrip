/**
 * 忘记密码 · 第三步:凭 verifyToken 设置新密码(Figma Onboarding · Login Forgot Password `3606:10832`)
 * 成功后弹 Success Overlay `3606:11034`,「Back to login」回登录页。
 *
 * 设计稿实测:
 *   外壳   AuthShell,**无顶部栏**(同第一步 `3602:9946`)
 *   卡片   `--tab` 圆角 24,padding 24,gap 8,无描边无投影
 *   小标题 Inter 400/16(行高 24)`--text` 左对齐
 *   密码框 两枚,`--secondary` #D9E1FB 高 52 圆角 12 p16,fluent:lock-closed-20-filled 主色 + 输入框,gap 12
 *   说明   Inter 400/16(行高 26)`--text-2`
 *   CTA    主色 py16 圆角 12,Outfit 400/16(行高 28)白字
 *   卡底   一段 24 高的空 Footer Link(与验证码页的「Change phone number」等高,换页时卡片高度不跳)
 *
 * 对设计稿的偏离:
 *   - 说明文案稿面写的是「至少 6 位,含大写、小写和特殊字符」,与后端真实规则不符
 *     (`UserAuthService::PASSWORD_PATTERN` = 6-32 位、至少 1 个大写字母 + 1 个数字,`isPassword` 同步),
 *     按真实规则改写,否则用户照稿设的密码可能被拒、照规则设的密码又不满足稿面描述。
 *   - 稿里密码框没有眼睛图标;两次盲输新密码容易输错,沿用登录页的明文切换(右侧 eye-off 16)。
 *   - 占位符稿面是 Inter Light Italic,同第一步说明,用常规体。
 *
 * `verifyToken` 由验证码页透传,是 scene=reset 的一次性票据(后端 10 分钟有效):
 * 提交成功即被后端作废,所以本页失败后可以原地改密码重试,但**不能返回上一页再提交一次**。
 * 后端重置后**不自动登录**,成功弹窗只给「回登录页」一条路,让用户用新密码走一次正常登录。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { apiResetPassword } from '@/api/user';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius } from '@/config/theme';
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
  const [done, setDone] = useState(false);

  /* 稿面空表单时 Continue 是实色;规则不满足交给 submit 里的 Toast */
  const canSubmit = !submitting && !done;

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
      setDone(true);
    } catch (e) {
      // 40001 密码不合规 / 40111 票据失效 / 40401·40301 账号状态变化,request 层已按后端文案 Toast
      if (!(e instanceof ApiError)) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** 栈里已有登录页(本流程由它 push 而来),navigate 会退回到它而不是再压一层 */
  const backToLogin = () => {
    setDone(false);
    navigation.navigate('Login');
  };

  return (
    <AuthShell>
      <View style={styles.card}>
        <Text style={styles.heading}>{t('user.reset.heading')}</Text>

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
            placeholder={t('user.reset.confirmPlaceholder')}
            placeholderTextColor={colors.textSoft}
            secureTextEntry={secureConfirm}
            maxLength={32}
            autoCapitalize="none"
          />
          <Pressable onPress={() => setSecureConfirm((v) => !v)} hitSlop={10}>
            <HomeIcon name="eyeOff" size={16} color={colors.body} />
          </Pressable>
        </View>

        <Text style={styles.hint}>{t('user.reset.hint')}</Text>

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

        <View style={styles.footerSpacer} />
      </View>

      <ConfirmDialog
        visible={done}
        icon="checkmarkCircle"
        iconColor={colors.primary}
        titleColor={colors.primary}
        title={t('user.reset.successTitle')}
        message={t('user.reset.successMessage')}
        confirmLabel={t('user.reset.backToLogin')}
        onCancel={backToLogin}
        onConfirm={backToLogin}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 8,
  },
  heading: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会把右侧眼睛图标挤出去 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  hint: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 26, color: colors.textSoft },

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
  footerSpacer: { height: 24 },
  pressed: { opacity: 0.85 },
});
