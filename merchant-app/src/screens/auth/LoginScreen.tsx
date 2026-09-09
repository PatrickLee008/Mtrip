import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, spacing } from '@/config/theme';
import { fonts, text } from '@/config/typography';
import { useCommonStore, useMerchantStore } from '@/store';
import { isSixDigitCode, required } from '@/utils/validate';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const { challenge, setup, beginLogin, loadTwoFaSetup, verifyTwoFa } = useMerchantStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const start = async () => {
    if (!required(username) || !required(password)) return;
    setSubmitting(true);
    try {
      const result = await beginLogin(username.trim(), password);
      if (result.requiresEnrollment) await loadTwoFaSetup();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    if (!isSixDigitCode(twoFaCode)) return;
    setSubmitting(true);
    try {
      await verifyTwoFa(twoFaCode.trim());
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('auth.loginTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.card}>
        {!challenge ? (
          <>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder={t('auth.accessCode')} placeholderTextColor={colors.body} autoCapitalize="none" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('auth.password')} placeholderTextColor={colors.body} secureTextEntry />
            <PrimaryButton label={t('auth.continue')} disabled={!required(username) || !required(password) || submitting} onPress={() => void start()} />
          </>
        ) : (
          <>
            {setup ? (
              <View style={styles.setupBox}>
                <Text style={styles.setupHint}>{t('auth.setupHint')}</Text>
                <Text style={styles.setupKey}>{t('auth.manualKey')}: {setup.manualKey}</Text>
              </View>
            ) : null}
            <TextInput style={styles.input} value={twoFaCode} onChangeText={setTwoFaCode} placeholder={t('auth.twoFa')} placeholderTextColor={colors.body} keyboardType="number-pad" maxLength={6} />
            <PrimaryButton label={t('auth.verify')} disabled={!isSixDigitCode(twoFaCode) || submitting} onPress={() => void verify()} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: PAGE_PADDING },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 34, lineHeight: 40, color: colors.primary },
  headerTitle: { fontFamily: fonts.outfitSemi, fontSize: 20, color: colors.slate900 },
  headerSpacer: { width: 24 },
  card: { marginTop: 48, gap: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: '#EFF4FF', paddingHorizontal: 16, fontFamily: fonts.inter, fontSize: 15, color: colors.slate900 },
  setupBox: { gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primaryLight, padding: spacing.lg },
  setupHint: text.body,
  setupKey: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.primary },
});
