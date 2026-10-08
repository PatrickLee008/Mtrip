import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  apiActivationFinish, apiActivationOtpSend, apiActivationOtpVerify, apiActivationStart,
  apiRecoveryStart, apiRecoveryVerify,
} from '@/api/merchant';
import type { AuthOtpChallenge } from '@/api/types';
import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, spacing } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';

type Mode = 'activation' | 'login' | 'recovery';
type Step = 'identity' | 'otp';

export default function MerchantAccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const initialMode = (route.params as { mode?: Mode } | undefined)?.mode ?? 'activation';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>('identity');
  const [accessCode, setAccessCode] = useState('');
  const [username, setUsername] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AuthOtpChallenge | null>(null);
  const [activationToken, setActivationToken] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const showToast = useCommonStore((s) => s.showToast);
  const beginEmailLogin = useMerchantStore((s) => s.beginEmailLogin);
  const verifyEmailLogin = useMerchantStore((s) => s.verifyEmailLogin);
  const acceptSession = useMerchantStore((s) => s.acceptSession);
  const clearRegistration = useRegistrationStore((s) => s.clear);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const switchMode = (next: Mode) => {
    setMode(next); setStep('identity'); setChallenge(null); setCode('');
    setActivationToken(''); setResendAt(0);
  };
  const handleError = (error: unknown) => showToast(error instanceof Error ? error.message : t('flow.common.requestFailed'));
  const send = async (resend = false) => {
    if (busy || (resend && remaining > 0)) return;
    setBusy(true);
    try {
      let next: AuthOtpChallenge;
      if (mode === 'activation') {
        let token = activationToken;
        if (!resend) {
          if (!accessCode.trim() && (!username.trim() || !temporaryPassword)) {
            showToast(t('flow.account.identityRequired')); return;
          }
          const identity = await apiActivationStart(accessCode.trim(), username.trim(), temporaryPassword);
          token = identity.activationToken;
          setActivationToken(token);
        }
        next = await apiActivationOtpSend(token);
      } else if (mode === 'recovery') {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) { showToast(t('flow.account.emailRequired')); return; }
        next = await apiRecoveryStart(email.trim().toLowerCase());
      } else {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) { showToast(t('flow.account.emailRequired')); return; }
        next = await beginEmailLogin(email.trim().toLowerCase());
      }
      setChallenge(next); setCode(''); setResendAt(Date.now() + next.resendAfter * 1000); setStep('otp');
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    if (!challenge || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    try {
      if (mode === 'activation') {
        const result = await apiActivationOtpVerify(challenge.challengeToken, code);
        if (result.profile.methods.accessCode) {
          await acceptSession(await apiActivationFinish(result.activationToken));
          clearRegistration();
          navigation.reset({ index: 0, routes: [{ name: 'BiometricOptIn' }] });
        } else navigation.navigate('TwoFaSetup', { mode: 'activation', token: result.activationToken });
      } else if (mode === 'recovery') {
        const result = await apiRecoveryVerify(challenge.challengeToken, code);
        navigation.navigate('TwoFaSetup', { mode: 'recovery', token: result.recoveryToken });
      } else {
        const next = await verifyEmailLogin(challenge.challengeToken, code);
        navigation.navigate(next.requiresEnrollment ? 'TwoFaSetup' : 'TwoFaVerify', { mode: 'login' });
      }
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>{t('register.back')}</Text></Pressable>
      <Text style={styles.title}>{t(`flow.account.${mode}Title`)}</Text>
      <View style={styles.modeRow}>
        {(['activation', 'login', 'recovery'] as Mode[]).map((item) => <Pressable key={item} onPress={() => switchMode(item)}><Text style={[styles.mode, item === mode && styles.modeActive]}>{t(`flow.account.${item}Tab`)}</Text></Pressable>)}
      </View>
      {step === 'identity' ? <View style={styles.form}>
        {mode === 'activation' ? <>
          <Text style={styles.hint}>{t('flow.account.identityHint')}</Text>
          <TextInput style={styles.input} value={accessCode} onChangeText={setAccessCode} placeholder={t('flow.account.accessCode')} autoCapitalize="characters" />
          <Text style={styles.hint}>{t('flow.account.temporaryHint')}</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder={t('flow.account.username')} autoCapitalize="none" />
          <TextInput style={styles.input} value={temporaryPassword} onChangeText={setTemporaryPassword} placeholder={t('flow.account.temporaryPassword')} secureTextEntry />
        </> : <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('flow.account.registeredEmail')} keyboardType="email-address" autoCapitalize="none" />}
        <PrimaryButton label={busy ? t('flow.common.sending') : t('flow.account.sendEmailCode')} disabled={busy} onPress={() => void send()} />
      </View> : null}
      {step === 'otp' ? <View style={styles.form}>
        <Text style={styles.hint}>{t('flow.account.codeSent', { recipient: challenge?.recipient })}</Text>
        {challenge?.testMode ? <Text style={styles.testMode}>{t('flow.account.testMode')}</Text> : null}
        <TextInput style={styles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder={t('flow.account.sixDigitCode')} />
        <PrimaryButton label={busy ? t('flow.common.verifying') : t('flow.account.verifyEmail')} disabled={busy || code.length !== 6} onPress={() => void verifyOtp()} />
        <Pressable disabled={busy || remaining > 0} onPress={() => void send(true)}><Text style={[styles.link, remaining > 0 && styles.disabled]}>{remaining > 0 ? t('flow.account.resendIn', { seconds: remaining }) : t('flow.account.resendCode')}</Text></Pressable>
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: PAGE_PADDING, paddingBottom: 48, gap: spacing.lg },
  back: { fontFamily: fonts.interSemi, color: colors.primary, fontSize: 15 },
  title: { fontFamily: fonts.outfitBold, fontSize: 26, color: colors.slate900 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  mode: { fontFamily: fonts.interSemi, fontSize: 14, color: colors.slate900, opacity: 0.55 },
  modeActive: { color: colors.primary, opacity: 1 },
  form: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: '#EFF4FF', paddingHorizontal: 16, fontFamily: fonts.inter, color: colors.slate900 },
  hint: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900 },
  testMode: { fontFamily: fonts.interSemi, color: colors.warning, fontSize: 14 },
  link: { fontFamily: fonts.interSemi, color: colors.primary, fontSize: 14, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
