/**
 * 登录页:手机号+密码,成功后返回上一页
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import CustomButton from '@/components/common/CustomButton';
import CustomInput from '@/components/common/CustomInput';
import PageLayout from '@/components/layout/PageLayout';
import { colors, fontSize, spacing } from '@/config/theme';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { isMobile, isPassword } from '@/utils/validate';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const login = useUserStore((s) => s.login);
  const showToast = useCommonStore((s) => s.showToast);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
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
      await login(mobile.trim(), password);
      showToast(t('common.success'));
      navigation.goBack();
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
        <CustomButton title={t('user.login')} loading={submitting} onPress={() => void submit()} />
        <Pressable style={styles.link} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>{t('user.toRegister')}</Text>
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
