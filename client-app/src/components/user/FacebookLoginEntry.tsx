import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { facebookSettings, facebookStart, type FacebookSettings } from '@/api/facebook';
import SocialIcon from '@/components/user/SocialIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { canUseFacebookWeb } from '@/utils/facebook';

export default function FacebookLoginEntry() {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [settings, setSettings] = useState<FacebookSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const open = async () => {
    if (Platform.OS !== 'web') { showToast(t('home.comingSoon')); return; }
    if (!canUseFacebookWeb()) { showToast(t('user.facebook.httpsRequired')); return; }
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { setSettings(await facebookSettings()); }
    catch { showToast(t('user.facebook.unavailable')); }
    finally { pending.current = false; setBusy(false); }
  };

  const confirm = async () => {
    if (!settings || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const { authorizationUrl } = await facebookStart(settings.consentVersion, 'home');
      const url = new URL(authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'www.facebook.com') throw new Error('Invalid authorization URL');
      window.location.assign(authorizationUrl);
    } catch {
      showToast(t('user.facebook.failed'));
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable accessibilityLabel={t('user.facebook.continue')} accessibilityRole="button"
        disabled={busy} onPress={() => void open()} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <SocialIcon provider="facebook" />}
      </Pressable>
      <Modal transparent visible={settings !== null} animationType="fade" onRequestClose={() => { if (!busy) setSettings(null); }}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('user.facebook.continue')}</Text>
            <Text style={styles.text}>{t('user.facebook.consent')}</Text>
            <Text style={styles.text}>{t('user.facebook.separateAccount')}</Text>
            <View style={styles.links}>
              <Pressable onPress={() => { if (settings) void Linking.openURL(settings.termsUrl); }}>
                <Text style={styles.link}>{t('user.terms')}</Text>
              </Pressable>
              <Pressable onPress={() => { if (settings) void Linking.openURL(settings.privacyUrl); }}>
                <Text style={styles.link}>{t('user.privacyPolicy')}</Text>
              </Pressable>
            </View>
            <Pressable disabled={busy} onPress={() => void confirm()} style={styles.button}>
              {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{t('user.facebook.agreeContinue')}</Text>}
            </Pressable>
            <Pressable disabled={busy} onPress={() => setSettings(null)} style={styles.cancel}>
              <Text style={styles.link}>{t('user.facebook.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entry: { flex: 1, minWidth: 0, maxWidth: 82, height: 48, borderRadius: radius.btn, borderWidth: 1, borderColor: colors.softBlue, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, padding: 24, gap: 16, borderRadius: 24, backgroundColor: colors.surface },
  title: { fontFamily: fonts.outfitSemi, fontSize: 22, color: colors.text },
  text: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.text },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  link: { fontFamily: fonts.inter, color: colors.primary, fontSize: 14 },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { fontFamily: fonts.outfitSemi, color: 'white', fontSize: 16 },
  cancel: { padding: 8, alignItems: 'center' },
});
