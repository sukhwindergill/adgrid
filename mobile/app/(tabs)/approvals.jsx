import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useApprovals } from '../../hooks/useApprovals';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { C, F } from '../../lib/tokens';

export default function ApprovalsScreen() {
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const screenIds = screens.map(s => s.id);
  const { pending, loading, error, approve, reject } = useApprovals(profile?.id, screenIds);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.container}>
        <PageHeader
          title="Approvals"
          subtitle={pending.length > 0 ? `${pending.length} ad${pending.length !== 1 ? 's' : ''} awaiting review` : 'All caught up'}
        />
        <ErrorBanner message={error} />
        {loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : pending.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={[styles.emptyTitle, { fontFamily: F.sansBold }]}>All caught up</Text>
            <Text style={[styles.emptySub, { fontFamily: F.sans }]}>No ads pending approval</Text>
          </View>
        ) : (
          <FlatList
            data={pending}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ApprovalCard
                row={item}
                onApprove={() => approve(item.id, item.campaign_id, item.campaign?.start_when)}
                onReject={(reason) => reject(item.id, reason)}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: C.text },
  emptySub: { fontSize: 14, color: C.textSub },
});
