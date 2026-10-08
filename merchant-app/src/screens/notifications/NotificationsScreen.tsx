import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { apiGuestMessage, apiGuestThread, apiNotificationClear, apiNotificationDestination, apiNotificationList, apiNotificationRead, apiNotificationSummary } from '@/api/merchant';
import type { GuestThread, NotificationItem, NotificationSummary } from '@/api/types';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';

type Filter = 'all' | 'unread' | 'bookings';
type IconName = 'back' | 'more' | 'check' | 'trash' | 'booking' | 'message' | 'alert' | 'bell';
const paths: Record<IconName, string> = {
  back: 'm15 18-6-6 6-6', more: 'M12 5h.01M12 12h.01M12 19h.01',
  check: 'm5 12 4 4L19 6', trash: 'M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5',
  booking: 'M4 7h16v14H4V7Zm0 4h16M8 3v6m8-6v6', message: 'M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5',
  alert: 'M12 8v5m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4',
};
function Icon({ name, color = '#64748B', size = 20 }: { name: IconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={paths[name]} stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function iconFor(category: string): IconName {
  return category === 'booking' ? 'booking' : category === 'support' ? 'message' : category === 'system' || category === 'security' ? 'alert' : 'bell';
}
function notificationTime(raw: string | null, language: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!raw) return '';
  const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return raw;
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return t('notification.justNow');
  if (minutes < 60) return t('notification.minutesAgo', { count: minutes });
  if (minutes < 1440) return t('notification.hoursAgo', { count: Math.floor(minutes / 60) });
  if (minutes < 2880) return t('notification.yesterday');
  return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(date);
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const profile = useMerchantStore((s) => s.profile);
  const canRead = !!profile && (profile.isOwner || profile.permissions.includes('mch:notifications:read'));
  const canViewBooking = !!profile && (profile.isOwner || profile.permissions.includes('mch:order:detail'));
  const canMessage = !!profile && (profile.isOwner || profile.permissions.includes('mch:order:message'));
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({ total: 0, unread: 0, categories: {} });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [active, setActive] = useState<NotificationItem | null>(null);
  const [detailView, setDetailView] = useState<'notice' | 'reply'>('notice');
  const [detailLoading, setDetailLoading] = useState(false);
  const [thread, setThread] = useState<GuestThread | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const readIds = useRef(new Set<number>());

  const load = useCallback(async (nextPage = 1) => {
    const current = ++requestId.current;
    if (nextPage === 1) setLoading(true); else setLoadingMore(true);
    setFailed(false);
    try {
      const [result, nextSummary] = await Promise.all([apiNotificationList(nextPage, filter), nextPage === 1 ? apiNotificationSummary() : Promise.resolve(null)]);
      if (current !== requestId.current) return;
      setItems((previous) => nextPage === 1 ? result.list : [...previous, ...result.list]);
      setPage(nextPage);
      setTotal(result.total);
      if (nextSummary) setSummary(nextSummary);
    } catch {
      if (current === requestId.current) setFailed(true);
    } finally {
      if (current === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [filter]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]));

  const markRead = async (item: NotificationItem) => {
    if (item.is_read || !canRead || readIds.current.has(item.id)) return;
    readIds.current.add(item.id);
    try {
      await apiNotificationRead(item.id);
      setItems((previous) => previous.map((row) => row.id === item.id ? { ...row, is_read: true } : row));
      setSummary((previous) => ({ ...previous, unread: Math.max(0, previous.unread - 1) }));
      if (filter === 'unread') await load();
    } catch { readIds.current.delete(item.id); /* The request layer reports the error. */ }
  };
  const openNotice = (item: NotificationItem) => {
    detailRequestId.current++;
    setDetailLoading(false);
    setReply('');
    setActive(item);
    setDetailView('notice');
    setThread(null);
    void markRead(item);
  };
  const actionFor = (item: NotificationItem): 'booking' | 'reply' | null => {
    if (item.deep_link_type !== 'booking_detail' || !/^\d+$/.test(item.deep_link_value)) return null;
    if (item.category === 'support' && canMessage) return 'reply';
    return canViewBooking ? 'booking' : null;
  };
  const openAction = async (item: NotificationItem) => {
    const action = actionFor(item);
    if (!action) return;
    openNotice(item);
    const current = detailRequestId.current;
    setDetailLoading(true);
    try {
      const destination = await apiNotificationDestination(item.id);
      const orderId = Number(destination.query.notificationTarget);
      if (destination.path !== '/order' || !Number.isSafeInteger(orderId) || orderId <= 0) throw new Error(t('notification.unavailable'));
      if (action === 'booking') {
        if (current !== detailRequestId.current) return;
        setActive(null);
        navigation.navigate('BookingDetail', { orderId, propertyId: 0 });
      } else {
        const result = await apiGuestThread(orderId);
        if (current !== detailRequestId.current) return;
        setThread(result); setDetailView('reply');
      }
    } catch (error) {
      if (current === detailRequestId.current) showToast(error instanceof Error ? error.message : t('notification.unavailable'));
    } finally { if (current === detailRequestId.current) setDetailLoading(false); }
  };
  const sendReply = async () => {
    if (!active || !reply.trim() || sending) return;
    setSending(true);
    try {
      const orderId = Number(active.deep_link_value);
      await apiGuestMessage(orderId, reply.trim());
      setThread(await apiGuestThread(orderId));
      setReply('');
    } catch { /* The request layer reports the error. */ }
    finally { setSending(false); }
  };
  const markAll = async () => {
    setMenuOpen(false);
    if (!canRead || actionBusy || summary.unread === 0) return;
    setActionBusy(true);
    try { await apiNotificationRead(); await load(); }
    catch { /* The request layer reports the error. */ }
    finally { setActionBusy(false); }
  };
  const clearAll = async () => {
    if (!canRead || actionBusy) return;
    setActionBusy(true);
    try { await apiNotificationClear(); setClearConfirm(false); await load(); }
    catch { /* The request layer reports the error. */ }
    finally { setActionBusy(false); }
  };
  const closeDetail = () => { if (!sending) { detailRequestId.current++; setActive(null); setReply(''); } };

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <StatusBar style="dark" translucent backgroundColor="transparent" />
    <View style={styles.shell}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button"><Icon name="back" size={24} /><Text style={styles.backText}>{t('notification.back')}</Text></Pressable>
        <Text style={styles.headerTitle}>{t('notification.title')}</Text>
        <Pressable style={styles.more} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t('notification.actions')}><Icon name="more" size={22} color="#1E293B" /></Pressable>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={() => void load()} tintColor={colors.primary} />} contentContainerStyle={styles.content}>
        <View style={styles.filters}>{(['all', 'unread', 'bookings'] as const).map((key) => <Pressable key={key} style={[styles.filter, filter === key && styles.filterActive]} onPress={() => setFilter(key)} accessibilityRole="button" accessibilityState={{ selected: filter === key }}><Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{key === 'unread' ? t('notification.unreadTab', { count: summary.unread }) : t(`notification.${key}`)}</Text></Pressable>)}</View>
        <View style={styles.countRow}><View style={styles.countDot} /><Text style={styles.countText}>{t('notification.unreadCount', { count: summary.unread })}</Text></View>
        {loading && items.length === 0 ? <ActivityIndicator style={styles.center} color={colors.primary} /> : null}
        {failed && items.length === 0 ? <Pressable style={styles.center} onPress={() => void load()}><Text style={styles.emptyText}>{t('notification.loadFailed')}</Text></Pressable> : null}
        {!loading && !failed && items.length === 0 ? <View style={styles.center}><Icon name="bell" size={30} /><Text style={styles.emptyText}>{t('notification.empty')}</Text></View> : null}
        {items.map((item) => {
          const icon = iconFor(item.category);
          const action = actionFor(item);
          return <Pressable key={item.id} style={[styles.card, !item.is_read && styles.cardUnread]} onPress={() => openNotice(item)} accessibilityRole="button">
            <View style={[styles.iconCircle, icon === 'alert' && styles.alertCircle]}><Icon name={icon} size={22} color={icon === 'alert' ? '#DC3943' : colors.primary} /></View>
            <View style={styles.cardBody}>
              <View style={styles.titleRow}><View style={styles.titleGroup}>{!item.is_read ? <View style={styles.unreadDot} /> : null}<Text style={[styles.cardTitle, item.is_read && styles.cardTitleRead]} numberOfLines={1}>{item.title}</Text></View><Text style={styles.time}>{notificationTime(item.send_at || item.created_at, i18n.language, t)}</Text></View>
              <Text style={styles.preview} numberOfLines={1}>{item.message}</Text>
              {action ? <Pressable style={styles.actionButton} onPress={(event) => { event.stopPropagation(); void openAction(item); }} accessibilityRole="button"><Text style={styles.actionButtonText}>{t(action === 'reply' ? 'notification.reply' : 'notification.viewBooking')}</Text></Pressable> : null}
            </View>
          </Pressable>;
        })}
        {items.length < total ? <Pressable style={styles.loadMore} disabled={loadingMore} onPress={() => void load(page + 1)}><Text style={styles.loadMoreText}>{loadingMore ? t('notification.loading') : t('notification.loadMore')}</Text></Pressable> : null}
      </ScrollView>
    </View>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><View style={styles.modalOverlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} /><View style={[styles.actionMenu, { top: insets.top + 57 }]}>
      <Pressable style={styles.menuRow} disabled={!canRead || actionBusy || summary.unread === 0} onPress={() => void markAll()}><View style={styles.menuIcon}><Icon name="check" size={16} /></View><Text style={styles.menuText}>{t('notification.markAllRead')}</Text></Pressable>
      <View style={styles.menuDivider} />
      <Pressable style={styles.menuRow} disabled={!canRead || actionBusy || summary.total === 0} onPress={() => { setMenuOpen(false); setClearConfirm(true); }}><View style={styles.menuIcon}><Icon name="trash" size={16} /></View><Text style={styles.menuText}>{t('notification.clearAll')}</Text></Pressable>
    </View></View></Modal>
    <Modal visible={clearConfirm} transparent animationType="fade" onRequestClose={() => { if (!actionBusy) setClearConfirm(false); }}><View style={styles.confirmOverlay}><View style={styles.confirmCard}><Text style={styles.confirmTitle}>{t('notification.clearTitle')}</Text><Text style={styles.confirmCopy}>{t('notification.clearCopy')}</Text><View style={styles.confirmButtons}><Pressable style={styles.cancelButton} disabled={actionBusy} onPress={() => setClearConfirm(false)}><Text style={styles.cancelText}>{t('notification.cancel')}</Text></Pressable><Pressable style={styles.clearButton} disabled={actionBusy} onPress={() => void clearAll()}><Text style={styles.clearText}>{actionBusy ? t('notification.loading') : t('notification.clearAll')}</Text></Pressable></View></View></View></Modal>
    <Modal visible={!!active} transparent animationType="slide" onRequestClose={closeDetail}><View style={styles.detailOverlay}><View style={[styles.detailSheet, { paddingBottom: 20 + insets.bottom }]}><View style={styles.detailHeader}><Text style={styles.detailTitle}>{detailView === 'reply' ? t('notification.guestMessage') : active?.title}</Text><Pressable onPress={closeDetail} accessibilityRole="button"><Text style={styles.closeText}>{t('notification.close')}</Text></Pressable></View>
      {detailLoading ? <ActivityIndicator style={styles.center} color={colors.primary} /> : null}
      {!detailLoading && detailView === 'notice' && active ? <ScrollView><Text style={styles.detailTime}>{notificationTime(active.send_at || active.created_at, i18n.language, t)}</Text><Text style={styles.detailCopy}>{active.message}</Text>{actionFor(active) ? <Pressable style={styles.detailAction} onPress={() => void openAction(active)}><Text style={styles.detailActionText}>{t(actionFor(active) === 'reply' ? 'notification.reply' : 'notification.viewBooking')}</Text></Pressable> : null}</ScrollView> : null}
      {!detailLoading && detailView === 'reply' && thread ? <><Text style={styles.detailTime}>{thread.guestName}</Text><ScrollView style={styles.messages}>{thread.messages.map((message) => <View key={message.id} style={[styles.message, message.sender_type === 2 && styles.ownMessage]}><Text style={styles.messageText}>{message.content}</Text></View>)}</ScrollView><View style={styles.replyRow}><TextInput style={styles.replyInput} value={reply} onChangeText={setReply} placeholder={t('notification.replyPlaceholder')} multiline maxLength={2000} editable={thread.status !== 1 && !sending} /><Pressable style={styles.sendButton} disabled={thread.status === 1 || !reply.trim() || sending} onPress={() => void sendReply()}><Text style={styles.sendText}>{t('notification.send')}</Text></Pressable></View>{thread.status === 1 ? <Text style={styles.closedText}>{t('notification.threadClosed')}</Text> : null}</> : null}
    </View></View></Modal>
  </SafeAreaView>;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' }, shell: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#FFFFFF' },
  header: { height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { flexDirection: 'row', alignItems: 'center', width: 90 }, backText: { fontFamily: fonts.interMedium, fontSize: 14, color: '#64748B' },
  headerTitle: { fontFamily: fonts.outfitBold, fontSize: 18, color: '#1E293B' }, more: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5EAF0', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 28 }, filters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 },
  filter: { minHeight: 38, borderRadius: 21, backgroundColor: '#E8EDF3', justifyContent: 'center', paddingHorizontal: 16 }, filterActive: { backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: colors.primary },
  filterText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#64748B' }, filterTextActive: { color: colors.primary },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 19, marginBottom: 12 }, countDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, countText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#64748B' },
  card: { flexDirection: 'row', gap: 12, padding: 15, marginBottom: 16, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EE' }, cardUnread: { backgroundColor: '#E7F4EC', borderColor: '#E7F4EC' },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, alertCircle: { backgroundColor: '#FCE5E8' },
  cardBody: { flex: 1, minWidth: 0 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 }, titleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardTitle: { flex: 1, fontFamily: fonts.interBold, fontSize: 13, color: '#1E293B' }, cardTitleRead: { color: '#64748B' }, time: { fontFamily: fonts.interMedium, fontSize: 10, color: colors.primary },
  preview: { marginTop: 8, fontFamily: fonts.inter, fontSize: 12, color: '#475569' }, actionButton: { alignSelf: 'flex-start', marginTop: 11, minHeight: 35, paddingHorizontal: 14, borderRadius: 7, backgroundColor: colors.primary, justifyContent: 'center' }, actionButtonText: { fontFamily: fonts.interSemi, color: '#FFFFFF', fontSize: 12 },
  center: { marginTop: 48, alignItems: 'center', gap: 14 }, emptyText: { fontFamily: fonts.inter, fontSize: 14, color: '#64748B', textAlign: 'center' }, loadMore: { padding: 14, alignItems: 'center' }, loadMoreText: { fontFamily: fonts.interSemi, color: colors.primary },
  modalOverlay: { flex: 1 }, actionMenu: { position: 'absolute', right: 16, width: 230, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAF0', overflow: 'hidden', elevation: 8, shadowColor: '#000000', shadowOpacity: 0.13, shadowRadius: 12 }, menuRow: { height: 53, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15 }, menuIcon: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#E5EAF0', alignItems: 'center', justifyContent: 'center' }, menuText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#1E293B' }, menuDivider: { height: 1, backgroundColor: '#E5EAF0' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(19, 33, 48, 0.4)', justifyContent: 'center', paddingHorizontal: 22 }, confirmCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 18 }, confirmTitle: { fontFamily: fonts.outfitBold, fontSize: 19, color: '#1E293B' }, confirmCopy: { marginTop: 10, fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: '#475569' }, confirmButtons: { flexDirection: 'row', gap: 10, marginTop: 22 }, cancelButton: { flex: 1, height: 42, borderRadius: 9, borderWidth: 1, borderColor: '#CBD5DF', alignItems: 'center', justifyContent: 'center' }, cancelText: { fontFamily: fonts.interSemi, color: '#475569' }, clearButton: { flex: 1, height: 42, borderRadius: 9, backgroundColor: '#B74343', alignItems: 'center', justifyContent: 'center' }, clearText: { fontFamily: fonts.interSemi, color: '#FFFFFF' },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(19, 33, 48, 0.4)', justifyContent: 'flex-end' }, detailSheet: { maxHeight: '82%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }, detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, detailTitle: { flex: 1, fontFamily: fonts.outfitBold, fontSize: 18, color: '#1E293B' }, closeText: { fontFamily: fonts.interSemi, color: colors.primary }, detailTime: { marginTop: 8, fontFamily: fonts.interMedium, fontSize: 12, color: '#64748B' }, detailCopy: { marginTop: 18, fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: '#1E293B' }, detailAction: { alignSelf: 'flex-start', marginTop: 22, paddingHorizontal: 18, height: 40, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center' }, detailActionText: { fontFamily: fonts.interSemi, color: '#FFFFFF' },
  messages: { marginTop: 16, minHeight: 80 }, message: { alignSelf: 'flex-start', maxWidth: '86%', padding: 11, borderRadius: 11, backgroundColor: '#F1F5F9', marginBottom: 8 }, ownMessage: { alignSelf: 'flex-end', backgroundColor: '#DDF7EF' }, messageText: { fontFamily: fonts.inter, fontSize: 13, color: '#1E293B' }, replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 }, replyInput: { flex: 1, minHeight: 42, maxHeight: 110, borderWidth: 1, borderColor: '#CBD5DF', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.inter }, sendButton: { height: 42, paddingHorizontal: 12, backgroundColor: colors.primary, borderRadius: 9, justifyContent: 'center' }, sendText: { fontFamily: fonts.interSemi, color: '#FFFFFF' }, closedText: { marginTop: 8, fontFamily: fonts.inter, color: '#64748B', fontSize: 12 },
});
