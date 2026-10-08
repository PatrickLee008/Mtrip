/**
 * 注册流程(Contact Info / Company Info / Business Details)共用的页面骨架与表单件。
 * 尺寸取 Figma mTrip_Merchant:内容 16px 内边距、导航→标题 24、标题→表单 36、字段 54 高。
 * 规范:设计稿里的 iPhone 状态栏只作为画布说明,App 页面不手绘时间/电池/信号。
 */

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { SelectSheet } from '@/components/onboarding/MerchantFlowComponents';
import { colors, PAGE_PADDING } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { PhoneCountryCode } from '@/utils/validate';

export function BackIcon() {
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

export function ChevronDownIcon() {
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

interface RegistrationScaffoldProps {
  current: number;
  total: number;
  progress: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** 注册步骤页骨架:返回 + Step x/y + 进度条 + 标题说明 + 表单 + 固定底部按钮。 */
export function RegistrationScaffold({
  current,
  total,
  progress,
  title,
  subtitle,
  onBack,
  footer,
  children,
}: RegistrationScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

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
                onPress={onBack}
                hitSlop={8}
              >
                <View style={styles.backButton}>
                  <BackIcon />
                </View>
                <Text style={styles.backText}>{t('register.back')}</Text>
              </Pressable>
              <Text style={styles.stepText}>{t('register.step', { current, total })}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.form}>{children}</View>
      </ScrollView>

      {footer ? <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

interface FloatingFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

/** 浮动标签字段容器:Figma 中标签压在边框左上方。 */
export function FloatingField({ label, required, children }: FloatingFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.field}>{children}</View>
      <View style={styles.floatingLabel} pointerEvents="none">
        <Text style={styles.labelText}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      </View>
    </View>
  );
}

export function FieldInput({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor="rgba(30, 41, 59, 0.6)" {...props} style={[styles.input, style]} />;
}

/** 下拉选择字段:点击交给调用方打开 `SelectSheet`(静态阶段也是本地可选,不再弹 Coming Soon)。 */
export function SelectField({
  value,
  placeholder,
  onPress,
}: {
  value?: string;
  placeholder?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.selectInner, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.selectText, !value && styles.placeholderText]}>{value || placeholder}</Text>
      <ChevronDownIcon />
    </Pressable>
  );
}

/** 手机号字段:保留 Figma 的前置区号布局,允许选择注册国家区号。 */
export function PhoneField({
  value,
  onChangeText,
  countryCode,
  onCountryCodeChange,
  placeholder = countryCode === '86' ? '137 0000 0000' : '9 123 456 789',
}: {
  value: string;
  onChangeText: (value: string) => void;
  countryCode: PhoneCountryCode;
  onCountryCodeChange: (value: PhoneCountryCode) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <>
      <View style={styles.phoneRow}>
        <Pressable accessibilityRole="button" style={styles.phoneCode} onPress={() => setPickerOpen(true)}>
          <Text style={styles.phoneCodeText}>+{countryCode}</Text>
          <ChevronDownIcon />
        </Pressable>
        <TextInput
          style={styles.phoneInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(30, 41, 59, 0.6)"
          keyboardType="phone-pad"
        />
      </View>
      <SelectSheet
        visible={pickerOpen}
        title={t('register.contactInfo.countryCode')}
        options={[
          { value: '95', label: t('register.contactInfo.countryMyanmar') },
          { value: '86', label: t('register.contactInfo.countryChina') },
        ]}
        value={countryCode}
        onSelect={(next) => onCountryCodeChange(next as PhoneCountryCode)}
        onClose={() => setPickerOpen(false)}
      />
    </>
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
  progressFill: { height: '100%', borderRadius: 9999, backgroundColor: colors.primary },
  headingBlock: { gap: 8 },
  title: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 36, color: colors.slate900 },
  subtitle: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.6 },
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
  placeholderText: { opacity: 0.6 },
  input: {
    minHeight: 52,
    paddingHorizontal: 17,
    paddingVertical: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.slate900,
  },
  phoneRow: { minHeight: 52, flexDirection: 'row', alignItems: 'stretch' },
  phoneCode: { width: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.surface },
  phoneCodeText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 },
  phoneInput: {
    flex: 1,
    minWidth: 0,
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
  pressed: { opacity: 0.75 },
});
