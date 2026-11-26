import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchFavoriteList, removeFavorite } from '@/api/user';
import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import type { FavoriteItem } from '@/types/models';

const PAGE_SIZE = 20;
const DELETE_WIDTH = 64;

export default function SavedHotelsScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((state) => state.showToast);
  const lite = useCommonStore((state) => state.liteMode);
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const request = useRef(0);
  const deletePending = useRef(false);

  const load = useCallback(async (next = 1) => {
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const result = await fetchFavoriteList({ page: next, pageSize: PAGE_SIZE });
      if (request.current !== id) return;
      setItems((current) => next === 1 ? result.list : [...current, ...result.list.filter((item) => !current.some((old) => old.id === item.id))]);
      setPage(next);
      setTotal(result.total);
    } catch {
      if (request.current === id) setFailed(true);
    } finally {
      if (request.current === id) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setOpenId(null);
    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !deletePending.current) void load();
    });
    return () => {
      ++request.current;
      subscription.remove();
    };
  }, [load]));

  const remove = async (item: FavoriteItem) => {
    if (deletePending.current) return;
    deletePending.current = true;
    setRemoving(true);
    try {
      await removeFavorite(item.property_id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setOpenId(null);
      showToast(t('myPick.savedHotels.removed'));
      // Re-read from page one because removing a row shifts subsequent pages.
      await load();
    } catch {
      showToast(t('myPick.savedHotels.removeFailed'));
    } finally {
      deletePending.current = false;
      setRemoving(false);
    }
  };

  return (
    <MorePageLayout title={t('myPick.savedHotels.title')} headerRight={
      <Pressable accessibilityRole="button" disabled={loading || removing} onPress={() => void load()}>
        <Text style={styles.action}>{t('myPick.savedHotels.refresh')}</Text>
      </Pressable>
    }>
      <View style={styles.list}>
        {items.map((item) => (
          <SavedHotelRow
            key={item.id}
            item={item}
            lite={lite}
            open={openId === item.id}
            removing={removing}
            setOpen={(open) => setOpenId(open ? item.id : null)}
            onRemove={() => void remove(item)}
            onOpen={() => lite
              ? nav.navigate('HotelDetailLite', { id: item.property_id })
              : nav.navigate('HotelDetail', { propertyId: item.property_id })}
          />
        ))}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? (
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={styles.action}>{t('myPick.savedHotels.retry')}</Text>
          </Pressable>
        ) : null}
        {!loading && !failed && items.length === 0 ? <Text style={styles.empty}>{t('myPick.savedHotels.empty')}</Text> : null}
        {!loading && !failed && page * PAGE_SIZE < total ? (
          <Pressable accessibilityRole="button" disabled={removing} onPress={() => void load(page + 1)}>
            <Text style={styles.action}>{t('myPick.savedHotels.loadMore')}</Text>
          </Pressable>
        ) : null}
      </View>
    </MorePageLayout>
  );
}

interface SavedHotelRowProps {
  item: FavoriteItem;
  lite: boolean;
  open: boolean;
  removing: boolean;
  setOpen: (open: boolean) => void;
  onRemove: () => void;
  onOpen: () => void;
}

function SavedHotelRow({ item, lite, open, removing, setOpen, onRemove, onOpen }: SavedHotelRowProps) {
  const { t } = useTranslation();
  const gestures = useRef({ setOpen, open, removing });
  gestures.current = { setOpen, open, removing };
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
      const state = gestures.current;
      return !state.removing && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5
        && (dx < 0 || state.open);
    },
    onPanResponderRelease: (_, { dx }) => {
      if (dx < -22) gestures.current.setOpen(true);
      if (dx > 22) gestures.current.setOpen(false);
    },
  })).current;

  return (
    <View style={styles.row}>
      {open ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('myPick.savedHotels.remove')}
          disabled={removing} onPress={onRemove} style={styles.remove}>
          <HomeIcon name="delete" size={22} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <View {...responder.panHandlers} style={[styles.content, open && styles.open]}>
        <Pressable accessibilityRole="button" disabled={item.available === false} onPress={onOpen} style={[styles.hotel, item.available === false && styles.unavailable]}>
          <CoverImage uri={item.cover_image} width={76} height={66} label={item.property_name} />
          <View style={styles.info}>
            <Text style={[styles.name, lite && styles.lite]} numberOfLines={2}>{item.property_name}</Text>
            {item.available === false ? <Text style={styles.address}>{t('myPick.savedHotels.unavailable')}</Text> : null}
            {item.address ? <Text style={styles.address} numberOfLines={2}>{item.address}</Text> : null}
            {item.star_level > 0 ? <Text style={styles.address}>{'★'.repeat(Math.min(5, item.star_level))}</Text> : null}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('myPick.savedHotels.remove')}
          disabled={removing} onPress={() => setOpen(!open)} style={styles.reveal}>
          <Text style={styles.action}>⋯</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { position: 'relative', overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface },
  content: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  open: { transform: [{ translateX: -DELETE_WIDTH }] },
  unavailable: { backgroundColor: '#EBEBEB', opacity: 0.65 },
  hotel: { flex: 1, minWidth: 0, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.body },
  lite: { fontSize: 20 },
  address: { fontFamily: fonts.inter, fontSize: 14, color: colors.muted },
  reveal: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  remove: { position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_WIDTH,
    backgroundColor: colors.hot, alignItems: 'center', justifyContent: 'center' },
  action: { textAlign: 'center', padding: 8, fontFamily: fonts.interSemi, color: colors.primary },
  empty: { textAlign: 'center', fontFamily: fonts.inter, color: colors.muted },
});
