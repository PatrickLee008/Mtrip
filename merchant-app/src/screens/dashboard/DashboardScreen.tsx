import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { apiDashboardEarnings, apiDashboardProperties, apiDashboardStats } from '@/api/merchant';
import type { DashboardBooking, DashboardEarnings, DashboardProperty, DashboardStats } from '@/api/types';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';

type IconName = 'home' | 'bookings' | 'calendar' | 'messages' | 'menu' | 'property' | 'chart' | 'support' | 'reviews' | 'bell' | 'chevron' | 'check' | 'logout';
const iconPaths: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-7v-7h-4v7H3V10.5Z',
  bookings: 'M8 4h8m-9 0H5v17h14V4h-2M8 9h8M8 13h8M8 17h5',
  calendar: 'M4 7h16v14H4V7Zm0 4h16M8 3v6m8-6v6M8 15h3m2 0h3m-8 3h3',
  messages: 'M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  property: 'M4 21V6l8-3 8 3v15H4Zm4-12h2m4 0h2M8 13h2m4 0h2m-6 8v-4h4v4',
  chart: 'M4 20V9m5 11V4m5 16v-8m5 8V7M2 21h20',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v6h4v-6H4Zm16 0h2v6h-4v-6h2Zm0 6a4 4 0 0 1-4 4h-3',
  reviews: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4',
  chevron: 'm6 9 6 6 6-6',
  check: 'm4 12 5 5L20 6',
  logout: 'M10 4H5v16h5m4-12 4 4-4 4m4-4H9',
};
function Icon({ name, color = colors.primary, size = 24 }: { name: IconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={iconPaths[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function money(value: number, currency: string, lang: string) {
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(value)} ${currency}`.trim();
}

export default function DashboardScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Dashboard'>) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const profile = useMerchantStore((s) => s.profile);
  const logout = useMerchantStore((s) => s.logout);
  const showToast = useCommonStore((s) => s.showToast);
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const propertyId = useMerchantStore((s) => s.propertyId);
  const setPropertyId = useMerchantStore((s) => s.setPropertyId);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [earnings, setEarnings] = useState<DashboardEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const requestId = useRef(0);
  const logoutInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    apiDashboardProperties().then(({ list }) => {
      if (!active) return;
      const hotels = list.filter((item) => item.business_type === 'hotel');
      setProperties(hotels);
      if (!profile?.storeId && hotels.length && !useMerchantStore.getState().propertyId) setPropertyId((hotels.find((item) => item.is_main === 1) || hotels[0]).id);
    }).catch(() => { /* Aggregates can still load under the account's server-side scope. */ });
    return () => { active = false; };
  }, [profile?.storeId]);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setStats(null);
    setEarnings(null);
    const [statsResult, earningsResult] = await Promise.allSettled([apiDashboardStats(propertyId), apiDashboardEarnings(propertyId)]);
    if (currentRequest !== requestId.current) return;
    setStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
    setEarnings(earningsResult.status === 'fulfilled' ? earningsResult.value : null);
    setLoading(false);
  }, [propertyId]);
  useFocusEffect(useCallback(() => { void load(); return () => { requestId.current++; }; }, [load]));
  useEffect(() => {
    if (route.params?.openMenu) { setMenuOpen(true); navigation.setParams({ openMenu: false }); }
  }, [route.params?.openMenu, navigation]);

  const selected = properties.find((item) => item.id === propertyId);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const today = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  const bookings = stats?.recentBookings ?? [];
  const unavailable = () => showToast(t('dashboardHome.notAvailable'));
  const canCheckIn = !!profile && (profile.isOwner || profile.permissions.includes('mch:order:check-in'));
  const canViewDetail = !!profile && (profile.isOwner || profile.permissions.includes('mch:order:detail'));
  const openDetail = (booking: DashboardBooking, action?: 'check-in') => navigation.navigate('BookingDetail', { orderId: booking.orderId, propertyId, action });
  const closeMenu = () => { if (!loggingOut) { setMenuOpen(false); setLogoutConfirm(false); } };
  const signOut = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLoggingOut(true);
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    } catch {
      showToast(t('dashboardHome.logoutFailed'));
    } finally {
      logoutInFlight.current = false;
      setLoggingOut(false);
    }
  };

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <StatusBar style="dark" translucent backgroundColor="transparent" />
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && !!stats} onRefresh={() => void load()} tintColor={colors.primary} />}>
        <View style={styles.topRow}>
          <Pressable style={styles.propertySelect} onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel={t('dashboardHome.chooseProperty')}>
            <Text style={styles.propertySelectText} numberOfLines={1}>{selected?.store_name || t('dashboardHome.allProperties')}</Text>
            <Icon name="chevron" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.bell} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel={t('dashboardHome.notifications')}><Icon name="bell" size={22} color="#253247" /></Pressable>
        </View>
        <Text style={styles.greeting}>{t(`dashboardHome.${greeting}`, { name: profile?.realName || profile?.username || t('dashboardHome.partner') })}</Text>
        <Text style={styles.date}>{today}</Text>
        {loading && !stats ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
        {!loading && !stats ? <Pressable style={styles.errorBox} onPress={() => void load()}><Text style={styles.errorText}>{t('dashboardHome.loadFailed')}</Text></Pressable> : null}
        <View style={styles.metrics}>
          <Metric title={t('dashboardHome.arrivals')} value={stats ? t('dashboardHome.guests', { count: stats.kpi.todayArrivalGuestCount }) : '--'} icon="bookings" iconColor="#1685C1" />
          <Metric title={t('dashboardHome.departures')} value={stats ? t('dashboardHome.guests', { count: stats.kpi.todayDepartureGuestCount }) : '--'} icon="bookings" iconColor={colors.primary} />
          <Metric title={t('dashboardHome.occupancy')} value={stats?.kpi.occupancyRate == null ? '--' : `${stats.kpi.occupancyRate}%`} icon="chart" iconColor="#68798B" />
          <Metric title={t('dashboardHome.netSettlement')} value={earnings ? money(earnings.netSettlement, earnings.currency, i18n.language) : '--'} icon="bookings" iconColor={colors.primary} accent />
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t('dashboardHome.quickActions')}</Text><Pressable onPress={unavailable}><Text style={styles.viewAll}>{t('dashboardHome.viewAll')}</Text></Pressable></View>
        <View style={styles.actions}>
          {(['property', 'chart', 'support', 'reviews'] as const).map((name) => <Pressable key={name} style={styles.action} onPress={name === 'property' ? () => setPickerOpen(true) : unavailable} accessibilityRole="button">
            <View style={styles.actionIcon}><Icon name={name} size={27} /></View><Text style={styles.actionLabel}>{t(`dashboardHome.action.${name}`)}</Text>
          </Pressable>)}
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t('dashboardHome.recentBookings')}</Text><Pressable onPress={() => navigation.navigate('Bookings')}><Text style={styles.viewAll}>{t('dashboardHome.viewAll')}</Text></Pressable></View>
        {stats && bookings.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyText}>{t('dashboardHome.noBookings')}</Text></View> : null}
        {bookings.slice(0, 1).map((booking) => <BookingCard key={booking.orderId} booking={booking} currency={earnings?.currency || ''} onDetail={canViewDetail ? () => openDetail(booking) : undefined} onCheckIn={canCheckIn && canViewDetail ? () => openDetail(booking, 'check-in') : undefined} />)}
      </ScrollView>
      <View style={styles.tabBar}>
        {(['home', 'bookings', 'calendar', 'messages', 'menu'] as const).map((name) => <Pressable key={name} style={styles.tab} onPress={name === 'menu' ? () => setMenuOpen(true) : name === 'home' ? () => void load() : name === 'bookings' ? () => navigation.navigate('Bookings') : unavailable} accessibilityRole="button" accessibilityState={{ selected: name === (menuOpen ? 'menu' : 'home') }}>
          <Icon name={name} size={25} color={name === (menuOpen ? 'menu' : 'home') ? colors.primary : '#65748B'} /><Text style={[styles.tabText, name === (menuOpen ? 'menu' : 'home') && styles.tabActive]}>{t(`dashboardHome.tab.${name}`)}</Text>
        </Pressable>)}
      </View>
    </View>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
      <View style={[styles.menuOverlay, { paddingBottom: 18 + insets.bottom }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel={t('dashboardHome.close')} />
        <View style={styles.menuSheet}>
          {logoutConfirm ? <>
            <Text style={styles.pickerTitle}>{t('dashboardHome.logoutConfirmTitle')}</Text>
            <Text style={styles.confirmCopy}>{t('dashboardHome.logoutConfirmCopy')}</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelButton} disabled={loggingOut} onPress={() => setLogoutConfirm(false)} accessibilityRole="button"><Text style={styles.cancelText}>{t('dashboardHome.cancel')}</Text></Pressable>
              <Pressable style={styles.logoutConfirmButton} disabled={loggingOut} onPress={() => void signOut()} accessibilityRole="button"><Text style={styles.confirmText}>{loggingOut ? t('dashboardHome.loggingOut') : t('dashboardHome.logout')}</Text></Pressable>
            </View>
          </> : <>
            <Text style={styles.pickerTitle}>{t('dashboardHome.account')}</Text>
            <View style={styles.accountCard}>
              <View style={styles.accountAvatar}><Text style={styles.accountInitial}>{(profile?.realName || profile?.username || 'M').slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.optionCopy}><Text style={styles.accountName} numberOfLines={1}>{profile?.realName || profile?.username}</Text><Text style={styles.accountUsername} numberOfLines={1}>{profile?.username}</Text></View>
            </View>
            <Pressable style={styles.logoutRow} onPress={() => setLogoutConfirm(true)} accessibilityRole="button"><Icon name="logout" size={21} color="#B74343" /><Text style={styles.logoutText}>{t('dashboardHome.logout')}</Text></Pressable>
          </>}
        </View>
      </View>
    </Modal>
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setPickerOpen(false)}><View style={styles.picker}>
        <Text style={styles.pickerTitle}>{t('dashboardHome.chooseProperty')}</Text>
        <ScrollView>{[{ id: 0, store_name: t('dashboardHome.allProperties'), address: '', status: 1 }, ...properties].map((property) => <Pressable key={property.id} style={[styles.propertyOption, property.id === propertyId && styles.propertyOptionActive]} onPress={() => { setPropertyId(property.id); setPickerOpen(false); }}>
          <Icon name="property" size={20} /><View style={styles.optionCopy}><Text style={styles.optionName}>{property.store_name}</Text>{property.address ? <Text style={styles.optionAddress} numberOfLines={1}>{property.address}</Text> : null}</View>
          {property.id === propertyId ? <Icon name="check" size={18} /> : null}
        </Pressable>)}</ScrollView>
      </View></Pressable>
    </Modal>
  </SafeAreaView>;
}

function Metric({ title, value, icon, iconColor, accent = false }: { title: string; value: string; icon: IconName; iconColor: string; accent?: boolean }) {
  return <View style={styles.metric}><View style={styles.metricTop}><Text style={styles.metricTitle}>{title}</Text><View style={styles.metricIcon}><Icon name={icon} size={17} color={iconColor} /></View></View><Text style={[styles.metricValue, accent && styles.accentValue]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}
function BookingCard({ booking, currency, onDetail, onCheckIn }: { booking: DashboardBooking; currency: string; onDetail?: () => void; onCheckIn?: () => void }) {
  const { t, i18n } = useTranslation();
  const paymentKey = booking.paymentStatus === 4 ? 'refunded' : booking.paymentStatus === 3 ? 'partiallyRefunded' : booking.paymentStatus === 2 ? 'paid' : 'unpaid';
  const paid = paymentKey === 'paid' || paymentKey === 'partiallyRefunded';
  const statusKey = booking.bookingStatus === 2 ? 'confirmed' : booking.bookingStatus === 3 ? 'checkedIn' : booking.bookingStatus === 4 ? 'checkedOut' : booking.bookingStatus === 5 ? 'cancelled' : booking.bookingStatus === 6 ? 'noShow' : 'pending';
  return <View style={styles.bookingCard}>
    <View style={styles.bookingTop}><Text style={styles.guest} numberOfLines={1}>{booking.guest || t('dashboardHome.guest')}</Text><Text style={styles.orderNo} numberOfLines={1}>#{booking.orderNo}</Text></View>
    <Text style={styles.bookingMeta} numberOfLines={1}>{booking.roomType} · {booking.checkIn} - {booking.checkOut}</Text><View style={styles.divider} />
    <View style={styles.tags}><Text style={[styles.tag, paid ? styles.paidTag : styles.pendingTag]}>{t(`dashboardHome.${paymentKey}`)}</Text><Text style={styles.statusTag}>{t(`dashboardHome.status.${statusKey}`)}</Text></View>
    <Text style={styles.bookingAmount}>{money(booking.totalAmount, currency, i18n.language)}</Text>
    <View style={styles.bookingActions}>{onDetail ? <Pressable style={styles.detailButton} onPress={onDetail}><Text style={styles.detailButtonText}>{t('dashboardHome.viewDetails')}</Text></Pressable> : null}{booking.bookingStatus === 2 && onCheckIn ? <Pressable style={styles.checkInButton} onPress={onCheckIn}><Text style={styles.checkInText}>{t('dashboardHome.checkIn')}</Text></Pressable> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' }, shell: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#F8FAFB' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  propertySelect: { maxWidth: '78%', minHeight: 43, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primary, borderRadius: 12 },
  propertySelectText: { flexShrink: 1, color: '#FFFFFF', fontFamily: fonts.interSemi, fontSize: 14 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAF0', alignItems: 'center', justifyContent: 'center' },
  greeting: { marginTop: 24, fontFamily: fonts.outfitBold, fontSize: 23, lineHeight: 29, color: '#1D293B' },
  date: { marginTop: 5, fontFamily: fonts.inter, fontSize: 13, color: '#69788C' }, loader: { marginTop: 20 },
  errorBox: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#FFF3EB' }, errorText: { color: '#A84E13', fontFamily: fonts.interMedium },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 27 },
  metric: { width: '48%', minHeight: 93, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E3E8EE', backgroundColor: '#FFFFFF', justifyContent: 'space-between' },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 }, metricTitle: { flex: 1, fontFamily: fonts.interMedium, fontSize: 12, color: '#6C7A8E' },
  metricIcon: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#ECF8F4' },
  metricValue: { fontFamily: fonts.outfitBold, fontSize: 22, color: '#1D293B' }, accentValue: { color: colors.primary },
  sectionHeading: { marginTop: 27, marginBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.outfitBold, fontSize: 16, color: '#1D293B' }, viewAll: { fontFamily: fonts.interSemi, fontSize: 12, color: colors.primary },
  actions: { flexDirection: 'row', justifyContent: 'space-between' }, action: { alignItems: 'center', width: '24%', gap: 7 },
  actionIcon: { width: 57, height: 57, borderWidth: 1, borderColor: '#E6EBEF', borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.interSemi, fontSize: 11, color: '#637188', textAlign: 'center' },
  bookingCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EE', borderRadius: 14, padding: 15, marginBottom: 10 },
  bookingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, guest: { flex: 1, fontFamily: fonts.outfitBold, fontSize: 17, color: '#1D293B' },
  orderNo: { maxWidth: '48%', fontFamily: fonts.interSemi, fontSize: 12, color: '#1685C1' }, bookingMeta: { marginTop: 8, fontFamily: fonts.inter, fontSize: 12, color: '#7A8798' },
  divider: { height: 1, backgroundColor: '#EFF2F5', marginVertical: 16 }, tags: { flexDirection: 'row', gap: 7 },
  tag: { overflow: 'hidden', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4, fontFamily: fonts.interSemi, fontSize: 11 },
  paidTag: { backgroundColor: '#E6F7EC', color: '#199453' }, pendingTag: { backgroundColor: '#FFF4DF', color: '#AD7317' },
  statusTag: { overflow: 'hidden', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4, fontFamily: fonts.interSemi, fontSize: 11, backgroundColor: '#E8F4FB', color: '#1685C1' },
  bookingAmount: { marginTop: 10, fontFamily: fonts.outfitBold, fontSize: 15, color: '#253247' },
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  detailButton: { flex: 1, height: 39, borderRadius: 9, borderWidth: 1, borderColor: '#1685C1', alignItems: 'center', justifyContent: 'center' },
  checkInButton: { flex: 1, height: 39, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkInText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#FFFFFF' },
  detailButtonText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#1685C1' }, emptyBox: { padding: 22, backgroundColor: '#FFFFFF', borderRadius: 12 },
  emptyText: { textAlign: 'center', color: '#718096', fontFamily: fonts.inter },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8EDF1', paddingTop: 9, paddingBottom: 5 },
  tab: { flex: 1, alignItems: 'center', gap: 4 }, tabText: { fontFamily: fonts.interSemi, fontSize: 10, color: '#69788C' }, tabActive: { color: colors.primary },
  overlay: { flex: 1, backgroundColor: 'rgba(19, 33, 48, 0.4)', justifyContent: 'center', paddingHorizontal: 22 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(19, 33, 48, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 18 },
  menuSheet: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F3F8F7' },
  accountAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  accountInitial: { fontFamily: fonts.outfitBold, fontSize: 20, color: '#FFFFFF' },
  accountName: { fontFamily: fonts.interSemi, fontSize: 14, color: '#1D293B' },
  accountUsername: { marginTop: 3, fontFamily: fonts.inter, fontSize: 12, color: '#69788C' },
  logoutRow: { height: 50, marginTop: 14, borderRadius: 10, borderWidth: 1, borderColor: '#F2DCDC', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  logoutText: { fontFamily: fonts.interSemi, fontSize: 14, color: '#B74343' },
  logoutConfirmButton: { flex: 1, height: 42, borderRadius: 9, backgroundColor: '#B74343', alignItems: 'center', justifyContent: 'center' },
  picker: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, maxHeight: '75%' }, pickerTitle: { fontFamily: fonts.outfitBold, fontSize: 20, color: '#1D293B', marginBottom: 12 },
  propertyOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 },
  propertyOptionActive: { backgroundColor: '#E8F7F2' }, optionCopy: { flex: 1 }, optionName: { fontFamily: fonts.interSemi, color: '#253247', fontSize: 13 },
  optionAddress: { marginTop: 3, fontFamily: fonts.inter, color: '#718096', fontSize: 11 },
  confirmCopy: { fontFamily: fonts.inter, fontSize: 14, color: '#475569', marginBottom: 14 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, height: 42, borderRadius: 9, borderWidth: 1, borderColor: '#CBD5DF', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.interSemi, color: '#475569' },
  confirmText: { fontFamily: fonts.interSemi, color: '#FFFFFF' },
});
