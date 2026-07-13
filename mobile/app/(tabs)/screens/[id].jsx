import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { HealthBadge } from '../../../components/screens/HealthBadge';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { Badge } from '../../../components/ui/Badge';
import { PageHeader } from '../../../components/ui/PageHeader';
import { KPI } from '../../../components/ui/KPI';
import { C, F } from '../../../lib/tokens';
import { VENUE_TAXONOMY } from '@adgrid/core';

export default function ScreenDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [screen, setScreen] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: cs }, { data: tok }] = await Promise.all([
        supabase.from('screens').select('*').eq('id', id).single(),
        supabase.from('campaign_screens')
          .select('id, status, campaign:bookings(id, name:campaign_name, advertiser_name, budget)')
          .eq('screen_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.rpc('get_screen_token', { p_screen_id: id }),
      ]);
      setScreen(s);
      setCampaigns(cs || []);
      setToken(tok || null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.purple} />
      </SafeAreaView>
    );
  }
  if (!screen) return null;

  const venueLabel = screen.venue_subtype || VENUE_TAXONOMY[screen.venue_category]?.label || '';
  const activeCampaigns = campaigns.filter(c => c.status === 'approved').length;
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title={screen.name} subtitle={[venueLabel, screen.address_city].filter(Boolean).join(' · ')} />
        <HealthBadge screen={screen} />

        {screen.screen_photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
            {screen.screen_photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Photo ${i + 1} of ${screen.name}`} />
            ))}
          </ScrollView>
        )}

        <View style={styles.kpis}>
          <KPI label="Active Ads" value={String(activeCampaigns)} icon="✅" color={C.green} />
          <KPI label="Pending" value={String(pendingCampaigns)} icon="⏳" color={C.amber} />
        </View>

        <Card style={styles.detailCard}>
          {[
            ['Status', screen.status || 'active'],
            ['Hours', `${screen.operating_hours_start || '—'} – ${screen.operating_hours_end || '—'}`],
            ['Timezone', screen.timezone || '—'],
            ['Token', token || '—'],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.rowLabel, { fontFamily: F.sansMed }]}>{label}</Text>
              <Text style={[styles.rowValue, { fontFamily: F.sans }]} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </Card>

        {campaigns.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Recent Campaigns</Text>
            {campaigns.map(cs => (
              <Card key={cs.id} style={{ marginBottom: 10, padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.sansMed, color: C.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {cs.campaign?.name || 'Campaign'}
                  </Text>
                  <Badge label={cs.status} variant={cs.status === 'approved' ? 'green' : cs.status === 'pending' ? 'amber' : 'muted'} />
                </View>
                <Text style={{ fontFamily: F.sans, color: C.textSub, fontSize: 12, marginTop: 4 }}>
                  {cs.campaign?.advertiser_name}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  photos: { marginVertical: 16, marginHorizontal: -20 },
  photo: { width: 280, height: 160, borderRadius: 8, marginLeft: 20 },
  kpis: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  detailCard: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel: { fontSize: 13, color: C.textMuted },
  rowValue: { fontSize: 13, color: C.text, flex: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 16, color: C.text, marginBottom: 10 },
});
