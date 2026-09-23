/**
 * 资料向导第 1 步 · Complete Your Profile(Figma M-Trip / Onboarding · Create account 3 `2485:8211`)
 *
 * 入口:注册 / 登录后的「Set Up Profile Now?」弹窗 → Set Up Now。
 *
 * 设计稿实测(卡内,页壳见 ProfileSetupShell):
 *   头像     128 圆,#E5EEFF 底 + 2px rgba(32,77,218,0.1) 描边 + 2px 内边距;右下 32.67x31 主色相机角标;
 *            下方「Upload Profile Photo」Inter 600/12 行高 16 tracking 0.6 #747686;gap 16
 *   字段     标签 Inter 500/16 行高 20 tracking 0.14 `--text`;输入框 #EFF4FF 底 / 圆角 12 / padding 16,
 *            20 主色图标 + gap 12 + Inter 400/16 值(占位 `--text-2`);字段 gap 8,字段间 gap 16
 *   性别     #E5EEFF 底 / 圆角 12 / padding 4 的三段分段;选中段 `--tab` 底圆角 8 + Inter 700/14 主色,
 *            未选 Inter 500/14 `--text-2`
 *   城市     定位图标 + 值 + 右侧 12x7.4 #204DDA 下拉箭头
 *   住址     无图标的多行框,最小高 140
 *   按钮     Continue + 下方 Inter 600/12 `--text-2` 说明,「Profile Settings」加粗主色
 *
 * 取舍:
 *   - 生日用 mm/dd/yyyy 掩码输入(稿面就是这三段占位),不引原生日期控件 —— 三端表现一致,也免新增依赖。
 *   - 城市列表稿面没给展开态,这里给缅甸主要城市的固定清单,落库存英文名(见 CITY_OPTIONS)。
 *   - 头像选完即上传,Continue 只提交 URL;姓名 / 生日 / 性别必填,城市与住址选填(与后端校验一致)。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchProfileSetup, saveProfileSetup, uploadUserImage } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import ProfileSetupShell, {
  OptionSheet,
  SetupPrimaryButton,
  setupColors,
} from '@/components/user/ProfileSetupShell';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { chooseImageSource, pickImage } from '@/utils/imagePicker';
import { resolveMediaUri } from '@/utils/media';

/** 落库值(英文名)→ i18n 键;顺序即面板顺序 */
const CITY_OPTIONS: { value: string; key: string }[] = [
  { value: 'Yangon', key: 'yangon' },
  { value: 'Mandalay', key: 'mandalay' },
  { value: 'Nay Pyi Taw', key: 'naypyitaw' },
  { value: 'Bagan', key: 'bagan' },
  { value: 'Taunggyi', key: 'taunggyi' },
  { value: 'Mawlamyine', key: 'mawlamyine' },
  { value: 'Pathein', key: 'pathein' },
  { value: 'Myitkyina', key: 'myitkyina' },
  { value: 'Sittwe', key: 'sittwe' },
];

/** 1男 2女 3其他(对齐后端 ProfileSetupService::GENDERS) */
const GENDERS: { value: number; key: string }[] = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 3, key: 'other' },
];

/** 数字串 → mm/dd/yyyy 掩码 */
function maskDob(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** mm/dd/yyyy → yyyy-mm-dd;不是真实存在的过去日期返回 null */
function dobToIso(masked: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    date.getFullYear() !== Number(yyyy) ||
    date.getMonth() !== Number(mm) - 1 ||
    date.getDate() !== Number(dd) ||
    date.getTime() > Date.now() ||
    Number(yyyy) < new Date().getFullYear() - 120
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDob(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const showToast = useCommonStore((s) => s.showToast);
  const setProfile = useUserStore((s) => s.setProfile);

  const [avatar, setAvatar] = useState('');
  /** 刚选的本地图,上传完成前先拿它预览 */
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState(0);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* 回填:注册时填的姓名、之前存过的资料 */
  useEffect(() => {
    let alive = true;
    fetchProfileSetup()
      .then((d) => {
        if (!alive) return;
        setAvatar(d.avatar);
        setFullName(d.fullName);
        setDob(isoToDob(d.birthday));
        setGender(d.gender);
        setCity(d.city);
        setAddress(d.homeAddress);
      })
      .catch(() => {
        // 回填失败不挡填写,错误已由请求层 toast
      });
    return () => {
      alive = false;
    };
  }, []);

  const cityOptions = useMemo(
    () => CITY_OPTIONS.map((c) => ({ value: c.value, label: t(`user.profileSetup.cities.${c.key}`) })),
    [t],
  );
  const cityLabel = cityOptions.find((c) => c.value === city)?.label ?? city;

  const pickAvatar = async () => {
    if (uploading) return;
    const source = await chooseImageSource({
      title: t('user.profileSetup.uploadPhoto'),
      camera: t('user.profileSetup.picker.camera'),
      library: t('user.profileSetup.picker.library'),
      cancel: t('common.cancel'),
      denied: t('user.profileSetup.picker.denied'),
    });
    if (!source) return;
    const image = await pickImage(source, { square: true, front: true });
    if (image === 'denied') {
      showToast(t('user.profileSetup.picker.denied'));
      return;
    }
    if (!image) return;
    setAvatarPreview(image.uri);
    setUploading(true);
    try {
      const { url } = await uploadUserImage('avatar', image);
      setAvatar(url);
    } catch {
      setAvatarPreview('');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (uploading) {
      showToast(t('user.profileSetup.uploading'));
      return;
    }
    if (!fullName.trim()) {
      showToast(t('user.profileSetup.errors.fullName'));
      return;
    }
    const birthday = dobToIso(dob);
    if (!birthday) {
      showToast(t('user.profileSetup.errors.dob'));
      return;
    }
    if (!gender) {
      showToast(t('user.profileSetup.errors.gender'));
      return;
    }
    setSubmitting(true);
    try {
      const profile = await saveProfileSetup({
        avatar: avatar || undefined,
        fullName: fullName.trim(),
        birthday,
        gender,
        city: city || undefined,
        homeAddress: address.trim() || undefined,
      });
      await setProfile(profile);
      navigation.navigate('IdentityVerify');
    } catch {
      // 请求层已 toast
    } finally {
      setSubmitting(false);
    }
  };

  const avatarUri = avatarPreview || resolveMediaUri(avatar);

  return (
    <ProfileSetupShell
      step={1}
      title={t('user.profileSetup.step1.title')}
      subtitle={t('user.profileSetup.subtitle')}
    >
      <View style={styles.form}>
        {/* 头像 */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={pickAvatar} style={({ pressed }) => pressed && styles.pressed}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarEmpty}>
                  <HomeIcon name="personQuestion" size={56} color={colors.softBlue} />
                </View>
              )}
              {uploading ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <View style={styles.cameraBadge}>
              <HomeIcon name="cameraSmall" width={16.667} height={15} color="#FFFFFF" />
            </View>
          </Pressable>
          <Text style={styles.avatarLabel}>{t('user.profileSetup.uploadPhoto')}</Text>
        </View>

        <View style={styles.grid}>
          <Field label={t('user.profileSetup.fullName')}>
            <View style={styles.box}>
              <HomeIcon name="renameA" size={20} color={colors.primary} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('user.profileSetup.fullNamePlaceholder')}
                placeholderTextColor={setupColors.text2}
                maxLength={100}
                autoCapitalize="words"
              />
            </View>
          </Field>

          <Field label={t('user.profileSetup.dob')}>
            <View style={styles.box}>
              <HomeIcon name="calendarFilled" size={20} color={colors.primary} />
              <TextInput
                style={styles.input}
                value={dob}
                onChangeText={(v) => setDob(maskDob(v))}
                placeholder="mm/dd/yyyy"
                placeholderTextColor={setupColors.text2}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </Field>

          <Field label={t('user.profileSetup.gender')}>
            <View style={styles.segment}>
              {GENDERS.map((g) => {
                const active = gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    onPress={() => setGender(g.value)}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t(`user.profileSetup.genders.${g.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label={t('user.profileSetup.city')}>
            <Pressable
              style={({ pressed }) => [styles.box, pressed && styles.pressed]}
              onPress={() => setCityOpen(true)}
            >
              <HomeIcon name="locationFilled" size={20} color={colors.primary} />
              <Text
                style={[styles.input, !city && styles.placeholder]}
                numberOfLines={1}
              >
                {city ? cityLabel : t('user.profileSetup.cityPlaceholder')}
              </Text>
              <HomeIcon name="chevronDown" width={12} height={12} color={setupColors.accentBlue} />
            </Pressable>
          </Field>

          <Field label={t('user.profileSetup.address')}>
            <View style={[styles.box, styles.addressBox]}>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                onChangeText={setAddress}
                placeholder={t('user.profileSetup.addressPlaceholder')}
                placeholderTextColor={setupColors.text2}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
            </View>
          </Field>
        </View>

        <View style={styles.action}>
          <SetupPrimaryButton
            title={t('user.profileSetup.continue')}
            onPress={submit}
            loading={submitting}
          />
          <Text style={styles.note}>
            {t('user.profileSetup.changeLater')}
            <Text style={styles.noteLink}>{t('user.profileSetup.profileSettings')}</Text>.
          </Text>
        </View>
      </View>

      <OptionSheet
        visible={cityOpen}
        title={t('user.profileSetup.city')}
        options={cityOptions}
        value={city}
        onClose={() => setCityOpen(false)}
        onSelect={setCity}
      />
    </ProfileSetupShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },

  avatarBlock: { alignItems: 'center', gap: 16 },
  avatarRing: {
    width: 128,
    height: 128,
    padding: 2,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: 'rgba(32, 77, 218, 0.1)',
    overflow: 'hidden',
    backgroundColor: setupColors.segmentBg,
  },
  avatarImg: { flex: 1, borderRadius: 62 },
  avatarEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32.667,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15.5,
    backgroundColor: colors.primary,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  avatarLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.label,
  },

  grid: { gap: 16 },
  field: { gap: 8 },
  label: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: setupColors.inputBg,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 20,
    color: colors.heading,
  },
  placeholder: { color: setupColors.text2 },
  addressBox: { minHeight: 140, alignItems: 'flex-start' },
  addressInput: { minHeight: 108, lineHeight: 20 },

  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: setupColors.segmentBg,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentItemActive: { backgroundColor: colors.surface },
  segmentText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: setupColors.text2,
  },
  segmentTextActive: { fontFamily: fonts.interBold, color: colors.primary },

  action: { gap: 16 },
  note: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: setupColors.text2,
  },
  noteLink: { fontFamily: fonts.interBold, color: colors.primary },

  pressed: { opacity: 0.85 },
});
