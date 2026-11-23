import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { LongStayQuote } from '@/types/models';
import { formatMoney } from '@/utils/format';

export default function LongStayPrice({ quote }: { quote: LongStayQuote }) {
  const { t } = useTranslation();
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{t('hotels.longStay.offer', { percent: quote.rate })}</Text>
      <View style={styles.amounts}>
        <Text style={styles.original}>{formatMoney(quote.original, quote.currency)}</Text>
        <Text style={styles.price}>{formatMoney(quote.total, quote.currency)}</Text>
      </View>
      <Text style={styles.label}>{t('hotels.longStay.saved', {
        amount: formatMoney(quote.discount, quote.currency), nights: quote.nights,
      })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.tintBg, borderRadius: 12, padding: 10, gap: 4 },
  amounts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: fonts.inter, color: colors.primary },
  original: { color: colors.muted, textDecorationLine: 'line-through' },
  price: { fontFamily: fonts.interSemi, color: colors.body },
});
