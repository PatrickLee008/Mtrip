/**
 * 注册页:手机号+密码+昵称(选填),成功即登录并回退两层
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import CustomButton from '@/components/common/CustomButton';
import CustomInput from '@/components/common/CustomInput';
import PageLayout from '@/components/layout/PageLayout';
import { colors, fontSize, spacing } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { setGdprConsent } from '@/utils/gdpr';
import { isMobile, isPassword } from '@/utils/validate';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const register = useUserStore((s) => s.register);
  const showToast = useCommonStore((s) => s.showToast);
  const setGdprAccepted = useCommonStore((s) => s.setGdprAccepted);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await register(mobile.trim(), password, nickname.trim() || undefined);
      // 注册即视为同意隐私政策(GDPR 授权落地)
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
    <PageLayout scrollable padded>
      <View style={styles.form}>
        <CustomInput
          label={t('user.mobile')}
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          maxLength={20}
        />
        <CustomInput
          label={t('user.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          maxLength={32}
        />
        <CustomInput
          label={t('user.nickname')}
          value={nickname}
          onChangeText={setNickname}
          maxLength={30}
        />
        <CustomButton title={t('user.register')} loading={submitting} onPress={() => void submit()} />
        <Pressable style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{t('user.toLogin')}</Text>
        </Pressable>
      </View>
      <Text style={styles.gdprTip}>{t('user.gdprTip')}</Text>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.xl },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { fontSize: fontSize.sm, color: colors.primary },
  gdprTip: {
    marginTop: spacing.xl,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
