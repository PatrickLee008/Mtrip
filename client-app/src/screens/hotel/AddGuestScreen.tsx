/**
 * 新增 / 编辑常旅客(Figma M-Trip / `Add New Guest` 1675:5777)
 *
 * 页壳复用「更多」子页的 `MorePageLayout`,与设计稿的顶部栏一致。
 *
 * **已接后端**:`user-service` 的 `/api/v1/app/user/traveler/{add,update,delete}`
 * (`TravelerController`)。带 `id` 进来即编辑态,额外多一枚删除按钮。
 *
 * 与设计稿的差异(用户确认「先裁 UI,只做后端支持的字段」):
 *   - 去掉了**性别 / 出生日期 / 未满 13 岁 / NRC 姓名**四栏 —— `user_traveler` 表没有对应列,
 *     后端 `collect()` 也不收这几个入参。留着只会让用户白填一遍然后被静默丢弃。
 *   - 设计稿把证件号拆成 NRC 的「省份码 + 镇区码 + 编号」三段;后端是单列 `id_no`,
 *     且证件类型还支持护照 / 其他(那两种没有段码),故收敛成一个输入框。
 *   - 国籍设计稿是下拉,但后端是自由文本、也没有国家列表接口,一个只有 Myanmar 的下拉毫无意义,
 *     改成输入框(placeholder 用设计稿的 Myanmar)。
 *   - 「证件到期日」是后端有、设计稿没有的字段,复用设计稿的出生日期滚轮浮层(1675:7673)。
 *
 * 编辑态的证件号:列表接口返回的是**脱敏值**,回填不了原文,故编辑时该栏留空即保持原值
 * (后端 `collect(true)` 已配合放宽为选填)。
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { addTraveler, deleteTraveler, updateTraveler, type TravelerPayload } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { FormInput, FormSelect } from '@/components/hotel/booking/FormField';
import SelectSheet from '@/components/hotel/booking/SelectSheet';
import WheelPickerSheet from '@/components/hotel/booking/WheelPickerSheet';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { formatMonthDayYear } from '@/components/hotel/booking/bookingFormat';
import { TRAVELER_ID_TYPES, TRAVELER_ID_TYPE_I18N } from '@/config/global';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

export default function AddGuestScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddGuest'>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  /** 带 id 即编辑态;其余字段由列表页带过来(列表接口已有全部可编辑字段,不再单独请求详情) */
  const editing = route.params?.traveler ?? null;
  const id = editing?.id ?? 0;

  const [firstName, setFirstName] = useState(editing?.first_name ?? '');
  const [lastName, setLastName] = useState(editing?.last_name ?? '');
  const [nationality, setNationality] = useState(editing?.nationality ?? '');
  const [idType, setIdType] = useState<number>(editing?.id_type ?? 2);
  const [idNo, setIdNo] = useState('');
  const [expireDate, setExpireDate] = useState<string | null>(editing?.id_expire_date ?? null);
  const [isDefault, setIsDefault] = useState((editing?.is_default ?? 0) === 1);

  const [typeOpen, setTypeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* 这两个页面都要登录才有数据,未登录直接引导去登录 */
  useEffect(() => {
    if (!isLogin) {
      showToast(t('user.notLogin'));
      navigation.goBack();
    }
  }, [isLogin, navigation, showToast, t]);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast(t('more.travelers.nameRequired'));
      return;
    }
    if (!id && !idNo.trim()) {
      showToast(t('more.travelers.idNoRequired'));
      return;
    }
    const payload: TravelerPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nationality: nationality.trim(),
      idType,
      idExpireDate: expireDate ?? '',
      isDefault: isDefault ? 1 : 0,
    };
    /* 编辑时留空 = 保持原值,别把空串传上去覆盖掉 */
    if (idNo.trim()) payload.idNo = idNo.trim();

    setSaving(true);
    try {
      if (id) {
        await updateTraveler(id, payload);
      } else {
        await addTraveler(payload);
      }
      showToast(t('common.success'));
      navigation.goBack();
    } catch {
      /* request.ts 已统一 Toast 过错误信息,这里只解除 loading */
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await deleteTraveler(id);
      showToast(t('common.success'));
      navigation.goBack();
    } catch {
      /* 同上 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <MorePageLayout
      title={id ? t('more.travelers.editTitle') : t('more.travelers.addGuest')}
      footer={
        <Pressable
          style={({ pressed }) => [
            bookingShared.primaryBtn,
            styles.saveBtn,
            (saving || !isLogin) && styles.disabled,
            pressed && bookingShared.pressed,
          ]}
          disabled={saving || !isLogin}
          onPress={() => void save()}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={bookingShared.primaryBtnText}>{t('more.travelers.save')}</Text>
          )}
        </Pressable>
      }
    >
      <View style={[bookingShared.panel, styles.card]}>
        <FormInput
          label={t('more.travelers.firstName')}
          required
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('hotels.booking.guests.firstNamePlaceholder')}
        />
        <FormInput
          label={t('more.travelers.lastName')}
          required
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('hotels.booking.guests.lastNamePlaceholder')}
        />
        <FormInput
          label={t('more.travelers.nationality')}
          value={nationality}
          onChangeText={setNationality}
          placeholder={t('more.travelers.nationalityPlaceholder')}
        />
      </View>

      <View style={[bookingShared.panel, styles.card]}>
        <FormSelect
          label={t('more.travelers.idType')}
          value={t(TRAVELER_ID_TYPE_I18N[idType] ?? TRAVELER_ID_TYPE_I18N[2])}
          placeholder={t('more.travelers.idType')}
          onPress={() => setTypeOpen(true)}
        />
        <View style={styles.field}>
          <FormInput
            label={t('more.travelers.idNo')}
            required={!id}
            value={idNo}
            onChangeText={setIdNo}
            placeholder={id ? t('more.travelers.idNoKeep') : t('more.travelers.idNoPlaceholder')}
            autoCapitalize="characters"
          />
          {id ? (
            <View style={styles.hintRow}>
              <HomeIcon name="infoSmall" size={13.333} color={colors.label} />
              <Text style={styles.hint}>
                {t('more.travelers.idNoMasked', { masked: editing?.id_no ?? '' })}
              </Text>
            </View>
          ) : null}
        </View>
        <FormSelect
          label={t('more.travelers.expireDate')}
          action
          value={expireDate ? formatMonthDayYear(expireDate, i18n.language) : null}
          placeholder={t('more.travelers.expireDatePlaceholder')}
          onPress={() => setDateOpen(true)}
        />

        <Pressable
          style={({ pressed }) => [styles.checkRow, pressed && bookingShared.pressed]}
          onPress={() => setIsDefault((v) => !v)}
        >
          <HomeIcon
            name={isDefault ? 'checkboxIndeterminate' : 'checkbox'}
            size={20}
            color={isDefault ? colors.primary : colors.softBlue}
          />
          <Text style={styles.checkLabel}>{t('more.travelers.setDefault')}</Text>
        </Pressable>
      </View>

      {id ? (
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && bookingShared.pressed]}
          disabled={saving}
          onPress={() => void remove()}
        >
          <Text style={styles.deleteText}>{t('more.travelers.delete')}</Text>
        </Pressable>
      ) : null}

      <SelectSheet
        visible={typeOpen}
        title={t('more.travelers.idType')}
        options={TRAVELER_ID_TYPES.map((v) => ({
          key: String(v),
          label: t(TRAVELER_ID_TYPE_I18N[v]),
        }))}
        value={String(idType)}
        onClose={() => setTypeOpen(false)}
        onSelect={(key) => setIdType(Number(key))}
      />
      <WheelPickerSheet
        visible={dateOpen}
        title={t('more.travelers.expireDate')}
        confirmLabel={t('more.travelers.confirm')}
        value={expireDate}
        onClose={() => setDateOpen(false)}
        onConfirm={setExpireDate}
      />
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  field: { gap: 6 },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
  hint: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 16,
    color: colors.label,
  },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },

  saveBtn: { paddingVertical: 16 },
  disabled: { opacity: 0.5 },

  deleteBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  deleteText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.hot,
  },
});
