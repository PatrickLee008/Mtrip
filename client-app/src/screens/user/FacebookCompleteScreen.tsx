import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { facebookExchange } from '@/api/facebook';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useUserStore } from '@/store/userStore';
import { clearFacebookPath, takeFacebookCompletion } from '@/utils/facebook';

export default function FacebookCompleteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const result = takeFacebookCompletion();
    if (!/^[a-f0-9]{64}$/.test(result.ticket)) {
      setError(['cancelled', 'restricted', 'failed'].includes(result.error) ? result.error : 'expired');
      return;
    }
    void (async () => {
      try {
        const auth = await facebookExchange(result.ticket);
        await useUserStore.getState().acceptSocialAuth(auth);
        clearFacebookPath();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: auth.returnTo === 'more' ? 'MoreTab' : 'HomeTab' } }] });
      } catch { setError('failed'); }
    })();
  }, [navigation]);

  const retry = () => {
    clearFacebookPath();
    navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Login' }] });
  };

  return (
    <View style={styles.page}>
      {error ? <>
        <Text style={styles.message}>{t(`user.facebook.${error}`)}</Text>
        <Pressable onPress={retry} style={styles.button}><Text style={styles.buttonText}>{t('user.facebook.backToLogin')}</Text></Pressable>
      </> : <>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{t('user.facebook.completing')}</Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
  message: { fontFamily: fonts.inter, color: colors.text, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 12 },
  buttonText: { fontFamily: fonts.outfitSemi, color: 'white', fontSize: 16 },
});
