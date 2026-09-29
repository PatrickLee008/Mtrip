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

export default function RegisterContactScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((state) => state.showToast);
  const business = useRegistrationStore((state) => state.business);
  const setBusiness = useRegistrationStore((state) => state.setBusiness);
  const [mobile, setMobile] = useState(business.contactPhone);
  const [email, setEmail] = useState(business.contactEmail);

  const next = () => {
    const phone = mobile.replace(/\s/g, '');
    const mail = email.trim().toLowerCase();
    if (!phone || !mail) {
      showToast(t('register.contactInfo.required'));
      return;
    }
    setBusiness({ contactPhone: phone, contactEmail: mail });
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
          <PhoneField value={mobile} onChangeText={setMobile} />
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
