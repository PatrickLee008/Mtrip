/**
 * 资料向导第 2 步 · Identity Verification(Figma M-Trip / Onboarding · Create account 4 `2485:8355`)
 *
 * 设计稿实测(卡内,页壳见 ProfileSetupShell):
 *   字段组(Component 3)  字段间 gap 24;标签 Inter 500/14 行高 20 tracking 0.14 #434655,左缩 4,与框 gap 4
 *   下拉框   #EFF4FF 底 / 高 56 / px16 py8 / 圆角 12,值 Inter 400/16 行高 24 `--text`,右侧 24 描边箭头 `--text-2`
 *   NRC 号   三段 gap 8:州号下拉(px12,值 #0B1C30,箭头 #6B7280)/ 镇区下拉 / 号码框(flex1,px17 py18)
 *   NRC 图   两枚 gap 10 的 1px 虚线 `--secondary` 圆角 12 padding 20 格子,
 *            「Front」+ image-add 图标 /「Back」反过来,Inter 500/14 `--text-2`,图文 gap 10
 *   自拍     标题行 20 #204DDA 图标 + Inter 600/24 #0B1C30;下方 224 高 `--tab` 底虚线框,
 *            30x27 相机(`--text-2`)+ 8 间距 +「Take or Upload Selfie」Inter 500/14 `--text` + 4 +
 *            「Must match your ID photo」Inter 600/12 tracking 0.6 `--text-2`
 *   声明     Inter 600/12 行高 16 tracking 0.6 `--text-2` 居中;按钮 Submit Verification
 *   Tips 卡  内容卡之外另起一张(gap 32):padding 21,标题 16.67 info 图标 + Inter 500/14 主色,
 *            三条 gap 16,每条 20 圆底 rgba(78,115,255,0.08) 勾 + Inter 400/16 行高 24 #434655
 *
 * 取舍:
 *   - 镇区代码(OoKaMa 等)全缅三百多个,稿面只画了收起态;这里做成与州号同款外观的输入框,
 *     不硬编码一份可能过时的镇区表。提交时拼成标准 NRC 串 `12/OoKaMa(N)123456`。
 *   - 国籍非缅甸时没有 NRC:号码区换成一格护照号,图片只要资料页(Back 格隐藏),后端同口径放行。
 *   - 图片选完即上传(同头像),Submit 只提交 URL。
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

import {
  fetchProfileSetup,
  submitIdentity,
  uploadUserImage,
  type UserUploadScene,
} from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import ProfileSetupShell, {
  OptionSheet,
  SetupPrimaryButton,
  setupColors,
} from '@/components/user/ProfileSetupShell';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { chooseImageSource, pickImage } from '@/utils/imagePicker';
import { resolveMediaUri } from '@/utils/media';

/** 国籍(ISO alpha-2)→ i18n 键;缅甸置顶 */
const NATIONALITIES: { value: string; key: string }[] = [
  { value: 'MM', key: 'mm' },
  { value: 'TH', key: 'th' },
  { value: 'CN', key: 'cn' },
  { value: 'IN', key: 'in' },
  { value: 'SG', key: 'sg' },
  { value: 'MY', key: 'my' },
  { value: 'JP', key: 'jp' },
  { value: 'KR', key: 'kr' },
  { value: 'US', key: 'us' },
  { value: 'GB', key: 'gb' },
];

/** NRC 州 / 省代码 1~14 */
const NRC_STATES = Array.from({ length: 14 }, (_, i) => String(i + 1));

type Slot = 'front' | 'back' | 'selfie';
const SLOT_SCENE: Record<Slot, UserUploadScene> = { front: 'id_front', back: 'id_back', selfie: 'selfie' };

interface SlotState {
  /** 本地预览 */
  preview: string;
  /** 上传后的 /uploads 地址 */
  url: string;
  uploading: boolean;
}
const EMPTY_SLOT: SlotState = { preview: '', url: '', uploading: false };

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function IdentityVerifyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const showToast = useCommonStore((s) => s.showToast);
  const setProfile = useUserStore((s) => s.setProfile);

  const [nationality, setNationality] = useState('MM');
  const [name, setName] = useState('');
  const [nrcState, setNrcState] = useState('12');
  const [township, setTownship] = useState('');
  const [idNo, setIdNo] = useState('');
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    front: EMPTY_SLOT,
    back: EMPTY_SLOT,
    selfie: EMPTY_SLOT,
  });
  const [sheet, setSheet] = useState<'nationality' | 'state' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isNrc = nationality === 'MM';

  useEffect(() => {
    let alive = true;
    fetchProfileSetup()
      .then((d) => {
        if (!alive) return;
        setName((prev) => prev || d.fullName);
        if (d.nationality) setNationality(d.nationality);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const nationalityOptions = useMemo(
    () => NATIONALITIES.map((n) => ({ value: n.value, label: t(`user.profileSetup.countries.${n.key}`) })),
    [t],
  );
  const nationalityLabel = nationalityOptions.find((n) => n.value === nationality)?.label ?? nationality;

  const setSlot = (slot: Slot, patch: Partial<SlotState>) =>
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));

  const pick = async (slot: Slot) => {
    if (slots[slot].uploading) return;
    const source = await chooseImageSource({
      title: slot === 'selfie' ? t('user.profileSetup.step2.selfieAction') : t('user.profileSetup.step2.nrcImage'),
      camera: t('user.profileSetup.picker.camera'),
      library: t('user.profileSetup.picker.library'),
      cancel: t('common.cancel'),
      denied: t('user.profileSetup.picker.denied'),
    });
    if (!source) return;
    const image = await pickImage(source, { front: slot === 'selfie' });
    if (image === 'denied') {
      showToast(t('user.profileSetup.picker.denied'));
      return;
    }
    if (!image) return;
    setSlot(slot, { preview: image.uri, uploading: true });
    try {
      const { url } = await uploadUserImage(SLOT_SCENE[slot], image);
      setSlot(slot, { url, uploading: false });
    } catch {
      setSlot(slot, EMPTY_SLOT);
    }
  };

  const submit = async () => {
    if (Object.values(slots).some((s) => s.uploading)) {
      showToast(t('user.profileSetup.uploading'));
      return;
    }
    if (!name.trim()) {
      showToast(t('user.profileSetup.errors.name'));
      return;
    }
    let idNumber = idNo.trim();
    if (isNrc) {
      const code = township.trim();
      if (!/^[A-Za-z]{3,12}$/.test(code) || !/^\d{6}$/.test(idNumber)) {
        showToast(t('user.profileSetup.errors.nrc'));
        return;
      }
      idNumber = `${nrcState}/${code}(N)${idNumber}`;
    } else if (!idNumber) {
      showToast(t('user.profileSetup.errors.passport'));
      return;
    }
    if (!slots.front.url || (isNrc && !slots.back.url)) {
      showToast(t('user.profileSetup.errors.idImage'));
      return;
    }
    if (!slots.selfie.url) {
      showToast(t('user.profileSetup.errors.selfie'));
      return;
    }
    setSubmitting(true);
    try {
      const profile = await submitIdentity({
        nationality,
        name: name.trim(),
        idNumber,
        idCardFront: slots.front.url,
        idCardBack: isNrc ? slots.back.url : undefined,
        selfieImage: slots.selfie.url,
      });
      await setProfile(profile);
      showToast(t('user.profileSetup.step2.submitted'));
      /* 回到进入向导之前的那一页(通常是首页):把第 1、2 步一起出栈 */
      const routes = navigation.getState().routes;
      const first = routes.findIndex((r) => r.name === 'ProfileSetup');
      if (first > 0) navigation.pop(routes.length - first);
      else navigation.goBack();
    } catch {
      // 请求层已 toast
    } finally {
      setSubmitting(false);
    }
  };

  const tips = [
    t('user.profileSetup.tips.clear'),
    t('user.profileSetup.tips.edges'),
    t('user.profileSetup.tips.lighting'),
  ];

  return (
    <ProfileSetupShell
      step={2}
      title={t('user.profileSetup.step2.title')}
      subtitle={t('user.profileSetup.subtitle')}
      after={
        <View style={styles.tipsCard}>
          <View style={styles.tipsHead}>
            <HomeIcon name="infoOutline" size={16.667} color={colors.primary} />
            <Text style={styles.tipsTitle}>{t('user.profileSetup.tips.title')}</Text>
          </View>
          <View style={styles.tipsList}>
            {tips.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <View style={styles.tipMarkWrap}>
                  <View style={styles.tipMark}>
                    <HomeIcon name="checkSmall" width={10.442} height={7.963} color={colors.primary} />
                  </View>
                </View>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      }
    >
      <View style={styles.fields}>
        <Field label={t('user.profileSetup.step2.nationality')}>
          <Pressable
            style={({ pressed }) => [styles.select, pressed && styles.pressed]}
            onPress={() => setSheet('nationality')}
          >
            <Text style={styles.selectText} numberOfLines={1}>
              {nationalityLabel}
            </Text>
            <HomeIcon name="chevronStroke" size={24} color={setupColors.text2} />
          </Pressable>
        </Field>

        <Field label={t('user.profileSetup.step2.name')}>
          <View style={styles.select}>
            <TextInput
              style={styles.selectText}
              value={name}
              onChangeText={setName}
              placeholder={t('user.profileSetup.step2.namePlaceholder')}
              placeholderTextColor={setupColors.text2}
              maxLength={100}
              autoCapitalize="words"
            />
          </View>
        </Field>

        {isNrc ? (
          <Field label={t('user.profileSetup.step2.nrcNumber')}>
            <View style={styles.nrcRow}>
              <Pressable
                style={({ pressed }) => [styles.nrcPart, pressed && styles.pressed]}
                onPress={() => setSheet('state')}
              >
                <Text style={styles.nrcPartText}>{nrcState}</Text>
                <HomeIcon name="chevronStroke" size={24} color="#6B7280" />
              </Pressable>
              <View style={[styles.nrcPart, styles.township]}>
                <TextInput
                  style={[styles.nrcPartText, styles.townshipInput]}
                  value={township}
                  onChangeText={(v) => setTownship(v.replace(/[^A-Za-z]/g, ''))}
                  placeholder="OoKaMa"
                  placeholderTextColor={setupColors.text2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={12}
                />
              </View>
              <View style={styles.nrcNumber}>
                <TextInput
                  style={styles.nrcNumberInput}
                  value={idNo}
                  onChangeText={(v) => setIdNo(v.replace(/\D/g, ''))}
                  placeholder="123456"
                  placeholderTextColor="#6B7280"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
          </Field>
        ) : (
          <Field label={t('user.profileSetup.step2.passportNumber')}>
            <View style={styles.select}>
              <TextInput
                style={styles.selectText}
                value={idNo}
                onChangeText={(v) => setIdNo(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                placeholder={t('user.profileSetup.step2.passportPlaceholder')}
                placeholderTextColor={setupColors.text2}
                autoCapitalize="characters"
                maxLength={20}
              />
            </View>
          </Field>
        )}

        <Field label={isNrc ? t('user.profileSetup.step2.nrcImage') : t('user.profileSetup.step2.passportImage')}>
          <View style={styles.imageRow}>
            <UploadTile
              slot={slots.front}
              label={isNrc ? t('user.profileSetup.step2.front') : t('user.profileSetup.step2.photoPage')}
              onPress={() => pick('front')}
            />
            {isNrc ? (
              <UploadTile
                slot={slots.back}
                label={t('user.profileSetup.step2.back')}
                iconFirst
                onPress={() => pick('back')}
              />
            ) : null}
          </View>
        </Field>
      </View>

      <View style={styles.selfie}>
        <View style={styles.selfieHead}>
          <HomeIcon name="faceSmile" size={20} color={setupColors.accentBlue} />
          <Text style={styles.selfieTitle}>{t('user.profileSetup.step2.selfieTitle')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.selfieBox, pressed && styles.pressed]}
          onPress={() => pick('selfie')}
        >
          {slots.selfie.preview || slots.selfie.url ? (
            <Image
              source={{ uri: slots.selfie.preview || resolveMediaUri(slots.selfie.url) || undefined }}
              style={styles.selfieImg}
              resizeMode="cover"
            />
          ) : (
            <>
              <View style={styles.selfieIcon}>
                <HomeIcon name="cameraOutline" width={30} height={27} color={setupColors.text2} />
              </View>
              <Text style={styles.selfieAction}>{t('user.profileSetup.step2.selfieAction')}</Text>
              <Text style={styles.selfieHint}>{t('user.profileSetup.step2.selfieHint')}</Text>
            </>
          )}
          {slots.selfie.uploading ? (
            <View style={styles.uploadingMask}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      </View>

      <Text style={styles.consent}>{t('user.profileSetup.step2.consent')}</Text>

      <SetupPrimaryButton
        title={t('user.profileSetup.step2.submit')}
        onPress={submit}
        loading={submitting}
      />

      <OptionSheet
        visible={sheet === 'nationality'}
        title={t('user.profileSetup.step2.nationality')}
        options={nationalityOptions}
        value={nationality}
        onClose={() => setSheet(null)}
        onSelect={setNationality}
      />
      <OptionSheet
        visible={sheet === 'state'}
        title={t('user.profileSetup.step2.nrcState')}
        options={NRC_STATES.map((s) => ({ value: s, label: s }))}
        value={nrcState}
        onClose={() => setSheet(null)}
        onSelect={setNrcState}
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

function UploadTile({
  slot,
  label,
  iconFirst,
  onPress,
}: {
  slot: SlotState;
  label: string;
  iconFirst?: boolean;
  onPress: () => void;
}) {
  const uri = slot.preview || resolveMediaUri(slot.url);
  const icon = <HomeIcon name="imageAdd" size={20} color={setupColors.text2} />;
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.pressed]} onPress={onPress}>
      {uri ? (
        <Image source={{ uri }} style={styles.tileImg} resizeMode="cover" />
      ) : (
        <>
          {iconFirst ? icon : null}
          <Text style={styles.tileText}>{label}</Text>
          {iconFirst ? null : icon}
        </>
      )}
      {slot.uploading ? (
        <View style={styles.uploadingMask}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 24 },
  field: { gap: 4 },
  label: {
    paddingLeft: 4,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: setupColors.fieldLabel,
  },

  select: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: setupColors.inputBg,
  },
  selectText: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  nrcRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  nrcPart: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: setupColors.inputBg,
  },
  nrcPartText: {
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: setupColors.ink,
  },
  township: { width: 96 },
  townshipInput: { flex: 1, minWidth: 0 },
  nrcNumber: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 17,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: setupColors.inputBg,
  },
  nrcNumberInput: {
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 20,
    color: setupColors.ink,
  },

  imageRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.softBlue,
    overflow: 'hidden',
  },
  tileImg: { ...StyleSheet.absoluteFillObject },
  tileText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: setupColors.text2,
  },
  uploadingMask: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },

  selfie: { gap: 16 },
  selfieHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selfieTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: setupColors.ink,
  },
  selfieBox: {
    height: 224,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  selfieImg: { ...StyleSheet.absoluteFillObject },
  selfieIcon: { marginBottom: 8 },
  selfieAction: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.heading,
  },
  selfieHint: {
    paddingTop: 4,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: setupColors.text2,
  },

  consent: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: setupColors.text2,
  },

  tipsCard: {
    gap: 16,
    padding: 21,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsTitle: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  tipsList: { gap: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipMarkWrap: { width: 20, height: 24, paddingTop: 4 },
  tipMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(78, 115, 255, 0.08)',
  },
  tipText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: setupColors.fieldLabel,
  },

  pressed: { opacity: 0.85 },
});
