/**
 * 旅行保险(Figma M-Trip / `Insurance` 1675:5900,页头写的是「Travel Protection」)
 *
 * 页壳同 `AddGuestScreen`,复用 `MorePageLayout`;底部是设计稿自带的
 * 「Total Cost + 金额 / Confirm」白底吸底栏(1675:6060),交给 layout 的 footer 插槽。
 *
 * 三张卡:保障定制(人数 / 天数两个下拉)→ 受益人信息(姓名 + 区号手机)→ 保障内容两条,
 * 下面是三枚说明胶囊与一行同意文案。
 *
 * **静态页**:后端没有保险接口,人数 / 天数只在本页生效,Confirm 走 comingSoon。
 * 设计稿把同意文案写成「you agree to xxxxxx Terms & Conditions」(xxxxxx 是占位),
 * 词条按正常英文写;「Medical. Hospital and other expenses」的句点笔误同样按正确英文写。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { FormInput, FormLabel, FormSelect } from '@/components/hotel/booking/FormField';
import SelectSheet from '@/components/hotel/booking/SelectSheet';
import { PLACEHOLDER, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  BOOKING_DEMO,
  INSURANCE_BENEFITS,
  INSURANCE_DAY_OPTIONS,
  INSURANCE_DEFAULT_DAYS,
  INSURANCE_DEFAULT_PERSONS,
  INSURANCE_LINKS,
  INSURANCE_PERSON_OPTIONS,
} from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

type Menu = 'persons' | 'days' | null;

export default function InsuranceScreen() {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const [persons, setPersons] = useState(INSURANCE_DEFAULT_PERSONS);
  const [days, setDays] = useState(INSURANCE_DEFAULT_DAYS);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [menu, setMenu] = useState<Menu>(null);

  const menuOptions =
    menu === 'persons'
      ? INSURANCE_PERSON_OPTIONS.map((n) => ({
          key: `${n}`,
          label: t('hotels.booking.insurance.personValue', { persons: n }),
        }))
      : INSURANCE_DAY_OPTIONS.map((n) => ({
          key: `${n}`,
          label: t('hotels.booking.insurance.dayValue', { days: n }),
        }));

  return (
    <MorePageLayout
      title={t('hotels.booking.insurance.title')}
      footer={
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>{t('hotels.booking.insurance.totalCost')}</Text>
            <Text style={styles.footerValue}>{formatMoney(BOOKING_DEMO.total, currency)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.confirmBtn, pressed && bookingShared.pressed]}
            onPress={comingSoon}
          >
            <Text style={styles.confirmText}>{t('hotels.booking.insurance.confirm')}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={[bookingShared.panel, styles.card]}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <HomeIcon name="shieldTask" size={20} color={colors.primary} />
            <Text style={bookingShared.panelTitle}>{t('hotels.booking.insurance.insurance')}</Text>
          </View>
          <Text style={styles.covered}>
            {t('hotels.booking.insurance.daysCovered', { days })}
          </Text>
        </View>

        <View style={styles.fields}>
          <Text style={styles.personalize}>{t('hotels.booking.insurance.personalize')}</Text>
          <FormSelect
            label={t('hotels.booking.insurance.persons')}
            value={t('hotels.booking.insurance.personValue', { persons })}
            placeholder={t('hotels.booking.insurance.persons')}
            onPress={() => setMenu('persons')}
          />
          <FormSelect
            label={t('hotels.booking.insurance.extend')}
            value={t('hotels.booking.insurance.dayValue', { days })}
            placeholder={t('hotels.booking.insurance.extend')}
            onPress={() => setMenu('days')}
          />
        </View>
      </View>

      <View style={[bookingShared.panel, styles.card]}>
        <Text style={bookingShared.panelTitle}>{t('hotels.booking.insurance.beneficiary')}</Text>
        <View style={styles.fields}>
          <FormInput
            label={t('hotels.booking.insurance.fullName')}
            value={name}
            onChangeText={setName}
            placeholder={t('hotels.booking.insurance.fullNamePlaceholder')}
          />
          <View style={styles.field}>
            <FormLabel label={t('hotels.booking.insurance.phone')} />
            <View style={styles.phoneRow}>
              <Pressable
                style={({ pressed }) => [
                  bookingShared.control,
                  styles.dialCode,
                  pressed && bookingShared.pressed,
                ]}
                onPress={comingSoon}
              >
                <Text style={bookingShared.controlText}>+95</Text>
                <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
              </Pressable>
              <View style={[bookingShared.control, styles.flex]}>
                <TextInput
                  style={bookingShared.controlText}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('hotels.booking.insurance.phonePlaceholder')}
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={[bookingShared.panel, styles.card]}>
        <Text style={bookingShared.panelTitle}>{t('hotels.booking.insurance.benefits')}</Text>
        {INSURANCE_BENEFITS.map((benefit) => (
          <View key={benefit.key} style={styles.benefitRow}>
            <View style={styles.benefitLeft}>
              <HomeIcon name="check" size={20} color={colors.primary} />
              <Text style={styles.benefitText}>
                {t(`hotels.booking.insurance.benefitLabels.${benefit.key}`)}
              </Text>
            </View>
            <Text style={styles.benefitText}>{formatMoney(benefit.amount, currency)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.links}>
        {INSURANCE_LINKS.map((key) => (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.linkChip, pressed && bookingShared.pressed]}
            onPress={comingSoon}
          >
            <Text style={styles.linkText}>{t(`hotels.booking.insurance.links.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.agree}>{t('hotels.booking.insurance.agree')}</Text>

      <SelectSheet
        visible={menu !== null}
        options={menuOptions}
        value={menu === 'persons' ? `${persons}` : `${days}`}
        onClose={() => setMenu(null)}
        onSelect={(key) => (menu === 'persons' ? setPersons(Number(key)) : setDays(Number(key)))}
      />
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 24 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  covered: { fontFamily: fonts.interBold, fontSize: 12, lineHeight: 24, color: colors.primary },

  fields: { gap: 12 },
  field: { gap: 4 },
  flex: { flex: 1, minWidth: 0 },
  personalize: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13 },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 4,
  },
  benefitLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  benefitText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.card,
    backgroundColor: colors.softBlue,
  },
  linkText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.primary,
  },
  agree: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /**
   * 设计稿的吸底栏是白底 + 顶部一条 `rgba(196,197,215,0.3)` 细线。
   * `MorePageLayout` 的 footer 插槽自带 px16 / pt12 / pb20 的**页面底色**内边距,
   * 这里用等量负 margin 抵消掉,白条才能铺满那一格(不改公共组件)。
   */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: -16,
    marginTop: -12,
    marginBottom: -20,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: colors.card,
  },
  footerLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.heading },
  footerValue: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  confirmText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
