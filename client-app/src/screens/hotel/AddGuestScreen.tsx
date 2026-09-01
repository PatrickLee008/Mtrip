/**
 * 新增旅客(Figma M-Trip / `Add New Guest` 1675:5777)
 *
 * 页壳复用「更多」子页的 `MorePageLayout`(返回箭头 + 主色 Outfit 600/24 标题 + Effect/DS 投影),
 * 设计稿这张稿的顶部栏与那一套完全一致,不再自绘。
 *
 * 两张卡:
 *   1) 名 / 姓 / 「我没有姓氏」勾选 / 性别下拉 / 出生日期(点开滚轮浮层)/「未满 13 岁」勾选
 *   2) 国籍下拉 / NRC 姓名 / NRC 号(省份码 + 镇区码 + 编号三段)+ 整宽 Save Info
 *
 * **静态页**:后端没有常用旅客接口(order 的 guests 只存在订单里),Save Info 走 comingSoon;
 * 表单值只在本页内生效。设计稿把「Guest is under 13 year old」写成了单数,词条按正确英文写。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { FormInput, FormLabel, FormSelect } from '@/components/hotel/booking/FormField';
import SelectSheet from '@/components/hotel/booking/SelectSheet';
import WheelPickerSheet from '@/components/hotel/booking/WheelPickerSheet';
import { PLACEHOLDER, bookingShared } from '@/components/hotel/booking/bookingShared';
import { formatMonthDayYear } from '@/components/hotel/booking/bookingFormat';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  NRC_STATE_OPTIONS,
  NRC_TOWNSHIP_OPTIONS,
} from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';

type Menu = 'gender' | 'nationality' | 'nrcState' | 'nrcTownship' | null;

export default function AddGuestScreen() {
  const { t, i18n } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [noLastName, setNoLastName] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [under13, setUnder13] = useState(false);
  const [nationality, setNationality] = useState<string>(NATIONALITY_OPTIONS[0]);
  const [nrcName, setNrcName] = useState('');
  const [nrcState, setNrcState] = useState<string>(NRC_STATE_OPTIONS[0]);
  const [nrcTownship, setNrcTownship] = useState<string>(NRC_TOWNSHIP_OPTIONS[0]);
  const [nrcNumber, setNrcNumber] = useState('');

  const [menu, setMenu] = useState<Menu>(null);
  const [dobOpen, setDobOpen] = useState(false);

  const menuOptions = (() => {
    switch (menu) {
      case 'gender':
        return GENDER_OPTIONS.map((key) => ({
          key,
          label: t(`hotels.booking.addGuest.genders.${key}`),
        }));
      case 'nationality':
        return NATIONALITY_OPTIONS.map((key) => ({
          key,
          label: t(`hotels.booking.addGuest.nationalities.${key}`),
        }));
      case 'nrcState':
        return NRC_STATE_OPTIONS.map((key) => ({ key, label: key }));
      case 'nrcTownship':
        return NRC_TOWNSHIP_OPTIONS.map((key) => ({ key, label: key }));
      default:
        return [];
    }
  })();

  const onMenuSelect = (key: string) => {
    if (menu === 'gender') setGender(key);
    if (menu === 'nationality') setNationality(key);
    if (menu === 'nrcState') setNrcState(key);
    if (menu === 'nrcTownship') setNrcTownship(key);
  };

  const CheckRow = ({
    checked,
    label,
    onToggle,
  }: {
    checked: boolean;
    label: string;
    onToggle: () => void;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.checkRow, pressed && bookingShared.pressed]}
      onPress={onToggle}
    >
      <HomeIcon
        name={checked ? 'checkboxIndeterminate' : 'checkbox'}
        size={20}
        color={checked ? colors.primary : colors.softBlue}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <MorePageLayout title={t('hotels.booking.addGuest.title')}>
      <View style={[bookingShared.panel, styles.card]}>
        <FormInput
          label={t('hotels.booking.guests.firstName')}
          required
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('hotels.booking.guests.firstNamePlaceholder')}
        />
        <FormInput
          label={t('hotels.booking.guests.lastName')}
          required
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('hotels.booking.guests.lastNamePlaceholder')}
          editable={!noLastName}
        />
        <CheckRow
          checked={noLastName}
          label={t('hotels.booking.addGuest.noLastName')}
          onToggle={() => setNoLastName((v) => !v)}
        />
        <FormSelect
          label={t('hotels.booking.addGuest.gender')}
          value={gender ? t(`hotels.booking.addGuest.genders.${gender}`) : null}
          placeholder={t('hotels.booking.addGuest.genderPlaceholder')}
          onPress={() => setMenu('gender')}
        />
        <FormSelect
          label={t('hotels.booking.addGuest.dob')}
          required
          action
          value={dob ? formatMonthDayYear(dob, i18n.language) : null}
          placeholder={t('hotels.booking.addGuest.dobPlaceholder')}
          onPress={() => setDobOpen(true)}
        />
        <CheckRow
          checked={under13}
          label={t('hotels.booking.addGuest.under13')}
          onToggle={() => setUnder13((v) => !v)}
        />
      </View>

      <View style={[bookingShared.panel, styles.cardWide]}>
        <FormSelect
          label={t('hotels.booking.addGuest.nationality')}
          value={t(`hotels.booking.addGuest.nationalities.${nationality}`)}
          placeholder={t('hotels.booking.addGuest.nationality')}
          onPress={() => setMenu('nationality')}
        />
        <FormInput
          label={t('hotels.booking.addGuest.nrcName')}
          value={nrcName}
          onChangeText={setNrcName}
          placeholder={t('hotels.booking.addGuest.nrcNamePlaceholder')}
        />

        <View style={styles.field}>
          <FormLabel label={t('hotels.booking.addGuest.nrcNumber')} />
          <View style={styles.nrcRow}>
            <Pressable
              style={({ pressed }) => [
                bookingShared.control,
                styles.nrcSegment,
                pressed && bookingShared.pressed,
              ]}
              onPress={() => setMenu('nrcState')}
            >
              <Text style={bookingShared.controlText}>{nrcState}</Text>
              <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                bookingShared.control,
                styles.nrcSegment,
                pressed && bookingShared.pressed,
              ]}
              onPress={() => setMenu('nrcTownship')}
            >
              <Text style={bookingShared.controlText}>{nrcTownship}</Text>
              <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
            </Pressable>
            <View style={[bookingShared.control, styles.flex]}>
              <TextInput
                style={bookingShared.controlText}
                value={nrcNumber}
                onChangeText={setNrcNumber}
                placeholder={t('hotels.booking.addGuest.nrcPlaceholder')}
                placeholderTextColor={PLACEHOLDER}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [bookingShared.primaryBtn, pressed && bookingShared.pressed]}
          onPress={comingSoon}
        >
          <Text style={bookingShared.primaryBtnText}>{t('hotels.booking.addGuest.save')}</Text>
        </Pressable>
      </View>

      <SelectSheet
        visible={menu !== null}
        options={menuOptions}
        value={
          menu === 'gender'
            ? gender
            : menu === 'nationality'
              ? nationality
              : menu === 'nrcState'
                ? nrcState
                : nrcTownship
        }
        onClose={() => setMenu(null)}
        onSelect={onMenuSelect}
      />
      <WheelPickerSheet
        visible={dobOpen}
        value={dob}
        onClose={() => setDobOpen(false)}
        onConfirm={setDob}
      />
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  /* 第二张卡设计稿的字段间距是 24 */
  cardWide: { gap: 24 },
  field: { gap: 4 },
  flex: { flex: 1, minWidth: 0 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.textSoft },

  nrcRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nrcSegment: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13 },
});
