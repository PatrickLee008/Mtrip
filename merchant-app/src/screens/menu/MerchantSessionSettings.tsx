import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { apiEndSession, apiOwnSessions, type MerchantSession } from '@/api/sessions';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { biometricEnabled, disableBiometric, enableBiometric } from '@/utils/merchantSession';
import { ui } from './MenuUi';

export default function MerchantSessionSettings() {
  const { t } = useTranslation();
  const token = useMerchantStore((state) => state.token);
  const toast = useCommonStore((state) => state.showToast);
  const [data, setData] = useState<Awaited<ReturnType<typeof apiOwnSessions>>>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [enabled, setEnabled] = useState(false);

  async function load() {
    setLoading(true);
    try { setData(await apiOwnSessions()); } catch { /* API reports errors. */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void load();
    if (Platform.OS === 'web') return;
    void Promise.all([LocalAuthentication.supportedAuthenticationTypesAsync(), LocalAuthentication.isEnrolledAsync(), biometricEnabled()])
      .then(([types, enrolled, stored]) => {
        const biometric = LocalAuthentication.AuthenticationType;
        if (enrolled) setBiometricType(types.includes(biometric.FACIAL_RECOGNITION) ? 'face'
          : types.includes(biometric.FINGERPRINT) ? 'fingerprint' : 'generic');
        setEnabled(stored);
      }).catch(() => undefined);
  }, []);

  async function toggleBiometric() {
    if (busy || !token) return;
    setBusy(true);
    try {
      if (enabled) await disableBiometric(token);
      else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('flow.biometric.unlock'), disableDeviceFallback: true, biometricsSecurityLevel: 'strong',
        });
        if (!result.success) return;
        await enableBiometric(token, t('flow.biometric.unlock'));
      }
      setEnabled(await biometricEnabled());
    } catch (error) { toast(error instanceof Error ? error.message : t('flow.biometric.enableFailed')); }
    finally { setBusy(false); }
  }

  function confirmEnd(session: MerchantSession) {
    Alert.alert(t('menu.sessionControl.end'), session.device_name || session.client, [
      { text: t('dashboardHome.cancel'), style: 'cancel' },
      { text: t('menu.sessionControl.end'), style: 'destructive', onPress: () => {
        void apiEndSession(session.id).then(load).catch(() => undefined);
      } },
    ]);
  }

  return <>
    {Platform.OS !== 'web' ? <View style={ui.card}>
      <Text style={ui.title}>{t('menu.sessionControl.' + (biometricType || 'generic'))}</Text>
      <Text style={[ui.body, styles.spacing]}>{t('menu.sessionControl.biometricHint')}</Text>
      {biometricType || enabled ? <Pressable style={[ui.button, ui.outline, busy && ui.disabled]} accessibilityRole="button"
        disabled={busy} onPress={() => void toggleBiometric()}>
        <Text style={[ui.buttonText, ui.outlineText]}>{t(enabled ? 'menu.sessionControl.disable' : 'menu.sessionControl.enable')}</Text>
      </Pressable> : <Text style={ui.body}>{t('flow.biometric.unavailable')}</Text>}
    </View> : null}
    <View style={ui.card}>
      <Text style={ui.title}>{t('menu.security.sessions')}</Text>
      {loading ? <ActivityIndicator /> : null}
      {!loading && !data ? <Pressable accessibilityRole="button" onPress={() => void load()}>
        <Text style={ui.outlineText}>{t('menu.security.deletion.retry')}</Text>
      </Pressable> : null}
      {data?.sessions.length === 0 ? <Text style={ui.body}>{t('menu.sessionControl.empty')}</Text> : null}
      {data?.sessions.map((session) => <View key={session.id} style={styles.session}>
        <Text style={ui.body}>{session.device_name || session.client} · {session.logged_in_at} UTC</Text>
        {session.id === data.currentSessionId ? <Text style={ui.title}>{t('menu.sessionControl.current')}</Text>
          : <Pressable accessibilityRole="button" onPress={() => confirmEnd(session)}>
            <Text style={ui.outlineText}>{t('menu.sessionControl.end')}</Text>
          </Pressable>}
      </View>)}
    </View>
  </>;
}

const styles = StyleSheet.create({
  spacing: { marginVertical: 10 },
  session: { paddingVertical: 10, gap: 8 },
});
