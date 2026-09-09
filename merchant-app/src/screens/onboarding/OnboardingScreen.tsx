/**
 * 商户 App 引导首屏(Figma mTrip_Merchant node 839:5721)。
 * 先实现静态视觉与路由入口,后续注册/KYC/2FA 页面按同一目录结构继续补齐。
 */

import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import FeatureIcon, { type FeatureIconName } from '@/components/onboarding/FeatureIcon';
import { colors, PAGE_PADDING, shadows, spacing } from '@/config/theme';
import { fonts, text } from '@/config/typography';

const LOGO = require('../../../assets/images/onboarding/logo.png');

const titleShadow = Platform.select({
  web: { textShadow: '0px 0px 4px rgba(0, 0, 0, 0.25)' } as unknown as TextStyle,
  default: {
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  } as TextStyle,
});


const FEATURES: Array<{ key: string; icon: FeatureIconName }> = [
  { key: 'bookings', icon: 'booking' },
  { key: 'mobile', icon: 'mobile' },
  { key: 'support', icon: 'support' },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.hero}>
          <View style={styles.logoClip}>
            <Image source={LOGO} style={styles.logo} resizeMode="cover" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{t('onboarding.title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={[styles.features, { paddingBottom: 166 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {FEATURES.map((feature) => (
            <View key={feature.key} style={styles.featureRow}>
              <FeatureIcon name={feature.icon} />
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{t(`onboarding.features.${feature.key}.title`)}</Text>
                <Text style={styles.featureDesc}>{t(`onboarding.features.${feature.key}.desc`)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 40 + insets.bottom }]}> 
          <PrimaryButton label={t('onboarding.register')} onPress={() => navigation.navigate('Register')} />
          <Pressable
            style={({ pressed }) => [styles.loginLink, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Login')}
            hitSlop={8}
          >
            <Text style={styles.loginText}>
              {t('onboarding.loginPrefix')}
              <Text style={styles.loginStrong}>{t('onboarding.login')}</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { backgroundColor: colors.primary },
  hero: { height: 202, alignItems: 'center', paddingHorizontal: PAGE_PADDING, gap: 16 },
  logoClip: { width: 108.73, height: 80, overflow: 'hidden' },
  logo: { position: 'absolute', width: 196.4, height: 196.4, left: -43.8, top: -58.2 },
  heroCopy: { width: '100%', alignItems: 'center', gap: 8 },
  title: {
    ...text.heroTitle,
    ...titleShadow,
    textAlign: 'center',
  },
  subtitle: { ...text.heroBody, textAlign: 'center', maxWidth: 358 },
  sheet: {
    flex: 1,
    marginTop: 32,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...shadows.sheet,
  },
  features: { paddingHorizontal: PAGE_PADDING, paddingTop: 48, gap: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, width: '100%' },
  featureCopy: { flex: 1, paddingTop: 2, gap: 4 },
  featureTitle: text.featureTitle,
  featureDesc: { ...text.featureBody, opacity: 0.8 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 25,
    gap: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.canvas,
  },
  loginLink: { alignItems: 'center' },
  loginText: { ...text.body, textAlign: 'center', opacity: 0.8 },
  loginStrong: { fontFamily: fonts.interSemi, color: colors.primary },
  pressed: { opacity: 0.75 },
});
