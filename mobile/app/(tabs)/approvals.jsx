import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useApprovals } from '../../hooks/useApprovals';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { C } from '../../lib/tokens';

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
          <EmptyState icon="✅" title="All caught up" subtitle="No ads pending approval" />
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
});
