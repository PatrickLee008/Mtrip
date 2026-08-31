/**
 * 通知(按 Figma M-Trip / Section 9 `1770:3863` 下的两张 Notification 稿实现)
 *
 * 两张稿是同一页的两个页签(`1685:3607` System / `1685:3881` Booking),故落成一页 + 分段页签。
 *
 * 设计稿实测:
 *   顶部栏 返回 + 「Notifications」Outfit 600/24 主色(与「更多」子页同一条,复用 MorePageLayout)
 *   页签   与优惠中心/推荐明细/教程同一枚 SegmentedTabs
 *   通知卡 与其余同壳(`--tab` / 1px `--secondary` / 圆角 32 / padding 24 / DS_AG 投影),卡间距 16
 *          标题 Inter 600/16(系统与「已确认」走主色,「已取消」走 `--tertiary` #EC1317)
 *          正文 Outfit 600/16 `--text-2`
 *          未读点 10 的主色圆,压在卡右上(设计稿 left340/top23 ≈ padding 内的右上角)
 *
 * 后端没有 App 侧的消息接口(只有 merchant-service 有商户通知路由),这里用 notificationDemo.ts
 * 的设计稿数据;点卡片只做本地已读、不发请求。首页/我的精选顶部栏的铃铛改为跳这里。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import SegmentedTabs from '@/components/common/SegmentedTabs';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  NOTIFICATION_TABS,
  NOTIFICATIONS,
  type NotificationTab,
} from '@/screens/notification/notificationDemo';

export default function NotificationScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<NotificationTab>('system');
  /** 后端没有已读接口,已读态只留在本页面 */
  const [read, setRead] = useState<string[]>([]);

  const list = NOTIFICATIONS.filter((item) => item.tab === tab);

  return (
    <MorePageLayout title={t('notifications.title')}>
      <SegmentedTabs
        tabs={NOTIFICATION_TABS}
        value={tab}
        onChange={setTab}
        label={(item) => t(`notifications.tabs.${item}`)}
      />

      {list.length === 0 ? (
        <Text style={styles.empty}>{t('notifications.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {list.map((item) => {
            const unread = !read.includes(item.key);
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [moreShared.panel, styles.card, pressed && moreShared.pressed]}
                onPress={() => setRead((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]))}
              >
                <Text style={[styles.title, item.tone === 'danger' && styles.titleDanger]}>
                  {t(`notifications.items.${item.key}.title`)}
                </Text>
                <Text style={styles.body}>{t(`notifications.items.${item.key}.body`)}</Text>
                {unread ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  card: { gap: 8 },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
    opacity: 0.9,
    /* 给右上角的未读点留位,避免长标题压到它 */
    paddingRight: 18,
  },
  titleDanger: { color: colors.hot },
  /* 设计稿正文用的是 Outfit 600(不是正文常用的 Inter) */
  body: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  dot: {
    position: 'absolute',
    top: 23,
    right: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  empty: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: 24,
  },
});
