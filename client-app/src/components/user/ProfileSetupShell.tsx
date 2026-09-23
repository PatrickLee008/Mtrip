/**
 * 资料向导两步共用的页壳(Figma Onboarding · Create account 3 `2485:8211` / Create account 4 `2485:8355`)
 *
 * 设计稿实测:
 *   顶栏     与「更多」子页同一条 Header - Top App Bar(返回 + Outfit 600/24 主色「Set Up Profile」),直接复用 MorePageLayout
 *   进度区   「PROFILE SET UP」Inter 600/12 行高 16 tracking 0.6 大写 #575E72 ↔「Step N of 2」Inter 700/14 行高 20 主色,底对齐;
 *            下方 6px 进度条,`--secondary` #D9E1FB 底 + 主色填充,全圆角;两行 gap 8
 *   内容卡   `--tab` 底 / 1px `--secondary` 描边 / 圆角 24 / padding 20 / gap 24 / DS_AG 投影
 *   卡头     标题 Inter 600/24 行高 32 #0B1C30 居中;副标 Inter 400/16 行高 24 #747686 居中;gap 8
 *   进度区与内容卡 gap 32(Create account 4 的 Verification Tips 卡同为 gap 32,经 `after` 传入)
 *
 * 另附两步共用的「下拉选项面板」OptionSheet:设计稿只画了收起态的下拉框,展开态沿用 App 其余底部面板的做法。
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 两步稿面上反复出现、theme 里没有的色值 */
export const setupColors = {
  /** 卡标题 / 选择框值 */
  ink: '#0B1C30',
  /** 进度区小标 */
  step: '#575E72',
  /** 第 2 步字段标签 / 提示列表正文 */
  fieldLabel: '#434655',
  /** 灰色占位 / 次级文字(--text-2 压平) */
  text2: '#8B8C91',
  /** 输入框底 */
  inputBg: '#EFF4FF',
  /** 性别分段底 / 头像底 */
  segmentBg: '#E5EEFF',
  /** 下拉小箭头(城市)/ 自拍标题图标 */
  accentBlue: '#204DDA',
} as const;

interface ShellProps {
  step: 1 | 2;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** 内容卡之后的附加卡片(第 2 步的 Verification Tips) */
  after?: React.ReactNode;
}

export default function ProfileSetupShell({ step, title, subtitle, children, after }: ShellProps) {
  const { t } = useTranslation();
  return (
    <MorePageLayout title={t('user.profileSetup.headerTitle')}>
      <View style={styles.container}>
        <View style={styles.progress}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{t('user.profileSetup.progressLabel')}</Text>
            <Text style={styles.progressStep}>{t('user.profileSetup.stepOf', { step, total: 2 })}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
          {children}
        </View>

        {after}
      </View>
    </MorePageLayout>
  );
}

/* ---------------- 下拉选项面板 ---------------- */

export interface Option {
  value: string;
  label: string;
}

interface SheetProps {
  visible: boolean;
  title: string;
  options: Option[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}

export function OptionSheet({ visible, title, options, value, onClose, onSelect }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetMask} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => {}}
        >
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.sheetText, active && styles.sheetTextActive]}>{opt.label}</Text>
                  {active ? <HomeIcon name="check" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 两步通用的主按钮(Button - Search CTA:主色底 / 圆角 12 / py16 / Outfit 400/16 行高 28 白字) */
export function SetupPrimaryButton({
  title,
  onPress,
  loading,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cta, (pressed || loading) && styles.pressed]}
      onPress={onPress}
      disabled={loading}
    >
      <Text style={styles.ctaText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* MorePageLayout 的滚动区已带 px16 / gap 24,这里只管进度区与卡片之间的 32 */
  container: { gap: 32 },

  progress: { gap: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  progressLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: setupColors.step,
  },
  progressStep: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  track: { height: 6, borderRadius: 9999, overflow: 'hidden', backgroundColor: colors.softBlue },
  fill: { height: '100%', borderRadius: 9999, backgroundColor: colors.primary },

  card: {
    gap: 24,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardHeader: { gap: 8, alignItems: 'center' },
  cardTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: setupColors.ink,
  },
  cardSubtitle: {
    maxWidth: 270,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.label,
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  ctaText: { fontFamily: fonts.outfit, fontSize: 16, lineHeight: 28, color: '#FFFFFF' },

  sheetMask: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    maxHeight: '70%',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    marginBottom: 8,
    fontFamily: fonts.interSemi,
    fontSize: 18,
    lineHeight: 24,
    color: setupColors.ink,
  },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  sheetText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  sheetTextActive: { fontFamily: fonts.interSemi, color: colors.primary },

  pressed: { opacity: 0.85 },
});
