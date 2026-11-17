/**
 * 「Chat with us」悬浮按钮(Consumer App PRD v1.0.6 模块 13 入口之二:首页 / 酒店页):
 * 打开 mTrip 平台客服会话(Chat type 2);未登录先去登录。
 * 由父容器绝对定位到右下角,`bottom` 可按页面底栏调整。
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useUserStore } from '@/store/userStore';

export default function SupportChatFab({ bottom = 20 }: { bottom?: number }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  return (
    <Pressable
      style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.pressed]}
      onPress={() => (isLogin ? navigation.navigate('Chat', { type: 2 }) : navigation.navigate('Login'))}
      accessibilityRole="button"
      accessibilityLabel={t('chat.supportChat.fab')}
      testID="support-chat-fab"
    >
      <HomeIcon name="chatFilled" size={18} color="#FFFFFF" />
      <Text style={styles.text}>{t('chat.supportChat.fab')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: colors.softBlue,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  text: { fontFamily: fonts.interSemi, fontSize: 14, color: '#FFFFFF' },
});
