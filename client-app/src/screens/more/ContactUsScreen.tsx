/**
 * 联系我们(按 Figma M-Trip / More `3503:9182` Contact us 实现)
 *
 * 同 section 另外两张「Contact us」不是本页的状态,而是点行之后跳出 App 的系统界面:
 *   3594:10402 系统拨号盘(热线弹层里点电话 → `tel:`)
 *   3819:11277 邮件客户端写信页(点邮箱行 → `mailto:`)
 * 所以本页只做四行入口 + 热线弹层(Hotline Overlay 3578:10243,见 HotlineSheet):
 *   官网 → 外部浏览器打开;邮箱 → 系统邮件;热线 → 底部弹层选号拨打;在线客服 → 客服会话(需登录)。
 *
 * 设计稿实测:
 *   行卡   --tab 底 / 1px --secondary / 圆角 28 / padding 20 / DS_AG,卡间距 16
 *   行内   48 圆形 #ECF5FE 底 + 20 主色图标(官网行是 mTrip 字标图,27.57×20)→ gap 16
 *          → 标题 Inter 400/16 --text + 副标题 Inter 400/14 --text-2(单行省略)→ 7.4×12 箭头 #C4C5D7
 *
 * 联系方式写死在 moreDemo.ts 的 SUPPORT_CONTACT(**后端没有客服联系方式配置接口**)。
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import HotlineSheet from '@/components/more/HotlineSheet';
import MorePageLayout from '@/components/more/MorePageLayout';
import { MENU_ICON_BG, moreShared } from '@/components/more/moreShared';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { SUPPORT_CONTACT } from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { openExternal } from '@/utils/openExternal';

/** 官网行的 mTrip 字标(与预订成功页凭证同一张 2026 版 logo) */
const LOGO = require('../../../assets/images/logo-2026.png');

export default function ContactUsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);
  const [hotlineOpen, setHotlineOpen] = useState(false);

  const fail = () => showToast(t('more.contact.openFailed'));

  const rows: { key: string; icon?: HomeIconName; title: string; desc: string; onPress: () => void }[] = [
    {
      key: 'website',
      title: t('more.contact.website'),
      desc: SUPPORT_CONTACT.website,
      onPress: () => void openExternal(SUPPORT_CONTACT.website, fail),
    },
    {
      key: 'email',
      icon: 'mail',
      title: t('more.contact.email'),
      desc: SUPPORT_CONTACT.email,
      onPress: () => void openExternal(`mailto:${SUPPORT_CONTACT.email}`, fail),
    },
    {
      key: 'hotline',
      icon: 'call',
      title: t('more.contact.hotlineRow'),
      desc: SUPPORT_CONTACT.hotlines.join(', '),
      onPress: () => setHotlineOpen(true),
    },
    {
      key: 'chat',
      icon: 'personSupport',
      title: t('more.contact.chat'),
      desc: t('more.contact.chatDesc'),
      // 客服会话(type 2)与订单详情页的「联系客服」同一个入口
      onPress: () => (isLogin ? navigation.navigate('Chat', { type: 2 }) : navigation.navigate('Login')),
    },
  ];

  return (
    <MorePageLayout title={t('more.contact.title')}>
      <View style={styles.list}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            style={({ pressed }) => [styles.card, pressed && moreShared.pressed]}
            accessibilityRole="button"
            onPress={row.onPress}
          >
            <View style={styles.iconBox}>
              {row.icon ? (
                <HomeIcon name={row.icon} size={20} color={colors.primary} />
              ) : (
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              )}
            </View>
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={styles.desc} numberOfLines={1}>
                {row.desc}
              </Text>
            </View>
            <HomeIcon name="chevronRight" width={7.4} height={12} color={colors.divider} />
          </Pressable>
        ))}
      </View>

      <HotlineSheet
        visible={hotlineOpen}
        onClose={() => setHotlineOpen(false)}
        onCall={(phone) => void openExternal(`tel:${phone}`, fail)}
      />
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    /* 设计稿卡 p20,但内容行固定宽 322 居中 → 左右实际留 24(含 1px 描边) */
    paddingHorizontal: 23,
    paddingVertical: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MENU_ICON_BG,
  },
  /* 设计稿 57.43% × 41.67% 的 48 圆框 */
  logo: { width: 27.57, height: 20 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },
});
