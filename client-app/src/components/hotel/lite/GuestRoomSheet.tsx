/**
 * 「Edit Room & Guest」浮层(Figma `Hotel Search Lite` 的 `2516:14575`)
 *
 * 关怀模式搜索页点「Guests」那一栏拉起:房间 / 成人 / 儿童三行加减 + Save。
 * 加减行直接复用订房向导的 `GuestCounterRow`(设计稿这三行与 1675:6180 逐项同构:
 * 标题 + 说明 + 40 圆减号 / 数字 / 40 圆加号),不另写一套。
 *
 * 设计稿实测:
 *   卡片   白底圆角 16,头部 padding 16 居中标题 Inter 700/20,左 X(20)、右 Reset(--text-2 16)
 *   主体   三行,行间 1px 分隔线(由 GuestCounterRow 的 divider 画)
 *   CTA    主色圆角 12,py16,Inter 600/16 白色,左右各 24 的外边距
 *
 * 交互按项目既有浮层模式(SelectSheet / DatePickerSheet):RN 自带 Modal + Animated,
 * 关闭动画播完才卸载;遮罩黑 25%,点遮罩 = 取消(不落值)。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import GuestCounterRow from '@/components/hotel/booking/GuestCounterRow';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 房间 / 成人 / 儿童三件套,搜索页与结果页共用同一个形状 */
export interface GuestRoomValue {
  rooms: number;
  adults: number;
  children: number;
}

export const DEFAULT_GUEST_ROOM: GuestRoomValue = { rooms: 1, adults: 2, children: 0 };

interface Props {
  visible: boolean;
  value: GuestRoomValue;
  onClose: () => void;
  onConfirm: (value: GuestRoomValue) => void;
}

export default function GuestRoomSheet({ visible, value, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(visible);
  const [draft, setDraft] = useState<GuestRoomValue>(value);
  const anim = useRef(new Animated.Value(0)).current;

  /* 每次打开都从外部值重新起草:上次点了取消的话,草稿不该留着 */
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <HomeIcon name="close" size={20} color={colors.body} />
            </Pressable>
            <Text style={styles.title}>{t('hotels.lite.guestSheet.title')}</Text>
            <Pressable onPress={() => setDraft(DEFAULT_GUEST_ROOM)} hitSlop={10}>
              <Text style={styles.reset}>{t('hotels.lite.guestSheet.reset')}</Text>
            </Pressable>
          </View>

          <GuestCounterRow
            title={t('hotels.lite.guestSheet.room')}
            hint={t('hotels.lite.guestSheet.roomHint')}
            value={draft.rooms}
            min={1}
            max={9}
            solidPlus
            onChange={(rooms) => setDraft((prev) => ({ ...prev, rooms }))}
          />
          <GuestCounterRow
            title={t('hotels.lite.guestSheet.adults')}
            hint={t('hotels.lite.guestSheet.adultsHint')}
            value={draft.adults}
            min={1}
            max={30}
            solidPlus
            divider
            onChange={(adults) => setDraft((prev) => ({ ...prev, adults }))}
          />
          <GuestCounterRow
            title={t('hotels.lite.guestSheet.children')}
            hint={t('hotels.lite.guestSheet.childrenHint')}
            value={draft.children}
            min={0}
            max={10}
            solidPlus
            divider
            onChange={(children) => setDraft((prev) => ({ ...prev, children }))}
          />

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={() => onConfirm(draft)}
            >
              <Text style={styles.ctaText}>{t('hotels.lite.guestSheet.save')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  title: { flex: 1, fontFamily: fonts.interBold, fontSize: 20, lineHeight: 28, color: colors.heading, textAlign: 'center' },
  reset: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },

  footer: { padding: 24 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
});
