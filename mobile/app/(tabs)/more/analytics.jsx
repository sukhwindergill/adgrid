import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { supabase } from '../../../lib/supabase';
import { KPI } from '../../../components/ui/KPI';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Btn } from '../../../components/ui/Btn';
import { C, F } from '../../../lib/tokens';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens, loading: screensLoading } = useScreens(profile?.id);
  const [stats, setStats] = useState({ totalImpressions: 0, activeCampaigns: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || screensLoading) return;
    async function load() {
      setLoading(true);
      const screenIds = screens.map(s => s.id);
      if (screenIds.length === 0) { setLoading(false); return; }
      // impressions doesn't exist as a table -- impression_events is the
      // real one, and it stores aggregated 30s-window rows (people_count
      // per window), not one row per impression, so a plain row count would
      // be wrong even with the right table name. Sum people_count instead,
      // matching how web's Analytics.jsx computes the same "Total
      // Impressions" figure. No date-range filter here (unlike web's
      // period selector) -- this screen shows an all-time total by design;
      // worth revisiting with a server-side aggregate if a screen
      // accumulates enough windows for this to become a lot of rows.
      const { data: impressionRows } = await supabase
        .from('impression_events').select('people_count').in('screen_id', screenIds);
      const impressions = (impressionRows || []).reduce((a, r) => a + (r.people_count || 0), 0);
      const { count: active } = await supabase
        .from('campaign_screens').select('id', { count: 'exact', head: true }).in('screen_id', screenIds).eq('status', 'approved');
      setStats({ totalImpressions: impressions || 0, activeCampaigns: active || 0 });
      setLoading(false);
    }
    load();
  }, [profile?.id, screens, screensLoading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Analytics" subtitle="Performance across your screen network" />
        {loading ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
          <>
            <View style={styles.kpis}>
              <KPI label="Total Impressions" value={stats.totalImpressions.toLocaleString()} icon="👁" />
              <KPI label="Active Campaigns" value={String(stats.activeCampaigns)} icon="📋" color={C.green} />
            </View>
            <Card>
              <Text style={[{ fontFamily: F.sansSemi, fontSize: 15, color: C.text, marginBottom: 8 }]}>About Impressions</Text>
              <Text style={[{ fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 20 }]}>
                Impressions are measured by your screen's camera, counting real people who looked at the display — not just ad plays. Only screens with the camera add-on report a number here.
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
  kpis: { flexDirection: 'row', gap: 10, marginBottom: 20 },
});
