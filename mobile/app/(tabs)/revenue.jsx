import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useRevenue } from '../../hooks/useRevenue';
import { KPI } from '../../components/ui/KPI';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { PillFilter } from '../../components/ui/PillFilter';
import { C, F } from '../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

const PERIODS = [
  { label: '30d', value: 30 }, { label: '90d', value: 90 },
  { label: '365d', value: 365 }, { label: 'All', value: null },
];

export default function RevenueScreen() {
  const [period, setPeriod] = useState(30);
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const screenIds = screens.map(s => s.id);
  const { campaigns, loading, totalRevenue } = useRevenue(profile?.id, screenIds, period);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <PageHeader title="Revenue" subtitle="Your earnings from approved campaigns" />
            <PillFilter options={PERIODS} value={period} onChange={setPeriod} />
            <View style={styles.kpis}>
              <KPI label="Your Earnings" value={formatCurrency(totalRevenue, 'cad')} icon="💰" color={C.green} />
              <KPI label="Campaigns" value={String(campaigns.length)} icon="📋" />
            </View>
          </View>
        )}
        data={campaigns}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[{ fontFamily: F.sansMed, color: C.text, fontSize: 14, flex: 1 }]} numberOfLines={1}>
                {item.campaign?.name}
              </Text>
              <Text style={[{ fontFamily: F.sansSemi, color: C.green, fontSize: 14 }]}>
                +{formatCurrency((item.campaign?.budget || 0) * 0.70, 'cad')}
              </Text>
            </View>
            <Text style={[{ fontFamily: F.sans, color: C.textSub, fontSize: 12 }]}>{item.campaign?.advertiser?.full_name}</Text>
          </Card>
        )}
        ListEmptyComponent={() =>
          loading ? <ActivityIndicator color={C.purple} style={{ margin: 40 }} /> : (
            <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
              <Text style={{ fontSize: 48 }}>💰</Text>
              <Text style={[{ fontFamily: F.sansBold, fontSize: 18, color: C.text }]}>No revenue yet</Text>
              <Text style={[{ fontFamily: F.sans, fontSize: 14, color: C.textSub }]}>Approved campaigns will appear here</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  kpis: { flexDirection: 'row', gap: 10, marginBottom: 20 },
});
