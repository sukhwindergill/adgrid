import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useScreens } from '../../hooks/useScreens';
import { KPI } from '../../components/ui/KPI';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { HealthBadge } from '../../components/screens/HealthBadge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { C, F } from '../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { totalScreens, liveScreens, pendingApprovals, revenueThisMonth, loading } = useDashboard(profile?.id);
  const { screens, loading: screensLoading, refetch } = useScreens(profile?.id);
  const firstName = profile?.full_name?.split(' ')[0] || 'Operator';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading || screensLoading} onRefresh={refetch} tintColor={C.purple} />}
      >
        <PageHeader title={`Hello, ${firstName}`} subtitle="Your network at a glance" />

        {loading ? (
          <View style={styles.kpis}><SkeletonCard rows={2} /><SkeletonCard rows={2} /></View>
        ) : (
          <View style={styles.kpis}>
            <KPI label="Total Screens" value={String(totalScreens)} icon="📺" />
            <KPI label="Live Now" value={String(liveScreens)} icon="🟢" color={C.green} />
            <KPI label="Pending Ads" value={String(pendingApprovals)} icon="⏳" color={pendingApprovals > 0 ? C.amber : C.textMuted} />
            <KPI label="Revenue (MTD)" value={formatCurrency(revenueThisMonth, 'cad')} icon="💰" color={C.green} />
          </View>
        )}

        {pendingApprovals > 0 && (
          <Card style={[styles.alertCard, { borderColor: C.amberBorder, backgroundColor: C.amberSoft }]}>
            <Text style={[styles.alertText, { fontFamily: F.sansMed }]}>
              ⚠ {pendingApprovals} ad{pendingApprovals !== 1 ? 's' : ''} awaiting your approval
            </Text>
            <Btn variant="secondary" size="sm" onPress={() => router.push('/(tabs)/approvals')} style={{ marginTop: 10 }}>
              Review Now
            </Btn>
          </Card>
        )}

        <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Your screens</Text>
        {screensLoading ? <SkeletonCard rows={2} /> : screens.slice(0, 5).map(screen => (
          <Card key={screen.id} style={styles.screenRow} onPress={() => router.push(`/(tabs)/screens/${screen.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.screenName, { fontFamily: F.sansMed }]} numberOfLines={1}>{screen.name}</Text>
              <HealthBadge screen={screen} />
            </View>
          </Card>
        ))}
        {screens.length > 5 && (
          <Btn variant="ghost" onPress={() => router.push('/(tabs)/screens')} style={{ alignSelf: 'center', marginTop: 4 }}>
            View all {screens.length} screens →
          </Btn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  alertCard: { borderWidth: 1, marginBottom: 20, padding: 14 },
  alertText: { fontSize: 14, color: C.amber },
  sectionTitle: { fontSize: 16, color: C.text, marginBottom: 10 },
  screenRow: { padding: 12, marginBottom: 8 },
  screenName: { fontSize: 14, color: C.text, flex: 1, marginRight: 10 },
});
