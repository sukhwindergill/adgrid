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
import { C, F } from '../../../lib/tokens';

export default function AdvertisersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      setLoading(true);
      const screenIds = screens.map(s => s.id);
      if (screenIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase
        .from('campaign_screens')
        .select('status, campaign:campaigns(id, name, budget, advertiser:profiles(id, full_name, email))')
        .in('screen_id', screenIds)
        .in('status', ['approved', 'pending']);
      const byAdvertiser = {};
      (data || []).forEach(cs => {
        const adv = cs.campaign?.advertiser;
        if (!adv) return;
        if (!byAdvertiser[adv.id]) byAdvertiser[adv.id] = { ...adv, campaignNames: [], approved: 0, pending: 0 };
        byAdvertiser[adv.id].campaignNames.push(cs.campaign?.name);
        if (cs.status === 'approved') byAdvertiser[adv.id].approved++;
        if (cs.status === 'pending') byAdvertiser[adv.id].pending++;
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
        ListEmptyComponent={() =>
          loading ? <ActivityIndicator color={C.purple} style={{ margin: 40 }} /> : (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={[{ fontFamily: F.sans, fontSize: 14, color: C.textSub }]}>No advertisers yet</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
