/**
 * 「给应用评分」弹窗(按 Figma M-Trip / More `3282:21342` Rate Application Overlay 实现)
 *
 * 「更多」页 Rate this app 行调起(完整模式 MineScreen 与关怀模式 MoreLiteScreen 共用)。
 * 两个动作都不在 App 内打分(设计稿没有星级控件,所以也不往反馈接口写评分):
 *   Yes! leave rating        → 跳应用商店评分页(链接见 moreDemo.ts 的 STORE_REVIEW_URL;
 *                              iOS 上架 id 还没有,拿不到链接时提示「即将开放」)
 *   Provide Feedback Instead → 进「Report Issue / Feedback」页(由调用方处理登录拦截)
 *
 * 设计稿实测:
 *   卡     宽 340,--tab 底 / 1px --secondary / 圆角 24 / Effect/DS;内容 px24 py20 gap24
 *   关闭   右上 12 的 ×(--text-2)
 *   插图   120×121 点赞 + 星星(导出原图 512²,assets/images/more/rate-thumb.png)
 *   标题   Inter 700/22 行高 30.25 字距 -0.55 --text 居中,宽 292
 *   按钮   两枚高 50 圆角 12,间距 8;主按钮主色底白字,次按钮 1px 主色描边主色字;Inter 600/15
 *
 * 设计稿标题写的是「Enjoying the Trip.com app?」,明显是占位误写,这里改成 mTrip。
 */

import React from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { STORE_REVIEW_URL } from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';
import { openExternal } from '@/utils/openExternal';

const ART = require('../../../assets/images/more/rate-thumb.png');

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 「Provide Feedback Instead」:弹窗先关,再由调用方跳反馈页 */
  onFeedback: () => void;
}

export default function RateAppDialog({ visible, onClose, onFeedback }: Props) {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  if (!visible) return null;

  const rate = () => {
    onClose();
    const url = Platform.OS === 'android' ? STORE_REVIEW_URL.android : Platform.OS === 'ios' ? STORE_REVIEW_URL.ios : null;
    if (!url) {
      showToast(t('home.comingSoon'));
      return;
    }
    void openExternal(url, () => showToast(t('more.contact.openFailed')));
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.closeRow}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('more.rate.close')}>
              <HomeIcon name="close" size={12} color={colors.textSoft} />
            </Pressable>
          </View>

          <Image source={ART} style={styles.art} resizeMode="contain" />

          <Text style={styles.headline}>{t('more.rate.headline')}</Text>

          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && moreShared.pressed]} onPress={rate}>
              <Text style={[styles.btnText, styles.btnTextPrimary]}>{t('more.rate.leaveRating')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && moreShared.pressed]}
              onPress={() => {
                onClose();
                onFeedback();
              }}
            >
              <Text style={styles.btnText}>{t('more.rate.feedbackInstead')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  closeRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  art: { width: 120, height: 121 },
  headline: {
    maxWidth: 292,
    fontFamily: fonts.interBold,
    fontSize: 22,
    lineHeight: 30.25,
    letterSpacing: -0.55,
    textAlign: 'center',
    color: colors.heading,
  },
  actions: { alignSelf: 'stretch', gap: 8 },
  btn: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.btn },
  btnPrimary: { backgroundColor: colors.primary },
  btnOutline: { borderWidth: 1, borderColor: colors.primary },
  btnText: { fontFamily: fonts.interSemi, fontSize: 15, lineHeight: 22.5, color: colors.primary },
  btnTextPrimary: { color: '#FFFFFF' },
});
