import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { C, F } from '../../../lib/tokens';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

export default function BillingScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [connectStatus, setConnectStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('profiles').select('stripe_connect_id, payout_enabled, default_currency').eq('id', profile.id).single()
      .then(({ data }) => { setConnectStatus(data); setLoading(false); });
  }, [profile?.id]);

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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Billing" subtitle="Payout settings and history" />
        {loading ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
          <>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Stripe Payout Account</Text>
              {connectStatus?.payout_enabled ? (
                <>
                  <Badge label="Connected" variant="green" />
                  <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                    Currency: {(connectStatus.default_currency || 'CAD').toUpperCase()}
                  </Text>
                </>
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
});
