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
import { SelectSheet, type SelectOption } from '@/components/onboarding/MerchantFlowComponents';
import { FieldInput, FloatingField, RegistrationScaffold, SelectField } from '@/components/onboarding/RegistrationForm';
import { ONBOARDING_BUSINESS_COUNTS } from '@/config/onboardingOptions';
import { useCommonStore } from '@/store/commonStore';
import { useRegistrationStore } from '@/store/registrationStore';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((state) => state.showToast);
  const [companyName, setCompanyName] = useState('');
  const setDraftCompany = useRegistrationStore((state) => state.setCompanyName);
  const businessCount = useRegistrationStore((state) => state.businessCount);
  const setBusinessCount = useRegistrationStore((state) => state.setBusinessCount);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 复数走仓库既有写法(本项目 compatibilityJSON: 'v3'):用 one/many 嵌套键自己挑,不用 i18next 复数后缀。
  const countLabel = (count: number) => count === 1
    ? t('register.companyInfo.businessCountOption.one', { count })
    : t('register.companyInfo.businessCountOption.many', { count });
  const countOptions: SelectOption[] = ONBOARDING_BUSINESS_COUNTS.map((count) => ({ value: String(count), label: countLabel(count) }));

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
          label={t('register.next')}
          onPress={() => {
            if (!companyName.trim()) {
              showToast(t('register.companyInfo.companyName'));
              return;
            }
            setDraftCompany(companyName.trim());
            navigation.navigate('RegisterBusinessDetails');
          }}
          textStyle={styles.largeButton}
        />
      }
    >
      <View style={styles.form}>
        <FloatingField label={t('register.companyInfo.businessCount')}>
          <SelectField value={countLabel(businessCount)} onPress={() => setPickerOpen(true)} />
        </FloatingField>

        <FloatingField label={t('register.companyInfo.companyName')} required>
          <FieldInput
            value={companyName}
            onChangeText={setCompanyName}
            placeholder={t('register.companyInfo.companyNamePlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </FloatingField>
      </View>

      <SelectSheet
        visible={pickerOpen}
        title={t('register.companyInfo.businessCount')}
        options={countOptions}
        value={String(businessCount)}
        onSelect={(value) => setBusinessCount(Number(value))}
        onClose={() => setPickerOpen(false)}
      />
    </RegistrationScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  largeButton: { fontSize: 18, lineHeight: 27 },
});
