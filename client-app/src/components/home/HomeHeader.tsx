/**
 * 首页顶部栏(Figma `Header - TopAppBar` node 81:2733)
 *
 * 设计稿实测:402x47,左右 padding 16、上下 4,SPACE_BETWEEN。
 *   左:mTrip 字标(图片填充 48x39,设计稿里的 "mTrip" 文本节点 visible=false,故用位图)
 *   右:Frame 56(gap 10)= 积分胶囊 62x32 r8 主色 10% + 消息按钮 36x36 圆形
 * 铃铛右上角的未读点:登录后每次页面获焦读一次 `/user/notify/unread-count`(设计稿没画,按通知页的未读点同色同尺寸补)。
 */

import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { fetchNotifyUnread } from '@/api/notify';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useUserStore } from '@/store/userStore';

const LOGO = require('../../../assets/images/logo.png');

interface Props {
  /** 积分值,未登录时传 0 */
  points: number;
  onPressPoints: () => void;
  onPressMessage: () => void;
}

export default function HomeHeader({ points, onPressPoints, onPressMessage }: Props) {
  const isLogin = useUserStore((s) => s.isLogin);
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!isLogin) {
        setUnread(0);
        return;
      }
      let alive = true;
      fetchNotifyUnread()
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [isLogin]),
  );

  return (
    <View style={styles.header}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      <View style={styles.right}>
        <Pressable style={styles.pill} onPress={onPressPoints} hitSlop={4}>
          <HomeIcon name="diamond" size={16} color={colors.primary} />
          <Text style={styles.pillText}>{points}</Text>
        </Pressable>

        <Pressable style={styles.msgBtn} onPress={onPressMessage} hitSlop={4}>
          <HomeIcon name="bell" size={20} color={colors.primary} />
          {unread > 0 ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  logo: { width: 48, height: 39 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    minWidth: 62,
    height: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    /* 设计稿为主色 #4169ED 10% 透明度 */
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  pillText: {
    fontFamily: fonts.interMedium,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.primary,
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: colors.hot,
  },
  msgBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
