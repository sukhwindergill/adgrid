import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCampaignDetail } from '../../../hooks/useCampaignDetail';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { Badge } from '../../../components/ui/Badge';
import { KPI } from '../../../components/ui/KPI';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { STATUS_META, canPause, canResume } from '../../../lib/campaignStatus';
import { C, F } from '../../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

const SCREEN_STATUS = {
  pending: { label: 'In review', variant: 'amber' },
  approved: { label: 'Approved', variant: 'green' },
  auto_approved: { label: 'Approved', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
};

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const {
    campaign, screens, screenNames, displayStatus, rejections, metrics,
    loading, error, updating, pause, resume, refetch,
  } = useCampaignDetail(id);

  function confirmPause() {
    Alert.alert('Pause campaign?', 'Your ads stop playing on every screen until you resume.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Pause', style: 'destructive', onPress: () => pause() },
    ]);
  }

  if (loading && !campaign) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ActivityIndicator color={C.purple} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <EmptyState icon="⚠️" title="Couldn't load this campaign" subtitle={error ?? 'Try again later.'} />
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[displayStatus] ?? STATUS_META.pending;
  const dates = [campaign.start_date, campaign.end_date].filter(Boolean).join(' → ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={C.purple} />}
      >
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to campaigns" style={styles.back}>
          <Text style={[styles.backText, { fontFamily: F.sansMed }]}>‹ Campaigns</Text>
        </TouchableOpacity>
        <PageHeader title={campaign.campaign_name || 'Untitled campaign'} subtitle={dates || undefined} />
        <View style={{ marginTop: -12, marginBottom: 16 }}>
          <Badge label={meta.label} variant={meta.variant} dot />
        </View>

        <ErrorBanner message={error} />

        {rejections.length > 0 && (
          <Card style={styles.rejectCard}>
            <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi, color: C.red }]}>Rejected by operators</Text>
            {rejections.map(r => (
              <Text key={r.screenId} style={[styles.rejection, { fontFamily: F.sans }]}>
                {r.screenName}: {r.reason}
              </Text>
            ))}
          </Card>
        )}

        <View style={styles.kpis}>
          <KPI label="Plays" value={metrics.plays.toLocaleString()} />
          <KPI label="Impressions" value={metrics.impressions.toLocaleString()} />
        </View>
        <View style={styles.kpis}>
          <KPI label="Scans" value={metrics.scans.toLocaleString()} color={C.purple} />
          <KPI
            label="Spend"
            value={formatCurrency(campaign.spent ?? 0, campaign.currency)}
            sub={`of ${formatCurrency(campaign.budget ?? 0, campaign.currency)}`}
          />
        </View>

        {(canPause(campaign.status) || canResume(campaign.status)) && (
          <View style={styles.actions}>
            {canPause(campaign.status) && (
              <Btn variant="secondary" onPress={confirmPause} loading={updating}>Pause campaign</Btn>
            )}
            {canResume(campaign.status) && (
              <Btn onPress={() => resume()} loading={updating}>Resume campaign</Btn>
            )}
          </View>
        )}

        {screens.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Screens</Text>
            {screens.map((s, idx) => {
              const st = SCREEN_STATUS[s.status] ?? { label: s.status, variant: 'muted' };
              return (
                <View key={s.screen_id} style={[styles.screenRow, idx < screens.length - 1 && styles.rowBorder]}>
                  <Text style={[styles.screenName, { fontFamily: F.sans }]} numberOfLines={1}>
                    {screenNames[s.screen_id] ?? 'Screen'}
                  </Text>
                  <Badge label={st.label} variant={st.variant} />
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: C.purple },
  kpis: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actions: { marginTop: 4, marginBottom: 16 },
  rejectCard: { marginBottom: 16, backgroundColor: C.redSoft, borderColor: C.redBorder, gap: 6 },
  rejection: { fontSize: 13, color: C.red },
  sectionTitle: { fontSize: 14, color: C.text, marginBottom: 8 },
  screenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  screenName: { flex: 1, fontSize: 14, color: C.text },
});
