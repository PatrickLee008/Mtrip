import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import { SUPPORTED_LANGS, type Lang } from '@/config/global';
import { colors, PAGE_PADDING } from '@/config/theme';
import { fonts } from '@/config/typography';

const LANGUAGE_NAMES: Record<Lang, string> = { 'en-US': 'English', 'zh-CN': '简体中文' };

export default function LanguageScreen({ defaultLang, onConfirm }: { defaultLang: Lang; onConfirm: (lang: Lang) => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Lang>(defaultLang);
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.logoClip}><Image source={require('../../../assets/images/onboarding/logo.png')} style={styles.logo} resizeMode="cover" /></View>
        <Text style={styles.heroTitle}>mTrip Merchant</Text>
        <Text style={styles.heroSubtitle}>{t('language.tagline', { lng: selected })}</Text>
      </View>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.eyebrow}>01 / 01</Text>
          <Text style={styles.title}>{t('language.title', { lng: selected })}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle', { lng: selected })}</Text>
        </View>
        <View style={styles.options}>
          {SUPPORTED_LANGS.map((lang) => <Pressable key={lang} accessibilityRole="radio" accessibilityState={{ checked: lang === selected }} onPress={() => setSelected(lang)} style={[styles.option, lang === selected && styles.optionSelected]}>
            <Text style={[styles.optionText, lang === selected && styles.optionTextSelected]}>{LANGUAGE_NAMES[lang]}</Text>
            <View style={[styles.radio, lang === selected && styles.radioSelected]}>{lang === selected ? <View style={styles.radioDot} /> : null}</View>
          </Pressable>)}
        </View>
        <View style={styles.footer}><PrimaryButton label={t('language.continue', { lng: selected })} onPress={() => onConfirm(selected)} /></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  content: { flexGrow: 1 },
  hero: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', paddingHorizontal: PAGE_PADDING, gap: 10 },
  logoClip: { width: 109, height: 80, overflow: 'hidden' },
  logo: { position: 'absolute', width: 196.4, height: 196.4, left: -43.8, top: -58.2 },
  heroTitle: { fontFamily: fonts.outfitBold, fontSize: 25, color: colors.surface },
  heroSubtitle: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.surface, opacity: 0.85, textAlign: 'center' },
  sheet: { minHeight: 350, padding: 24, paddingBottom: 32, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
  sheetHeader: { gap: 6 },
  eyebrow: { fontFamily: fonts.outfitSemi, fontSize: 12, letterSpacing: 2, color: colors.primary },
  title: { fontFamily: fonts.outfitBold, fontSize: 26, color: colors.slate900 },
  subtitle: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.body },
  options: { gap: 12, marginTop: 28 },
  option: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionText: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.slate900 },
  optionTextSelected: { color: colors.primary },
  radio: { width: 22, height: 22, borderWidth: 2, borderColor: '#94A3B8', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  footer: { marginTop: 'auto', paddingTop: 28 },
});
