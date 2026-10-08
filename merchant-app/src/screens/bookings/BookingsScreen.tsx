import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { apiBookings } from '@/api/merchant';
import type { BookingOrder, PaymentFilter } from '@/api/types';
import { useMerchantStore } from '@/store/merchantStore';
import { useCommonStore } from '@/store/commonStore';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BookingBadges, BookingButton, BookingIcon, ui } from './BookingUi';
import { bookingDate, bookingMoney, bookingNights, hasBookingPermission } from './bookingHelpers';

export default function BookingsScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const profile = useMerchantStore((s) => s.profile);
  const propertyId = useMerchantStore((s) => s.propertyId);
  const showToast = useCommonStore((s) => s.showToast);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [statuses, setStatuses] = useState<number[]>([]);
  const [payments, setPayments] = useState<PaymentFilter[]>([]);
  const [draftStatuses, setDraftStatuses] = useState<number[]>([]);
  const [draftPayments, setDraftPayments] = useState<PaymentFilter[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<BookingOrder[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const canList = hasBookingPermission(profile, 'list');
  const canDetail = hasBookingPermission(profile, 'detail');
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (nextPage = 1) => {
    const current = ++requestId.current;
    inFlight.current = true;
    setLoading(true); setFailed(false);
    if (nextPage === 1) { setItems([]); setTotal(0); setPage(1); }
    if (!canList) { setLoading(false); inFlight.current = false; return; }
    try {
      const result = await apiBookings(propertyId, nextPage, q, statuses, payments);
      if (current !== requestId.current) return;
      setItems((previous) => nextPage === 1 ? result.list : [...previous, ...result.list]);
      setPage(result.page); setTotal(result.total);
    } catch { if (current === requestId.current) setFailed(true); }
    finally { if (current === requestId.current) { setLoading(false); inFlight.current = false; } }
  }, [propertyId, q, statuses, payments, canList]);
  useFocusEffect(useCallback(() => { void load(); return () => { requestId.current++; inFlight.current = false; }; }, [load]));
  const openDetail = (order: BookingOrder, action?: 'check-in' | 'check-out') => navigation.navigate('BookingDetail', { orderId: order.id, propertyId, action });
  const toggleStatus = (value: number) => setDraftStatuses((previous) => previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]);
  const togglePayment = (value: PaymentFilter) => setDraftPayments((previous) => previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]);

  return <SafeAreaView style={ui.root} edges={['top', 'bottom']}><StatusBar style="dark" /><View style={ui.shell}>
    <View style={ui.header}><Text style={ui.title}>{t('bookings.title')}</Text><Pressable style={ui.iconButton} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel={t('dashboardHome.notifications')}><BookingIcon name="bell" /></Pressable></View>
    <View style={styles.searchRow}><View style={styles.search}><BookingIcon name="search" size={18} /><TextInput style={styles.searchInput} placeholder={t('bookings.search')} placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={() => setQ(search.trim())} accessibilityLabel={t('bookings.search')} /></View><Pressable style={[ui.iconButton, !!(statuses.length + payments.length) && styles.activeFilter]} accessibilityRole="button" accessibilityLabel={t('bookings.filters')} onPress={() => { setDraftStatuses([...statuses]); setDraftPayments([...payments]); setFilterOpen(true); }}><BookingIcon name="filter" color={statuses.length + payments.length ? colors.primary : '#64748B'} /></Pressable></View>
    <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={() => void load()} tintColor={colors.primary} />}>
      {!canList ? <Text style={ui.text}>{t('bookings.noPermission')}</Text> : null}
      {loading && !items.length ? <ActivityIndicator style={styles.empty} color={colors.primary} /> : null}
      {failed ? <BookingButton title={t('bookings.retry')} onPress={() => void load(items.length ? page + 1 : 1)} tone="outline" /> : null}
      {!loading && !failed && canList && !items.length ? <View style={styles.empty}><BookingIcon name="bookings" size={40} /><Text style={styles.emptyTitle}>{t(q || statuses.length || payments.length ? 'bookings.noResults' : 'bookings.empty')}</Text></View> : null}
      {items.map((order) => {
        const status = Number(order.booking_status);
        const action = status === 2 ? 'check-in' : status === 3 ? 'check-out' : null;
        const canAct = canDetail && !!action && hasBookingPermission(profile, action) && !!order.availableActions?.includes(action);
        return <View style={ui.card} key={order.id}><View style={ui.row}><Text style={styles.guest} numberOfLines={2}>{order.contact_name || t('dashboardHome.guest')}</Text><Text style={styles.orderNo} numberOfLines={2}>#{order.order_no}</Text></View>
          <Text style={[ui.text, styles.dates]}>{order.sku_name || order.goods_name} · {bookingDate(order.use_date, i18n.language, true)} – {bookingDate(order.end_date, i18n.language, true)} ({t('bookings.nights', { count: bookingNights(order.use_date, order.end_date) })})</Text><View style={styles.divider} />
          <BookingBadges order={order} /><Text style={styles.amount}>{bookingMoney(order.pay_amount, order.currency, i18n.language)}</Text>
          {canDetail ? <View style={ui.actions}><BookingButton title={t(status === 1 ? 'bookings.awaitingPayment' : 'bookings.viewDetails')} onPress={() => openDetail(order)} tone={status === 1 ? 'pending' : 'outline'} />{canAct && action ? <BookingButton title={t(`bookings.action.${action}`)} onPress={() => openDetail(order, action)} tone={action === 'check-out' ? 'orange' : 'primary'} /> : null}</View> : null}
        </View>;
      })}
      {!failed && items.length < total ? <BookingButton title={t(loading ? 'bookings.loading' : 'bookings.loadMore')} disabled={loading} onPress={() => { if (!inFlight.current) void load(page + 1); }} tone="outline" /> : null}
    </ScrollView>
    <View style={styles.tabs}>{(['home', 'bookings', 'calendar', 'messages', 'menu'] as const).map((name) => <Pressable key={name} style={styles.tab} accessibilityRole="button" accessibilityState={{ selected: name === 'bookings' }} onPress={() => { if (name === 'home') navigation.navigate('Dashboard'); else if (name === 'menu') navigation.navigate('Dashboard', { openMenu: true }); else if (name !== 'bookings') showToast(t('dashboardHome.notAvailable')); }}><BookingIcon name={name} color={name === 'bookings' ? colors.primary : '#64748B'} /><Text style={[styles.tabLabel, name === 'bookings' && { color: colors.primary }]}>{t(`dashboardHome.tab.${name}`)}</Text></Pressable>)}</View>
    <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}><View style={ui.overlay}><View style={ui.sheet}><Text style={ui.heading}>{t('bookings.filters')}</Text><ScrollView><Text style={styles.filterHeading}>{t('bookings.bookingStatus')}</Text><FilterOption title={t('bookings.allStatus')} selected={!draftStatuses.length} onPress={() => setDraftStatuses([])} />{[2, 1, 3, 4, 5, 6].map((status) => <FilterOption key={status} title={t(`bookings.status.${status}`)} selected={draftStatuses.includes(status)} onPress={() => toggleStatus(status)} />)}<Text style={styles.filterHeading}>{t('bookings.paymentStatus')}</Text><FilterOption title={t('bookings.allStatus')} selected={!draftPayments.length} onPress={() => setDraftPayments([])} />{(['paid', 'unpaid', 'refunded', 'hotel', 'partial', 'failed'] as const).map((payment) => <FilterOption key={payment} title={t(`bookings.payment.${payment}`)} selected={draftPayments.includes(payment)} onPress={() => togglePayment(payment)} />)}</ScrollView><View style={ui.actions}><BookingButton title={t('bookings.clearAll')} tone="outline" onPress={() => { setDraftStatuses([]); setDraftPayments([]); }} /><BookingButton title={t('bookings.applyFilters')} onPress={() => { setStatuses(draftStatuses); setPayments(draftPayments); setFilterOpen(false); }} /></View><Pressable onPress={() => setFilterOpen(false)} style={styles.cancel}><Text style={ui.text}>{t('bookings.close')}</Text></Pressable></View></View></Modal>
  </View></SafeAreaView>;
}
function FilterOption({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable style={styles.option} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><View style={[styles.checkbox, selected && styles.checked]}>{selected ? <BookingIcon name="check" size={14} color="#FFFFFF" /> : null}</View><Text style={ui.text}>{title}</Text></Pressable>;
}
const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: 20, flexDirection: 'row', gap: 10, marginBottom: 16 }, search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12 }, searchInput: { flex: 1, minWidth: 0, minHeight: 46, fontFamily: fonts.inter, fontSize: 12, color: '#1E293B' }, activeFilter: { backgroundColor: '#CCFBF1' },
  guest: { flex: 1, fontFamily: fonts.outfitBold, fontSize: 16, color: '#1E293B' }, orderNo: { maxWidth: '48%', fontFamily: fonts.interSemi, fontSize: 11, color: '#0284C7', textAlign: 'right' }, dates: { fontSize: 11, marginBottom: 12 }, divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 }, amount: { fontFamily: fonts.interSemi, fontSize: 15, color: '#1E293B', marginTop: 14 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 16 }, emptyTitle: { fontFamily: fonts.inter, fontSize: 14, color: '#64748B', textAlign: 'center' }, tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0', paddingVertical: 13 }, tab: { flex: 1, alignItems: 'center', gap: 6 }, tabLabel: { fontFamily: fonts.interSemi, fontSize: 10, color: '#64748B' },
  filterHeading: { fontFamily: fonts.interSemi, fontSize: 13, color: '#1E293B', marginTop: 12, marginBottom: 10 }, option: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 12 }, checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.primary, borderColor: colors.primary }, cancel: { paddingTop: 15, alignItems: 'center' },
});
