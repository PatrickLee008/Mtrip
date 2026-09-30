import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiActivationFinish, apiActivationOtpSend, apiActivationOtpVerify, apiActivationStart,
  apiActivationTotpSetup, apiActivationTotpVerify, apiEmailLoginStart, apiEmailLoginVerify,
  apiRecoveryStart, apiRecoveryTotpSetup, apiRecoveryTotpVerify, apiRecoveryVerify,
} from '@/api/merchant';
import type { AuthOtpChallenge, TwoFaSetupResult } from '@/api/types';
import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, spacing } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';

type Mode = 'activation' | 'login' | 'recovery';
type Step = 'identity' | 'otp' | 'totp';

export default function MerchantAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialMode = (route.params as { mode?: Mode } | undefined)?.mode ?? 'login';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>('identity');
  const [accessCode, setAccessCode] = useState('');
  const [username, setUsername] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AuthOtpChallenge | null>(null);
  const [activationToken, setActivationToken] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [setup, setSetup] = useState<TwoFaSetupResult | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const showToast = useCommonStore((s) => s.showToast);
  const acceptSession = useMerchantStore((s) => s.acceptSession);
  const clearRegistration = useRegistrationStore((s) => s.clear);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const switchMode = (next: Mode) => {
    setMode(next); setStep('identity'); setChallenge(null); setCode(''); setSetup(null);
    setActivationToken(''); setRecoveryToken(''); setResendAt(0);
  };
  const handleError = (error: unknown) => showToast(error instanceof Error ? error.message : 'Request failed');
  const send = async (resend = false) => {
    if (busy || (resend && remaining > 0)) return;
    setBusy(true);
    try {
      let next: AuthOtpChallenge;
      if (mode === 'activation') {
        let token = activationToken;
        if (!resend) {
          if (!accessCode.trim() && (!username.trim() || !temporaryPassword)) {
            showToast('Enter an access code or username and temporary password'); return;
          }
          const identity = await apiActivationStart(accessCode.trim(), username.trim(), temporaryPassword);
          token = identity.activationToken;
          setActivationToken(token);
        }
        next = await apiActivationOtpSend(token);
      } else {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) { showToast('Enter your registered email'); return; }
        next = mode === 'login' ? await apiEmailLoginStart(email.trim().toLowerCase()) : await apiRecoveryStart(email.trim().toLowerCase());
      }
      setChallenge(next); setCode(''); setResendAt(Date.now() + next.resendAfter * 1000); setStep('otp');
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };
  const loadSetup = async (token: string) => {
    try {
      const result = mode === 'activation' ? await apiActivationTotpSetup(token) : await apiRecoveryTotpSetup(token);
      setSetup(result);
    } catch (error) { handleError(error); }
  };
  const verifyOtp = async () => {
    if (!challenge || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        const session = await apiEmailLoginVerify(challenge.challengeToken, code);
        await acceptSession(session);
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      } else if (mode === 'activation') {
        const result = await apiActivationOtpVerify(challenge.challengeToken, code);
        setActivationToken(result.activationToken); setStep('totp'); setCode('');
        await loadSetup(result.activationToken);
      } else {
        const result = await apiRecoveryVerify(challenge.challengeToken, code);
        setRecoveryToken(result.recoveryToken); setStep('totp'); setCode('');
        await loadSetup(result.recoveryToken);
      }
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    const token = mode === 'activation' ? activationToken : recoveryToken;
    if (!token || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    try {
      const session = mode === 'activation'
        ? (await apiActivationTotpVerify(token, code), await apiActivationFinish(token))
        : await apiRecoveryTotpVerify(token, code);
      await acceptSession(session);
      if (mode === 'activation') clearRegistration();
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>Back</Text></Pressable>
      <Text style={styles.title}>{mode === 'activation' ? 'Activate Merchant Account' : mode === 'recovery' ? 'Recover Authenticator' : 'Merchant Email Login'}</Text>
      <View style={styles.modeRow}>
        {(['activation', 'login', 'recovery'] as Mode[]).map((item) => <Pressable key={item} onPress={() => switchMode(item)}><Text style={[styles.mode, item === mode && styles.modeActive]}>{item === 'activation' ? 'Activate' : item === 'login' ? 'Login' : 'Recover'}</Text></Pressable>)}
      </View>
      {step === 'identity' ? <View style={styles.form}>
        {mode === 'activation' ? <>
          <Text style={styles.hint}>Use the Merchant Access Code or your username and temporary password.</Text>
          <TextInput style={styles.input} value={accessCode} onChangeText={setAccessCode} placeholder="Merchant Access Code" autoCapitalize="characters" />
          <Text style={styles.hint}>Or use the temporary credentials</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" />
          <TextInput style={styles.input} value={temporaryPassword} onChangeText={setTemporaryPassword} placeholder="Temporary password" secureTextEntry />
        </> : <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Registered email" keyboardType="email-address" autoCapitalize="none" />}
        <PrimaryButton label={busy ? 'Sending...' : 'Send Email Code'} disabled={busy} onPress={() => void send()} />
      </View> : null}
      {step === 'otp' ? <View style={styles.form}>
        <Text style={styles.hint}>Enter the code sent to {challenge?.recipient}.</Text>
        {challenge?.testMode ? <Text style={styles.testMode}>Test mode: no email was sent. Use 000000.</Text> : null}
        <TextInput style={styles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit code" />
        <PrimaryButton label={busy ? 'Verifying...' : 'Verify Email'} disabled={busy || code.length !== 6} onPress={() => void verifyOtp()} />
        <Pressable disabled={busy || remaining > 0} onPress={() => void send(true)}><Text style={[styles.link, remaining > 0 && styles.disabled]}>{remaining > 0 ? `Resend in ${remaining}s` : 'Resend code'}</Text></Pressable>
      </View> : null}
      {step === 'totp' ? <View style={styles.form}>
        <Text style={styles.hint}>Add this key to your Authenticator app, then enter its current 6-digit code.</Text>
        {setup ? <Text selectable style={styles.secret}>{setup.manualKey}</Text> : <Pressable onPress={() => void loadSetup(mode === 'activation' ? activationToken : recoveryToken)}><Text style={styles.link}>Load setup key</Text></Pressable>}
        <TextInput style={styles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="Authenticator code" />
        <PrimaryButton label={busy ? 'Finishing...' : mode === 'activation' ? 'Activate Account' : 'Recover Account'} disabled={busy || !setup || code.length !== 6} onPress={() => void finish()} />
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
  secret: { fontFamily: fonts.interSemi, color: colors.primary, fontSize: 18, letterSpacing: 1 },
});
