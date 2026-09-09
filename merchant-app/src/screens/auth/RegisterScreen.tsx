/**
 * 商户注册 Step 1:Company Info(Figma `839:6106`)。
 * 规范:设计稿里的 iPhone 状态栏只作为画布说明,App 页面不手绘时间/电池/信号。
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, spacing } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M13.125 16.25L6.875 10L13.125 3.75"
        stroke="#FFFFFF"
        strokeWidth={1.66667}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.00005 9.72329L11.8 14.5233L16.6 9.72329"
        stroke={colors.slate900}
        strokeOpacity={0.6}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface FloatingFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function FloatingField({ label, required, children }: FloatingFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.field}>{children}</View>
      <View style={styles.floatingLabel}>
        <Text style={styles.labelText}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const showToast = useCommonStore((state) => state.showToast);
  const [businessCount] = useState('1 Business');
  const [companyName, setCompanyName] = useState('');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBlock}>
          <View style={styles.navigationBlock}>
            <View style={styles.navBar}>
              <Pressable
                style={({ pressed }) => [styles.backGroup, pressed && styles.pressed]}
                onPress={() => navigation.goBack()}
                hitSlop={8}
              >
                <View style={styles.backButton}>
                  <BackIcon />
                </View>
                <Text style={styles.backText}>{t('register.back')}</Text>
              </Pressable>
              <Text style={styles.stepText}>{t('register.step', { current: 1, total: 4 })}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>{t('register.companyInfo.title')}</Text>
            <Text style={styles.subtitle}>{t('register.companyInfo.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <FloatingField label={t('register.companyInfo.businessCount')}>
            <Pressable
              style={({ pressed }) => [styles.selectInner, pressed && styles.pressed]}
              onPress={() => showToast(t('common.comingSoon'))}
            >
              <Text style={styles.selectText}>{businessCount}</Text>
              <ChevronDownIcon />
            </Pressable>
          </FloatingField>

          <FloatingField label={t('register.companyInfo.companyName')} required>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder={t('register.companyInfo.companyNamePlaceholder')}
              placeholderTextColor="rgba(30, 41, 59, 0.6)"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </FloatingField>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}> 
        <PrimaryButton
          label={t('register.next')}
          onPress={() => navigation.navigate('RegisterBusinessDetails')}
          style={styles.nextDisabledLook}
          textStyle={styles.nextText}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: PAGE_PADDING, paddingTop: 16, gap: 36 },
  topBlock: { gap: 24 },
  navigationBlock: { gap: 16 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate900,
    opacity: 0.8,
  },
  stepText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.primary },
  progressTrack: { width: '100%', height: 6, borderRadius: 9999, overflow: 'hidden', backgroundColor: colors.primaryLight },
  progressFill: { width: '25%', height: '100%', borderRadius: 9999, backgroundColor: colors.primary },
  headingBlock: { gap: 8 },
  title: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 36, color: colors.slate900 },
  subtitle: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 },
  form: { gap: 24 },
  fieldWrap: { position: 'relative', width: '100%' },
  field: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.slate900,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingLabel: {
    position: 'absolute',
    left: 12,
    top: -8,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  labelText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    color: colors.slate900,
    opacity: 0.6,
  },
  required: { color: '#EC1317', opacity: 1 },
  selectInner: {
    minHeight: 52,
    paddingLeft: 17,
    paddingRight: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.slate900,
    opacity: 0.8,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 17,
    paddingVertical: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.slate900,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 25,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE',
  },
  nextDisabledLook: { opacity: 0.4 },
  nextText: { fontSize: 18, lineHeight: 27 },
  pressed: { opacity: 0.75 },
});
