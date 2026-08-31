/**
 * 「更多」section 子页的公共页壳(设计稿 1797:4313 Header - Top App Bar 等)
 *
 * 这个 section 下 7 张子页用的是同一套壳:页面底 `--background`,顶部一条 `--tab` 底的
 * 返回栏(px20 py16,Effect/DS 投影;返回箭头 20 + 标题 Outfit 600/24 主色),
 * 下面是 px16 pb20、块间距 24 的滚动区,部分页尾部还有一行 60% 透明度的版本号。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { moreShared } from '@/components/more/moreShared';
import { APP_VERSION } from '@/config/global';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  title: string;
  /** 尾部是否显示版本号(设计稿 Account 页有,Traveler / Guides 等没有) */
  showVersion?: boolean;
  /** 固定在底部的操作区(设计稿部分子页有一枚整宽 CTA) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function MorePageLayout({ title, showVersion, footer, children }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && moreShared.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
          {showVersion ? (
            <Text style={styles.version}>{t('more.version', { version: APP_VERSION })}</Text>
          ) : null}
        </ScrollView>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  back: { padding: 2 },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 24,
  },
  version: {
    opacity: 0.6,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  footer: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.pageBg,
  },
});
