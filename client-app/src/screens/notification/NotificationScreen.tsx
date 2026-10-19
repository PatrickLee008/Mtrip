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
 * 数据:`/app/user/notify/list`(Consumer App PRD 模块 10,后端 shared UserNotify 写入),两个页签各自分页,
 * 文案按 `event_key + params` 用当前语言渲染(没有对应文案的回落到后端存的英文 title/content)。
 * 点卡片:标记已读,订单类跳预订详情(「邀请评价」直接进评价页),申诉结果只标已读。
 * 设计稿里的「新版本」系统通知后端还没有对应事件,不再展示假数据。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchNotifications, markNotifyRead, type NotifyBizType, type NotifyItem } from '@/api/notify';
import { chatSummary, connectChat } from '@/api/chat';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import { formatMoney } from '@/utils/format';

const NOTIFICATION_TABS = ['system', 'booking'] as const;
type NotificationTab = (typeof NOTIFICATION_TABS)[number];
const TAB_BIZ: Record<NotificationTab, NotifyBizType> = { system: 3, booking: 1 };
const PAGE_SIZE = 20;

/** 标题走 `--tertiary` 红色的事件(设计稿「Booking Cancelled」) */
const DANGER_EVENTS = ['booking_cancelled', 'booking_expired'];

interface TabState {
  list: NotifyItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}

const EMPTY_TAB: TabState = { list: [], page: 0, hasMore: true, loading: false, error: false };

export default function NotificationScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currency = useSiteStore((s) => s.currency);
  const isLogin = useUserStore((s) => s.isLogin);
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState<NotificationTab>('booking');
  const [tabs, setTabs] = useState<Record<NotificationTab, TabState>>({ system: EMPTY_TAB, booking: EMPTY_TAB });
  const state = tabs[tab];

  useFocusEffect(
    useCallback(() => {
      if (!isLogin) {
        setUnread(0);
        return undefined;
      }
      let mounted = true;
      const refreshChatSummary = async () => {
        try {
          const summary = await chatSummary();
          if (mounted) setUnread(summary.unread);
        } catch {
          // Notification history remains usable when chat is unavailable.
        }
      };
      void refreshChatSummary();
      const stop = connectChat(
        (event) => {
          if (event.kind !== 'receipt') void refreshChatSummary();
        },
        () => {},
      );
      return () => {
        mounted = false;
        stop();
      };
    }, [isLogin]),
  );

  const loadPage = useCallback(async (which: NotificationTab, page: number) => {
    setTabs((cur) => ({ ...cur, [which]: { ...cur[which], loading: true, error: false } }));
    try {
      const data = await fetchNotifications({ bizType: TAB_BIZ[which], page, pageSize: PAGE_SIZE });
      setTabs((cur) => ({
        ...cur,
        [which]: {
          list: page === 1 ? data.list : [...cur[which].list, ...data.list],
          page,
          hasMore: page * PAGE_SIZE < data.total,
          loading: false,
          error: false,
        },
      }));
    } catch {
      setTabs((cur) => ({ ...cur, [which]: { ...cur[which], loading: false, error: true } }));
    }
  }, []);

  /* 每个页签第一次切到时才拉 */
  useEffect(() => {
    if (state.page === 0 && !state.loading && !state.error) void loadPage(tab, 1);
  }, [tab, state.page, state.loading, state.error, loadPage]);

  /** 按当前语言渲染一条通知;没有 params(旧数据)或没有这个事件的文案,用后端存的英文兜底 */
  const render = (item: NotifyItem): { title: string; body: string } => {
    const key = `notifications.events.${item.event_key}`;
    if (!item.params || !i18n.exists(`${key}.title`)) return { title: item.title, body: item.content };
    const p = item.params;
    const vars: Record<string, string | number> = {
      hotel: String(p.hotel ?? ''),
      orderNo: String(p.orderNo ?? ''),
      checkIn: String(p.checkIn ?? ''),
      checkOut: String(p.checkOut ?? ''),
      amount: p.amount !== undefined ? formatMoney(Number(p.amount), currency) : '',
    };
    /* 取消方 / 申诉结果用各自的子文案 */
    const variant =
      item.event_key === 'booking_cancelled'
        ? String(p.by ?? 'hotel')
        : item.event_key === 'appeal_result'
          ? String(p.result ?? 'rejected')
          : '';
    const bodyKey = variant && i18n.exists(`${key}.body_${variant}`) ? `${key}.body_${variant}` : `${key}.body`;
    return { title: t(`${key}.title`), body: t(bodyKey, vars) };
  };

  const open = (item: NotifyItem) => {
    if (!item.is_read) {
      setTabs((cur) => ({
        ...cur,
        [tab]: { ...cur[tab], list: cur[tab].list.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n)) },
      }));
      void markNotifyRead(item.id).catch(() => undefined);
    }
    if (item.biz_type !== 1 || item.biz_id <= 0) return;
    if (item.event_key === 'review_request') navigation.navigate('WriteReview', { orderId: item.biz_id });
    else navigation.navigate('BookingDetail', { orderId: item.biz_id });
  };

  return (
    <MorePageLayout title={t('notifications.title')}>
      <Pressable style={styles.chatLink} onPress={() => navigation.navigate('Chat')}>
        <Text style={styles.title}>{t('chat.messages')}</Text>
        {unread > 0 ? <Text style={styles.badge}>{unread}</Text> : null}
        <Text style={styles.title}>↗</Text>
      </Pressable>
      <SegmentedTabs
        tabs={NOTIFICATION_TABS}
        value={tab}
        onChange={setTab}
        label={(item) => t(`notifications.tabs.${item}`)}
      />

      {state.list.length === 0 ? (
        state.error ? (
          <Pressable style={styles.state} onPress={() => void loadPage(tab, 1)}>
            <Text style={styles.empty}>{t('notifications.loadFailed')}</Text>
          </Pressable>
        ) : state.loading || state.page === 0 ? (
          <ActivityIndicator style={styles.state} color={colors.primary} />
        ) : (
          <Text style={styles.empty}>{t('notifications.empty')}</Text>
        )
      ) : (
        <View style={styles.list}>
          {state.list.map((item) => {
            const { title, body } = render(item);
            const danger =
              DANGER_EVENTS.includes(item.event_key) ||
              (item.event_key === 'appeal_result' && item.params?.result !== 'approved');
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [moreShared.panel, styles.card, pressed && moreShared.pressed]}
                onPress={() => open(item)}
              >
                <Text style={[styles.title, danger && styles.titleDanger]}>{title}</Text>
                <Text style={styles.body}>{body}</Text>
                <Text style={styles.time}>{item.created_at.slice(0, 16)}</Text>
                {!item.is_read ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
          {state.hasMore ? (
            <Pressable
              style={styles.more}
              disabled={state.loading}
              onPress={() => void loadPage(tab, state.page + 1)}
            >
              {state.loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.moreText}>{t('notifications.loadMore')}</Text>
              )}
            </Pressable>
          ) : null}
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
  time: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  dot: {
    position: 'absolute',
    top: 23,
    right: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  state: { alignItems: 'center', paddingVertical: 24 },
  empty: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: 24,
  },
  more: { alignItems: 'center', paddingVertical: 12 },
  moreText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.primary },
  chatLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#f0f4ff',
    borderRadius: 16,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: colors.primary,
    color: 'white',
    paddingHorizontal: 7,
    borderRadius: 10,
    fontSize: 11,
  },
});
