/**
 * 商户注册 Step 4:Company Info(Figma `2332:21915` / 组件 `364:2900`)。
 * 「Number of Business」是可用的本地下拉,选择结果决定 Step 5 渲染几张业务卡片。
 * 规范:设计稿里的 iPhone 状态栏只作为画布说明,App 页面不手绘时间/电池/信号。
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import { apiApplicationSave } from '@/api/merchant';
import { SelectSheet, type SelectOption } from '@/components/onboarding/MerchantFlowComponents';
import { FieldInput, FloatingField, RegistrationScaffold, SelectField } from '@/components/onboarding/RegistrationForm';
import { ONBOARDING_BUSINESS_COUNTS } from '@/config/onboardingOptions';
import { ONBOARDING_PROTOTYPE } from '@/config/env';
import { useCommonStore } from '@/store/commonStore';
import { useRegistrationStore } from '@/store/registrationStore';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((state) => state.showToast);
  const registration = useRegistrationStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 复数走仓库既有写法(本项目 compatibilityJSON: 'v3'):用 one/many 嵌套键自己挑,不用 i18next 复数后缀。
  const countLabel = (count: number) => count === 1
    ? t('register.companyInfo.businessCountOption.one', { count })
    : t('register.companyInfo.businessCountOption.many', { count });
  const countOptions: SelectOption[] = ONBOARDING_BUSINESS_COUNTS.map((count) => ({ value: String(count), label: countLabel(count) }));
  const next = async () => {
    if (!registration.companyName.trim() || !registration.regNumber.trim() || !registration.country.trim() || !registration.address.trim()) {
      showToast(t('register.companyInfo.required'));
      return;
    }
    if (!ONBOARDING_PROTOTYPE) {
      if (!registration.registrationToken) { showToast(t('register.businessDetails.sessionExpired')); return; }
      setSaving(true);
      try {
        const detail = await apiApplicationSave(registration.registrationToken, {
          applicationId: registration.applicationId,
          companyName: registration.companyName.trim(),
          regNumber: registration.regNumber.trim(),
          country: registration.country.trim(),
          address: registration.address.trim(),
          currentStep: 3,
          removeBusinessIds: registration.removedBusinessIds,
          businesses: registration.businesses,
        });
        registration.setApplicationDetail(detail);
      } catch (error) {
        showToast(error instanceof Error ? error.message : t('register.businessDetails.submitFailed'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    navigation.navigate('RegisterBusinessDetails');
  };

  return (
    <RegistrationScaffold
      current={4}
      total={5}
      progress={0.8}
      title={t('register.companyInfo.title')}
      subtitle={t('register.companyInfo.subtitle')}
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label={saving ? t('register.businessDetails.submitting') : t('register.next')}
          disabled={saving}
          onPress={() => void next()}
          textStyle={styles.largeButton}
        />
      }
    >
      <View style={styles.form}>
        <FloatingField label={t('register.companyInfo.businessCount')}>
          <SelectField value={countLabel(registration.businessCount)} onPress={() => setPickerOpen(true)} />
        </FloatingField>

        <FloatingField label={t('register.companyInfo.companyName')} required>
          <FieldInput
            value={registration.companyName}
            onChangeText={(companyName) => registration.setCompany({ companyName })}
            placeholder={t('register.companyInfo.companyNamePlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </FloatingField>
        <FloatingField label={t('register.companyInfo.regNumber')} required>
          <FieldInput value={registration.regNumber} onChangeText={(regNumber) => registration.setCompany({ regNumber })} autoCapitalize="characters" />
        </FloatingField>
        <FloatingField label={t('register.companyInfo.country')} required>
          <FieldInput value={registration.country} onChangeText={(country) => registration.setCompany({ country })} />
        </FloatingField>
        <FloatingField label={t('register.companyInfo.address')} required>
          <FieldInput value={registration.address} onChangeText={(address) => registration.setCompany({ address })} />
        </FloatingField>
      </View>

      <SelectSheet
        visible={pickerOpen}
        title={t('register.companyInfo.businessCount')}
        options={countOptions}
        value={String(registration.businessCount)}
        onSelect={(value) => registration.setBusinessCount(Number(value))}
        onClose={() => setPickerOpen(false)}
      />
    </RegistrationScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  largeButton: { fontSize: 18, lineHeight: 27 },
});
