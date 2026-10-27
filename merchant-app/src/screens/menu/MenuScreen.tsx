import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiDashboardProperties } from '@/api/merchant';
import type { DashboardProperty } from '@/api/types';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { BookingIcon } from '@/screens/bookings/BookingUi';
import { MenuAvatar, MenuDialog, MenuHeader, MenuIcon, ui } from './MenuUi';
import type { MenuIconName } from './MenuUi';

type Section = RootStackParamList['MenuSettings']['section'];
const management: [string, MenuIconName][] = [['allProperties', 'property'], ['hotelProfile', 'property'], ['roomTypes', 'bed']];
const business: [string, MenuIconName][] = [['earnings', 'chart'], ['budget', 'budget'], ['promotions', 'tag'], ['campaigns', 'campaign'], ['staff', 'staff'], ['reviews', 'star']];
const settings: [string, MenuIconName, Section?][] = [['security', 'shield', 'security'], ['notifications', 'bell', 'notifications'], ['localization', 'globe', 'localization'], ['support', 'support'], ['rules', 'rules'], ['faq', 'faq'], ['guide', 'book']];

export default function MenuScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Menu'>) {
  const { t } = useTranslation();
  const profile = useMerchantStore((s) => s.profile);
  const propertyId = useMerchantStore((s) => s.propertyId);
  const setPropertyId = useMerchantStore((s) => s.setPropertyId);
  const logout = useMerchantStore((s) => s.logout);
  const showToast = useCommonStore((s) => s.showToast);
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutInFlight = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setFailed(false);
    apiDashboardProperties().then(({ list }) => {
      if (active) setProperties(list.filter((p) => p.business_type === 'hotel'));
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  const name = profile?.realName || profile?.username || t('dashboardHome.partner');
  const selected = properties.find((p) => p.id === propertyId);
  const propertyName = selected?.store_name || (propertyId ? t('menu.selectedProperty') : t('dashboardHome.allProperties'));
  const unavailable = () => showToast(t('menu.unavailable'));
  const signOut = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true; setLoggingOut(true);
    try { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }); }
    catch { showToast(t('dashboardHome.logoutFailed')); }
    finally { logoutInFlight.current = false; setLoggingOut(false); }
  };
  const row = (key: string, icon: MenuIconName, section?: Section) => <Pressable key={key} style={styles.row} accessibilityRole="button" onPress={section ? () => navigation.navigate('MenuSettings', { section }) : key === 'allProperties' ? () => setPicker(true) : unavailable}>
    <MenuIcon name={icon} />
    <Text style={styles.rowText}>{t(`menu.items.${key}`)}</Text><MenuIcon name="right" size={16} />
  </Pressable>;
  return <SafeAreaView style={ui.root} edges={['top', 'bottom']}><StatusBar style="dark" /><View style={ui.shell}>
    <MenuHeader title={t('menu.title')} onNotifications={() => navigation.navigate('Notifications')} />
    <ScrollView contentContainerStyle={ui.content}>
      <Pressable style={[ui.card, styles.account]} accessibilityRole="button" onPress={() => navigation.navigate('MenuSettings', { section: 'profile' })}>
        <MenuAvatar name={name} /><View style={styles.copy}><Text style={styles.name}>{name}</Text><Text style={ui.body}>{t(profile?.isOwner ? 'menu.owner' : 'menu.staffAccount')}</Text></View><MenuIcon name="right" size={18} color="#2563EB" />
      </Pressable>
      <View style={ui.card}>
        <Text style={[ui.body, styles.context]}>{t('menu.propertyContext', { name: propertyName })}</Text>
        <Pressable style={styles.property} accessibilityRole="button" accessibilityLabel={t('dashboardHome.chooseProperty')} onPress={() => setPicker(true)}><Text style={styles.propertyText} numberOfLines={1}>{propertyName}</Text><MenuIcon name="down" color="#FFFFFF" size={18} /></Pressable>
        <Text style={ui.section}>{t('menu.hotelManagement')}</Text>{management.map(([key, icon]) => row(key, icon))}
        <Text style={ui.section}>{t('menu.businessOperations')}</Text>{business.map(([key, icon]) => row(key, icon))}
      </View>
      <View style={ui.card}><Text style={[ui.section, { marginTop: 2 }]}>{t('menu.settingsSupport')}</Text>{settings.map(([key, icon, section]) => row(key, icon, section))}</View>
      <Pressable style={styles.logout} accessibilityRole="button" onPress={() => setConfirm(true)}><MenuIcon name="logout" color="#DC2626" /><Text style={styles.logoutText}>{t('dashboardHome.logout')}</Text></Pressable>
    </ScrollView>
    <View style={styles.tabs}>{(['home', 'bookings', 'calendar', 'messages', 'menu'] as const).map((tab) => <Pressable key={tab} style={styles.tab} accessibilityRole="button" accessibilityState={{ selected: tab === 'menu' }} onPress={() => { if (tab === 'home') navigation.navigate('Dashboard'); else if (tab === 'bookings') navigation.navigate('Bookings'); else if (tab !== 'menu') unavailable(); }}><BookingIcon name={tab} color={tab === 'menu' ? colors.primary : '#64748B'} /><Text style={[styles.tabText, tab === 'menu' && { color: colors.primary }]}>{t(`dashboardHome.tab.${tab}`)}</Text></Pressable>)}</View>
  </View>
    <MenuDialog visible={picker} title={t('dashboardHome.chooseProperty')} onClose={() => setPicker(false)}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}{failed ? <Text style={ui.body}>{t('menu.propertiesFailed')}</Text> : null}
      {[{ id: 0, store_name: t('dashboardHome.allProperties'), address: '' }, ...properties].map((p) => <Pressable key={p.id} style={[ui.option, p.id === propertyId && ui.selected]} accessibilityRole="radio" accessibilityState={{ checked: p.id === propertyId }} onPress={() => { setPropertyId(p.id); setPicker(false); }}><MenuIcon name="property" /><View style={styles.copy}><Text style={ui.title}>{p.store_name}</Text>{p.address ? <Text style={ui.body}>{p.address}</Text> : null}</View>{p.id === propertyId ? <BookingIcon name="check" color={colors.primary} /> : null}</Pressable>)}
    </MenuDialog>
    <MenuDialog visible={confirm} title={t('dashboardHome.logoutConfirmTitle')} onClose={() => { if (!loggingOut) setConfirm(false); }}>
      <Text style={ui.body}>{t('dashboardHome.logoutConfirmCopy')}</Text><View style={styles.confirmActions}>
        <Pressable style={[ui.button, ui.outline, styles.copy]} disabled={loggingOut} onPress={() => setConfirm(false)} accessibilityRole="button"><Text style={[ui.buttonText, ui.outlineText]}>{t('dashboardHome.cancel')}</Text></Pressable>
        <Pressable style={[ui.button, styles.danger, styles.copy]} disabled={loggingOut} onPress={() => void signOut()} accessibilityRole="button"><Text style={ui.buttonText}>{t(loggingOut ? 'dashboardHome.loggingOut' : 'dashboardHome.logout')}</Text></Pressable>
      </View>
    </MenuDialog>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }, copy: { flex: 1 }, name: { fontFamily: fonts.outfitBold, fontSize: 18, color: '#1E293B', marginBottom: 4 },
  context: { marginBottom: 10 }, property: { backgroundColor: colors.primary, borderRadius: 6, minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  propertyText: { flex: 1, fontFamily: fonts.interSemi, fontSize: 13, color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 58, paddingVertical: 12 }, rowText: { flex: 1, fontFamily: fonts.interMedium, color: '#1E293B', fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 }, logoutText: { fontFamily: fonts.interMedium, fontSize: 15, color: '#DC2626' },
  tabs: { flexDirection: 'row', paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' }, tab: { flex: 1, alignItems: 'center', gap: 7 }, tabText: { fontFamily: fonts.interSemi, fontSize: 10, color: '#64748B' },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 24 }, danger: { backgroundColor: '#DC2626' },
});
