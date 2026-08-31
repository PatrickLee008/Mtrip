/**
 * 常用旅客(按 Figma M-Trip / More `1797:4324` Traveler 实现)
 *
 * 一张 1px `--secondary`、圆角 20、padding 25 的卡:
 *   标题行 「Select Guest (n/3)」Inter 700/16 `#0B1C30` + 右侧 12 的关闭叉
 *   旅客行 圆角 20、padding 17、1px `--secondary`、Effect/DS 投影;
 *          40 圆(`#DDE1FF` 底 + 16 小人)+ 姓名 Inter 700/16 + 右侧 24 编辑 / 24 勾选
 *   末尾   「Add New Guest」同款行(文字 `--text-2` 居中偏左)+ 主色 Done 按钮(圆角 8、py8)
 *
 * 后端没有常用旅客接口(order 的 guests 字段只存在订单里),这里用本地状态演示勾选,
 * 新增/编辑/Done 一律 comingSoon;关闭叉退回上一页。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

/** 设计稿一次最多选 3 位同行人 */
const MAX_GUESTS = 3;

export default function TravelersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  /** 设计稿画了三行同名旅客;没有接口,先用当前账号昵称占位 */
  const travelers = [
    { key: 'g1', name: profile?.nickname || profile?.mobile || t('more.travelers.guest') },
  ];
  const [selected, setSelected] = useState<string[]>([]);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_GUESTS) {
        showToast(t('more.travelers.maxReached', { max: MAX_GUESTS }));
        return prev;
      }
      return [...prev, key];
    });
  };

  return (
    <MorePageLayout title={t('more.travelers.title')} showVersion>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>
            {t('more.travelers.selectGuest', { count: selected.length, max: MAX_GUESTS })}
          </Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <HomeIcon name="close" size={12} color={colors.textSoft} />
          </Pressable>
        </View>

        {travelers.map((traveler) => {
          const checked = selected.includes(traveler.key);
          return (
            <Pressable
              key={traveler.key}
              style={({ pressed }) => [styles.row, pressed && moreShared.pressed]}
              onPress={() => toggle(traveler.key)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.avatar}>
                  <HomeIcon name="personSmall" size={16} color="#204DDA" />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {traveler.name}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Pressable onPress={comingSoon} hitSlop={6}>
                  <HomeIcon name="personEdit" size={24} color={colors.textSoft} />
                </Pressable>
                <HomeIcon
                  name={checked ? 'checkboxIndeterminate' : 'checkbox'}
                  size={24}
                  color={checked ? colors.primary : colors.body}
                />
              </View>
            </Pressable>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.row, styles.addRow, pressed && moreShared.pressed]}
          onPress={comingSoon}
        >
          <Text style={styles.addText}>{t('more.travelers.addGuest')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && moreShared.pressed]}
          onPress={comingSoon}
        >
          <Text style={styles.doneText}>{t('more.travelers.done')}</Text>
        </Pressable>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  /* 设计稿这张卡的圆角是 20、padding 25,与其余页的 32/24 不同 */
  card: {
    gap: 24,
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headTitle: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: '#0B1C30',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  rowLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    /* 设计稿旅客头像底色,仅此一处 */
    backgroundColor: '#DDE1FF',
  },
  name: { flexShrink: 1, fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  addRow: { justifyContent: 'center' },
  addText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.textSoft },

  doneBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  doneText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.tintBg,
  },
});
