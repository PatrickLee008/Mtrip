import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { addFavorite, fetchFavoriteStatus, removeFavorite } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

export default function SaveHotelButton({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useUserStore((state) => state.isLogin ? state.profile?.id ?? 0 : 0);
  const toast = useCommonStore((state) => state.showToast);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  useFocusEffect(useCallback(() => {
    const current = ++request.current;
    setSaved(null);
    if (userId) {
      void fetchFavoriteStatus(propertyId).then((result) => {
        if (current === request.current) setSaved(result.saved);
      }).catch(() => undefined);
    }
    return () => { ++request.current; };
  }, [propertyId, userId]));

  const toggle = async () => {
    if (!userId) {
      navigation.navigate('Login');
      return;
    }
    if (busy) return;
    setBusy(true);
    const current = ++request.current;
    try {
      const wasSaved = saved ?? (await fetchFavoriteStatus(propertyId)).saved;
      if (wasSaved) await removeFavorite(propertyId);
      else await addFavorite(propertyId);
      if (current !== request.current) return;
      setSaved(!wasSaved);
      toast(t(wasSaved ? 'myPick.savedHotels.removed' : 'myPick.savedHotels.added'));
    } catch {
      if (current === request.current) toast(t('myPick.savedHotels.updateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(saved), disabled: busy }}
      accessibilityLabel={t(saved ? 'myPick.savedHotels.remove' : 'myPick.savedHotels.add')}
      onPress={() => void toggle()} disabled={busy} style={styles.button}>
      <HomeIcon name={saved ? 'heartFilled' : 'heart'} size={21} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.tintBg },
});
