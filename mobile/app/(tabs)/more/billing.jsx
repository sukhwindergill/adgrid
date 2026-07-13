import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useBilling } from '../../../hooks/useBilling';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { C, F } from '../../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

const PAYOUT_BADGE_VARIANT = { paid: 'green', pending: 'amber', in_transit: 'amber', failed: 'red', canceled: 'red' };

export default function BillingScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useBilling();
  const [connecting, setConnecting] = useState(false);

  const connected = data?.connectStatus === 'active';
  const payouts = data?.payouts ?? [];

  async function handleConnectStripe() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: 'adgrid://billing', state: Math.random().toString(36) }),
      });
      const { url } = await res.json();
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not connect to Stripe. Try again.');
    }
    setConnecting(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.purple} />}
      >
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Billing" subtitle="Payout settings and history" />
        <ErrorBanner message={error} />
        {loading && !data ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
          <>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Stripe Payout Account</Text>
              {connected ? (
                <Badge label="Connected" variant="green" />
              ) : (
                <>
                  <Badge label="Not connected" variant="amber" />
                  <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                    Connect Stripe to receive payouts from approved campaigns.
                  </Text>
                  <Btn onPress={handleConnectStripe} loading={connecting} size="lg" style={{ marginTop: 14 }}>
                    Connect Stripe →
                  </Btn>
                </>
              )}
            </Card>

            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Payout rate</Text>
              <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                You receive 70% of the campaign budget for each approved ad. Payouts processed monthly.
              </Text>
            </Card>

            <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Payout History</Text>
            {!connected ? (
              <Card style={styles.card}>
                <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                  Connect your Stripe account to see payout history.
                </Text>
              </Card>
            ) : payouts.length === 0 ? (
              <Card style={styles.card}>
                <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                  No payouts yet. Your first payout will appear here once initiated.
                </Text>
              </Card>
            ) : (
              payouts.map(p => (
                <Card key={p.id} style={styles.payoutRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payoutAmount, { fontFamily: F.sansSemi }]}>
                      {formatCurrency(p.amount, p.currency)}
                    </Text>
                    <Text style={[styles.payoutDate, { fontFamily: F.sans }]}>{p.arrival_date}</Text>
                  </View>
                  <Badge label={p.status} variant={PAYOUT_BADGE_VARIANT[p.status] || 'muted'} />
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  card: { marginBottom: 16, gap: 8 },
  cardTitle: { fontSize: 15, color: C.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: C.textSub, lineHeight: 20, marginTop: 4 },
  sectionTitle: { fontSize: 16, color: C.text, marginBottom: 10, marginTop: 4 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: 14 },
  payoutAmount: { fontSize: 15, color: C.text, marginBottom: 2 },
  payoutDate: { fontSize: 12, color: C.textSub },
});
