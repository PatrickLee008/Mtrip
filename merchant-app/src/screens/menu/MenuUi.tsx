import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BookingIcon } from '@/screens/bookings/BookingUi';

const paths = {
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4',
  property: 'M4 21V6h5V3h8v5h3v13H4Zm5 0V6m8 15V8M6 10h1m-1 4h1m-1 4h1m5-11h2m-2 4h2m-2 4h2m-2 4h2',
  bed: 'M3 18v3m18-3v3M3 18h18v-7H3v7Zm2-7V5h6v6m2 0V5h6v6',
  chart: 'M3 3v18h18M7 16v-5m5 5V7m5 9v-8',
  budget: 'M4 3v18h17M8 3v12m-2-8h4v5H6V7Zm8-4v14m-2-7h4v5h-4v-5Z',
  tag: 'm3 3 9 0 9 9-9 9-9-9V3Zm4 4h.01',
  campaign: 'M3 5h18v14H3V5Zm3 10V9h4v6m-4-3h4m4-3h3v6h-3V9Z',
  staff: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 3a4 4 0 0 1 0 8M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2M2 12h4v8H2v-8Zm16 0h4v8h-4v-8Z',
  rules: 'M14 21H3V3h10v7m-7-3h4m-4 4h4m-4 4h3m8-1v7m-3-3h6m-3-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  faq: 'm12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1 3-2Zm-3 7a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01',
  book: 'M12 5C8 2 3 3 2 4v16c3-2 6-2 10 0 4-2 7-2 10 0V4c-3-2-7-2-10 1Zm0 0v15',
  logout: 'M10 4H4v16h6m5-12 4 4-4 4m4-4H9',
  right: 'm9 5 7 7-7 7', down: 'm6 9 6 6 6-6', clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  currency: 'M2 6h20v12H2V6Zm10 3v6m-2-4h4m-4 2h4M5 10v4m14-4v4',
};
export type MenuIconName = keyof typeof paths;
export function MenuIcon({ name, color = '#64748B', size = 22 }: { name: MenuIconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={paths[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function MenuHeader({ title, onBack, onNotifications }: { title: string; onBack?: () => void; onNotifications: () => void }) {
  const { t } = useTranslation();
  return <View style={ui.header}>
    {onBack ? <Pressable style={ui.back} onPress={onBack} accessibilityRole="button"><BookingIcon name="back" size={18} /><Text style={ui.backText}>{t('menu.back')}</Text></Pressable> : null}
    <Text style={[ui.heading, !!onBack && ui.centerTitle]}>{title}</Text>
    <Pressable style={ui.bell} onPress={onNotifications} accessibilityRole="button" accessibilityLabel={t('dashboardHome.notifications')}><BookingIcon name="bell" color="#1E293B" size={22} /></Pressable>
  </View>;
}
export function MenuAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const initial = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toUpperCase() || 'M';
  return <View style={[ui.avatar, large && ui.avatarLarge]}><Text style={[ui.initial, large && ui.initialLarge]}>{initial}</Text></View>;
}
export function MenuDialog({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={ui.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('dashboardHome.close')} />
      <View style={ui.dialog} accessibilityViewIsModal><Text style={ui.dialogTitle}>{title}</Text><ScrollView>{children}</ScrollView></View>
    </View>
  </Modal>;
}
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, shell: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, fontFamily: fonts.outfitBold, color: '#1E293B', fontSize: 20 }, centerTitle: { fontSize: 16, textAlign: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44 }, backText: { fontFamily: fonts.interMedium, fontSize: 13, color: '#64748B' },
  bell: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 28, flexGrow: 1 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, marginBottom: 16 },
  title: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: '#1E293B' },
  body: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: '#64748B' },
  section: { fontFamily: fonts.interSemi, fontSize: 12, color: '#64748B', marginTop: 18, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 72, height: 72, borderRadius: 36 }, initial: { fontFamily: fonts.interSemi, fontSize: 20, color: '#FFFFFF' }, initialLarge: { fontSize: 26 },
  button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  outline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }, outlineText: { color: '#1E293B' },
  disabled: { opacity: 0.45 }, footer: { paddingTop: 24, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16 },
  footerCopy: { flex: 1 }, overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 },
  dialogTitle: { fontFamily: fonts.outfitBold, fontSize: 19, color: '#1E293B', marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, padding: 12, borderRadius: 6, gap: 12 }, selected: { backgroundColor: '#CCFBF1' },
});
