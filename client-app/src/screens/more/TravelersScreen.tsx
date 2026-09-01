/**
 * 常用旅客(按 Figma M-Trip / More `1797:4324` Traveler 实现)
 *
 * 一张 1px `--secondary`、圆角 20、padding 25 的卡:
 *   标题行 「Select Guest (n/3)」Inter 700/16 `#0B1C30` + 右侧 12 的关闭叉
 *   旅客行 圆角 20、padding 17、1px `--secondary`、Effect/DS 投影;
 *          40 圆(`#DDE1FF` 底 + 16 小人)+ 姓名 Inter 700/16 + 右侧 24 编辑 / 24 勾选
 *   末尾   「Add New Guest」同款行(文字 `--text-2` 居中)+ 主色 Done 按钮(圆角 8、py8)
 *
 * **已接后端**:`user-service` 的 `/api/v1/app/user/traveler/list`(`TravelerController`);
 * 新增 / 编辑 / 删除都在 `AddGuest` 页完成,回到本页时自动重拉列表。
 * 该接口挂在 `UserAuthMiddleware` 下,未登录先引导登录。
 *
 * 设计稿的姓名行只有一行,这里补了一条副行(证件类型 + 脱敏证件号)与「默认」角标 ——
 * 同名旅客靠证件号才分得清,设计稿没画是因为它用的是假数据。
 *
 * 两种进入方式:
 *   **管理模式**(更多 → 账号 → Traveler):设计稿的「Select Guest (n/3)」多选态,目前没有消费方,
 *     选中只停在本页,Done 关闭页面。
 *   **选择模式**(订房第 2 步的 Select,带 `pick: true`):主要入住人只有一位,多选会误导,
 *     故隐藏勾选框、**点一行即选中并返回**,用 `navigate(..., merge: true)` 把姓名合并回 `HotelBooking` 的参数。
 *     只回传姓名 —— `user_traveler` 没有联系方式列,`/app/user/me` 的手机号与邮箱又是脱敏的,
 *     拿不到可直接提交的原值,电话/邮箱仍由用户自己填。
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchTravelerList } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { TRAVELER_ID_TYPE_I18N } from '@/config/global';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import type { TravelerItem } from '@/types/models';

/** 设计稿一次最多选 3 位同行人 */
const MAX_GUESTS = 3;

export default function TravelersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Travelers'>>();
  /** 订房第 2 步进来的「选择主要入住人」模式 */
  const pick = route.params?.pick === true;
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  const [list, setList] = useState<TravelerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!isLogin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setList(await fetchTravelerList());
    } catch {
      /* request.ts 已统一 Toast 过错误,这里落到空列表即可 */
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [isLogin]);

  /* 从 AddGuest 保存 / 删除回来要看到最新列表,所以用 focus 而不是 mount */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** 选择模式:把姓名合并回订房向导的路由参数,并弹回已在栈里的 HotelBooking */
  const applyAsLeadGuest = (item: TravelerItem) => {
    navigation.navigate({
      name: 'HotelBooking',
      params: { leadGuest: { firstName: item.first_name, lastName: item.last_name } },
      merge: true,
    });
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((k) => k !== id);
      if (prev.length >= MAX_GUESTS) {
        showToast(t('more.travelers.maxReached', { max: MAX_GUESTS }));
        return prev;
      }
      return [...prev, id];
    });
  };

  const openEditor = (traveler?: TravelerItem) => {
    if (!isLogin) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('AddGuest', traveler ? { traveler } : undefined);
  };

  /** 姓名:后端分 first_name / last_name 两列,都为空时退回占位文案 */
  const fullName = (item: TravelerItem) =>
    [item.first_name, item.last_name].filter(Boolean).join(' ') || t('more.travelers.guest');

  const subtitle = (item: TravelerItem) => {
    const type = t(TRAVELER_ID_TYPE_I18N[item.id_type] ?? TRAVELER_ID_TYPE_I18N[2]);
    return item.id_no ? `${type} · ${item.id_no}` : type;
  };

  const renderBody = () => {
    if (!isLogin) {
      return (
        <Pressable
          style={({ pressed }) => [styles.row, styles.addRow, pressed && moreShared.pressed]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.addText}>{t('user.notLogin')}</Text>
        </Pressable>
      );
    }
    if (loading) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!list.length) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.emptyText}>{t('more.travelers.empty')}</Text>
        </View>
      );
    }
    return list.map((item) => {
      const checked = selected.includes(item.id);
      return (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.row, pressed && moreShared.pressed]}
          onPress={() => (pick ? applyAsLeadGuest(item) : toggle(item.id))}
        >
          <View style={styles.rowLeft}>
            <View style={styles.avatar}>
              <HomeIcon name="personSmall" size={16} color="#204DDA" />
            </View>
            <View style={styles.nameBox}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {fullName(item)}
                </Text>
                {item.is_default === 1 ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>{t('more.travelers.default')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.sub} numberOfLines={1}>
                {subtitle(item)}
              </Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Pressable onPress={() => openEditor(item)} hitSlop={6}>
              <HomeIcon name="personEdit" size={24} color={colors.textSoft} />
            </Pressable>
            {pick ? null : (
              <HomeIcon
                name={checked ? 'checkboxIndeterminate' : 'checkbox'}
                size={24}
                color={checked ? colors.primary : colors.body}
              />
            )}
          </View>
        </Pressable>
      );
    });
  };

  return (
    <MorePageLayout title={t('more.travelers.title')} showVersion>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>
            {pick
              ? t('more.travelers.pickTitle')
              : t('more.travelers.selectGuest', { selected: selected.length, max: MAX_GUESTS })}
          </Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <HomeIcon name="close" size={12} color={colors.textSoft} />
          </Pressable>
        </View>

        {renderBody()}

        <Pressable
          style={({ pressed }) => [styles.row, styles.addRow, pressed && moreShared.pressed]}
          onPress={() => openEditor()}
        >
          <Text style={styles.addText}>{t('more.travelers.addGuest')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && moreShared.pressed]}
          onPress={() => navigation.goBack()}
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

  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  emptyText: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSoft,
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
  nameBox: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.tintBg,
  },
  defaultText: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    lineHeight: 14,
    color: colors.primary,
  },
  sub: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.textSoft },
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
