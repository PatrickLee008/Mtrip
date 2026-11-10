/**
 * 热线电话底部弹层(按 Figma M-Trip / More `3578:10243` Hotline Overlay 实现)
 *
 * 联系我们页点「Hotline Phone Number」行弹出:两条热线(点整行拨号,跳系统拨号盘 3594:10402)
 * + 服务时间说明。点遮罩或右上角 × 关闭。
 *
 * 设计稿实测:
 *   壳     --tab 底 / 1px --secondary / 顶部圆角 24 / Effect/DS 投影,贴底
 *   标题栏 padding 16,下边框 --secondary;标题 Inter 600/20 --text 居中,× 12 --text-2 靠右
 *   热线行 padding 24,两端对齐;名称 Inter 600/18 行高 28 --text,号码 Inter 500/14 --text-2;
 *          右侧 48 圆框内 20 主色 call 图标;两行之间、末行与服务时间之间各一条 --secondary 线
 *   时间   padding 24 gap 10;小标题 Inter 500/14 --text,两行 Inter 500/14 --text-2 行距 4
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { moreShared } from '@/components/more/moreShared';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { HOTLINE_HOURS, SUPPORT_CONTACT } from '@/screens/more/moreDemo';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
}

export default function HotlineSheet({ visible, onClose, onCall }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{t('more.contact.hotline.title')}</Text>
            <Pressable
              style={styles.close}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('more.rate.close')}
            >
              <HomeIcon name="close" size={12} color={colors.textSoft} />
            </Pressable>
          </View>

          {SUPPORT_CONTACT.hotlines.map((phone, index) => (
            <Pressable
              key={phone}
              style={({ pressed }) => [styles.row, pressed && moreShared.pressed]}
              accessibilityRole="button"
              onPress={() => onCall(phone)}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{t('more.contact.hotline.name', { index: index + 1 })}</Text>
                <Text style={styles.phone}>{phone}</Text>
              </View>
              <View style={styles.callBox}>
                <HomeIcon name="call" size={20} color={colors.primary} />
              </View>
            </Pressable>
          ))}

          <View style={styles.hours}>
            <Text style={styles.hoursTitle}>{t('more.contact.hotline.hoursTitle')}</Text>
            <View style={styles.hoursList}>
              {HOTLINE_HOURS.map((key) => (
                <Text key={key} style={styles.hoursText}>
                  {t(`more.contact.hotline.hours.${key}`)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  /* 设计稿行高 20 小于字号,抬到 24 免得裁字 */
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.heading,
  },
  close: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 28, color: colors.heading },
  phone: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  callBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  hours: { gap: 10, padding: 24 },
  hoursTitle: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  hoursList: { gap: 4 },
  hoursText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
});
