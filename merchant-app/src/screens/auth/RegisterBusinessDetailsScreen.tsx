/**
 * 商户注册 Step 5:Business Details(Figma `839:6159` / 组件 `364:3082`)。
 * 卡片张数由 Step 4 的「Number of Business」决定;第一张卡直接绑注册草稿(提交时用得到),
 * 第 2..N 张静态阶段只保留在本页本地状态。Business Type / Headquarters City 都是本地可用的下拉。
 * 提交动作:本页是注册流程最后一屏,草稿保存与正式提交都在这里发起。
 * 规范:忽略设计稿中的 iPhone 状态栏,只使用系统透明状态栏和 SafeAreaView。
 */

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, type ViewStyle, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import { SelectSheet, type SelectOption } from '@/components/onboarding/MerchantFlowComponents';
import {
  FieldInput,
  FloatingField,
  PhoneField,
  RegistrationScaffold,
  SelectField,
} from '@/components/onboarding/RegistrationForm';
import { apiApplicationSave, apiApplicationSubmit } from '@/api/merchant';
import { ONBOARDING_BUSINESS_TYPES, ONBOARDING_CITIES } from '@/config/onboardingOptions';
import { ONBOARDING_PROTOTYPE } from '@/config/env';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useRegistrationStore, type RegistrationBusiness } from '@/store/registrationStore';

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

const EMPTY_BUSINESS: RegistrationBusiness = { businessType: '', city: '', contactName: '', contactPhone: '', contactEmail: '' };

type PickerKind = 'type' | 'city';

function BusinessCard({
  index,
  value,
  onChange,
  onOpenPicker,
}: {
  index: number;
  value: RegistrationBusiness;
  onChange: (patch: Partial<RegistrationBusiness>) => void;
  onOpenPicker: (kind: PickerKind) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.businessCard}>
      <View style={styles.cardHeading}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index}</Text>
        </View>
        <Text style={styles.cardTitle}>{t('register.businessDetails.cardTitle', { index })}</Text>
      </View>

      <FloatingField label={t('register.businessDetails.businessType')} required>
        <SelectField
          value={value.businessType ? t(`register.businessDetails.businessTypeOptions.${value.businessType}`) : ''}
          placeholder={t('register.businessDetails.selectType')}
          onPress={() => onOpenPicker('type')}
        />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.contactPerson')} required>
        <FieldInput
          value={value.contactName}
          onChangeText={(next) => onChange({ contactName: next })}
          placeholder={t('register.businessDetails.contactPlaceholder')}
          autoCapitalize="words"
        />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.mobile')} required>
        <PhoneField value={value.contactPhone} onChangeText={(next) => onChange({ contactPhone: next.replace(/\s/g, '') })} />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.email')} required>
        <FieldInput
          value={value.contactEmail}
          onChangeText={(next) => onChange({ contactEmail: next.trim().toLowerCase() })}
          placeholder="contact@property.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </FloatingField>

      <FloatingField label={t('register.businessDetails.city')} required>
        <SelectField
          value={value.city}
          placeholder={t('register.businessDetails.selectCity')}
          onPress={() => onOpenPicker('city')}
        />
      </FloatingField>
    </View>
  );
}

export default function RegisterBusinessDetailsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const registration = useRegistrationStore();
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<{ kind: PickerKind; index: number } | null>(null);
  /** 第 2..N 张业务卡片:静态阶段只存在本页,提交时随草稿一起拼进 businesses[]。 */
  const [extraBusinesses, setExtraBusinesses] = useState<RegistrationBusiness[]>([]);

  const count = Math.max(1, registration.businessCount);
  useEffect(() => {
    setExtraBusinesses((prev) => Array.from({ length: count - 1 }, (_, i) => prev[i] ?? { ...EMPTY_BUSINESS }));
  }, [count]);

  const first = registration.business;
  const cards: RegistrationBusiness[] = [first, ...extraBusinesses];
  const patchCard = (index: number, patch: Partial<RegistrationBusiness>) => {
    if (index === 0) {
      registration.setBusiness(patch);
      return;
    }
    setExtraBusinesses((prev) => prev.map((item, i) => (i === index - 1 ? { ...item, ...patch } : item)));
  };

  const typeOptions: SelectOption[] = ONBOARDING_BUSINESS_TYPES.map((type) => ({ value: type, label: t(`register.businessDetails.businessTypeOptions.${type}`) }));
  const cityOptions: SelectOption[] = ONBOARDING_CITIES.map((city) => ({ value: city, label: city }));
  const pickerValue = picker ? (picker.kind === 'city' ? cards[picker.index]?.city : cards[picker.index]?.businessType) : undefined;

  const submit = async () => {
    const { companyName, registrationToken } = registration;
    const complete = cards.every((card) => card.businessType && card.contactName.trim() && card.contactPhone && card.contactEmail && card.city);
    if (!companyName.trim() || !complete) {
      showToast(t('register.businessDetails.required'));
      return;
    }
    if (ONBOARDING_PROTOTYPE) {
      // 静态原型:不保存/提交申请,校验通过即进入审核结果页。
      navigation.navigate('RegistrationReview');
      return;
    }
    if (!registrationToken) {
      showToast(t('register.businessDetails.sessionExpired'));
      return;
    }
    setSubmitting(true);
    try {
      const draft = await apiApplicationSave(registrationToken, {
        companyName,
        businesses: cards.map((card, index) => ({
          businessName: index === 0 ? companyName : `${companyName} ${index + 1}`,
          businessType: card.businessType,
          city: card.city,
          contactName: card.contactName,
          contactPhone: card.contactPhone,
          contactEmail: card.contactEmail,
        })),
      });
      const submitted = await apiApplicationSubmit(registrationToken, draft.applicationId);
      registration.setApplication(submitted);
      navigation.navigate('RegistrationReview');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('register.businessDetails.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationScaffold
      current={5}
      total={5}
      progress={1}
      title={t('register.businessDetails.title')}
      subtitle={t('register.businessDetails.subtitle')}
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label={submitting ? t('register.businessDetails.submitting') : t('register.businessDetails.submit')}
          disabled={submitting}
          onPress={() => void submit()}
          textStyle={styles.largeButton}
        />
      }
    >
      {cards.map((card, index) => (
        <BusinessCard
          key={index}
          index={index + 1}
          value={card}
          onChange={(patch) => patchCard(index, patch)}
          onOpenPicker={(kind) => setPicker({ kind, index })}
        />
      ))}

      <SelectSheet
        visible={picker !== null}
        title={picker?.kind === 'city' ? t('register.businessDetails.city') : t('register.businessDetails.businessType')}
        options={picker?.kind === 'city' ? cityOptions : typeOptions}
        value={pickerValue}
        onSelect={(next) => { if (picker) patchCard(picker.index, picker.kind === 'city' ? { city: next } : { businessType: next }); }}
        onClose={() => setPicker(null)}
      />
    </RegistrationScaffold>
  );
}

const styles = StyleSheet.create({
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
  largeButton: { fontSize: 18, lineHeight: 27 },
});
