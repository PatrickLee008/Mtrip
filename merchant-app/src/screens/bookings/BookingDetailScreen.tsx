import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { apiBookingAction, apiBookingContact, apiBookingDetail, apiBookingMessage, apiBookingThread } from '@/api/merchant';
import type { BookingAction, BookingDetail, GuestThread } from '@/api/types';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useMerchantStore } from '@/store/merchantStore';
import { useCommonStore } from '@/store/commonStore';
import { BookingBadges, BookingButton, BookingIcon, ui } from './BookingUi';
import { bookingDate, bookingMoney, hasBookingPermission, paymentLabel, remainingSeconds } from './bookingHelpers';

export default function BookingDetailScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'BookingDetail'>) {
  const { orderId, propertyId } = route.params;
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const profile = useMerchantStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState<BookingAction | 'message' | null>(null);
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<GuestThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadFailed, setThreadFailed] = useState(false);
  const requestId = useRef(0);
  const dialogRequestId = useRef(0);
  const submitting = useRef(false);
  const calling = useRef(false);
  const latest = useRef<BookingDetail | null>(null);
  const expiresRefreshed = useRef(false);
  const canView = hasBookingPermission(profile, 'detail');
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setFailed(false);
    if (!canView) { setLoading(false); return; }
    try {
      const result = await apiBookingDetail(orderId, propertyId);
      if (current !== requestId.current) return;
      latest.current = result; setDetail(result); setNow(Date.now());
    } catch { if (current === requestId.current) setFailed(true); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [orderId, propertyId, canView]);
  useFocusEffect(useCallback(() => {
    latest.current = null; setDetail(null); setDialog(null); expiresRefreshed.current = false;
    void load();
    let ticks = 0;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time); ticks++;
      const current = latest.current;
      if (!current || submitting.current) return;
      const status = Number(current.order.booking_status);
      const expired = status === 1 && remainingSeconds(current.payment.paymentExpiresAt, time) === 0;
      if ((expired && !expiresRefreshed.current) || (ticks % 15 === 0 && (status === 1 || (status === 2 && !current.availableActions.includes('no-show') && Date.parse(current.stay.noShowDeadline) < time)))) {
        expiresRefreshed.current = expired; void load();
      }
    }, 1000);
    return () => { clearInterval(timer); requestId.current++; dialogRequestId.current++; latest.current = null; };
  }, [load]));

  const can = (action: string) => !!detail && hasBookingPermission(profile, action) && detail.availableActions.includes(action);
  const openDialog = (action: BookingAction | 'message') => { dialogRequestId.current++; setField(''); setThread(null); setDialog(action); };
  const closeDialog = () => { if (!submitting.current) { dialogRequestId.current++; setDialog(null); setField(''); } };
  const loadThread = async () => {
    const current = ++dialogRequestId.current;
    setThreadLoading(true); setThreadFailed(false);
    try { const result = await apiBookingThread(orderId, propertyId); if (current === dialogRequestId.current) setThread(result); }
    catch { if (current === dialogRequestId.current) setThreadFailed(true); }
    finally { if (current === dialogRequestId.current) setThreadLoading(false); }
  };
  const messageGuest = () => { openDialog('message'); void loadThread(); };
  const callGuest = async () => {
    if (calling.current) return;
    calling.current = true;
    try {
      const contact = await apiBookingContact(orderId, propertyId);
      const phone = contact.phone.replace(/[\s()-]/g, '');
      if (!/^\+?\d{5,15}$/.test(phone)) { showToast(t('bookings.noPhone')); return; }
      await Linking.openURL(`tel:${phone}`);
    } catch { showToast(t('bookings.callFailed')); }
    finally { calling.current = false; }
  };
  const submit = async () => {
    if (!dialog || submitting.current) return;
    if ((dialog === 'note' || dialog === 'cancel' || dialog === 'message') && !field.trim()) { showToast(t('bookings.requiredText')); return; }
    if (dialog === 'message' && (!thread || thread.status === 1)) return;
    submitting.current = true; setBusy(true);
    try {
      if (dialog === 'message') {
        await apiBookingMessage(orderId, propertyId, field.trim());
        setField(''); await loadThread();
      } else {
        if (!can(dialog)) { showToast(t('bookings.actionUnavailable')); await load(); return; }
        const fields: Record<string, string> = dialog === 'check-in' ? { roomNo: field.trim() } : dialog === 'cancel' ? { reason: field.trim() } : dialog === 'note' ? { content: field.trim() } : {};
        await apiBookingAction(orderId, propertyId, dialog, fields);
        setDialog(null); setField(''); await load();
      }
      showToast(t('bookings.saved'));
    } catch { if (dialog === 'message') await loadThread(); else await load(); }
    finally { submitting.current = false; setBusy(false); }
  };
  // Consume a list quick-action once; the server still decides whether it is allowed.
  React.useEffect(() => {
    if (!detail || !route.params.action) return;
    const action = route.params.action;
    navigation.setParams({ action: undefined });
    if (can(action)) openDialog(action); else showToast(t('bookings.actionUnavailable'));
  }, [detail, route.params.action]);

  const order = detail?.order;
  const status = Number(order?.booking_status);
  const seconds = remainingSeconds(detail?.payment.paymentExpiresAt || null, now);
  const payment = order ? paymentLabel(order) : 'unknown';
  const money = (value: string | number) => bookingMoney(value, order?.currency || '', i18n.language);
  const back = () => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Bookings');

  return <SafeAreaView style={ui.root} edges={['top', 'bottom']}><StatusBar style="dark" /><View style={ui.shell}>
    <View style={ui.header}><Pressable onPress={back} style={ui.iconButton} accessibilityRole="button" accessibilityLabel={t('bookings.back')}><BookingIcon name="back" /></Pressable><Text style={styles.detailTitle} numberOfLines={2}>{order ? t('bookings.bookingNumber', { number: order.order_no }) : t('bookings.details')}</Text>{can('note') ? <Pressable style={ui.iconButton} onPress={() => openDialog('note')} accessibilityRole="button" accessibilityLabel={t('bookings.staffNotes')}><BookingIcon name="note" />{detail?.notes.length ? <View style={styles.noteDot} /> : null}</Pressable> : <View style={{ width: 42 }} />}</View>
    {!canView ? <Text style={[ui.text, ui.content]}>{t('bookings.noPermission')}</Text> : null}
    {loading && !detail ? <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /> : null}
    {failed ? <View style={ui.content}><BookingButton title={t('bookings.retry')} tone="outline" onPress={() => void load()} /></View> : null}
    {detail && order ? <>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />}>
        {status >= 1 && status <= 4 ? <View style={styles.progress}>{['pending', 'confirmed', 'in', 'out'].map((step, index) => <View key={step} style={styles.step}>{index < 3 ? <View style={[styles.connector, index + 1 < status && styles.connectorActive]} /> : null}<View style={[styles.stepCircle, index < status && styles.stepActive]}><Text style={[styles.stepNumber, index < status && styles.stepNumberActive]}>{index + 1}</Text></View><Text style={[styles.stepLabel, index < status && styles.stepLabelActive]}>{t(`bookings.progress.${step}`)}</Text></View>)}</View> : <View style={{ marginBottom: 18 }}><BookingBadges order={order} /></View>}
        {status === 1 ? <View style={[styles.banner, styles.pending]}><Text style={styles.countdown}>{seconds == null ? t('bookings.awaitingPayment') : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}</Text><Text style={[ui.strong, { textAlign: 'center' }]}>{t(seconds === 0 ? 'bookings.checkingPayment' : 'bookings.awaitingPayment')}</Text><Text style={[ui.text, { textAlign: 'center', marginTop: 10 }]}>{t('bookings.paymentHold')}</Text></View> : null}
        {status === 5 || status === 6 ? <View style={[styles.banner, status === 5 ? ui.red : ui.grey]}><Text style={ui.strong}>{t(status === 5 ? 'bookings.cancelledTitle' : 'bookings.noShowTitle')}</Text><Text style={[ui.text, { marginTop: 8 }]}>{t(status === 5 ? 'bookings.cancelledCopy' : 'bookings.noShowCopy')}</Text></View> : null}
        <View style={ui.card}><Text style={styles.sectionHeading}>{t('bookings.guestDetails')}</Text><View style={ui.row}><View style={styles.avatar}><Text style={styles.initials}>{(order.contact_name || 'G').split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={ui.strong}>{order.contact_name || t('dashboardHome.guest')}</Text><Text style={ui.text}>{order.contact_phone || '--'}</Text></View>{hasBookingPermission(profile, 'guest-contact') ? <Pressable onPress={() => void callGuest()} style={styles.phone} accessibilityRole="button" accessibilityLabel={t('bookings.callGuest')}><BookingIcon name="phone" color={colors.primary} size={18} /></Pressable> : null}</View>
          {hasBookingPermission(profile, 'message') ? <View style={ui.actions}><BookingButton title={t('bookings.messageGuest')} tone="outline" disabled={!order.user_id} onPress={messageGuest} /></View> : null}{!order.user_id ? <Text style={[ui.text, { marginTop: 8 }]}>{t('bookings.noGuestAccount')}</Text> : null}
        </View>
        <View style={ui.card}><Text style={styles.sectionHeading}>{t('bookings.stayDetails')}</Text><Text style={ui.strong}>{order.sku_name || order.goods_name}</Text><Text style={[ui.text, { marginVertical: 10, color: '#0284C7' }]}>{t('bookings.staySummary', { nights: detail.stay.nights, rooms: detail.stay.quantity })}</Text><View style={ui.row}><View style={{ flex: 1 }}><Text style={ui.text}>{t('bookings.checkInDate')}</Text><Text style={ui.strong}>{bookingDate(detail.stay.useDate, i18n.language)}</Text></View><View style={{ flex: 1 }}><Text style={ui.text}>{t('bookings.checkOutDate')}</Text><Text style={ui.strong}>{bookingDate(detail.stay.endDate, i18n.language)}</Text></View></View>{detail.stay.roomNo ? <InfoRow title={t('bookings.roomNo')} value={detail.stay.roomNo} /> : null}</View>
        {detail.stay.specialRequests ? <View style={ui.card}><Text style={styles.sectionHeading}>{t('bookings.specialRequest')}</Text><Text style={[ui.text, { color: '#D97706' }]}>{detail.stay.specialRequests}</Text></View> : null}
        {status !== 1 ? <View style={[ui.card, payment === 'hotel' && status === 3 && styles.hotelPayment]}><Text style={styles.sectionHeading}>{t('bookings.billing')}</Text><InfoRow title={t('bookings.subtotal')} value={money(detail.payment.totalAmount)} /><InfoRow title={t('bookings.discount')} value={`− ${money(detail.payment.discountAmount)}`} /><View style={styles.divider} /><InfoRow title={t('bookings.total')} value={money(detail.payment.payAmount)} /><InfoRow title={t('bookings.paymentMethod')} value={t(Number(detail.payment.payMethod) === 4 ? 'bookings.payment.hotel' : `bookings.method.${Number(detail.payment.payMethod)}` , { defaultValue: t('bookings.payment.unknown') })} /><View style={ui.row}><Text style={ui.text}>{t('bookings.paymentStatus')}</Text><BookingBadges order={order} paymentOnly /></View>{status === 3 && can('mark-paid') ? <View style={ui.actions}><BookingButton title={t('bookings.action.mark-paid')} onPress={() => openDialog('mark-paid')} /></View> : null}</View> : null}
      </ScrollView>
      <View style={styles.footer}>
        {can('check-in') ? <View style={styles.footerRow}><BookingButton title={t('bookings.action.check-in')} onPress={() => openDialog('check-in')} /></View> : null}
        {status === 3 && hasBookingPermission(profile, 'check-out') ? <View style={styles.footerRow}><BookingButton title={t('bookings.action.check-out')} tone="orange" disabled={!can('check-out') || busy} onPress={() => openDialog('check-out')} /></View> : null}
        {status === 3 && payment === 'hotel' ? <Text style={styles.hint}>{t('bookings.collectBeforeCheckout')}</Text> : null}
        {status === 4 ? <View style={styles.completed}><BookingIcon name="check" color="#2563EB" /><Text style={styles.completedText}>{t('bookings.completed')}</Text></View> : null}
        {status === 2 && (can('cancel') || hasBookingPermission(profile, 'no-show')) ? <View style={styles.footerRow}>{can('cancel') ? <BookingButton title={t('bookings.action.cancel')} tone="dangerOutline" onPress={() => openDialog('cancel')} /> : null}{hasBookingPermission(profile, 'no-show') ? <BookingButton title={t('bookings.action.no-show')} tone="outline" disabled={!can('no-show')} onPress={() => openDialog('no-show')} /> : null}</View> : null}
        {status === 2 && hasBookingPermission(profile, 'no-show') && !can('no-show') ? <Text style={styles.hint}>{t('bookings.noShowDeadline', { deadline: detail.stay.noShowDeadline || '--' })}</Text> : null}
        <Pressable style={styles.backToList} onPress={() => navigation.navigate('Bookings')} accessibilityRole="button"><Text style={ui.text}>{t('bookings.backToList')}</Text></Pressable>
      </View>
    </> : null}
    <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={closeDialog}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[ui.overlay, { paddingBottom: 20 + insets.bottom }]}><View style={ui.sheet}>
      <Text style={ui.heading}>{dialog === 'message' ? t('bookings.messageGuest') : dialog === 'note' ? t('bookings.staffNotes') : dialog ? t(`bookings.action.${dialog}`) : ''}</Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        {dialog === 'note' ? <><Text style={ui.text}>{t('bookings.notesPrivate')}</Text>{detail?.notes.map((note) => <View key={note.id} style={styles.note}><Text style={ui.text}>{note.content}</Text><Text style={styles.noteMeta}>{note.author_name} · {note.created_at}</Text></View>)}</> : null}
        {dialog === 'message' ? <>{threadLoading ? <ActivityIndicator color={colors.primary} /> : null}{threadFailed ? <BookingButton title={t('bookings.retry')} tone="outline" onPress={() => void loadThread()} /> : null}{thread?.messages.map((message) => <View key={message.id} style={[styles.note, message.sender_type === 2 && styles.staffMessage]}><Text style={ui.text}>{message.content}</Text><Text style={styles.noteMeta}>{message.created_at}</Text></View>)}{thread?.status === 1 ? <Text style={ui.text}>{t('bookings.threadClosed')}</Text> : null}</> : null}
        {dialog && !['note', 'message'].includes(dialog) ? <Text style={ui.text}>{t(`bookings.confirm.${dialog}`)}</Text> : null}
        {dialog === 'mark-paid' && detail ? <View style={{ marginTop: 16 }}><InfoRow title={t('bookings.total')} value={money(detail.payment.payAmount)} /></View> : null}
        {dialog && ['check-in', 'cancel', 'note', 'message'].includes(dialog) ? <TextInput style={[ui.input, (dialog === 'note' || dialog === 'message') && styles.multiline]} value={field} onChangeText={setField} editable={!busy && (dialog !== 'message' || !!thread && thread.status !== 1)} placeholder={t(dialog === 'check-in' ? 'bookings.roomNoOptional' : dialog === 'cancel' ? 'bookings.cancelReason' : dialog === 'note' ? 'bookings.notePlaceholder' : 'bookings.messagePlaceholder')} placeholderTextColor="#94A3B8" multiline={dialog !== 'check-in'} maxLength={dialog === 'check-in' ? 50 : dialog === 'cancel' ? 500 : 2000} textAlignVertical="top" /> : null}
      </ScrollView>
      <View style={ui.actions}><BookingButton title={t('bookings.close')} tone="outline" disabled={busy} onPress={closeDialog} /><BookingButton title={t(busy ? 'bookings.saving' : dialog === 'message' ? 'bookings.send' : dialog === 'note' ? 'bookings.saveNote' : 'bookings.confirmAction')} tone={dialog === 'cancel' || dialog === 'no-show' ? 'danger' : 'primary'} disabled={busy || dialog === 'message' && (!thread || thread.status === 1 || threadLoading || !field.trim())} onPress={() => void submit()} /></View>
    </View></KeyboardAvoidingView></Modal>
  </View></SafeAreaView>;
}
function InfoRow({ title, value }: { title: string; value: string }) { return <View style={ui.row}><Text style={[ui.text, { flex: 1 }]}>{title}</Text><Text style={[ui.strong, { flex: 1, textAlign: 'right' }]}>{value}</Text></View>; }
const styles = StyleSheet.create({
  detailTitle: { flex: 1, fontFamily: fonts.outfitBold, fontSize: 17, color: '#1E293B', textAlign: 'center' }, noteDot: { position: 'absolute', right: 7, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: '#F97316' },
  progress: { flexDirection: 'row', marginBottom: 24, paddingVertical: 8 }, step: { flex: 1, alignItems: 'center', gap: 8, paddingBottom: 10 }, connector: { position: 'absolute', top: 14, left: '72%', width: '56%', height: 2, backgroundColor: '#E2E8F0' }, connectorActive: { backgroundColor: colors.primary }, stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }, stepActive: { backgroundColor: colors.primary }, stepNumber: { fontFamily: fonts.interSemi, color: '#94A3B8' }, stepNumberActive: { color: '#FFFFFF' }, stepLabel: { fontFamily: fonts.interSemi, fontSize: 11, color: '#94A3B8' }, stepLabelActive: { color: colors.primary },
  banner: { padding: 18, borderRadius: 14, marginBottom: 16 }, pending: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }, countdown: { fontFamily: fonts.outfitBold, fontSize: 32, color: '#D97706', textAlign: 'center', marginBottom: 8 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' }, initials: { fontFamily: fonts.outfitBold, fontSize: 16, color: colors.primary }, phone: { borderWidth: 1, borderColor: '#99F6E4', borderRadius: 20, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { fontFamily: fonts.interSemi, fontSize: 11, color: '#94A3B8', marginBottom: 18, textTransform: 'uppercase' }, divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 14 }, hotelPayment: { borderColor: '#FDBA74' }, footer: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 9 }, footerRow: { flexDirection: 'row', gap: 10 }, hint: { fontFamily: fonts.inter, fontSize: 10, color: '#94A3B8', textAlign: 'center', lineHeight: 16 }, backToList: { alignItems: 'center', padding: 8 }, completed: { padding: 13, borderRadius: 10, backgroundColor: '#DBEAFE', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }, completedText: { fontFamily: fonts.interSemi, fontSize: 14, color: '#2563EB' },
  note: { marginTop: 12, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10 }, noteMeta: { fontFamily: fonts.inter, fontSize: 10, color: '#94A3B8', marginTop: 6 }, multiline: { minHeight: 100 }, staffMessage: { backgroundColor: '#F0FDFA' },
});
