/**
 * 商户注册 Step 1:Contact Info(Figma `2331:21717` / 组件 `2326:21552`)。
 * 静态阶段:校验必填后写入注册草稿,再进入 Step 2 Verify Account 选择 OTP 渠道。
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '@/components/common/PrimaryButton';
import {
  FieldInput,
  FloatingField,
  PhoneField,
  RegistrationScaffold,
} from '@/components/onboarding/RegistrationForm';
import { useCommonStore } from '@/store/commonStore';
import { useRegistrationStore } from '@/store/registrationStore';
import { isE164Mobile, localPhoneNumber, normalizeMobile, phoneCountryCode, type PhoneCountryCode } from '@/utils/validate';

export default function RegisterContactScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((state) => state.showToast);
  const registrationPhone = useRegistrationStore((state) => state.registrationPhone);
  const registrationEmail = useRegistrationStore((state) => state.registrationEmail);
  const setContacts = useRegistrationStore((state) => state.setContacts);
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>(phoneCountryCode(registrationPhone));
  const [mobile, setMobile] = useState(localPhoneNumber(registrationPhone, countryCode));
  const [email, setEmail] = useState(registrationEmail);

  const next = () => {
    const phone = normalizeMobile(mobile, countryCode);
    const mail = email.trim().toLowerCase();
    if (!isE164Mobile(phone) || !mail || !/^\S+@\S+\.\S+$/.test(mail)) {
      showToast(t('register.contactInfo.required'));
      return;
    }
    setContacts(phone, mail);
    navigation.navigate('RegisterVerification');
  };

  return (
    <RegistrationScaffold
      current={1}
      total={5}
      progress={0.2}
      title={t('register.contactInfo.title')}
      subtitle={t('register.contactInfo.subtitle')}
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label={t('register.next')}
          onPress={next}
          textStyle={styles.largeButton}
        />
      }
    >
      <View style={styles.form}>
        <FloatingField label={t('register.contactInfo.mobile')} required>
          <PhoneField value={mobile} onChangeText={setMobile} countryCode={countryCode} onCountryCodeChange={setCountryCode} />
        </FloatingField>

        <FloatingField label={t('register.contactInfo.email')} required>
          <FieldInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('register.contactInfo.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FloatingField>
      </View>
    </RegistrationScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  largeButton: { fontSize: 18, lineHeight: 27 },
});
