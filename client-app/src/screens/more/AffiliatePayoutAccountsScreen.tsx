import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  fetchAffiliatePayoutAccounts, saveAffiliatePayoutAccount, setDefaultAffiliatePayoutAccount,
  type AffiliatePayoutAccount, type AffiliatePayoutProvider,
} from '@/api/user';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';

export default function AffiliatePayoutAccountsScreen() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<AffiliatePayoutAccount[]>([]);
  const [providers, setProviders] = useState<AffiliatePayoutProvider[]>([]);
  const [editing, setEditing] = useState<AffiliatePayoutAccount>();
  const [formOpen, setFormOpen] = useState(false);
  const [providerId, setProviderId] = useState(0);
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAffiliatePayoutAccounts();
      setAccounts(result.accounts);
      setProviders(result.providers);
    } catch {
      setAccounts([]);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => {
      setFormOpen(false);
      setHolderName('');
      setAccountNumber('');
    };
  }, [load]));

  const startForm = (account?: AffiliatePayoutAccount) => {
    setEditing(account);
    setProviderId(account?.provider_enabled ? account.provider_id : 0);
    setHolderName('');
    setAccountNumber('');
    setFormOpen(true);
  };

  const save = async () => {
    if (!providerId || !holderName.trim() || !accountNumber.trim()) return;
    setBusy(true);
    try {
      await saveAffiliatePayoutAccount({
        id: editing?.id, version: editing?.version, providerId, holderName, accountNumber,
      });
      setFormOpen(false);
      setHolderName('');
      setAccountNumber('');
      await load();
    } catch {
      // Existing request feedback shows the validation error.
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (id: number) => {
    setBusy(true);
    try {
      await setDefaultAffiliatePayoutAccount(id);
      await load();
    } catch {
      // Existing request feedback shows the validation error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <MorePageLayout title={t('affiliatePayout.title')}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {accounts.map((account) => (
        <View key={account.id} style={[moreShared.panel, styles.panel]}>
          <Text style={styles.title}>{account.provider_name} · •••• {account.number_suffix}</Text>
          <Text>{t(`affiliatePayout.status${account.status}`)}{account.is_default && account.provider_enabled ? ` · ${t('affiliatePayout.default')}` : ''}</Text>
          {account.review_note ? <Text>{account.review_note}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => startForm(account)}>
            <Text style={styles.action}>{t('affiliatePayout.edit')}</Text>
          </Pressable>
          {!!account.provider_enabled && account.status === 1 && !account.is_default ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void makeDefault(account.id)}>
              <Text style={styles.action}>{t('affiliatePayout.makeDefault')}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {!loading && providers.length === 0 ? <Text>{t('affiliatePayout.noProviders')}</Text> : null}
      {providers.length > 0 && !formOpen ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => startForm()}>
          <Text style={styles.action}>{t('affiliatePayout.add')}</Text>
        </Pressable>
      ) : null}
      {formOpen ? (
        <View style={[moreShared.panel, styles.panel]}>
          <Text style={styles.title}>{t('affiliatePayout.provider')}</Text>
          {providers.map((provider) => (
            <Pressable
              key={provider.id} accessibilityRole="radio" accessibilityState={{ checked: provider.id === providerId }}
              disabled={busy} onPress={() => setProviderId(provider.id)}
            >
              <Text style={provider.id === providerId ? styles.action : undefined}>
                {provider.id === providerId ? '✓ ' : ''}{provider.name} · {t(`affiliatePayout.${provider.kind}`)}
              </Text>
            </Pressable>
          ))}
          <TextInput style={styles.input} editable={!busy} value={holderName} maxLength={100}
            accessibilityLabel={t('affiliatePayout.holder')} placeholder={t('affiliatePayout.holder')} onChangeText={setHolderName} />
          <TextInput style={styles.input} editable={!busy} value={accountNumber} maxLength={60} autoCorrect={false}
            accessibilityLabel={t('affiliatePayout.number')} placeholder={t('affiliatePayout.number')} onChangeText={setAccountNumber} />
          <Pressable accessibilityRole="button" disabled={busy || !providerId || !holderName.trim() || !accountNumber.trim()}
            onPress={() => void save()}>
            <Text style={styles.action}>{t('affiliatePayout.submit')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
            setFormOpen(false);
            setHolderName('');
            setAccountNumber('');
          }}>
            <Text style={styles.action}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  title: { color: colors.heading, fontSize: 17, fontWeight: '600' },
  action: { color: colors.primary, paddingVertical: 8 },
  input: { minHeight: 44, borderRadius: 8, backgroundColor: colors.softBlue, paddingHorizontal: 12, color: colors.text },
});
