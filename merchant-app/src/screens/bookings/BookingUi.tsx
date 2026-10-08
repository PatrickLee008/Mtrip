import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { BookingOrder } from '@/api/types';
import { paymentLabel } from './bookingHelpers';

const paths = {
  back: 'm15 18-6-6 6-6', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', filter: 'M3 4h18l-7 8v8l-4-2v-6L3 4Z',
  home: 'M3 10.5 12 3l9 7.5V21h-7v-7h-4v7H3V10.5Z', bookings: 'M8 4h8m-9 0H5v17h14V4h-2M8 9h8M8 13h8M8 17h5',
  calendar: 'M4 7h16v14H4V7Zm0 4h16M8 3v6m8-6v6', messages: 'M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5',
  menu: 'M4 7h16M4 12h16M4 17h16', note: 'M12 4H4v17h16v-8M9 15l1-5L19 1l4 4-9 9-5 1Z',
  phone: 'M7 3H3v4c0 8 6 14 14 14h4v-4l-5-2-2 2a11 11 0 0 1-7-7l2-2-2-5Z', check: 'm5 12 4 4L19 6',
} as const;
export function BookingIcon({ name, size = 22, color = '#64748B' }: { name: keyof typeof paths; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={paths[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function BookingButton({ title, onPress, disabled, tone = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'outline' | 'orange' | 'danger' | 'dangerOutline' | 'pending' }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[ui.button, tone === 'outline' && ui.outline, tone === 'orange' && ui.orange, tone === 'danger' && ui.danger, tone === 'dangerOutline' && ui.dangerOutline, tone === 'pending' && ui.pendingButton, disabled && ui.disabled]}><Text style={[ui.buttonText, tone === 'outline' && ui.outlineText, tone === 'dangerOutline' && ui.redText, tone === 'pending' && ui.yellowText]}>{title}</Text></Pressable>;
}
export function BookingBadges({ order, paymentOnly = false }: { order: BookingOrder; paymentOnly?: boolean }) {
  const { t } = useTranslation();
  const payment = paymentLabel(order);
  const status = Number(order.booking_status);
  const paymentTone: [ViewStyle, TextStyle] = payment === 'paid' ? [ui.green, ui.greenText] : payment === 'refunded' || payment === 'failed' ? [ui.red, ui.redText] : payment === 'unpaid' || payment === 'unknown' ? [ui.grey, ui.greyText] : [ui.yellow, ui.yellowText];
  const statusTone: [ViewStyle, TextStyle] = status === 1 ? [ui.yellow, ui.yellowText] : status === 3 ? [ui.green, ui.greenText] : status === 5 || status === 6 ? [ui.red, ui.redText] : [ui.blue, ui.blueText];
  return <View style={ui.badges}><View style={[ui.badge, paymentTone[0]]}><Text style={[ui.badgeText, paymentTone[1]]}>{t(`bookings.payment.${payment}`)}</Text></View>{!paymentOnly ? <View style={[ui.badge, statusTone[0]]}><Text style={[ui.badgeText, statusTone[1]]}>{t(`bookings.status.${status >= 1 && status <= 6 ? status : 'unknown'}`)}</Text></View> : null}</View>;
}
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' }, shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, gap: 12 },
  title: { fontFamily: fonts.outfitBold, fontSize: 22, color: '#1E293B', flex: 1 }, iconButton: { minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingTop: 6, paddingBottom: 24 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  heading: { fontFamily: fonts.outfitBold, fontSize: 18, color: '#1E293B', marginBottom: 14 }, text: { fontFamily: fonts.inter, fontSize: 13, color: '#64748B', lineHeight: 21 },
  strong: { fontFamily: fonts.interSemi, fontSize: 14, color: '#1E293B' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 }, button: { flex: 1, minHeight: 46, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.interSemi, fontSize: 13, color: '#FFFFFF', textAlign: 'center' }, outline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0284C7' }, outlineText: { color: '#0284C7' }, orange: { backgroundColor: '#D97706' }, danger: { backgroundColor: '#DC2626' }, dangerOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EF4444' }, pendingButton: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#D97706' }, disabled: { opacity: 0.4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, badge: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9 }, badgeText: { fontFamily: fonts.interSemi, fontSize: 11 },
  green: { backgroundColor: '#DCFCE7' }, greenText: { color: '#15803D' }, yellow: { backgroundColor: '#FEF3C7' }, yellowText: { color: '#B45309' }, blue: { backgroundColor: '#DBEAFE' }, blueText: { color: '#2563EB' }, red: { backgroundColor: '#FEE2E2' }, redText: { color: '#B91C1C' }, grey: { backgroundColor: '#E2E8F0' }, greyText: { color: '#475569' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxWidth: 460, maxHeight: '85%' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 13, fontFamily: fonts.inter, fontSize: 14, color: '#1E293B', marginTop: 12, minHeight: 48 },
});
