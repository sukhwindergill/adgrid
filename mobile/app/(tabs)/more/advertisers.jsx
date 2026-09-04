import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Btn } from '../../../components/ui/Btn';
import { EmptyState } from '../../../components/ui/EmptyState';
import { C, F } from '../../../lib/tokens';

export default function AdvertisersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      setLoading(true);
      setError(false);
      const screenIds = screens.map(s => s.id);
      if (screenIds.length === 0) { setLoading(false); return; }
      // campaign_screens.campaign_id references bookings(id), not the
      // campaigns (parent) table -- confirmed against the live schema's FK
      // constraints. Embedding `campaigns` here has no relationship for
      // PostgREST to resolve at all, and `campaigns` has no budget column
      // regardless (that's a bookings column). advertiser_name is already
      // denormalized onto bookings (same field web's ApprovalQueue.jsx
      // reads), so only email actually needs the profiles join -- and since
      // bookings has two FKs into profiles (advertiser_id,
      // billed_to_profile_id), that join must name which one to use or
      // PostgREST can't disambiguate it either.
      const { data, error: err } = await supabase
        .from('campaign_screens')
        .select('status, campaign:bookings(id, name:campaign_name, budget, advertiser_id, advertiser_name, advertiser:profiles!bookings_advertiser_id_fkey(email))')
        .in('screen_id', screenIds)
        .in('status', ['approved', 'pending']);
      if (err) { setError(true); setLoading(false); return; }
      const byAdvertiser = {};
      (data || []).forEach(cs => {
        const campaign = cs.campaign;
        const advId = campaign?.advertiser_id;
        if (!advId) return;
        if (!byAdvertiser[advId]) {
          byAdvertiser[advId] = { id: advId, full_name: campaign.advertiser_name, email: campaign.advertiser?.email, campaignNames: [], approved: 0, pending: 0 };
        }
        byAdvertiser[advId].campaignNames.push(campaign.name);
        if (cs.status === 'approved') byAdvertiser[advId].approved++;
        if (cs.status === 'pending') byAdvertiser[advId].pending++;
      });
      setAdvertisers(Object.values(byAdvertiser));
      setLoading(false);
    }
    load();
  }, [profile?.id, screens]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        ListHeaderComponent={() => (
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Btn variant="ghost" onPress={() => router.back()} style={{ paddingHorizontal: 0, marginBottom: 12 }}>← Back</Btn>
            <PageHeader title="Advertisers" subtitle="Brands running on your screens" />
          </View>
        )}
        data={advertisers}
        keyExtractor={a => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[{ fontFamily: F.sansSemi, fontSize: 15, color: C.text, flex: 1 }]} numberOfLines={1}>{item.full_name}</Text>
              {item.pending > 0 && <Badge label={`${item.pending} pending`} variant="amber" />}
            </View>
            <Text style={[{ fontFamily: F.sans, fontSize: 12, color: C.textSub }]}>{item.email}</Text>
            <Text style={[{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 }]}>
              {item.approved} approved · {item.campaignNames.slice(0, 2).join(', ')}{item.campaignNames.length > 2 ? '…' : ''}
            </Text>
          </Card>
        )}
        ListEmptyComponent={() => {
          if (loading) return <ActivityIndicator color={C.purple} style={{ margin: 40 }} />;
          if (error) return <EmptyState icon="⚠️" title="Couldn't load advertisers" subtitle="Check your connection and try again." />;
          return <EmptyState icon="🏢" title="No advertisers yet" subtitle="Advertisers will appear here once they book a campaign on one of your screens" />;
        }}
      />
    </SafeAreaView>
  );
}
