/**
 * 「Set Up Profile Now?」弹窗(Figma M-Trip / Onboarding · Set Up Profile Overlay `2516:14427`)
 *
 * 设计稿实测:
 *   卡片  `--tab` 底 / 圆角 24 / padding 24 / gap 16 / 整体居中(版式同 ConfirmDialog)
 *   图标  fluent:person-question-mark-20-filled,60,主色
 *   标题  Inter 600/20(行高 20)tracking 0.14 **主色** 居中
 *   正文  Inter 400/16(行高 24)`--text-2` 居中
 *   按钮  两枚等宽 gap 16,圆角 12,Inter 500/**20**(行高 20)tracking 0.14
 *         Later       1px 主色描边、py17、主色字
 *         Set Up Now  主色底、py16、白字
 *
 * 全局挂在 NavigationContainer 里(不属于任何页面):注册 / 登录成功后由 userStore 置可见,
 * 注册流程紧接着 popToTop,弹窗得盖在回到的首页上,所以不能长在某个页面里。
 * 点遮罩 / 返回键等同 Later。
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { navigationRef } from '@/navigation/navigationRef';
import { useUserStore } from '@/store/userStore';

export default function ProfileSetupPrompt() {
  const { t } = useTranslation();
  const visible = useUserStore((s) => s.profilePromptVisible);
  const dismiss = useUserStore((s) => s.dismissProfilePrompt);

  const later = () => void dismiss(true);
  const setUpNow = () => {
    // 不记 Later:用户中途退出向导的话,下次登录还会再提示
    void dismiss(false);
    if (navigationRef.isReady()) navigationRef.navigate('ProfileSetup');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={later}>
      <Pressable style={styles.mask} onPress={later}>
        <Pressable style={styles.card} onPress={() => {}}>
          <HomeIcon name="personQuestion" size={60} color={colors.primary} />

          <Text style={styles.title}>{t('user.profileSetup.prompt.title')}</Text>
          <Text style={styles.message}>{t('user.profileSetup.prompt.message')}</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}
              onPress={later}
            >
              <Text style={styles.laterText}>{t('user.profileSetup.prompt.later')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
              onPress={setUpNow}
            >
              <Text style={styles.confirmText} numberOfLines={1}>
                {t('user.profileSetup.prompt.setUpNow')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const button = {
  flex: 1,
  minWidth: 0,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: radius.btn,
} as const;

const buttonText = {
  fontFamily: fonts.interMedium,
  fontSize: 20,
  lineHeight: 20,
  letterSpacing: 0.14,
  textAlign: 'center',
} as const;

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 370,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  title: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },
  message: {
    width: '100%',
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  actions: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, width: '100%' },
  laterBtn: { ...button, paddingVertical: 17, borderWidth: 1, borderColor: colors.primary },
  laterText: { ...buttonText, color: colors.primary },
  confirmBtn: { ...button, paddingVertical: 16, backgroundColor: colors.primary },
  confirmText: { ...buttonText, color: '#FFFFFF' },

  pressed: { opacity: 0.85 },
});
