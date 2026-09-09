/**
 * 商户注册 Step 2:Business Details(Figma `839:6159`)。
 * 规范:忽略设计稿中的 iPhone 状态栏,只使用系统透明状态栏和 SafeAreaView。
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ViewStyle,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, spacing } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';

const cardShadow = Platform.select({
  web: { boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.08)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as ViewStyle,
});

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

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M11.2 3.85L5.775 9.275L2.8 6.3" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

interface BusinessCardProps {
  index: number;
}

function BusinessCard({ index }: BusinessCardProps) {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [type] = useState('');
  const [contact, setContact] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city] = useState('');

  const selectComingSoon = () => showToast(t('common.comingSoon'));

  return (
    <View style={styles.businessCard}>
      <View style={styles.cardHeading}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index}</Text>
        </View>
        <Text style={styles.cardTitle}>{t('register.businessDetails.cardTitle', { index })}</Text>
      </View>

      <FloatingField label={t('register.businessDetails.businessType')} required>
        <Pressable style={({ pressed }) => [styles.selectInner, pressed && styles.pressed]} onPress={selectComingSoon}>
          <Text style={[styles.fieldText, !type && styles.placeholder]}>{type || t('register.businessDetails.selectType')}</Text>
          <ChevronDownIcon />
        </Pressable>
      </FloatingField>

      <FloatingField label={t('register.businessDetails.contactPerson')} required>
        <TextInput
          style={styles.input}
          value={contact}
          onChangeText={setContact}
          placeholder={t('register.businessDetails.contactPlaceholder')}
          placeholderTextColor="rgba(30, 41, 59, 0.6)"
          autoCapitalize="words"
        />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.mobile')} required>
        <View style={styles.phoneRow}>
          <View style={styles.phoneCode}>
            <Text style={styles.phoneCodeText}>+95</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            value={mobile}
            onChangeText={setMobile}
            placeholder="9 123 456 789"
            placeholderTextColor="rgba(30, 41, 59, 0.6)"
            keyboardType="phone-pad"
          />
        </View>
      </FloatingField>

      <FloatingField label={t('register.businessDetails.email')} required>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="contact@property.com"
          placeholderTextColor="rgba(30, 41, 59, 0.6)"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.city')} required>
        <Pressable style={({ pressed }) => [styles.selectInner, pressed && styles.pressed]} onPress={selectComingSoon}>
          <Text style={[styles.fieldText, !city && styles.placeholder]}>{city || t('register.businessDetails.selectCity')}</Text>
          <ChevronDownIcon />
        </Pressable>
      </FloatingField>
    </View>
  );
}

export default function RegisterBusinessDetailsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);

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
              <Text style={styles.stepText}>{t('register.step', { current: 2, total: 4 })}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>{t('register.businessDetails.title')}</Text>
            <Text style={styles.subtitle}>{t('register.businessDetails.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <BusinessCard index={1} />
          <BusinessCard index={2} />

          <Pressable
            style={({ pressed }) => [styles.termsRow, pressed && styles.pressed]}
            onPress={() => setAccepted((v) => !v)}
            hitSlop={6}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted ? <CheckIcon /> : null}
            </View>
            <Text style={styles.termsText}>
              {t('register.businessDetails.termsBefore')}
              <Text style={styles.termsBlue}>{t('register.businessDetails.terms')}</Text>
              {t('register.businessDetails.termsAnd')}
              <Text style={styles.termsTeal}>{t('register.businessDetails.privacy')}</Text>
              {t('register.businessDetails.termsAfter')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}> 
        <PrimaryButton
          label={t('register.businessDetails.submit')}
          onPress={() => navigation.navigate('RegisterVerification')}
          style={styles.submitDisabledLook}
          textStyle={styles.submitText}
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
  progressFill: { width: '50%', height: '100%', borderRadius: 9999, backgroundColor: colors.primary },
  headingBlock: { gap: 8 },
  title: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 36, color: colors.slate900 },
  subtitle: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 },
  form: { gap: 24 },
  businessCard: {
    width: '100%',
    gap: 24,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 33,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.surface, textAlign: 'center' },
  cardTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.slate900 },
  fieldWrap: { position: 'relative', width: '100%' },
  field: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.slate900,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingLabel: {
    position: 'absolute',
    left: 8,
    top: -8,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  labelText: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(25, 26, 37, 0.5)',
  },
  required: { color: '#EC1317' },
  selectInner: {
    minHeight: 40,
    paddingLeft: 12,
    paddingRight: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900 },
  placeholder: { opacity: 0.8 },
  input: {
    minHeight: 39,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate900,
  },
  phoneRow: { minHeight: 39, flexDirection: 'row', alignItems: 'stretch' },
  phoneCode: { width: 54, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.surface },
  phoneCodeText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate900,
  },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.slate900,
    borderRadius: 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: {
    flex: 1,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    opacity: 0.8,
  },
  termsBlue: { fontFamily: fonts.interMedium, color: '#4169ED' },
  termsTeal: { fontFamily: fonts.interMedium, color: colors.primary },
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
  submitDisabledLook: { opacity: 0.4 },
  submitText: { fontSize: 18, lineHeight: 27 },
  pressed: { opacity: 0.75 },
});
