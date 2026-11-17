/**
 * mTrip 平台客服聊天(Chat type 2,Consumer App PRD v1.0.6 模块 13)专用的几块界面,
 * 由 `ChatScreen` 在会话类型为 2 时插入:
 * - `SupportIntro`:欢迎语 + 当前预订上下文(可切换 / 一般咨询)+ 最近浏览的酒店
 * - `BookingPicker`:选当前 / 历史预订或一般咨询的底部弹层
 * - `SupportRating`:会话结束后的 1-5 星评价(可选备注)与「发起新会话」
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { supportBookings, type ChatConversation, type SupportBooking } from '@/api/chat';
import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { resolveMediaUri } from '@/utils/media';
import type { RecentHotel } from '@/utils/recentHotels';

function stayDates(b: SupportBooking): string {
  if (!b.use_date) return '';
  return b.end_date && b.end_date !== b.use_date ? `${b.use_date} → ${b.end_date}` : b.use_date;
}

export function SupportIntro({ conversation, recent, onPickBooking, onRecent }: {
  conversation: ChatConversation;
  recent: RecentHotel[];
  onPickBooking: () => void;
  onRecent: (hotel: RecentHotel) => void;
}) {
  const { t } = useTranslation();
  const booking = conversation.support?.booking ?? null;
  const active = conversation.status === 0;
  return (
    <View style={styles.intro}>
      <View style={styles.welcome}>
        <View style={styles.welcomeIcon}><HomeIcon name="headset" size={20} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.welcomeTitle}>{t('chat.supportChat.welcomeTitle')}</Text>
          <Text style={styles.welcomeBody}>{t('chat.supportChat.welcome')}</Text>
        </View>
      </View>

      <Pressable style={styles.context} disabled={!active} onPress={onPickBooking} accessibilityRole="button" accessibilityLabel={t('chat.supportChat.selectBooking')} testID="support-booking-context">
        <View style={styles.flex}>
          <Text style={styles.contextLabel}>{booking ? t('chat.supportChat.booking') : t('chat.supportChat.general')}</Text>
          {booking ? (
            <>
              <Text style={styles.contextTitle} numberOfLines={1}>{booking.goods_name}</Text>
              <Text style={styles.contextMeta} numberOfLines={1}>
                {booking.order_no}{stayDates(booking) ? ' · ' + stayDates(booking) : ''} · {t(`chat.supportChat.scene.${booking.scene}`)}
              </Text>
            </>
          ) : (
            <Text style={styles.contextMeta}>{t('chat.supportChat.generalHint')}</Text>
          )}
        </View>
        {active ? <Text style={styles.link}>{booking ? t('chat.supportChat.changeBooking') : t('chat.supportChat.selectBooking')}</Text> : null}
      </Pressable>

      {recent.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.sectionLabel}>{t('chat.supportChat.recent')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
            {recent.map((hotel) => (
              <Pressable key={hotel.propertyId} style={styles.hotel} disabled={!active} onPress={() => onRecent(hotel)} accessibilityLabel={hotel.name}>
                {hotel.image ? <Image source={{ uri: resolveMediaUri(hotel.image) ?? undefined }} style={styles.hotelImage} /> : <View style={[styles.hotelImage, styles.hotelPlaceholder]}><HomeIcon name="bed" size={18} color={colors.primary} /></View>}
                <Text style={styles.hotelName} numberOfLines={2}>{hotel.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function BookingPicker({ visible, selected, onClose, onSelect }: {
  visible: boolean;
  selected: number;
  onClose: () => void;
  onSelect: (orderId: number) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SupportBooking[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setFailed(false);
    supportBookings().then((rows) => { if (alive) setList(rows); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [visible]);
  const current = (list ?? []).filter((b) => b.current);
  const past = (list ?? []).filter((b) => !b.current);
  const row = (b: SupportBooking) => (
    <Pressable key={b.id} style={[styles.option, selected === b.id && styles.optionOn]} onPress={() => onSelect(b.id)} testID={`support-booking-${b.id}`}>
      <Text style={styles.contextTitle} numberOfLines={1}>{b.goods_name}</Text>
      <Text style={styles.contextMeta} numberOfLines={1}>{b.order_no}{stayDates(b) ? ' · ' + stayDates(b) : ''} · {t(`chat.supportChat.scene.${b.scene}`)}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.mask} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{t('chat.supportChat.pickerTitle')}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('chat.cancel')}><Text style={styles.close}>×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Pressable style={[styles.option, selected === 0 && styles.optionOn]} onPress={() => onSelect(0)} testID="support-booking-general">
            <Text style={styles.contextTitle}>{t('chat.supportChat.generalOption')}</Text>
          </Pressable>
          {list === null && !failed ? <ActivityIndicator color={colors.primary} style={{ padding: 20 }} /> : null}
          {failed ? <Text style={styles.empty}>{t('chat.error')}</Text> : null}
          {list !== null && !list.length ? <Text style={styles.empty}>{t('chat.supportChat.noBookings')}</Text> : null}
          {current.length > 0 && <Text style={styles.sectionLabel}>{t('chat.supportChat.current')}</Text>}
          {current.map(row)}
          {past.length > 0 && <Text style={styles.sectionLabel}>{t('chat.supportChat.past')}</Text>}
          {past.map(row)}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SupportRating({ conversation, onSubmit, onNewChat }: {
  conversation: ChatConversation;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onNewChat: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const rated = conversation.rating || 0;
  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    try { await onSubmit(rating, comment.trim()); } finally { setBusy(false); }
  }
  return (
    <View style={styles.rating}>
      <Text style={styles.contextMeta}>{t('chat.supportChat.ended')}</Text>
      {rated > 0 ? (
        <Text style={styles.ratedText}>{'★'.repeat(rated)} {t('chat.supportChat.rated', { rating: rated })}</Text>
      ) : (
        <>
          <Text style={styles.welcomeTitle}>{t('chat.supportChat.rateTitle')}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n}/5`} testID={`support-star-${n}`}>
                <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.comment} value={comment} onChangeText={setComment} maxLength={500} multiline placeholder={t('chat.supportChat.ratePlaceholder')} accessibilityLabel={t('chat.supportChat.ratePlaceholder')} />
          <Pressable style={[styles.primary, (!rating || busy) && styles.disabled]} disabled={!rating || busy} onPress={() => void submit()} testID="support-rate-submit">
            <Text style={styles.primaryText}>{t('chat.supportChat.rateSubmit')}</Text>
          </Pressable>
        </>
      )}
      <Pressable style={styles.secondary} onPress={onNewChat} testID="support-new-chat">
        <Text style={styles.link}>{t('chat.supportChat.newChat')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: 12 },
  welcome: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.tintBg },
  welcomeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softBlue },
  welcomeTitle: { fontFamily: fonts.outfitSemi, fontSize: 16, color: colors.heading, marginBottom: 4 },
  welcomeBody: { fontFamily: fonts.inter, fontSize: 13, lineHeight: 20, color: '#323e54' },
  context: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e4e9f1', backgroundColor: '#fafbfe' },
  contextLabel: { fontFamily: fonts.interSemi, fontSize: 11, color: colors.label, textTransform: 'uppercase' },
  contextTitle: { fontFamily: fonts.interSemi, fontSize: 14, color: colors.heading, marginTop: 2 },
  contextMeta: { fontFamily: fonts.inter, fontSize: 12, color: '#8791a5', marginTop: 2 },
  link: { fontFamily: fonts.interSemi, fontSize: 12, color: colors.primary },
  recent: { gap: 8 },
  sectionLabel: { fontFamily: fonts.interSemi, fontSize: 12, color: colors.label, marginTop: 4 },
  recentRow: { gap: 10 },
  hotel: { width: 112, gap: 6 },
  hotelImage: { width: 112, height: 72, borderRadius: 10, backgroundColor: colors.tintBg },
  hotelPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  hotelName: { fontFamily: fonts.inter, fontSize: 12, color: colors.body },
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '75%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  sheetTitle: { fontFamily: fonts.outfitSemi, fontSize: 18, color: colors.heading, flex: 1 },
  close: { fontSize: 26, color: '#8e9bb2' },
  sheetBody: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  option: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e4e9f1' },
  optionOn: { borderColor: colors.primary, backgroundColor: '#f4f7ff' },
  empty: { textAlign: 'center', padding: 16, color: '#9ba6b8', fontFamily: fonts.inter, fontSize: 13 },
  rating: { gap: 10, alignItems: 'center', paddingVertical: 4 },
  ratedText: { fontFamily: fonts.interSemi, fontSize: 13, color: colors.heading },
  stars: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 32, color: '#d5dbe6' },
  starOn: { color: colors.star },
  comment: { alignSelf: 'stretch', minHeight: 56, maxHeight: 110, borderWidth: 1, borderColor: '#e4e9f1', borderRadius: 12, padding: 10, fontFamily: fonts.inter, fontSize: 13, color: '#323e54', textAlignVertical: 'top' },
  primary: { alignSelf: 'stretch', height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.interSemi, fontSize: 14, color: '#fff' },
  disabled: { opacity: 0.4 },
  secondary: { paddingVertical: 6 },
});
